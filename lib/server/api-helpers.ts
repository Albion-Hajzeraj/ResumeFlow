import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function readJson<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<ParsedBody<T>> {
  try {
    const raw = await request.json();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, response: badRequest('Invalid request body') };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, response: badRequest('Invalid request body') };
  }
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}
