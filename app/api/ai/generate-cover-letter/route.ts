import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAiApiKey, getOpenAiModel, openAiChat } from '@/lib/server/openai';
import { readJson } from '@/lib/server/api-helpers';

const bodySchema = z.object({
  resumeData: z.any(),
  jobDescription: z.string().min(1),
  companyName: z.string().min(1),
  jobTitle: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = await readJson(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const openaiApiKey = getOpenAiApiKey();
  if (!openaiApiKey) {
    return NextResponse.json(
      {
        coverLetter: generateFallbackCoverLetter(body.companyName, body.jobTitle, body.resumeData),
      },
      { status: 200 }
    );
  }

  const prompt = `Generate a professional cover letter for the following:

Job Title: ${body.jobTitle}
Company: ${body.companyName}

Job Description:
${body.jobDescription}

Candidate's Resume Summary:
${JSON.stringify(body.resumeData, null, 2)}

Please write a compelling, professional cover letter that:
1. Addresses the specific requirements in the job description
2. Highlights relevant experience and skills from the resume
3. Shows enthusiasm for the role and company
4. Is 3-4 paragraphs long
5. Uses a professional but personable tone
6. Includes specific examples of achievements when relevant

Format the letter with proper spacing but do not include the address header or date.`;

  try {
    const data = await openAiChat({
      apiKey: openaiApiKey,
      model: getOpenAiModel(),
      messages: [
        {
          role: 'system',
          content:
            'You are a professional career coach and resume writer. Write a cover letter in plain text. Do not use markdown.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const coverLetter = (data.choices?.[0]?.message?.content ?? '').trim();
    return NextResponse.json({ coverLetter });
  } catch (error) {
    console.error('Error generating cover letter:', error);
    return NextResponse.json(
      {
        coverLetter: generateFallbackCoverLetter(body.companyName, body.jobTitle, body.resumeData),
      },
      { status: 200 }
    );
  }
}

function generateFallbackCoverLetter(companyName: string, jobTitle: string, resumeData: any) {
  return `Dear Hiring Manager,

I am writing to express my strong interest in the ${jobTitle} position at ${companyName}. With my background and experience, I am confident that I would be a valuable addition to your team.

${resumeData.summary || 'Throughout my career, I have developed strong skills and expertise that align well with the requirements of this role. My experience has equipped me with the technical abilities and professional qualities needed to excel in this position.'}

I am particularly drawn to ${companyName} because of its reputation for excellence and innovation. I am excited about the opportunity to contribute to your team and help drive success in this role.

Thank you for considering my application. I look forward to the opportunity to discuss how my skills and experience can benefit ${companyName}.

Best regards`;
}
