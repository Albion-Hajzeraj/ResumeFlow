'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth-context';

export default function SettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [autoSave, setAutoSave] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your profile and workspace preferences.
          </p>
        </div>

        <Card className="transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your basic details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <Button variant="outline">Save profile</Button>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Personalize your editing experience.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Auto-save drafts</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Keep drafts synced automatically.</div>
              </div>
              <Switch checked={autoSave} onCheckedChange={setAutoSave} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Compact mode</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Tighter spacing for dense editing.</div>
              </div>
              <Switch checked={compactMode} onCheckedChange={setCompactMode} />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

