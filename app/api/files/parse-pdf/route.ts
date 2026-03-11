import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    process.env.PDFJS_DISABLE_WORKER = 'true';

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const name = file.name || '';
    const type = file.type || '';
    if (!name.toLowerCase().endsWith('.pdf') && type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Use the CJS build to avoid webpack export analysis issues with pdfjs-dist in Next 13.
    const require = createRequire(import.meta.url);
    const pdfParse = require('pdf-parse') as any;
    let text = '';

    if (typeof pdfParse === 'function') {
      const result = await pdfParse(buffer);
      text = String(result?.text || '').trim();
    } else if (pdfParse?.PDFParse) {
      const parser = new pdfParse.PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      text = String(result?.text || '').trim();
    } else {
      throw new Error('pdf-parse did not load correctly');
    }

    if (!text) {
      return NextResponse.json(
        {
          error:
            'No text could be extracted from this PDF. If it is a scanned image, OCR is required.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('PDF parse failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to parse PDF' },
      { status: 500 }
    );
  }
}
