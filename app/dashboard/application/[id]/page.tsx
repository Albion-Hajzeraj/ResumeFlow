'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader as Loader2, ArrowLeft, RefreshCw, Download, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase, type Database } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { downloadTextFile } from '@/lib/download';
import { analyzeKeywords, generateCoverLetter, optimizeResume, parseResumeText } from '@/lib/ai-service';
import type { KeywordAnalysis, ResumeData } from '@/lib/ai-service';

type JobApplication = Database['public']['Tables']['job_applications']['Row'];
type ResumeRow = Database['public']['Tables']['resumes']['Row'];
type CoverLetterRow = Database['public']['Tables']['cover_letters']['Row'];
type OptimizedResumeRow = Database['public']['Tables']['optimized_resumes']['Row'];

const STATUSES = ['draft', 'applied', 'interview', 'offer', 'rejected'] as const;

function maxVersion(rows: Array<{ version: number }>) {
  return rows.reduce((acc, r) => Math.max(acc, r.version || 1), 0);
}

export default function ApplicationPage() {
  const params = useParams();
  const applicationId = String(params?.id || '');
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [resume, setResume] = useState<ResumeRow | null>(null);
  const [coverLetters, setCoverLetters] = useState<CoverLetterRow[]>([]);
  const [optimizedResumes, setOptimizedResumes] = useState<OptimizedResumeRow[]>([]);

  const [selectedCoverLetterId, setSelectedCoverLetterId] = useState<string>('');
  const [selectedOptimizedId, setSelectedOptimizedId] = useState<string>('');

  const [updating, setUpdating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [jobDescriptionDraft, setJobDescriptionDraft] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || !applicationId) {
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, applicationId, authLoading]);

  const load = async () => {
    setLoading(true);
    try {
      const appRes = await supabase
        .from('job_applications')
        .select('*')
        .eq('id', applicationId)
        .maybeSingle();
      if (appRes.error) throw appRes.error;
      if (!appRes.data) {
        setApplication(null);
        return;
      }

      setApplication(appRes.data);
      setJobDescriptionDraft(appRes.data.job_description);

      const [resumeRes, coverRes, optRes] = await Promise.all([
        appRes.data.resume_id
          ? supabase.from('resumes').select('*').eq('id', appRes.data.resume_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        supabase
          .from('cover_letters')
          .select('*')
          .eq('job_application_id', applicationId)
          .order('version', { ascending: false }),
        supabase
          .from('optimized_resumes')
          .select('*')
          .eq('job_application_id', applicationId)
          .order('version', { ascending: false }),
      ]);

      if (resumeRes?.error) throw resumeRes.error;
      if (coverRes.error) throw coverRes.error;
      if (optRes.error) throw optRes.error;

      setResume(resumeRes?.data ?? null);
      setCoverLetters(coverRes.data ?? []);
      setOptimizedResumes(optRes.data ?? []);

      setSelectedCoverLetterId((coverRes.data?.[0]?.id as string) || '');
      setSelectedOptimizedId((optRes.data?.[0]?.id as string) || '');
    } catch (e: any) {
      toast({ title: 'Load failed', description: e?.message || 'Could not load application.' });
    } finally {
      setLoading(false);
    }
  };

  const selectedCoverLetter = useMemo(
    () => coverLetters.find((c) => c.id === selectedCoverLetterId) || null,
    [coverLetters, selectedCoverLetterId]
  );
  const selectedOptimized = useMemo(
    () => optimizedResumes.find((o) => o.id === selectedOptimizedId) || null,
    [optimizedResumes, selectedOptimizedId]
  );

  const keywords = useMemo(() => {
    const list = (application?.keywords as any) ?? [];
    return Array.isArray(list) ? list.map(String) : [];
  }, [application?.keywords]);

  const ensureResumeData = async (): Promise<ResumeData> => {
    const structured = resume?.structured_data as any;
    if (structured && typeof structured === 'object' && Object.keys(structured).length > 0) return structured;

    const original = resume?.original_content?.trim();
    if (original) return await parseResumeText(original);

    return {};
  };

  const refreshKeywordAnalysis = async () => {
    if (!application || !resume) return;
    setRegenerating(true);
    try {
      const baseContent = resume.original_content || JSON.stringify(resume.structured_data || {});
      const analysis: KeywordAnalysis = await analyzeKeywords(baseContent, jobDescriptionDraft);

      const updateRes = await supabase
        .from('job_applications')
        .update({
          keywords: analysis.keywords,
          match_score: analysis.matchScore,
          job_description: jobDescriptionDraft,
        })
        .eq('id', application.id)
        .select('*')
        .single();

      if (updateRes.error) throw updateRes.error;
      setApplication(updateRes.data);

      toast({ title: 'Updated', description: `Match score is now ${analysis.matchScore}%.` });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message || 'Could not refresh keyword analysis.' });
    } finally {
      setRegenerating(false);
    }
  };

  const updateStatus = async (next: JobApplication['status']) => {
    if (!application) return;
    setUpdating(true);
    try {
      const res = await supabase
        .from('job_applications')
        .update({ status: next })
        .eq('id', application.id)
        .select('*')
        .single();
      if (res.error) throw res.error;
      setApplication(res.data);
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message || 'Could not update status.' });
    } finally {
      setUpdating(false);
    }
  };

  const generateNewCoverLetter = async () => {
    if (!application || !resume) return;
    setRegenerating(true);
    try {
      const resumeData = await ensureResumeData();
      const text = await generateCoverLetter(
        resumeData,
        jobDescriptionDraft,
        application.company_name,
        application.job_title
      );

      const version = maxVersion(coverLetters) + 1;
      const insertRes = await supabase
        .from('cover_letters')
        .insert({
          user_id: application.user_id,
          job_application_id: application.id,
          content: text,
          version,
        })
        .select('*')
        .single();
      if (insertRes.error) throw insertRes.error;

      const next = [insertRes.data, ...coverLetters].sort((a, b) => b.version - a.version);
      setCoverLetters(next);
      setSelectedCoverLetterId(insertRes.data.id);
      toast({ title: 'Cover letter generated', description: `Saved as version ${version}.` });
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e?.message || 'Could not generate cover letter.' });
    } finally {
      setRegenerating(false);
    }
  };

  const generateNewOptimizedResume = async () => {
    if (!application || !resume) return;
    setRegenerating(true);
    try {
      const resumeData = await ensureResumeData();
      const opt = await optimizeResume(resumeData, jobDescriptionDraft);

      const version = maxVersion(optimizedResumes) + 1;
      const insertRes = await supabase
        .from('optimized_resumes')
        .insert({
          user_id: application.user_id,
          job_application_id: application.id,
          original_resume_id: resume.id,
          optimized_content: opt.optimizedResume,
          suggestions: opt.suggestions,
          version,
        })
        .select('*')
        .single();
      if (insertRes.error) throw insertRes.error;

      const next = [insertRes.data, ...optimizedResumes].sort((a, b) => b.version - a.version);
      setOptimizedResumes(next);
      setSelectedOptimizedId(insertRes.data.id);
      toast({ title: 'Optimized resume saved', description: `Saved as version ${version}.` });
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e?.message || 'Could not optimize resume.' });
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!application) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <Card>
            <CardHeader>
              <CardTitle>Application not found</CardTitle>
              <CardDescription>Either it does not exist, or you do not have access.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{application.job_title}</h1>
              <p className="text-slate-600 dark:text-slate-400">{application.company_name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {application.status}
              </Badge>
              {application.match_score > 0 ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                  Match: {application.match_score}%
                </Badge>
              ) : (
                <Badge variant="secondary">No match score yet</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={load} disabled={updating || regenerating} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Job Description</CardTitle>
              <CardDescription>Edit, then refresh keyword analysis or regenerate documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={jobDescriptionDraft}
                onChange={(e) => setJobDescriptionDraft(e.target.value)}
                className="min-h-[220px]"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={refreshKeywordAnalysis} disabled={regenerating} className="gap-2">
                  {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh keywords
                </Button>
                <Button onClick={generateNewOptimizedResume} disabled={regenerating} variant="secondary">
                  Generate optimized resume
                </Button>
                <Button onClick={generateNewCoverLetter} disabled={regenerating} variant="secondary">
                  Generate cover letter
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>Update your application status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button key={s} type="button" onClick={() => updateStatus(s)} disabled={updating} className="focus:outline-none">
                    <Badge variant={application.status === s ? 'default' : 'secondary'} className="capitalize">
                      {s}
                    </Badge>
                  </button>
                ))}
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="text-sm font-medium">Keywords</div>
                {keywords.length === 0 ? (
                  <div className="text-sm text-slate-600 dark:text-slate-400">No keywords saved yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {keywords.slice(0, 18).map((k) => (
                      <Badge key={k} variant="secondary">
                        {k}
                      </Badge>
                    ))}
                    {keywords.length > 18 ? <Badge variant="secondary">+{keywords.length - 18} more</Badge> : null}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Cover letters and optimized resumes saved for this application.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="cover" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="cover">Cover letters</TabsTrigger>
                <TabsTrigger value="optimized">Optimized resumes</TabsTrigger>
                <TabsTrigger value="resume">Original resume</TabsTrigger>
              </TabsList>

              <TabsContent value="cover" className="mt-6 space-y-4">
                {coverLetters.length === 0 ? (
                  <div className="text-sm text-slate-600 dark:text-slate-400">No cover letters yet.</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="w-[260px]">
                        <Select value={selectedCoverLetterId} onValueChange={setSelectedCoverLetterId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select version" />
                          </SelectTrigger>
                          <SelectContent>
                            {coverLetters
                              .slice()
                              .sort((a, b) => b.version - a.version)
                              .map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  Version {c.version}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (!selectedCoverLetter?.content) return;
                            navigator.clipboard.writeText(selectedCoverLetter.content);
                            toast({ title: 'Copied', description: 'Cover letter copied to clipboard.' });
                          }}
                          className="gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (!selectedCoverLetter?.content) return;
                            downloadTextFile(
                              `cover-letter-${application.company_name}-v${selectedCoverLetter.version}.txt`,
                              selectedCoverLetter.content
                            );
                          }}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-[380px] rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                      <pre className="text-sm whitespace-pre-wrap">{selectedCoverLetter?.content || ''}</pre>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>

              <TabsContent value="optimized" className="mt-6 space-y-4">
                {optimizedResumes.length === 0 ? (
                  <div className="text-sm text-slate-600 dark:text-slate-400">No optimized resumes yet.</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="w-[260px]">
                        <Select value={selectedOptimizedId} onValueChange={setSelectedOptimizedId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select version" />
                          </SelectTrigger>
                          <SelectContent>
                            {optimizedResumes
                              .slice()
                              .sort((a, b) => b.version - a.version)
                              .map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  Version {o.version}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            const payload = JSON.stringify(
                              {
                                optimizedResume: selectedOptimized?.optimized_content,
                                suggestions: selectedOptimized?.suggestions,
                                version: selectedOptimized?.version,
                              },
                              null,
                              2
                            );
                            navigator.clipboard.writeText(payload);
                            toast({ title: 'Copied', description: 'Optimized resume JSON copied to clipboard.' });
                          }}
                          className="gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const payload = JSON.stringify(
                              {
                                optimizedResume: selectedOptimized?.optimized_content,
                                suggestions: selectedOptimized?.suggestions,
                              },
                              null,
                              2
                            );
                            downloadTextFile(
                              `optimized-resume-${application.company_name}-v${selectedOptimized?.version}.json`,
                              payload
                            );
                          }}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="space-y-3">
                        <h3 className="font-semibold">Suggestions</h3>
                        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                          {Array.isArray(selectedOptimized?.suggestions)
                            ? (selectedOptimized?.suggestions as any[]).slice(0, 12).map((s, idx) => (
                                <li key={idx} className="flex gap-2">
                                  <span className="mt-[2px] h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                                  <span>{String(s)}</span>
                                </li>
                              ))
                            : null}
                        </ul>
                      </div>
                      <ScrollArea className="h-[340px] rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                        <pre className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(selectedOptimized?.optimized_content ?? {}, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="resume" className="mt-6 space-y-4">
                {!resume ? (
                  <div className="text-sm text-slate-600 dark:text-slate-400">No resume attached.</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-semibold">{resume.title}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          Saved {new Date(resume.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            const text = resume.original_content || '';
                            navigator.clipboard.writeText(text);
                            toast({ title: 'Copied', description: 'Resume text copied to clipboard.' });
                          }}
                          className="gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => downloadTextFile(`resume-${application.company_name}.txt`, resume.original_content || '')}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-[380px] rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                      <pre className="text-sm whitespace-pre-wrap">{resume.original_content || ''}</pre>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
