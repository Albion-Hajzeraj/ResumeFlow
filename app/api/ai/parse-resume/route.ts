import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getOpenAiApiKey,
  getOpenAiModel,
  openAiChat,
  parseJsonFromModelOutput,
} from '@/lib/server/openai';
import { readJson } from '@/lib/server/api-helpers';

const bodySchema = z.object({
  text: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = await readJson(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const openaiApiKey = getOpenAiApiKey();
  const cleanedText = cleanResumeText(body.text);
  if (!openaiApiKey) {
    return NextResponse.json(
      { parsedResume: fallbackParsedResume(cleanedText) },
      { status: 200 }
    );
  }

  const prompt = `Parse this resume text and extract structured information.

Resume Text:
${cleanedText}

Extract and return a JSON object with this structure:
{
  "summary": "Professional summary or objective",
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "duration": "Time period",
      "description": "Job description and achievements"
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "institution": "School name",
      "year": "Graduation year"
    }
  ],
  "skills": ["skill1", "skill2", ...],
  "contact": {
    "email": "email if found",
    "phone": "phone if found",
    "location": "location if found"
  }
}

Rules:
- Use empty strings when a field is unknown. Do not invent facts.
- Prefer 1-4 experience entries and 0-3 education entries.
- Split experience into separate roles if possible.
- Keep descriptions concise (1-3 sentences).`;

  try {
    const data = await openAiChat({
      apiKey: openaiApiKey,
      model: getOpenAiModel(),
      messages: [
        {
          role: 'system',
          content:
            'You are a resume parsing expert. Return ONLY valid JSON matching the requested schema. No code fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = data.choices?.[0]?.message?.content ?? '';
    const parsedResume = parseJsonFromModelOutput(content);
    return NextResponse.json({ parsedResume: normalizeParsedResume(parsedResume) });
  } catch (error) {
    console.error('Error parsing resume:', error);
    return NextResponse.json(
      { parsedResume: fallbackParsedResume(cleanedText) },
      { status: 200 }
    );
  }
}

function cleanResumeText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '')
    .trim();
}

function normalizeParsedResume(parsed: any) {
  if (!parsed || typeof parsed !== 'object') return fallbackParsedResume('');
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    experience: Array.isArray(parsed.experience)
      ? parsed.experience
          .slice(0, 6)
          .map((e: any) => ({
            title: typeof e?.title === 'string' ? e.title.trim() : '',
            company: typeof e?.company === 'string' ? e.company.trim() : '',
            duration: typeof e?.duration === 'string' ? e.duration.trim() : '',
            description: typeof e?.description === 'string' ? e.description.trim() : '',
          }))
          .filter((e: any) => e.title || e.company || e.description)
      : [],
    education: Array.isArray(parsed.education)
      ? parsed.education
          .slice(0, 4)
          .map((e: any) => ({
            degree: typeof e?.degree === 'string' ? e.degree.trim() : '',
            institution: typeof e?.institution === 'string' ? e.institution.trim() : '',
            year: typeof e?.year === 'string' ? e.year.trim() : '',
          }))
          .filter((e: any) => e.degree || e.institution || e.year)
      : [],
    skills: Array.isArray(parsed.skills)
      ? parsed.skills.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 24)
      : [],
    contact: {
      email: typeof parsed?.contact?.email === 'string' ? parsed.contact.email.trim() : '',
      phone: typeof parsed?.contact?.phone === 'string' ? parsed.contact.phone.trim() : '',
      location: typeof parsed?.contact?.location === 'string' ? parsed.contact.location.trim() : '',
    },
  };
}

function fallbackParsedResume(text: string) {
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(\+?\d[\d(). -]{7,}\d)/);
  const summary = text.split('\n').slice(0, 6).join(' ').trim().slice(0, 280);
  return {
    summary,
    experience: [],
    education: [],
    skills: [],
    contact: {
      email: emailMatch?.[0] || '',
      phone: phoneMatch?.[0] || '',
      location: '',
    },
  };
}
