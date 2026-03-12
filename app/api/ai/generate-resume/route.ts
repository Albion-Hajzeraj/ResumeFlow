import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAiApiKey, getOpenAiModel, openAiChat } from '@/lib/server/openai';

const experienceSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  duration: z.string().min(1),
  description: z.string().min(1),
});

const educationSchema = z.object({
  degree: z.string().min(1),
  institution: z.string().min(1),
  year: z.string().min(1),
});

const bodySchema = z.object({
  name: z.string().min(1),
  jobTitle: z.string().min(1),
  skills: z.array(z.string()).optional(),
  experience: z.array(experienceSchema).optional(),
  education: z.array(educationSchema).optional(),
  style: z.enum(['modern', 'professional', 'creative']),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const openaiApiKey = getOpenAiApiKey();
  if (!openaiApiKey) {
    return NextResponse.json({ resumeHtml: generateFallbackResume(body) }, { status: 200 });
  }

  const styleHint =
    body.style === 'modern'
      ? 'Clean, contemporary layout with concise sections and strong action verbs.'
      : body.style === 'creative'
        ? 'Distinctive, energetic tone with tasteful flair while staying professional.'
        : 'Traditional, formal, and ATS-friendly tone with clear section headings.';

  const prompt = `Create a ${body.style} resume in HTML using the details below.

Candidate:
Name: ${body.name}
Target Job Title: ${body.jobTitle}
Skills: ${(body.skills || []).join(', ')}
Experience: ${JSON.stringify(body.experience || [], null, 2)}
Education: ${JSON.stringify(body.education || [], null, 2)}

Requirements:
- Output ONLY valid HTML (no markdown, no code fences).
- Include sections: Summary, Experience, Skills, Education.
- Keep it to one page if possible.
- Use bullet points for achievements under each role.
- ${styleHint}
- Do not invent employers or dates; if data is missing, keep it brief or omit details.
`;

  try {
    const data = await openAiChat({
      apiKey: openaiApiKey,
      model: getOpenAiModel(),
      messages: [
        {
          role: 'system',
          content:
            'You are an expert resume writer. Return only HTML for the resume with semantic tags.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1400,
    });

    const resumeHtml = (data.choices?.[0]?.message?.content ?? '').trim();
    return NextResponse.json({ resumeHtml });
  } catch (error) {
    console.error('Error generating resume:', error);
    return NextResponse.json({ resumeHtml: generateFallbackResume(body) }, { status: 200 });
  }
}

function generateFallbackResume(body: z.infer<typeof bodySchema>) {
  const skills = (body.skills || []).filter(Boolean);
  const experience = body.experience || [];
  const education = body.education || [];

  const summary = `Results-focused ${body.jobTitle} with experience across ${
    skills.slice(0, 3).join(', ') || 'core tools and methodologies'
  }. Proven ability to deliver measurable impact and collaborate across teams.`;

  const expHtml = experience
    .map(
      (exp) => `
      <div class="role">
        <h3>${exp.title} - ${exp.company}</h3>
        <div class="meta">${exp.duration}</div>
        <ul>
          ${exp.description
            .split('\n')
            .filter(Boolean)
            .map((line) => `<li>${line}</li>`)
            .join('')}
        </ul>
      </div>
    `
    )
    .join('');

  const eduHtml = education
    .map((edu) => `<div class="edu"><strong>${edu.degree}</strong> - ${edu.institution} (${edu.year})</div>`)
    .join('');

  return `
  <div class="resume ${body.style}">
    <h1>${body.name}</h1>
    <p class="title">${body.jobTitle}</p>
    <h2>Summary</h2>
    <p>${summary}</p>
    <h2>Experience</h2>
    ${expHtml || '<p>Add experience details to enrich this section.</p>'}
    <h2>Skills</h2>
    <ul>${skills.map((s) => `<li>${s}</li>`).join('')}</ul>
    <h2>Education</h2>
    ${eduHtml || '<p>Add education details to enrich this section.</p>'}
  </div>
  `.trim();
}


