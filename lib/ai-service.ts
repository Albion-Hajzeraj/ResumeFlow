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
    const response = await fetch('/api/ai/generate-resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...resumeData,
        style,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate resume');
    }

    const data = await response.json();
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
    const response = await fetch('/api/ai/suggest-edits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        jobDescription,
        docType,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate suggestions');
    }

    const data = await response.json();
    return data.suggestions || [];
  } catch (error) {
    console.error('Error generating suggestions:', error);
    throw error;
  }
}

export async function extractSkills(jobDescription: string): Promise<string[]> {
  try {
    const response = await fetch('/api/ai/extract-skills', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobDescription }),
    });

    if (!response.ok) {
      throw new Error('Failed to extract skills');
    }

    const data = await response.json();
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
    const response = await fetch('/api/ai/generate-cover-letter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeData,
        jobDescription,
        companyName,
        jobTitle,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate cover letter');
    }

    const data = await response.json();
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
    const response = await fetch('/api/ai/optimize-resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeData,
        jobDescription,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to optimize resume');
    }

    const data = await response.json();
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
    const response = await fetch('/api/ai/analyze-keywords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeContent,
        jobDescription,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze keywords');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error analyzing keywords:', error);
    throw error;
  }
}

export async function parseResumeText(text: string): Promise<ResumeData> {
  try {
    const response = await fetch('/api/ai/parse-resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse resume');
    }

    const data = await response.json();
    return data.parsedResume;
  } catch (error) {
    console.error('Error parsing resume:', error);
    throw error;
  }
}
