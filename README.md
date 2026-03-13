# ResumeFlow AI

AI-powered dashboard to create, optimize, and track job applications. Upload or paste a resume, parse structured experience, generate optimized resumes and cover letters, and manage everything in a Supabase-backed dashboard.

## Features
- New application flow with AI parsing and optimization
- Resume parsing into structured experience/skills
- Keyword analysis against job descriptions
- Cover letter generation
- Document library for resumes, cover letters, and optimized versions
- Supabase-backed data storage and auth
- Optional client-side OCR for scanned PDFs

## Tech Stack
- Next.js 13 (App Router)
- React 18
- Supabase
- Tailwind CSS + Radix UI
- OpenAI API (for parsing, optimization, generation)
- PDF parsing + optional OCR

## Getting Started

### 1) Install dependencies
```
npm install
```

### 2) Environment variables
Create a `.env` file in the project root:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```
`OPENAI_API_KEY` is optional, but AI features won’t run without it.

### 3) Supabase schema
Run the migration in `supabase/migrations/20260310134342_resume_schema.sql` in the Supabase SQL Editor.

### 4) Run the app
```
npm run dev
```

Open `http://localhost:3000`.

## Notes on OCR
Scanned PDFs (image-only) require OCR. The app uses client-side OCR, which can be slow for large PDFs. For best results:
- Use clear, high-contrast scans
- Keep PDFs under ~5 pages
- Prefer text-based PDFs or `.txt` paste when possible

## Scripts
- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - lint
- `npm run typecheck` - TypeScript checks

## Project Structure
```
app/                # Next.js routes and pages
components/         # UI components
hooks/              # React hooks
lib/                # Client/server helpers
supabase/           # SQL schema
public/             # Static assets
```

## Troubleshooting
- **PDF parsing fails**: use OCR toggle or paste text directly.
- **Supabase errors**: ensure tables exist and env vars are set.
- **AI parsing is weak**: try a text-based PDF or paste plain text.

## License
Private. All rights reserved.

