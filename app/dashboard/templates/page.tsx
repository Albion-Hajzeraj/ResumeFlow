'use client';

import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layers, Sparkles } from 'lucide-react';

const RESUME_TEMPLATES = [
  { id: 'onyx', name: 'Onyx', description: 'Structured, strong dividers.' },
  { id: 'lumen', name: 'Lumen', description: 'Clean columns and light accents.' },
  { id: 'atelier', name: 'Atelier', description: 'Creative, softer rhythm.' },
];

const COVER_TEMPLATES = [
  { id: 'classic', name: 'Classic', description: 'Traditional letter format.' },
  { id: 'impact', name: 'Impact', description: 'Confident, modern spacing.' },
  { id: 'studio', name: 'Studio', description: 'Creative tone with crisp headers.' },
];

export default function TemplatesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Templates</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Choose a professional template before you generate.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="transition-all hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle>Resume Templates</CardTitle>
              <CardDescription>Designed for clarity, ATS-fit, and visual polish.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {RESUME_TEMPLATES.map((template) => (
                <div key={template.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="font-semibold">{template.name}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{template.description}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle>Cover Letter Templates</CardTitle>
              <CardDescription>Different tones for different roles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {COVER_TEMPLATES.map((template) => (
                <div key={template.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="font-semibold">{template.name}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{template.description}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Try a template
            </CardTitle>
            <CardDescription>Jump into the generator and experiment.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/generate">
              <Button className="gap-2">
                <Sparkles className="h-4 w-4" />
                Open AI Generator
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

