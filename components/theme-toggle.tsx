'use client';

import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const effective = (theme === 'system' ? resolvedTheme : theme) || 'light';

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setTheme(effective === 'dark' ? 'light' : 'dark')}
      className="justify-start"
    >
      {effective === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
      {effective === 'dark' ? 'Light mode' : 'Dark mode'}
    </Button>
  );
}

