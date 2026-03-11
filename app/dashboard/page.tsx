'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CirclePlus as PlusCircle, FileText, Briefcase, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalResumes: 0,
    totalApplications: 0,
    totalCoverLetters: 0,
  });
  const [recentApplications, setRecentApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      const [resumesCountRes, applicationsCountRes, coverLettersCountRes, recentAppsRes] = await Promise.all([
        supabase.from('resumes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase.from('cover_letters').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase
          .from('job_applications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setStats({
        totalResumes: resumesCountRes.count || 0,
        totalApplications: applicationsCountRes.count || 0,
        totalCoverLetters: coverLettersCountRes.count || 0,
      });

      setRecentApplications(recentAppsRes.data || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadDashboardData();
  }, [user, authLoading, loadDashboardData]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Welcome back! Here is an overview of your applications.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Resumes</CardTitle>
              <FileText className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalResumes}</div>
              <p className="text-xs text-slate-500 mt-1">
                Saved in your library
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Applications</CardTitle>
              <Briefcase className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalApplications}</div>
              <p className="text-xs text-slate-500 mt-1">
                Job applications tracked
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cover Letters</CardTitle>
              <TrendingUp className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCoverLetters}</div>
              <p className="text-xs text-slate-500 mt-1">
                Generated with AI
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Applications</CardTitle>
                <CardDescription>
                  Your latest job applications and their status
                </CardDescription>
              </div>
              <Link href="/dashboard/new">
                <Button>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  New Application
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentApplications.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No applications yet</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Get started by creating your first application
                </p>
                <Link href="/dashboard/new">
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create Application
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{app.job_title}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {app.company_name}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-slate-500">
                          {new Date(app.created_at).toLocaleDateString()}
                        </span>
                        {app.match_score > 0 && (
                          <span className="text-xs bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                            {app.match_score}% match
                          </span>
                        )}
                      </div>
                    </div>
                    <Link href={`/dashboard/application/${app.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
