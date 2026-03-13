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
  resumeContent: z.string().min(1),
  jobDescription: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = await readJson(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const openaiApiKey = getOpenAiApiKey();
  if (!openaiApiKey) {
    return NextResponse.json(
      generateFallbackKeywordAnalysis(body.resumeContent, body.jobDescription),
      { status: 200 }
    );
  }

  const prompt = `Analyze the keywords in this job description and compare them with the resume content.

Job Description:
${body.jobDescription}

Resume Content:
${body.resumeContent}

Provide a JSON response with:
1. "keywords": Array of important keywords from the job description
2. "matchScore": A score from 0-100 indicating how well the resume matches
3. "missingKeywords": Keywords from the job description not found in resume
4. "presentKeywords": Keywords that are present in the resume

Format:
{
  "keywords": ["keyword1", "keyword2", ...],
  "matchScore": 75,
  "missingKeywords": ["keyword1", ...],
  "presentKeywords": ["keyword2", ...]
}`;

  try {
    const data = await openAiChat({
      apiKey: openaiApiKey,
      model: getOpenAiModel(),
      messages: [
        {
          role: 'system',
          content:
            'You are an ATS keyword analysis expert. Return ONLY valid JSON matching the requested schema. No code fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = data.choices?.[0]?.message?.content ?? '';
    const result = parseJsonFromModelOutput(content);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error analyzing keywords:', error);
    return NextResponse.json(
      generateFallbackKeywordAnalysis(body.resumeContent, body.jobDescription),
      { status: 200 }
    );
  }
}

function generateFallbackKeywordAnalysis(resumeContent: string, jobDescription: string) {
  const resumeLower = resumeContent.toLowerCase();
  const jobLower = jobDescription.toLowerCase();

  const commonKeywords = [
    'experience',
    'skills',
    'management',
    'development',
    'team',
    'project',
    'leadership',
    'communication',
    'technical',
    'analysis',
  ];

  const presentKeywords = commonKeywords.filter((keyword) => resumeLower.includes(keyword));
  const missingKeywords = commonKeywords.filter(
    (keyword) => jobLower.includes(keyword) && !resumeLower.includes(keyword)
  );

  const matchScore = Math.round((presentKeywords.length / commonKeywords.length) * 100);

  return {
    keywords: commonKeywords,
    matchScore,
    missingKeywords,
    presentKeywords,
  };
}
