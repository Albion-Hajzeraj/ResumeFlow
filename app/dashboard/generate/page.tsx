'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader as Loader2, Sparkles, Wand2, RotateCcw, FileDown, Lightbulb, Zap, ChevronLeft, ChevronRight, MoveVertical } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { RichTextEditor } from '@/components/rich-text-editor';
import type { ResumeData, ResumeStyle } from '@/lib/ai-service';
import { extractSkills, generateCoverLetter, generateResume, suggestEdits } from '@/lib/ai-service';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams } from 'next/navigation';

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

const RESUME_STYLES: Array<{ key: ResumeStyle; label: string; tone: string }> = [
  { key: 'modern', label: 'Modern', tone: 'Clean, contemporary layout.' },
  { key: 'professional', label: 'Professional', tone: 'Formal and ATS-friendly.' },
  { key: 'creative', label: 'Creative', tone: 'Distinctive and energetic.' },
];

const RESUME_TEMPLATES = [
  {
    id: 'onyx',
    name: 'Onyx',
    description: 'Structured, strong dividers.',
    bodyClass: 'font-["Times New Roman"]',
    accent: '#0f172a',
  },
  {
    id: 'lumen',
    name: 'Lumen',
    description: 'Clean columns and light accents.',
    bodyClass: 'font-["Times New Roman"]',
    accent: '#1d4ed8',
  },
  {
    id: 'atelier',
    name: 'Atelier',
    description: 'Creative, softer rhythm.',
    bodyClass: 'font-["Times New Roman"]',
    accent: '#a21caf',
  },
];

const COVER_TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional letter format.',
    accent: '#0f172a',
  },
  {
    id: 'impact',
    name: 'Impact',
    description: 'Confident, modern spacing.',
    accent: '#0ea5e9',
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'Creative tone with crisp headers.',
    accent: '#db2777',
  },
];

const ACTION_VERBS = [
  'Led',
  'Launched',
  'Optimized',
  'Designed',
  'Implemented',
  'Accelerated',
  'Streamlined',
  'Shipped',
  'Mentored',
  'Improved',
];

const STORAGE_KEY = 'resume-ai-generator-v1';
const MAX_HISTORY = 30;

