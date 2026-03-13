import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAiApiKey, getOpenAiModel, openAiChat, parseJsonFromModelOutput } from '@/lib/server/openai';
import { readJson } from '@/lib/server/api-helpers';

const bodySchema = z.object({
  jobDescription: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = await readJson(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const openaiApiKey = getOpenAiApiKey();
  if (!openaiApiKey) {
    return NextResponse.json(
      {
        skills: extractFallbackSkills(body.jobDescription),
      },
      { status: 200 }
    );
  }

  const prompt = `Extract a list of hard and soft skills from this job description.
Return JSON:
{
  "skills": ["skill 1", "skill 2", ...]
}
Keep to 12-18 items, no duplicates, title case when appropriate.

Job Description:
${body.jobDescription}`;

  try {
    const data = await openAiChat({
      apiKey: openaiApiKey,
      model: getOpenAiModel(),
      messages: [
        {
          role: 'system',
          content: 'You are a talent recruiter. Return ONLY valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = data.choices?.[0]?.message?.content ?? '';
    const result = parseJsonFromModelOutput(content);
    return NextResponse.json({ skills: result.skills || [] });
  } catch (error) {
    console.error('Error extracting skills:', error);
    return NextResponse.json({ skills: extractFallbackSkills(body.jobDescription) }, { status: 200 });
  }
}

function extractFallbackSkills(description: string) {
  const lower = description.toLowerCase();
  const common = [
    'Communication',
    'Collaboration',
    'Problem Solving',
    'Leadership',
    'Project Management',
    'Data Analysis',
    'SQL',
    'JavaScript',
    'TypeScript',
    'React',
    'User Research',
    'Agile',
  ];
  return common.filter((skill) => lower.includes(skill.toLowerCase()));
}
