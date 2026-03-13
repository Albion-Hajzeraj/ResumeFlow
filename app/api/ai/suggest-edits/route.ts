import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAiApiKey, getOpenAiModel, openAiChat, parseJsonFromModelOutput } from '@/lib/server/openai';
import { readJson } from '@/lib/server/api-helpers';

const bodySchema = z.object({
  content: z.string().min(1),
  jobDescription: z.string().optional(),
  docType: z.enum(['resume', 'cover_letter']),
});

export async function POST(request: NextRequest) {
  const parsed = await readJson(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const openaiApiKey = getOpenAiApiKey();
  if (!openaiApiKey) {
    return NextResponse.json(
      {
        suggestions: fallbackSuggestions(),
      },
      { status: 200 }
    );
  }

  const prompt = `Review the ${body.docType} content below and provide concise, actionable improvement suggestions.
${body.jobDescription ? `\nJob Description:\n${body.jobDescription}\n` : ''}
Content:
${body.content}

Return JSON:
{
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}
Keep each suggestion under 18 words.`;

  try {
    const data = await openAiChat({
      apiKey: openaiApiKey,
      model: getOpenAiModel(),
      messages: [
        {
          role: 'system',
          content: 'You are a resume and cover letter editor. Return ONLY valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const content = data.choices?.[0]?.message?.content ?? '';
    const result = parseJsonFromModelOutput(content);
    return NextResponse.json({ suggestions: result.suggestions || [] });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      {
        suggestions: fallbackSuggestions().slice(0, 2),
      },
      { status: 200 }
    );
  }
}

function fallbackSuggestions() {
  return [
    'Use strong action verbs at the start of each bullet.',
    'Quantify impact with metrics (%, $, time, scale).',
    'Align keywords with the job description.',
    'Remove filler phrases and tighten sentences.',
  ];
}
