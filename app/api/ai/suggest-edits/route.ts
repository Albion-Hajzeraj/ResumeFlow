import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAiApiKey, getOpenAiModel, openAiChat, parseJsonFromModelOutput } from '@/lib/server/openai';

const bodySchema = z.object({
  content: z.string().min(1),
  jobDescription: z.string().optional(),
  docType: z.enum(['resume', 'cover_letter']),
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
    return NextResponse.json(
      {
        suggestions: [
          'Use strong action verbs at the start of each bullet.',
          'Quantify impact with metrics (%, $, time, scale).',
          'Align keywords with the job description.',
          'Remove filler phrases and tighten sentences.',
        ],
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
        suggestions: [
          'Use strong action verbs at the start of each bullet.',
          'Quantify impact with metrics (%, $, time, scale).',
        ],
      },
      { status: 200 }
    );
  }
}