function plainTextToHtml(text: string) {
  const escape = (value: string) =>
    value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]!));

  return text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => `<p>${escape(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function exportHtmlToPdf(title: string, html: string) {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank');
  if (!win) {
    toast({ title: 'Popup blocked', description: 'Allow popups to export the PDF.' });
    return;
  }

  win.document.write(`<!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: "Times New Roman", serif; padding: 36px; color: #0f172a; }
          h1 { font-size: 28px; margin-bottom: 6px; }
          h2 { font-size: 18px; margin-top: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          h3 { font-size: 15px; margin-top: 12px; }
          p { margin: 8px 0; line-height: 1.5; }
          ul { padding-left: 20px; margin: 6px 0; }
          .meta { color: #475569; font-size: 13px; }
          @media print { body { padding: 24px; } }
        </style>
      </head>
      <body>${html}</body>
    </html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function wrapWithTemplate(html: string, templateId: string, accent: string) {
  const border = `border-left: 4px solid ${accent}; padding-left: 12px;`;
  if (!html) return '';
  if (templateId === 'onyx') {
    return `<div style="color:#0f172a">
      <div style="${border}">
        ${html}
      </div>
    </div>`;
  }
  if (templateId === 'lumen') {
    return `<div style="color:#0f172a">
      <div style="display:grid; grid-template-columns: 1fr 2fr; gap: 20px;">
        <div>
          <div style="font-weight:600; color:${accent}; margin-bottom:8px;">Snapshot</div>
          <div style="font-size:12px; color:#475569;">Skills, summary, highlights</div>
        </div>
        <div style="${border}">
          ${html}
        </div>
      </div>
    </div>`;
  }
  return `<div style="color:#0f172a">
    <div style="border:1px solid #e2e8f0; padding:16px; border-radius:8px;">
      <div style="height:6px; background:${accent}; border-radius:999px; margin-bottom:12px;"></div>
      ${html}
    </div>
  </div>`;
}

function insertSkillsIntoHtml(html: string, skills: string[]) {
  if (!html || skills.length === 0) return html;
  if (typeof window === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const headings = Array.from(doc.querySelectorAll('h2, h3'));
  const skillsHeading = headings.find((h) => h.textContent?.toLowerCase().includes('skills'));
  const list = doc.createElement('ul');
  skills.forEach((skill) => {
    const li = doc.createElement('li');
    li.textContent = skill;
    list.appendChild(li);
  });
  if (skillsHeading && skillsHeading.parentElement) {
    const next = skillsHeading.nextElementSibling;
    if (next && next.tagName.toLowerCase() === 'ul') {
      skills.forEach((skill) => {
        const li = doc.createElement('li');
        li.textContent = skill;
        next.appendChild(li);
      });
    } else {
      skillsHeading.parentElement.insertBefore(list, skillsHeading.nextSibling);
    }
  } else {
    const h2 = doc.createElement('h2');
    h2.textContent = 'Skills';
    doc.body.appendChild(h2);
    doc.body.appendChild(list);
  }
  return doc.body.innerHTML;
}

function buildResumeData(
  name: string,
  jobTitle: string,
  skillsInput: string,
  experience: ExperienceItem[],
  education: EducationItem[]
): ResumeData {
  const skills = skillsInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const summary = name && jobTitle
    ? `Experienced ${jobTitle} with strengths in ${skills.slice(0, 4).join(', ') || 'cross-functional delivery'}.`
    : '';

  return {
    summary,
    skills,
    experience: experience.filter((e) => e.title || e.company || e.duration || e.description),
    education: education.filter((e) => e.degree || e.institution || e.year),
  };
}

export default function GenerateResumePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState('');
  const [targetTitle, setTargetTitle] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const [experience, setExperience] = useState<ExperienceItem[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);

  const [selectedStyle, setSelectedStyle] = useState<ResumeStyle>('modern');
  const [resumeVersions, setResumeVersions] = useState<Record<ResumeStyle, string>>({
    modern: '',
    professional: '',
    creative: '',
  });
  const [coverLetterHtml, setCoverLetterHtml] = useState('');
  const [resumeTemplate, setResumeTemplate] = useState(RESUME_TEMPLATES[0].id);
  const [coverTemplate, setCoverTemplate] = useState(COVER_TEMPLATES[0].id);
  const [resumeSuggestions, setResumeSuggestions] = useState<string[]>([]);
  const [coverSuggestions, setCoverSuggestions] = useState<string[]>([]);
  const [skillHighlights, setSkillHighlights] = useState<string[]>([]);
  const [resumeHistory, setResumeHistory] = useState<string[]>([]);
  const [resumeHistoryIndex, setResumeHistoryIndex] = useState(-1);
  const [coverHistory, setCoverHistory] = useState<string[]>([]);
  const [coverHistoryIndex, setCoverHistoryIndex] = useState(-1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const resumeChangeRef = useRef<number | null>(null);
  const coverChangeRef = useRef<number | null>(null);
  const skipFirstSaveRef = useRef(true);
  const creatingDraftRef = useRef(false);
  const [draggingExperience, setDraggingExperience] = useState<number | null>(null);
  const [draggingEducation, setDraggingEducation] = useState<number | null>(null);

  const [loadingStyle, setLoadingStyle] = useState<ResumeStyle | null>(null);
  const [loadingCover, setLoadingCover] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);

  const resumeReady = Boolean(resumeVersions[selectedStyle]);
  const resumeTemplateAccent = RESUME_TEMPLATES.find((t) => t.id === resumeTemplate)?.accent || '#0f172a';
  const coverTemplateAccent = COVER_TEMPLATES.find((t) => t.id === coverTemplate)?.accent || '#0f172a';
  const resumePreviewHtml = useMemo(
    () => wrapWithTemplate(resumeVersions[selectedStyle], resumeTemplate, resumeTemplateAccent),
    [resumeVersions, selectedStyle, resumeTemplate, resumeTemplateAccent]
  );
  const coverPreviewHtml = useMemo(
    () => wrapWithTemplate(coverLetterHtml, coverTemplate, coverTemplateAccent),
    [coverLetterHtml, coverTemplate, coverTemplateAccent]
  );
  const highlightMode = searchParams.get('mode') || 'all';

  const progressStep = useMemo(() => {
    if (!fullName.trim() || !targetTitle.trim()) return 1;
    if (!resumeVersions[selectedStyle] && !coverLetterHtml) return 2;
    return 3;
  }, [fullName, targetTitle, resumeVersions, selectedStyle, coverLetterHtml]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      setFullName(saved.fullName || '');
      setTargetTitle(saved.targetTitle || '');
      setSkillsInput(saved.skillsInput || '');
      setCompanyName(saved.companyName || '');
      setJobDescription(saved.jobDescription || '');
      setExperience(saved.experience || []);
      setEducation(saved.education || []);
      setSelectedStyle(saved.selectedStyle || 'modern');
      setResumeVersions(saved.resumeVersions || { modern: '', professional: '', creative: '' });
      setCoverLetterHtml(saved.coverLetterHtml || '');
      setResumeTemplate(saved.resumeTemplate || RESUME_TEMPLATES[0].id);
      setCoverTemplate(saved.coverTemplate || COVER_TEMPLATES[0].id);
      setResumeHistory(saved.resumeHistory || []);
      setResumeHistoryIndex(saved.resumeHistoryIndex ?? -1);
      setCoverHistory(saved.coverHistory || []);
      setCoverHistoryIndex(saved.coverHistoryIndex ?? -1);
      setSkillHighlights(saved.skillHighlights || []);
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    const loadDraft = async () => {
      if (!user) return;
      setLoadingDraft(true);
      try {
        if (user.email) {
          await supabase.from('profiles').upsert({ id: user.id, email: user.email }, { onConflict: 'id' });
        }

        const draftRes = await supabase
          .from('generator_drafts')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (draftRes.error) throw draftRes.error;

        if (draftRes.data) {
          const payload = draftRes.data.payload || {};
          setDraftId(draftRes.data.id);
          setFullName(payload.fullName || '');
          setTargetTitle(payload.targetTitle || '');
          setSkillsInput(payload.skillsInput || '');
          setCompanyName(payload.companyName || '');
          setJobDescription(payload.jobDescription || '');
          setExperience(payload.experience || []);
          setEducation(payload.education || []);
          setSelectedStyle(draftRes.data.resume_style || 'modern');
          setResumeTemplate(draftRes.data.resume_template || RESUME_TEMPLATES[0].id);
          setCoverTemplate(draftRes.data.cover_template || COVER_TEMPLATES[0].id);
          setResumeVersions(payload.resumeVersions || { modern: '', professional: '', creative: '' });
          setCoverLetterHtml(draftRes.data.cover_html || '');
          setSkillHighlights(payload.skillHighlights || []);

          const versionsRes = await supabase
            .from('generator_versions')
            .select('*')
            .eq('generator_id', draftRes.data.id)
            .order('version_index', { ascending: true });
          if (!versionsRes.error && versionsRes.data) {
            const resumeV = versionsRes.data.filter((v) => v.doc_type === 'resume').map((v) => v.content);
            const coverV = versionsRes.data.filter((v) => v.doc_type === 'cover_letter').map((v) => v.content);
            setResumeHistory(resumeV);
            setCoverHistory(coverV);
            setResumeHistoryIndex(resumeV.length - 1);
            setCoverHistoryIndex(coverV.length - 1);
          }
        }
      } catch (e: any) {
        toast({ title: 'Draft load failed', description: e?.message || 'Could not load draft.' });
      } finally {
        setLoadingDraft(false);
        skipFirstSaveRef.current = true;
      }
    };
    void loadDraft();
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      fullName,
      targetTitle,
      skillsInput,
      companyName,
      jobDescription,
      experience,
      education,
      selectedStyle,
      resumeVersions,
      coverLetterHtml,
      resumeTemplate,
      coverTemplate,
      resumeHistory,
      resumeHistoryIndex,
      coverHistory,
      coverHistoryIndex,
      skillHighlights,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    fullName,
    targetTitle,
    skillsInput,
    companyName,
    jobDescription,
    experience,
    education,
    selectedStyle,
    resumeVersions,
    coverLetterHtml,
    resumeTemplate,
    coverTemplate,
    resumeHistory,
    resumeHistoryIndex,
    coverHistory,
    coverHistoryIndex,
    skillHighlights,
  ]);

  useEffect(() => {
    const saveDraft = async () => {
      if (!user) return;
      if (skipFirstSaveRef.current) {
        skipFirstSaveRef.current = false;
        return;
      }
      const payload = {
        fullName,
        targetTitle,
        skillsInput,
        companyName,
        jobDescription,
        experience,
        education,
        resumeVersions,
        skillHighlights,
      };
      const draft = {
        user_id: user.id,
        title: 'AI Generator Draft',
        payload,
        resume_html: resumeVersions[selectedStyle] || null,
        cover_html: coverLetterHtml || null,
        resume_style: selectedStyle,
        resume_template: resumeTemplate,
        cover_template: coverTemplate,
      };

      if (draftId) {
        await supabase.from('generator_drafts').update(draft).eq('id', draftId);
      } else {
        const res = await supabase.from('generator_drafts').insert(draft).select('id').single();
        if (!res.error) setDraftId(res.data.id);
      }
    };

    const timeout = window.setTimeout(() => {
      void saveDraft();
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [
    user,
    draftId,
    fullName,
    targetTitle,
    skillsInput,
    companyName,
    jobDescription,
    experience,
    education,
    resumeVersions,
    coverLetterHtml,
    selectedStyle,
    resumeTemplate,
    coverTemplate,
    skillHighlights,
  ]);

  const resumeData = useMemo(
    () => buildResumeData(fullName, targetTitle, skillsInput, experience, education),
    [fullName, targetTitle, skillsInput, experience, education]
  );

  const handleGenerateResume = async (style: ResumeStyle) => {
    if (!fullName.trim() || !targetTitle.trim()) {
      toast({ title: 'Missing info', description: 'Add your name and target job title first.' });
      return;
    }

    setLoadingStyle(style);
    try {
      const html = await generateResume(
        {
          name: fullName.trim(),
          jobTitle: targetTitle.trim(),
          skills: resumeData.skills,
          experience: resumeData.experience,
          education: resumeData.education,
        },
        style
      );

      setResumeVersions((prev) => ({ ...prev, [style]: html }));
      setSelectedStyle(style);
      pushResumeHistory(html);
      toast({ title: 'Resume generated', description: `Style: ${style}. Feel free to edit below.` });
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e?.message || 'Could not generate resume.' });
    } finally {
      setLoadingStyle(null);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!jobDescription.trim()) {
      toast({ title: 'Missing job description', description: 'Paste the job description first.' });
      return;
    }
    if (!fullName.trim() || !targetTitle.trim()) {
      toast({ title: 'Missing info', description: 'Add your name and target job title first.' });
      return;
    }

    setLoadingCover(true);
    try {
      const letter = await generateCoverLetter(
        resumeData,
        jobDescription.trim(),
        companyName.trim() || 'the company',
        targetTitle.trim()
      );
      const html = plainTextToHtml(letter);
      setCoverLetterHtml(html);
      pushCoverHistory(html);
      toast({ title: 'Cover letter ready', description: 'Edit and export when ready.' });
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e?.message || 'Could not generate cover letter.' });
    } finally {
      setLoadingCover(false);
    }
  };

  const handleSuggestions = async (docType: 'resume' | 'cover_letter') => {
    const content = docType === 'resume' ? resumeVersions[selectedStyle] : coverLetterHtml;
    if (!content) {
      toast({ title: 'Generate first', description: 'Create content before requesting suggestions.' });
      return;
    }
    setLoadingSuggestions(true);
    try {
      const suggestions = await suggestEdits(content, docType, jobDescription.trim() || undefined);
      if (docType === 'resume') {
        setResumeSuggestions(suggestions);
      } else {
        setCoverSuggestions(suggestions);
      }
      toast({ title: 'Suggestions ready', description: 'Review tips in the sidebar.' });
    } catch (e: any) {
      toast({ title: 'Suggestions failed', description: e?.message || 'Could not generate suggestions.' });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleHighlightSkills = async () => {
    if (!jobDescription.trim()) {
      toast({ title: 'Missing job description', description: 'Paste the job description first.' });
      return;
    }
    if (!resumeVersions[selectedStyle]) {
      toast({ title: 'Generate first', description: 'Create a resume before highlighting skills.' });
      return;
    }
    setLoadingSkills(true);
    try {
      const skills = await extractSkills(jobDescription.trim());
      setSkillHighlights(skills);
      const updated = insertSkillsIntoHtml(resumeVersions[selectedStyle], skills);
      setResumeVersions((prev) => ({ ...prev, [selectedStyle]: updated }));
      toast({ title: 'Skills highlighted', description: 'Inserted skills into the resume.' });
    } catch (e: any) {
      toast({ title: 'Highlight failed', description: e?.message || 'Could not insert skills.' });
    } finally {
      setLoadingSkills(false);
    }
  };

  const pushResumeHistory = (value: string) => {
    setResumeHistory((prev) => {
      const trimmed = prev.slice(0, resumeHistoryIndex + 1);
      const next = [...trimmed, value].slice(-MAX_HISTORY);
      const nextIndex = next.length - 1;
      setResumeHistoryIndex(nextIndex);
      void saveVersionToSupabase('resume', value, nextIndex);
      return next;
    });
  };

  const pushCoverHistory = (value: string) => {
    setCoverHistory((prev) => {
      const trimmed = prev.slice(0, coverHistoryIndex + 1);
      const next = [...trimmed, value].slice(-MAX_HISTORY);
      const nextIndex = next.length - 1;
      setCoverHistoryIndex(nextIndex);
      void saveVersionToSupabase('cover_letter', value, nextIndex);
      return next;
    });
  };

  const ensureDraftId = async () => {
    if (!user) return null;
    if (draftId) return draftId;
    if (creatingDraftRef.current) return null;
    creatingDraftRef.current = true;
    const payload = {
      fullName,
      targetTitle,
      skillsInput,
      companyName,
      jobDescription,
      experience,
      education,
      resumeVersions,
      skillHighlights,
    };
    const res = await supabase
      .from('generator_drafts')
      .insert({
        user_id: user.id,
        title: 'AI Generator Draft',
        payload,
        resume_html: resumeVersions[selectedStyle] || null,
        cover_html: coverLetterHtml || null,
        resume_style: selectedStyle,
        resume_template: resumeTemplate,
        cover_template: coverTemplate,
      })
      .select('id')
      .single();
    creatingDraftRef.current = false;
    if (!res.error) {
      setDraftId(res.data.id);
      return res.data.id;
    }
    return null;
  };

  const saveVersionToSupabase = async (docType: 'resume' | 'cover_letter', content: string, versionIndex: number) => {
    if (!user) return;
    const generatorId = await ensureDraftId();
    if (!generatorId) return;
    await supabase.from('generator_versions').insert({
      user_id: user.id,
      generator_id: generatorId,
      doc_type: docType,
      content,
      version_index: versionIndex + 1,
    });
  };

  const handleResumeChange = (val: string) => {
    setResumeVersions((prev) => ({ ...prev, [selectedStyle]: val }));
    if (resumeChangeRef.current) window.clearTimeout(resumeChangeRef.current);
    resumeChangeRef.current = window.setTimeout(() => pushResumeHistory(val), 300);
  };

  const handleCoverChange = (val: string) => {
    setCoverLetterHtml(val);
    if (coverChangeRef.current) window.clearTimeout(coverChangeRef.current);
    coverChangeRef.current = window.setTimeout(() => pushCoverHistory(val), 300);
  };

  const handleResumeUndo = () => {
    if (resumeHistoryIndex <= 0) return;
    const nextIndex = resumeHistoryIndex - 1;
    setResumeHistoryIndex(nextIndex);
    const nextValue = resumeHistory[nextIndex];
    setResumeVersions((prev) => ({ ...prev, [selectedStyle]: nextValue }));
  };

  const handleResumeRedo = () => {
    if (resumeHistoryIndex >= resumeHistory.length - 1) return;
    const nextIndex = resumeHistoryIndex + 1;
    setResumeHistoryIndex(nextIndex);
    const nextValue = resumeHistory[nextIndex];
    setResumeVersions((prev) => ({ ...prev, [selectedStyle]: nextValue }));
  };

  const handleCoverUndo = () => {
    if (coverHistoryIndex <= 0) return;
    const nextIndex = coverHistoryIndex - 1;
    setCoverHistoryIndex(nextIndex);
    setCoverLetterHtml(coverHistory[nextIndex]);
  };

  const handleCoverRedo = () => {
    if (coverHistoryIndex >= coverHistory.length - 1) return;
    const nextIndex = coverHistoryIndex + 1;
    setCoverHistoryIndex(nextIndex);
    setCoverLetterHtml(coverHistory[nextIndex]);
  };

  const moveExperience = (from: number, to: number) => {
    setExperience((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const moveEducation = (from: number, to: number) => {
    setEducation((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleExperienceDrop = (index: number) => {
    if (draggingExperience === null || draggingExperience === index) return;
    moveExperience(draggingExperience, index);
    setDraggingExperience(null);
  };

  const handleEducationDrop = (index: number) => {
    if (draggingEducation === null || draggingEducation === index) return;
    moveEducation(draggingEducation, index);
    setDraggingEducation(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">AI Resume & Cover Letter</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Enter your details, generate multiple resume styles, then edit and export to PDF.
            </p>
            {highlightMode !== 'all' && (
              <div className="mt-2 text-xs text-blue-600">
                Quick mode: {highlightMode === 'resume' ? 'Resume Builder' : 'Cover Letter Generator'}
              </div>
            )}
          </div>
        </div>

        <Card className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${progressStep >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                Step 1: Enter Info
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${progressStep >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                Step 2: AI Generation
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${progressStep >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                Step 3: Review & Export
              </div>
            </div>
            {loadingDraft && (
              <div className="mt-3 text-xs text-slate-500">Loading saved draft from Supabase...</div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="transition-all hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle>Candidate Details</CardTitle>
              <CardDescription>Provide the essentials for AI generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Johnson" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetTitle">Target job title</Label>
                  <Input id="targetTitle" value={targetTitle} onChange={(e) => setTargetTitle(e.target.value)} placeholder="Product Designer" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills">Skills (comma separated)</Label>
                <Input
                  id="skills"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="Figma, UX Research, Design Systems, Prototyping"
                />
                <div className="flex flex-wrap gap-2">
                  {resumeData.skills?.slice(0, 10).map((skill) => (
                    <Badge key={skill} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>

              <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold">Experience</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Add roles and achievements.</div>
                    </div>
                    <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setExperience((prev) => [...prev, { title: '', company: '', duration: '', description: '' }])
                    }
                  >
                    Add role
                  </Button>
                </div>

                {experience.length === 0 ? (
                  <div className="text-sm text-slate-600 dark:text-slate-400">No experience added yet.</div>
                ) : (
                  <div className="space-y-4">
                    {experience.map((exp, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3 transition-all ${
                          draggingExperience === idx ? 'ring-2 ring-blue-400' : ''
                        }`}
                        draggable
                        onDragStart={() => setDraggingExperience(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleExperienceDrop(idx)}
                        onDragEnd={() => setDraggingExperience(null)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <MoveVertical className="h-3 w-3" />
                            Drag-like reorder
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => idx > 0 && moveExperience(idx, idx - 1)}
                              disabled={idx === 0}
                            >
                              Up
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => idx < experience.length - 1 && moveExperience(idx, idx + 1)}
                              disabled={idx === experience.length - 1}
                            >
                              Down
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Input
                            value={exp.title}
                            onChange={(e) =>
                              setExperience((prev) => prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
                            }
                            placeholder="Title"
                          />
                          <Input
                            value={exp.company}
                            onChange={(e) =>
                              setExperience((prev) => prev.map((x, i) => (i === idx ? { ...x, company: e.target.value } : x)))
                            }
                            placeholder="Company"
                          />
                          <Input
                            value={exp.duration}
                            onChange={(e) =>
                              setExperience((prev) => prev.map((x, i) => (i === idx ? { ...x, duration: e.target.value } : x)))
                            }
                            placeholder="Dates"
                          />
                        </div>
                        <Textarea
                          value={exp.description}
                          onChange={(e) =>
                            setExperience((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                          }
                          placeholder="Bullet points, one per line"
                          className="min-h-[110px]"
                        />
                        <div className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setExperience((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">Education</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Degrees, schools, dates.</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEducation((prev) => [...prev, { degree: '', institution: '', year: '' }])}
                  >
                    Add education
                  </Button>
                </div>

                {education.length === 0 ? (
                  <div className="text-sm text-slate-600 dark:text-slate-400">No education added yet.</div>
                ) : (
                  <div className="space-y-4">
                    {education.map((edu, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3 transition-all ${
                          draggingEducation === idx ? 'ring-2 ring-blue-400' : ''
                        }`}
                        draggable
                        onDragStart={() => setDraggingEducation(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleEducationDrop(idx)}
                        onDragEnd={() => setDraggingEducation(null)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <MoveVertical className="h-3 w-3" />
                            Drag-like reorder
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => idx > 0 && moveEducation(idx, idx - 1)}
                              disabled={idx === 0}
                            >
                              Up
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => idx < education.length - 1 && moveEducation(idx, idx + 1)}
                              disabled={idx === education.length - 1}
                            >
                              Down
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Input
                            value={edu.degree}
                            onChange={(e) =>
                              setEducation((prev) => prev.map((x, i) => (i === idx ? { ...x, degree: e.target.value } : x)))
                            }
                            placeholder="Degree"
                          />
                          <Input
                            value={edu.institution}
                            onChange={(e) =>
                              setEducation((prev) => prev.map((x, i) => (i === idx ? { ...x, institution: e.target.value } : x)))
                            }
                            placeholder="Institution"
                          />
                          <Input
                            value={edu.year}
                            onChange={(e) =>
                              setEducation((prev) => prev.map((x, i) => (i === idx ? { ...x, year: e.target.value } : x)))
                            }
                            placeholder="Year"
                          />
                        </div>
                        <div className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setEducation((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="animate-in fade-in-0 slide-in-from-right-2 duration-300 transition-all hover:shadow-lg hover:-translate-y-0.5">
              <CardHeader>
                <CardTitle>Live Tips</CardTitle>
                <CardDescription>AI suggestions and action verbs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Resume tips
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleSuggestions('resume')} disabled={loadingSuggestions}>
                      {loadingSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
                    </Button>
                  </div>
                  {resumeSuggestions.length === 0 ? (
                    <div className="text-xs text-slate-600 dark:text-slate-400">Generate resume to get tips.</div>
                  ) : (
                    <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {resumeSuggestions.map((tip, idx) => (
                        <li key={`rt-${idx}`} className="flex gap-2">
                          <span className="mt-[3px] h-2 w-2 rounded-full bg-amber-400" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-emerald-500" />
                      Cover letter tips
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleSuggestions('cover_letter')} disabled={loadingSuggestions}>
                      {loadingSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
                    </Button>
                  </div>
                  {coverSuggestions.length === 0 ? (
                    <div className="text-xs text-slate-600 dark:text-slate-400">Generate cover letter to get tips.</div>
                  ) : (
                    <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {coverSuggestions.map((tip, idx) => (
                        <li key={`ct-${idx}`} className="flex gap-2">
                          <span className="mt-[3px] h-2 w-2 rounded-full bg-emerald-400" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Separator />

                <div>
                  <div className="font-medium text-sm flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-blue-500" />
                    Action verbs
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ACTION_VERBS.map((verb) => (
                      <Badge key={verb} variant="secondary" className="text-xs">{verb}</Badge>
                    ))}
                  </div>
                </div>

                {skillHighlights.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="font-medium text-sm mb-2">Highlighted skills</div>
                      <div className="flex flex-wrap gap-2">
                        {skillHighlights.map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-lg hover:-translate-y-0.5">
              <CardHeader>
                <CardTitle>Cover Letter Details</CardTitle>
                <CardDescription>Use the job description to tailor the letter.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company name (optional)</Label>
                  <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobDescription">Job description</Label>
                  <Textarea
                    id="jobDescription"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job description here..."
                    className="min-h-[240px]"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleGenerateCoverLetter} disabled={loadingCover} className="gap-2">
                    {loadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Generate cover letter
                  </Button>
                  <Button onClick={handleHighlightSkills} variant="outline" disabled={loadingSkills} className="gap-2">
                    {loadingSkills ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Highlight skills
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Resume Styles
            </CardTitle>
            <CardDescription>Generate a full resume in multiple styles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {RESUME_STYLES.map((style) => (
                <Button
                  key={style.key}
                  variant={selectedStyle === style.key ? 'default' : 'outline'}
                  onClick={() => setSelectedStyle(style.key)}
                  className="gap-2"
                >
                  {style.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {RESUME_STYLES.map((style) => (
                <Button
                  key={`${style.key}-generate`}
                  onClick={() => handleGenerateResume(style.key)}
                  variant="secondary"
                  className="gap-2"
                  disabled={loadingStyle !== null}
                >
                  {loadingStyle === style.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate {style.label}
                </Button>
              ))}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {RESUME_STYLES.find((s) => s.key === selectedStyle)?.tone}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="transition-all hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>Resume Editor</CardTitle>
                  <CardDescription>Edit the selected style before exporting.</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => handleGenerateResume(selectedStyle)}
                    disabled={loadingStyle !== null}
                    className="gap-2"
                  >
                    {loadingStyle === selectedStyle ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Regenerate
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!resumeVersions[selectedStyle]) {
                        toast({ title: 'Generate first', description: 'Create a resume before exporting.' });
                        return;
                      }
                      exportHtmlToPdf(`${fullName || 'resume'}-${selectedStyle}.pdf`, resumePreviewHtml);
                    }}
                    className="gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                    Export PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleResumeUndo}
                    disabled={resumeHistoryIndex <= 0}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Undo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleResumeRedo}
                    disabled={resumeHistoryIndex >= resumeHistory.length - 1}
                    className="gap-1"
                  >
                    Redo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!resumeReady ? (
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Generate a resume style to start editing.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {RESUME_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setResumeTemplate(template.id)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-all hover:shadow-sm ${
                          resumeTemplate === template.id
                            ? 'border-blue-500 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="font-semibold">{template.name}</div>
                        <div className="text-slate-500">{template.description}</div>
                      </button>
                    ))}
                  </div>
                  <RichTextEditor
                    value={resumeVersions[selectedStyle]}
                    onChange={handleResumeChange}
                    placeholder="Your resume will appear here..."
                  />
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-950 animate-in fade-in-0 duration-300">
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Live Preview</div>
                    <div
                      className="prose prose-sm max-w-none"
                      style={{ color: '#0f172a' }}
                      dangerouslySetInnerHTML={{ __html: resumePreviewHtml }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>Cover Letter Editor</CardTitle>
                  <CardDescription>Tailor the letter and export to PDF.</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={handleGenerateCoverLetter}
                    disabled={loadingCover}
                    className="gap-2"
                  >
                    {loadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Regenerate
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!coverLetterHtml) {
                        toast({ title: 'Generate first', description: 'Create a cover letter before exporting.' });
                        return;
                      }
                      exportHtmlToPdf(`${fullName || 'cover-letter'}.pdf`, coverPreviewHtml);
                    }}
                    className="gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                    Export PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCoverUndo}
                    disabled={coverHistoryIndex <= 0}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Undo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCoverRedo}
                    disabled={coverHistoryIndex >= coverHistory.length - 1}
                    className="gap-1"
                  >
                    Redo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!coverLetterHtml ? (
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Generate a cover letter to start editing.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {COVER_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setCoverTemplate(template.id)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-all hover:shadow-sm ${
                          coverTemplate === template.id
                            ? 'border-blue-500 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="font-semibold">{template.name}</div>
                        <div className="text-slate-500">{template.description}</div>
                      </button>
                    ))}
                  </div>
                  <RichTextEditor
                    value={coverLetterHtml}
                    onChange={handleCoverChange}
                    placeholder="Your cover letter will appear here..."
                    minHeight="240px"
                  />
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-950 animate-in fade-in-0 duration-300">
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Live Preview</div>
                    <div
                      className="prose prose-sm max-w-none"
                      style={{ color: '#0f172a' }}
                      dangerouslySetInnerHTML={{ __html: coverPreviewHtml }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
