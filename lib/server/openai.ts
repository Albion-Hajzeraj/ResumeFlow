import { z } from 'zod';

const openAiErrorSchema = z
  .object({
    error: z
      .object({
        message: z.string().optional(),
        type: z.string().optional(),
        code: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

export function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY ?? '';
}

export function getOpenAiModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

function stripCodeFences(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  const lines = trimmed.split('\n');
  if (lines.length < 3) return trimmed;
  if (!lines[0].startsWith('```')) return trimmed;

  const last = lines[lines.length - 1].trim();
  if (last !== '```') return trimmed;

  return lines.slice(1, -1).join('\n').trim();
}

function findJsonSlice(text: string) {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return text.slice(firstBracket, lastBracket + 1);
  }

  return null;
}

export function parseJsonFromModelOutput(output: string) {
  const candidate = stripCodeFences(output);
  try {
    return JSON.parse(candidate);
  } catch {
    const slice = findJsonSlice(candidate);
    if (slice) return JSON.parse(slice);

    throw new Error('Model response was not valid JSON');
  }
}

export async function openAiChat(request: {
  apiKey: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: unknown;
}) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      ...(request.response_format ? { response_format: request.response_format } : {}),
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    let details: string | undefined;
    try {
      const maybe = openAiErrorSchema.safeParse(JSON.parse(text));
      if (maybe.success) details = maybe.data?.error?.message;
    } catch {
      // ignore
    }
    throw new Error(details || `OpenAI request failed (${response.status})`);
  }

  return JSON.parse(text);
}
