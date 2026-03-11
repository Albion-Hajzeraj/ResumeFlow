/*
  # Resume Generator Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, references auth.users)
      - `email` (text)
      - `full_name` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `resumes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `title` (text) - e.g., "Software Engineer Resume"
      - `original_content` (text) - extracted text from upload
      - `structured_data` (jsonb) - parsed resume sections
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `job_applications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `resume_id` (uuid, references resumes)
      - `company_name` (text)
      - `job_title` (text)
      - `job_description` (text)
      - `keywords` (jsonb) - extracted keywords
      - `match_score` (integer) - 0-100
      - `status` (text) - draft, applied, interview, etc.
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `cover_letters`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `job_application_id` (uuid, references job_applications)
      - `content` (text)
      - `version` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `optimized_resumes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `job_application_id` (uuid, references job_applications)
      - `original_resume_id` (uuid, references resumes)
      - `optimized_content` (jsonb)
      - `suggestions` (jsonb)
      - `version` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Ensure gen_random_uuid() is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  original_content text,
  structured_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create job_applications table
CREATE TABLE IF NOT EXISTS job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resume_id uuid REFERENCES resumes(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  job_title text NOT NULL,
  job_description text NOT NULL,
  keywords jsonb DEFAULT '[]'::jsonb,
  match_score integer DEFAULT 0,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cover_letters table
CREATE TABLE IF NOT EXISTS cover_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_application_id uuid NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  content text NOT NULL,
  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create optimized_resumes table
CREATE TABLE IF NOT EXISTS optimized_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_application_id uuid NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  original_resume_id uuid NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  optimized_content jsonb NOT NULL,
  suggestions jsonb DEFAULT '[]'::jsonb,
  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Basic constraints
ALTER TABLE job_applications
  ADD CONSTRAINT job_applications_match_score_range CHECK (match_score >= 0 AND match_score <= 100);

ALTER TABLE job_applications
  ADD CONSTRAINT job_applications_status_check CHECK (status IN ('draft','applied','interview','offer','rejected'));

ALTER TABLE cover_letters
  ADD CONSTRAINT cover_letters_version_positive CHECK (version >= 1);

ALTER TABLE optimized_resumes
  ADD CONSTRAINT optimized_resumes_version_positive CHECK (version >= 1);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimized_resumes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Resumes policies
CREATE POLICY "Users can view own resumes"
  ON resumes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes"
  ON resumes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes"
  ON resumes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes"
  ON resumes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Job applications policies
CREATE POLICY "Users can view own job applications"
  ON job_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job applications"
  ON job_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own job applications"
  ON job_applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own job applications"
  ON job_applications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Cover letters policies
CREATE POLICY "Users can view own cover letters"
  ON cover_letters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cover letters"
  ON cover_letters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cover letters"
  ON cover_letters FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cover letters"
  ON cover_letters FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Optimized resumes policies
CREATE POLICY "Users can view own optimized resumes"
  ON optimized_resumes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own optimized resumes"
  ON optimized_resumes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own optimized resumes"
  ON optimized_resumes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own optimized resumes"
  ON optimized_resumes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_user_id ON cover_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_optimized_resumes_user_id ON optimized_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_resume_id ON job_applications(resume_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_job_application_id ON cover_letters(job_application_id);
CREATE INDEX IF NOT EXISTS idx_optimized_resumes_job_application_id ON optimized_resumes(job_application_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cover_letters_application_version
  ON cover_letters(job_application_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS uq_optimized_resumes_application_version
  ON optimized_resumes(job_application_id, version);

-- updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at_profiles ON profiles;
CREATE TRIGGER set_updated_at_profiles
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_resumes ON resumes;
CREATE TRIGGER set_updated_at_resumes
BEFORE UPDATE ON resumes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_job_applications ON job_applications;
CREATE TRIGGER set_updated_at_job_applications
BEFORE UPDATE ON job_applications
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_cover_letters ON cover_letters;
CREATE TRIGGER set_updated_at_cover_letters
BEFORE UPDATE ON cover_letters
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_optimized_resumes ON optimized_resumes;
CREATE TRIGGER set_updated_at_optimized_resumes
BEFORE UPDATE ON optimized_resumes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
