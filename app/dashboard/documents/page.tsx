'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader as Loader2, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase, type Database } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type ResumeRow = Database['public']['Tables']['resumes']['Row'];
type CoverLetterRow = Database['public']['Tables']['cover_letters']['Row'];
type OptimizedResumeRow = Database['public']['Tables']['optimized_resumes']['Row'];
type JobApplicationRow = Database['public']['Tables']['job_applications']['Row'];

export default function DocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [query, setQuery] = useState('');

  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [coverLetters, setCoverLetters] = useState<CoverLetterRow[]>([]);
  const [optimizedResumes, setOptimizedResumes] = useState<OptimizedResumeRow[]>([]);
  const [applications, setApplications] = useState<Record<string, JobApplicationRow>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setLoadError('Sign in to view your documents.');
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [resumesRes, coverRes, optRes, appsRes] = await Promise.all([
        supabase
          .from('resumes')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('cover_letters')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('optimized_resumes')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('job_applications')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (resumesRes.error) throw resumesRes.error;
      if (coverRes.error) throw coverRes.error;
      if (optRes.error) throw optRes.error;
      if (appsRes.error) throw appsRes.error;

      setResumes(resumesRes.data ?? []);
      setCoverLetters(coverRes.data ?? []);
      setOptimizedResumes(optRes.data ?? []);

      const map: Record<string, JobApplicationRow> = {};
      (appsRes.data ?? []).forEach((a) => {
        map[a.id] = a;
      });
      setApplications(map);
    } catch (e: any) {
      const rawMessage = e?.message || 'Could not load your documents.';
      const message =
        rawMessage.includes('relation') && rawMessage.includes('does not exist')
          ? 'Your Supabase tables are not created yet. Run the migration SQL in Supabase (SQL Editor) and refresh.'
          : rawMessage;
      setLoadError(message);
      toast({ title: 'Load failed', description: message });
    } finally {
      setLoading(false);
    }
  };

  const q = query.trim().toLowerCase();

  const filteredResumes = useMemo(() => {
    if (!q) return resumes;
    return resumes.filter((r) => r.title.toLowerCase().includes(q));
  }, [resumes, q]);

  const filteredCoverLetters = useMemo(() => {
    if (!q) return coverLetters;
    return coverLetters.filter((c) => {
      const app = applications[c.job_application_id];
      const hay = `${app?.company_name || ''} ${app?.job_title || ''} v${c.version}`.toLowerCase();
      return hay.includes(q);
    });
  }, [coverLetters, applications, q]);

  const filteredOptimizedResumes = useMemo(() => {
    if (!q) return optimizedResumes;
    return optimizedResumes.filter((o) => {
      const app = applications[o.job_application_id];
      const hay = `${app?.company_name || ''} ${app?.job_title || ''} v${o.version}`.toLowerCase();
      return hay.includes(q);
    });
  }, [optimizedResumes, applications, q]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">My Documents</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Resumes, cover letters, and optimized versions saved across your applications.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Library</CardTitle>
            <CardDescription>Search by title, company, or job title.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100 p-4 text-sm flex items-center justify-between gap-3 flex-wrap">
                <div>{loadError}</div>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="text-sm font-medium text-red-900 dark:text-red-100 underline"
                >
                  Retry
                </button>
              </div>
            ) : null}
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." />

            <Tabs defaultValue="resumes" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="resumes">Resumes</TabsTrigger>
                <TabsTrigger value="cover">Cover letters</TabsTrigger>
                <TabsTrigger value="optimized">Optimized</TabsTrigger>
              </TabsList>

              <TabsContent value="resumes" className="mt-6">
                {filteredResumes.length === 0 ? (
                  <div className="text-sm text-slate-600 dark:text-slate-400">No resumes found.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResumes.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.title}</TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-400">
                            {new Date(r.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="cover" className="mt-6">
                {filteredCoverLetters.length === 0 ? (
                  <div className="text-sm text-slate-600 dark:text-slate-400">No cover letters found.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Application</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCoverLetters.map((c) => {
                        const app = applications[c.job_application_id];
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">
                              {app ? `${app.company_name} · ${app.job_title}` : c.job_application_id}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">v{c.version}</Badge>
                            </TableCell>
                            <TableCell className="text-slate-600 dark:text-slate-400">
                              {new Date(c.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={`/dashboard/application/${c.job_application_id}`}
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink className="h-4 w-4" />
                                View
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="optimized" className="mt-6">
                {filteredOptimizedResumes.length === 0 ? (
                  <div className="text-sm text-slate-600 dark:text-slate-400">No optimized resumes found.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Application</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOptimizedResumes.map((o) => {
                        const app = applications[o.job_application_id];
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">
                              {app ? `${app.company_name} · ${app.job_title}` : o.job_application_id}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">v{o.version}</Badge>
                            </TableCell>
                            <TableCell className="text-slate-600 dark:text-slate-400">
                              {new Date(o.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={`/dashboard/application/${o.job_application_id}`}
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink className="h-4 w-4" />
                                View
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
