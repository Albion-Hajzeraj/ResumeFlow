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
  resumeData: z.any(),
  jobDescription: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = await readJson(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const openaiApiKey = getOpenAiApiKey();
  if (!openaiApiKey) {
    return NextResponse.json(generateFallbackOptimization(body.resumeData), { status: 200 });
  }

  const prompt = `Analyze this resume against the job description and provide optimization suggestions.

Resume:
${JSON.stringify(body.resumeData, null, 2)}

Job Description:
${body.jobDescription}

Provide:
1. An optimized version of the resume with improved bullet points and keywords
2. A list of specific suggestions for improvement
3. Keywords to add
4. Areas where experience could be better highlighted

Return the response as JSON with this structure:
{
  "optimizedResume": { ... improved resume data ... },
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}`;

  try {
    const data = await openAiChat({
      apiKey: openaiApiKey,
      model: getOpenAiModel(),
      messages: [
        {
          role: 'system',
          content:
            'You are an expert resume optimizer and ATS specialist. Return ONLY valid JSON matching the requested schema. No code fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = data.choices?.[0]?.message?.content ?? '';
    const result = parseJsonFromModelOutput(content);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error optimizing resume:', error);
    return NextResponse.json(generateFallbackOptimization(body.resumeData), { status: 200 });
  }
}

function generateFallbackOptimization(resumeData: any) {
  return {
    optimizedResume: resumeData,
    suggestions: [
      'Add quantifiable achievements with specific metrics and numbers',
      'Include relevant keywords from the job description throughout your resume',
      'Strengthen action verbs in bullet points (e.g., "Led", "Developed", "Achieved")',
      'Ensure your summary statement directly addresses key job requirements',
      'Highlight transferable skills that match the position',
      'Remove outdated or irrelevant experience to maintain focus',
      'Format consistently for ATS compatibility',
    ],
  };
}
