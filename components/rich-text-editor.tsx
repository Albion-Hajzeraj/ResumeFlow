'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Pilcrow,
} from 'lucide-react';

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  className,
  minHeight = '260px',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  const toolbar = useMemo(
    () => [
      { icon: Undo2, cmd: 'undo' },
      { icon: Redo2, cmd: 'redo' },
      { divider: true },
      { icon: Bold, cmd: 'bold' },
      { icon: Italic, cmd: 'italic' },
      { icon: Underline, cmd: 'underline' },
      { divider: true },
      { icon: List, cmd: 'insertUnorderedList' },
      { icon: ListOrdered, cmd: 'insertOrderedList' },
      { divider: true },
      { icon: Heading1, cmd: 'formatBlock', value: 'h1' },
      { icon: Heading2, cmd: 'formatBlock', value: 'h2' },
      { icon: Pilcrow, cmd: 'formatBlock', value: 'p' },
    ],
    []
  );

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const emitChange = () => {
    const html = editorRef.current?.innerHTML ?? '';
    onChange(html);
  };

  const runCommand = (command: string, commandValue?: string) => {
    if (typeof document === 'undefined') return;
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const handleToolbarMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  return (
    <div className={`rounded-lg border border-slate-200 dark:border-slate-800 ${className || ''}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50/70 dark:bg-slate-900/70">
        {toolbar.map((item, index) => {
          if ('divider' in item) {
            return <div key={`div-${index}`} className="h-5 w-px bg-slate-200 dark:bg-slate-800" />;
          }
          const Icon = item.icon;
          return (
            <Button
              key={`${item.cmd}-${index}`}
              type="button"
              size="sm"
              variant="ghost"
              onMouseDown={handleToolbarMouseDown}
              onClick={() => runCommand(item.cmd, item.value)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>
      <div
        ref={editorRef}
        role="textbox"
        aria-label={placeholder}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        className="px-4 py-3 text-sm leading-relaxed focus:outline-none"
        style={{ minHeight }}
        data-placeholder={placeholder}
      />
    </div>
  );
}
