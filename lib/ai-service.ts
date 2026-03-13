export interface ResumeData {
  summary?: string;
  experience?: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education?: Array<{
    degree: string;
    institution: string;
    year: string;
  }>;
  skills?: string[];
  [key: string]: any;
}

export interface KeywordAnalysis {
  keywords: string[];
  matchScore: number;
  missingKeywords: string[];
  presentKeywords: string[];
}

export type ResumeStyle = 'modern' | 'professional' | 'creative';

async function postJson<T>(url: string, payload: unknown, errorMessage: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

export async function generateResume(
  resumeData: {
    name: string;
    jobTitle: string;
    skills?: string[];
    experience?: ResumeData['experience'];
    education?: ResumeData['education'];
  },
  style: ResumeStyle
): Promise<string> {
  try {
    const data = await postJson<{ resumeHtml: string }>(
      '/api/ai/generate-resume',
      { ...resumeData, style },
      'Failed to generate resume'
    );
    return data.resumeHtml;
  } catch (error) {
    console.error('Error generating resume:', error);
    throw error;
  }
}

export async function suggestEdits(
  content: string,
  docType: 'resume' | 'cover_letter',
  jobDescription?: string
): Promise<string[]> {
  try {
    const data = await postJson<{ suggestions?: string[] }>(
      '/api/ai/suggest-edits',
      { content, jobDescription, docType },
      'Failed to generate suggestions'
    );
    return data.suggestions || [];
  } catch (error) {
    console.error('Error generating suggestions:', error);
    throw error;
  }
}

export async function extractSkills(jobDescription: string): Promise<string[]> {
  try {
    const data = await postJson<{ skills?: string[] }>(
      '/api/ai/extract-skills',
      { jobDescription },
      'Failed to extract skills'
    );
    return data.skills || [];
  } catch (error) {
    console.error('Error extracting skills:', error);
    throw error;
  }
}

export async function generateCoverLetter(
  resumeData: ResumeData,
  jobDescription: string,
  companyName: string,
  jobTitle: string
): Promise<string> {
  try {
    const data = await postJson<{ coverLetter: string }>(
      '/api/ai/generate-cover-letter',
      { resumeData, jobDescription, companyName, jobTitle },
      'Failed to generate cover letter'
    );
    return data.coverLetter;
  } catch (error) {
    console.error('Error generating cover letter:', error);
    throw error;
  }
}

export async function optimizeResume(
  resumeData: ResumeData,
  jobDescription: string
): Promise<{
  optimizedResume: ResumeData;
  suggestions: string[];
}> {
  try {
    const data = await postJson<{ optimizedResume: ResumeData; suggestions: string[] }>(
      '/api/ai/optimize-resume',
      { resumeData, jobDescription },
      'Failed to optimize resume'
    );
    return {
      optimizedResume: data.optimizedResume,
      suggestions: data.suggestions,
    };
  } catch (error) {
    console.error('Error optimizing resume:', error);
    throw error;
  }
}

export async function analyzeKeywords(
  resumeContent: string,
  jobDescription: string
): Promise<KeywordAnalysis> {
  try {
    return await postJson<KeywordAnalysis>(
      '/api/ai/analyze-keywords',
      { resumeContent, jobDescription },
      'Failed to analyze keywords'
    );
  } catch (error) {
    console.error('Error analyzing keywords:', error);
    throw error;
  }
}

export async function parseResumeText(text: string): Promise<ResumeData> {
  try {
    const data = await postJson<{ parsedResume: ResumeData }>(
      '/api/ai/parse-resume',
      { text },
      'Failed to parse resume'
    );
    return data.parsedResume;
  } catch (error) {
    console.error('Error parsing resume:', error);
    throw error;
  }
}
