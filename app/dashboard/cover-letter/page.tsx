'use client';

import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Mail } from 'lucide-react';

export default function CoverLetterPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Cover Letter Generator</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Generate tailored cover letters using job descriptions and your resume details.
          </p>
        </div>

        <Card className="transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle>Tailor each application</CardTitle>
            <CardDescription>AI drafts a strong narrative, you refine the final touch.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <Link href="/dashboard/generate?mode=cover-letter">
              <Button className="gap-2">
                <Sparkles className="h-4 w-4" />
                Open Cover Letter Builder
              </Button>
            </Link>
            <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Includes AI suggestions, templates, and PDF export.
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

