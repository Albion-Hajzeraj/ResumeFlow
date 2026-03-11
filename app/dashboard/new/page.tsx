'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader as Loader2, Upload, Sparkles, Save, Wand2, CirclePlus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { KeywordAnalysis, ResumeData } from '@/lib/ai-service';
import { analyzeKeywords, generateCoverLetter, optimizeResume, parseResumeText } from '@/lib/ai-service';

const STATUSES = ['draft', 'applied', 'interview', 'offer', 'rejected'] as const;

function formatDateForFilename(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

type ExperienceItem = {
  title: string;
  company: string;
  duration: string;
  description: string;
};

type EducationItem = {
  degree: string;
  institution: string;
  year: string;
};

function normalizeResumeData(input: ResumeData | null): ResumeData {
  const experience = Array.isArray(input?.experience) ? input!.experience : [];
  const education = Array.isArray(input?.education) ? input!.education : [];
  const skills = Array.isArray(input?.skills) ? input!.skills : [];
  const contact = input?.contact && typeof input.contact === 'object' ? input.contact : {};

  return {
    summary: typeof input?.summary === 'string' ? input.summary : '',
    experience: experience.map((e: any) => ({
      title: String(e?.title || ''),
      company: String(e?.company || ''),
      duration: String(e?.duration || ''),
      description: String(e?.description || ''),
    })),
    education: education.map((e: any) => ({
      degree: String(e?.degree || ''),
      institution: String(e?.institution || ''),
      year: String(e?.year || ''),
    })),
    skills: skills.map((s: any) => String(s)).filter(Boolean),
    contact: {
      email: typeof (contact as any)?.email === 'string' ? (contact as any).email : '',
      phone: typeof (contact as any)?.phone === 'string' ? (contact as any).phone : '',
      location: typeof (contact as any)?.location === 'string' ? (contact as any).location : '',
    },
  };
}

function hasStructuredData(data: ResumeData | null) {
  if (!data) return false;
  const hasSummary = Boolean((data.summary || '').trim());
  const hasSkills = Array.isArray(data.skills) && data.skills.length > 0;
  const hasExp = Array.isArray(data.experience) && data.experience.length > 0;
  const hasEdu = Array.isArray(data.education) && data.education.length > 0;
  return hasSummary || hasSkills || hasExp || hasEdu;
}

export default function NewApplicationPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('draft');

  const [resumeTitle, setResumeTitle] = useState('');
  const [resumeContent, setResumeContent] = useState('');
  const [showRawResume, setShowRawResume] = useState(true);
  const [useOcrForPdf, setUseOcrForPdf] = useState(true);
  const [ocrStatus, setOcrStatus] = useState('');

  const [parsedResume, setParsedResume] = useState<ResumeData | null>(null);
  const [resumeDraft, setResumeDraft] = useState<ResumeData>(() => normalizeResumeData(null));
  const [keywordAnalysis, setKeywordAnalysis] = useState<KeywordAnalysis | null>(null);
  const [optimization, setOptimization] = useState<{ optimizedResume: ResumeData; suggestions: string[] } | null>(
    null
  );
  const [coverLetter, setCoverLetter] = useState('');

  const [runningAi, setRunningAi] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [saving, setSaving] = useState(false);

  const derivedResumeTitle = useMemo(() => {
    if (resumeTitle.trim()) return resumeTitle.trim();
    if (!jobTitle.trim()) return 'My Resume';
    return `${jobTitle.trim()} Resume`;
  }, [resumeTitle, jobTitle]);

  const resetResumeState = () => {
    setParsedResume(null);
    setResumeDraft(normalizeResumeData(null));
    setKeywordAnalysis(null);
    setOptimization(null);
    setCoverLetter('');
  };

  const parseResumeFromText = async (text: string, opts?: { silent?: boolean }) => {
    if (!text.trim()) {
      if (!opts?.silent) {
        toast({ title: 'Resume required', description: 'Paste your resume text or upload a file first.' });
      }
      return;
    }
    setParsingResume(true);
    try {
      const parsed = await parseResumeText(text);
      setParsedResume(parsed);
      setResumeDraft(normalizeResumeData(parsed));
      if (!opts?.silent) {
        toast({ title: 'Fields filled', description: 'Review and edit the structured fields below.' });
      }
    } catch (e: any) {
      if (!opts?.silent) {
        toast({
          title: 'Parse failed',
          description: e?.message || 'Could not parse this resume. Try again or paste cleaner text.',
        });
      }
    } finally {
      setParsingResume(false);
    }
  };

  const loadPdfJs = async () => {
    try {
      const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const lib = (mod as any).default ?? mod;
      if (lib?.getDocument) {
        return lib;
      }
    } catch (e) {
      const suffix = e instanceof Error ? ` ${e.message}` : '';
      throw new Error(`Failed to load PDF renderer.${suffix}`);
    }
    throw new Error('Failed to load PDF renderer.');
  };

  const loadTesseract = async () => {
    if (typeof window === 'undefined') {
      throw new Error('OCR is only available in the browser.');
    }
    const win = window as any;
    if (win.Tesseract?.createWorker) {
      return win.Tesseract;
    }
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/tesseract.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load OCR engine.'));
      document.head.appendChild(script);
    });
    if (!win.Tesseract?.createWorker) {
      throw new Error('OCR engine did not initialize.');
    }
    return win.Tesseract;
  };

  const runOcrFromPdf = async (file: File) => {
    setParsingFile(true);
    setOcrStatus('Preparing OCR...');
    try {
      const pdfjs = await loadPdfJs();
      const Tesseract = await loadTesseract();

      const data = new Uint8Array(await file.arrayBuffer());
      if (pdfjs?.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = '';
      }
      const loadingTask = pdfjs.getDocument({ data, disableWorker: true });
      const pdf = await loadingTask.promise;

      const worker = await Tesseract.createWorker({
        workerPath: '/vendor/tesseract-worker.min.js',
        corePath: '/vendor/tesseract-core.wasm.js',
      });
      await worker.loadLanguage('eng');
      await worker.initialize('eng');

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i += 1) {
        setOcrStatus(`Running OCR... page ${i} of ${pdf.numPages}`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Canvas is not available for OCR.');
        }
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const { data: ocrData } = await worker.recognize(canvas);
        if (ocrData?.text) {
          fullText += `${ocrData.text}\n`;
        }
      }

      await worker.terminate();
      const text = fullText.trim();
      if (!text) {
        throw new Error('No text could be extracted from this PDF. It may be low quality for OCR.');
      }

      setResumeContent(text);
      resetResumeState();
      toast({ title: 'Resume loaded', description: `${file.name} OCR completed.` });
      await parseResumeFromText(text, { silent: true });
    } catch (e: any) {
      toast({
        title: 'OCR failed',
        description: e?.message || 'Could not OCR this PDF. Try a clearer scan or upload text instead.',
      });
    } finally {
      setParsingFile(false);
      setOcrStatus('');
    }
  };

  const handleUploadTxt = async (file: File) => {
    const text = await file.text();
    setResumeContent(text);
    resetResumeState();
    toast({ title: 'Resume loaded', description: `${file.name} imported as text.` });
    await parseResumeFromText(text, { silent: true });
  };

  const handleUploadPdf = async (file: File) => {
    if (useOcrForPdf) {
      await runOcrFromPdf(file);
      return;
    }
    setParsingFile(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/files/parse-pdf', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to parse PDF');
      }

      const text = String(data.text || '');
      setResumeContent(text);
      resetResumeState();
      toast({ title: 'Resume loaded', description: `${file.name} parsed successfully.` });
      await parseResumeFromText(text, { silent: true });
    } catch (e: any) {
      toast({
        title: 'PDF import failed',
        description:
          e?.message ||
          'Could not extract text from this PDF. If it is scanned, you will need OCR or paste text.',
      });
    } finally {
      setParsingFile(false);
    }
  };

  const parseAndFill = async () => {
    await parseResumeFromText(resumeContent);
  };

  const runAi = async () => {
    const hasResumeText = Boolean(resumeContent.trim());
    const hasStructured = hasStructuredData(resumeDraft) || hasStructuredData(parsedResume);
    if (!hasResumeText && !hasStructured) {
      toast({ title: 'Resume required', description: 'Paste your resume text or upload a file first.' });
      return;
    }
    if (!jobDescription.trim()) {
      toast({ title: 'Job description required', description: 'Paste the job description to optimize against.' });
      return;
    }
    if (!companyName.trim() || !jobTitle.trim()) {
      toast({ title: 'Missing details', description: 'Add company name and job title first.' });
      return;
    }

    setRunningAi(true);
    try {
      const baseResume = hasStructuredData(resumeDraft)
        ? resumeDraft
        : parsedResume
          ? normalizeResumeData(parsedResume)
          : hasResumeText
            ? normalizeResumeData(await parseResumeText(resumeContent))
            : normalizeResumeData(null);

      if (!hasStructuredData(resumeDraft)) {
        setResumeDraft(baseResume);
      }
      if (!parsedResume) {
        setParsedResume(baseResume);
      }

      const contentForKeywords = hasResumeText ? resumeContent : JSON.stringify(baseResume);
      const [kw, opt, cl] = await Promise.all([
        analyzeKeywords(contentForKeywords, jobDescription),
        optimizeResume(baseResume, jobDescription),
        generateCoverLetter(baseResume, jobDescription, companyName.trim(), jobTitle.trim()),
      ]);

      setKeywordAnalysis(kw);
      setOptimization(opt);
      setCoverLetter(cl);

      toast({ title: 'Analysis ready', description: 'Review results below, then save when you are ready.' });
    } catch (e: any) {
      toast({
        title: 'AI request failed',
        description: e?.message || 'Something went wrong while running the analysis.',
      });
    } finally {
      setRunningAi(false);
    }
  };

  const saveAll = async () => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to save documents.' });
      return;
    }
    if (!companyName.trim() || !jobTitle.trim() || !jobDescription.trim()) {
      toast({ title: 'Missing application details', description: 'Company, job title, and description are required.' });
      return;
    }
    const hasResumeText = Boolean(resumeContent.trim());
    const hasStructured = hasStructuredData(resumeDraft) || hasStructuredData(parsedResume);
    if (!hasResumeText && !hasStructured) {
      toast({ title: 'Missing resume', description: 'Paste your resume content first.' });
      return;
    }

    setSaving(true);
    try {
      if (user.email) {
        // Ensure the FK target exists before inserting rows that reference profiles(id).
        const profileUpsert = await supabase
          .from('profiles')
          .upsert({ id: user.id, email: user.email }, { onConflict: 'id' });
        if (profileUpsert.error) throw profileUpsert.error;
      }

      const structured = hasStructuredData(resumeDraft)
        ? resumeDraft
        : parsedResume
          ? normalizeResumeData(parsedResume)
          : hasResumeText
            ? normalizeResumeData(await parseResumeText(resumeContent))
            : normalizeResumeData(null);

      const resumeInsert = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          title: derivedResumeTitle,
          original_content: resumeContent || null,
          structured_data: structured,
        })
        .select('id')
        .single();

      if (resumeInsert.error) throw resumeInsert.error;
      const resumeId = resumeInsert.data.id;

      const appInsert = await supabase
        .from('job_applications')
        .insert({
          user_id: user.id,
          resume_id: resumeId,
          company_name: companyName.trim(),
          job_title: jobTitle.trim(),
          job_description: jobDescription,
          keywords: keywordAnalysis?.keywords ?? [],
          match_score: keywordAnalysis?.matchScore ?? 0,
          status,
        })
        .select('id')
        .single();

      if (appInsert.error) throw appInsert.error;
      const applicationId = appInsert.data.id;

      if (coverLetter.trim()) {
        const clInsert = await supabase.from('cover_letters').insert({
          user_id: user.id,
          job_application_id: applicationId,
          content: coverLetter,
          version: 1,
        });
        if (clInsert.error) throw clInsert.error;
      }

      if (optimization) {
        const optInsert = await supabase.from('optimized_resumes').insert({
          user_id: user.id,
          job_application_id: applicationId,
          original_resume_id: resumeId,
          optimized_content: optimization.optimizedResume,
          suggestions: optimization.suggestions,
          version: 1,
        });
        if (optInsert.error) throw optInsert.error;
      }

      toast({ title: 'Saved', description: 'Application and documents saved to your dashboard.' });
      router.push(`/dashboard/application/${applicationId}`);
    } catch (e: any) {
      const rawMessage = e?.message || (typeof e === 'string' ? e : '');
      const hint =
        rawMessage.includes('relation') && rawMessage.includes('does not exist')
          ? 'Your Supabase tables are not created yet. Run the migration SQL in Supabase (SQL Editor) and try again.'
          : '';
      toast({
        title: 'Save failed',
        description:
          hint || rawMessage || 'Could not save your application. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">New Application</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Paste a job description and your resume. Generate an optimized version and a cover letter, then save it.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
            <Link href="/dashboard/documents">
              <Button variant="outline">Documents</Button>
            </Link>
            <Button onClick={runAi} disabled={runningAi} className="gap-2">
              {runningAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Run AI
            </Button>
            <Button onClick={saveAll} disabled={saving} variant="secondary" className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
              <CardDescription>Company, role, and job description.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job title</Label>
                  <Input
                    id="jobTitle"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Frontend Engineer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Label className="mr-2">Status</Label>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className="focus:outline-none"
                    >
                      <Badge variant={s === status ? 'default' : 'secondary'} className="capitalize">
                        {s}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobDescription">Job description</Label>
                <Textarea
                  id="jobDescription"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                  className="min-h-[220px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resume</CardTitle>
              <CardDescription>Upload a PDF or paste text. Parse it into structured fields you can edit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="resumeTitle">Resume title</Label>
                  <Input
                    id="resumeTitle"
                    value={resumeTitle}
                    onChange={(e) => setResumeTitle(e.target.value)}
                    placeholder="Software Engineer Resume"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resumeUpload">Upload (.pdf or .txt)</Label>
                  <Input
                    id="resumeUpload"
                    type="file"
                    accept=".txt,.pdf,text/plain,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                        if (isPdf) {
                          void handleUploadPdf(file);
                        } else {
                          void handleUploadTxt(file);
                        }
                      }
                      e.currentTarget.value = '';
                    }}
                    disabled={parsingFile}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {useOcrForPdf
                    ? 'PDFs will be OCR scanned to extract text.'
                    : 'PDFs will be parsed for embedded text only.'}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUseOcrForPdf((prev) => !prev)}
                  disabled={parsingFile}
                >
                  {useOcrForPdf ? 'Use text-only PDF' : 'Use OCR for PDF'}
                </Button>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {ocrStatus || 'Paste text here if upload is unavailable.'}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRawResume((prev) => !prev)}
                >
                  {showRawResume ? 'Hide resume text' : 'Show resume text'}
                </Button>
              </div>

              {showRawResume ? (
                <div className="space-y-2">
                  <Label htmlFor="resumeContent">Resume content</Label>
                  <Textarea
                    id="resumeContent"
                    value={resumeContent}
                    onChange={(e) => {
                      setResumeContent(e.target.value);
                      setParsedResume(null);
                    }}
                    placeholder="Paste your resume text here..."
                    className="min-h-[200px]"
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {parsedResume
                    ? `Parsed resume: ${parsedResume.experience?.length || 0} roles, ${parsedResume.education?.length || 0} education, ${parsedResume.skills?.length || 0} skills.`
                    : 'Parse the resume to fill the structured fields.'}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void parseAndFill()}
                  disabled={parsingResume || parsingFile}
                  className="gap-2"
                >
                  {parsingResume ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {parsedResume ? 'Re-parse' : 'Parse and fill'}
                </Button>
              </div>

              <Separator />

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="resumeSummary">Summary</Label>
                  <Textarea
                    id="resumeSummary"
                    value={resumeDraft.summary || ''}
                    onChange={(e) => setResumeDraft((prev) => ({ ...prev, summary: e.target.value }))}
                    placeholder="2-4 lines that summarize your profile..."
                    className="min-h-[110px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resumeSkills">Skills</Label>
                  <Input
                    id="resumeSkills"
                    value={(resumeDraft.skills || []).join(', ')}
                    onChange={(e) =>
                      setResumeDraft((prev) => ({
                        ...prev,
                        skills: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                    placeholder="React, TypeScript, Node.js, SQL..."
                  />
                  <div className="flex flex-wrap gap-2">
                    {(resumeDraft.skills || []).slice(0, 18).map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold">Experience</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Add or edit roles and achievements.</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setResumeDraft((prev) => ({
                          ...prev,
                          experience: [
                            ...((prev.experience as ExperienceItem[] | undefined) || []),
                            { title: '', company: '', duration: '', description: '' },
                          ],
                        }))
                      }
                      className="gap-2"
                    >
                      <CirclePlus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>

                  {((resumeDraft.experience as ExperienceItem[] | undefined) || []).length === 0 ? (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      No experience items yet. Click Add to create one.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {((resumeDraft.experience as ExperienceItem[] | undefined) || []).map((exp, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">Role {idx + 1}</div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setResumeDraft((prev) => ({
                                  ...prev,
                                  experience: (prev.experience as ExperienceItem[]).filter((_, i) => i !== idx),
                                }))
                              }
                              className="gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <Input
                              value={exp.title}
                              onChange={(e) =>
                                setResumeDraft((prev) => ({
                                  ...prev,
                                  experience: (prev.experience as ExperienceItem[]).map((x, i) =>
                                    i === idx ? { ...x, title: e.target.value } : x
                                  ),
                                }))
                              }
                              placeholder="Title"
                            />
                            <Input
                              value={exp.company}
                              onChange={(e) =>
                                setResumeDraft((prev) => ({
                                  ...prev,
                                  experience: (prev.experience as ExperienceItem[]).map((x, i) =>
                                    i === idx ? { ...x, company: e.target.value } : x
                                  ),
                                }))
                              }
                              placeholder="Company"
                            />
                            <Input
                              value={exp.duration}
                              onChange={(e) =>
                                setResumeDraft((prev) => ({
                                  ...prev,
                                  experience: (prev.experience as ExperienceItem[]).map((x, i) =>
                                    i === idx ? { ...x, duration: e.target.value } : x
                                  ),
                                }))
                              }
                              placeholder="Dates"
                            />
                          </div>
                          <Textarea
                            value={exp.description}
                            onChange={(e) =>
                              setResumeDraft((prev) => ({
                                ...prev,
                                experience: (prev.experience as ExperienceItem[]).map((x, i) =>
                                  i === idx ? { ...x, description: e.target.value } : x
                                ),
                              }))
                            }
                            placeholder="Bullet points and achievements..."
                            className="min-h-[110px]"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold">Education</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Degrees, schools, dates.</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setResumeDraft((prev) => ({
                          ...prev,
                          education: [
                            ...((prev.education as EducationItem[] | undefined) || []),
                            { degree: '', institution: '', year: '' },
                          ],
                        }))
                      }
                      className="gap-2"
                    >
                      <CirclePlus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>

                  {((resumeDraft.education as EducationItem[] | undefined) || []).length === 0 ? (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      No education items yet. Click Add to create one.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {((resumeDraft.education as EducationItem[] | undefined) || []).map((edu, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">Entry {idx + 1}</div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setResumeDraft((prev) => ({
                                  ...prev,
                                  education: (prev.education as EducationItem[]).filter((_, i) => i !== idx),
                                }))
                              }
                              className="gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <Input
                              value={edu.degree}
                              onChange={(e) =>
                                setResumeDraft((prev) => ({
                                  ...prev,
                                  education: (prev.education as EducationItem[]).map((x, i) =>
                                    i === idx ? { ...x, degree: e.target.value } : x
                                  ),
                                }))
                              }
                              placeholder="Degree"
                            />
                            <Input
                              value={edu.institution}
                              onChange={(e) =>
                                setResumeDraft((prev) => ({
                                  ...prev,
                                  education: (prev.education as EducationItem[]).map((x, i) =>
                                    i === idx ? { ...x, institution: e.target.value } : x
                                  ),
                                }))
                              }
                              placeholder="Institution"
                            />
                            <Input
                              value={edu.year}
                              onChange={(e) =>
                                setResumeDraft((prev) => ({
                                  ...prev,
                                  education: (prev.education as EducationItem[]).map((x, i) =>
                                    i === idx ? { ...x, year: e.target.value } : x
                                  ),
                                }))
                              }
                              placeholder="Year"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                  {parsingFile ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-700 dark:text-blue-300" />
                  ) : (
                    <Upload className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                  )}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Upload a `.pdf` or `.txt`. If your PDF is scanned (image-only), you will need OCR first.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Results
                </CardTitle>
                <CardDescription>Parsed resume, keyword match, optimization suggestions, and cover letter.</CardDescription>
              </div>
              {keywordAnalysis && (
                <Badge variant="secondary" className="text-sm">
                  Match score: {keywordAnalysis.matchScore}%
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!parsedResume && !keywordAnalysis && !optimization && !coverLetter ? (
              <div className="text-center py-12 text-slate-600 dark:text-slate-400">
                Run the AI step to generate results.
              </div>
            ) : (
              <Tabs defaultValue="keywords" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="keywords">Keywords</TabsTrigger>
                  <TabsTrigger value="resume">Parsed</TabsTrigger>
                  <TabsTrigger value="optimize">Optimize</TabsTrigger>
                  <TabsTrigger value="cover">Cover letter</TabsTrigger>
                </TabsList>

                <TabsContent value="keywords" className="mt-6">
                  {!keywordAnalysis ? (
                    <div className="text-slate-600 dark:text-slate-400">No keyword analysis yet.</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {keywordAnalysis.presentKeywords.map((k) => (
                          <Badge key={k} className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                            {k}
                          </Badge>
                        ))}
                        {keywordAnalysis.missingKeywords.map((k) => (
                          <Badge
                            key={k}
                            variant="secondary"
                            className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                          >
                            Missing: {k}
                          </Badge>
                        ))}
                      </div>
                      <Separator />
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Keywords extracted: {keywordAnalysis.keywords.length}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="resume" className="mt-6">
                  {!parsedResume ? (
                    <div className="text-slate-600 dark:text-slate-400">No parsed resume yet.</div>
                  ) : (
                    <ScrollArea className="h-[360px] rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                      <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(parsedResume, null, 2)}</pre>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="optimize" className="mt-6">
                  {!optimization ? (
                    <div className="text-slate-600 dark:text-slate-400">No optimization yet.</div>
                  ) : (
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="space-y-3">
                        <h3 className="font-semibold">Suggestions</h3>
                        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                          {optimization.suggestions.map((s, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="mt-[2px] h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-3">
                        <h3 className="font-semibold">Optimized resume (JSON)</h3>
                        <ScrollArea className="h-[300px] rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                          <pre className="text-xs whitespace-pre-wrap">
                            {JSON.stringify(optimization.optimizedResume, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="cover" className="mt-6">
                  {!coverLetter ? (
                    <div className="text-slate-600 dark:text-slate-400">No cover letter yet.</div>
                  ) : (
                    <ScrollArea className="h-[360px] rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                      <pre className="text-sm whitespace-pre-wrap">{coverLetter}</pre>
                    </ScrollArea>
                  )}
                  {coverLetter ? (
                    <div className="mt-4 text-right">
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(coverLetter);
                          toast({ title: 'Copied', description: 'Cover letter copied to clipboard.' });
                        }}
                      >
                        Copy text
                      </Button>
                    </div>
                  ) : null}
                  <div className="mt-2 text-xs text-slate-500">
                    Suggested filename: cover-letter-{companyName || 'company'}-{formatDateForFilename()}.txt
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
