'use client';

import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText } from 'lucide-react';

export default function ResumeBuilderPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Resume Builder</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Build an AI-powered resume with templates, tips, and live previews.
          </p>
        </div>

        <Card className="transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle>Start from your profile</CardTitle>
            <CardDescription>Enter your details once, generate multiple resume styles.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <Link href="/dashboard/generate?mode=resume">
              <Button className="gap-2">
                <Sparkles className="h-4 w-4" />
                Open Resume Builder
              </Button>
            </Link>
            <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Multi-style templates, AI suggestions, and PDF export.
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

