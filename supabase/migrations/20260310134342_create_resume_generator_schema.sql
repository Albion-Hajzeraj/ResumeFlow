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

-- Generator drafts table
CREATE TABLE IF NOT EXISTS generator_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text DEFAULT 'AI Generator Draft',
  payload jsonb DEFAULT '{}'::jsonb,
  resume_html text,
  cover_html text,
  resume_style text DEFAULT 'modern',
  resume_template text DEFAULT 'onyx',
  cover_template text DEFAULT 'classic',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Generator versions table
CREATE TABLE IF NOT EXISTS generator_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  generator_id uuid NOT NULL REFERENCES generator_drafts(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  content text NOT NULL,
  version_index integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Basic constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_applications_match_score_range'
  ) THEN
    ALTER TABLE job_applications
      ADD CONSTRAINT job_applications_match_score_range CHECK (match_score >= 0 AND match_score <= 100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_applications_status_check'
  ) THEN
    ALTER TABLE job_applications
      ADD CONSTRAINT job_applications_status_check CHECK (status IN ('draft','applied','interview','offer','rejected'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cover_letters_version_positive'
  ) THEN
    ALTER TABLE cover_letters
      ADD CONSTRAINT cover_letters_version_positive CHECK (version >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'optimized_resumes_version_positive'
  ) THEN
    ALTER TABLE optimized_resumes
      ADD CONSTRAINT optimized_resumes_version_positive CHECK (version >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generator_versions_doc_type_check'
  ) THEN
    ALTER TABLE generator_versions
      ADD CONSTRAINT generator_versions_doc_type_check CHECK (doc_type IN ('resume','cover_letter'));
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimized_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE generator_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE generator_versions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON profiles FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Resumes policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own resumes' AND tablename = 'resumes'
  ) THEN
    CREATE POLICY "Users can view own resumes"
      ON resumes FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own resumes' AND tablename = 'resumes'
  ) THEN
    CREATE POLICY "Users can insert own resumes"
      ON resumes FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own resumes' AND tablename = 'resumes'
  ) THEN
    CREATE POLICY "Users can update own resumes"
      ON resumes FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own resumes' AND tablename = 'resumes'
  ) THEN
    CREATE POLICY "Users can delete own resumes"
      ON resumes FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Job applications policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own job applications' AND tablename = 'job_applications'
  ) THEN
    CREATE POLICY "Users can view own job applications"
      ON job_applications FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own job applications' AND tablename = 'job_applications'
  ) THEN
    CREATE POLICY "Users can insert own job applications"
      ON job_applications FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own job applications' AND tablename = 'job_applications'
  ) THEN
    CREATE POLICY "Users can update own job applications"
      ON job_applications FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own job applications' AND tablename = 'job_applications'
  ) THEN
    CREATE POLICY "Users can delete own job applications"
      ON job_applications FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Cover letters policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own cover letters' AND tablename = 'cover_letters'
  ) THEN
    CREATE POLICY "Users can view own cover letters"
      ON cover_letters FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own cover letters' AND tablename = 'cover_letters'
  ) THEN
    CREATE POLICY "Users can insert own cover letters"
      ON cover_letters FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own cover letters' AND tablename = 'cover_letters'
  ) THEN
    CREATE POLICY "Users can update own cover letters"
      ON cover_letters FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own cover letters' AND tablename = 'cover_letters'
  ) THEN
    CREATE POLICY "Users can delete own cover letters"
      ON cover_letters FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Optimized resumes policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own optimized resumes' AND tablename = 'optimized_resumes'
  ) THEN
    CREATE POLICY "Users can view own optimized resumes"
      ON optimized_resumes FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own optimized resumes' AND tablename = 'optimized_resumes'
  ) THEN
    CREATE POLICY "Users can insert own optimized resumes"
      ON optimized_resumes FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own optimized resumes' AND tablename = 'optimized_resumes'
  ) THEN
    CREATE POLICY "Users can update own optimized resumes"
      ON optimized_resumes FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own optimized resumes' AND tablename = 'optimized_resumes'
  ) THEN
    CREATE POLICY "Users can delete own optimized resumes"
      ON optimized_resumes FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Generator drafts policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own generator drafts' AND tablename = 'generator_drafts'
  ) THEN
    CREATE POLICY "Users can view own generator drafts"
      ON generator_drafts FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own generator drafts' AND tablename = 'generator_drafts'
  ) THEN
    CREATE POLICY "Users can insert own generator drafts"
      ON generator_drafts FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own generator drafts' AND tablename = 'generator_drafts'
  ) THEN
    CREATE POLICY "Users can update own generator drafts"
      ON generator_drafts FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own generator drafts' AND tablename = 'generator_drafts'
  ) THEN
    CREATE POLICY "Users can delete own generator drafts"
      ON generator_drafts FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Generator versions policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own generator versions' AND tablename = 'generator_versions'
  ) THEN
    CREATE POLICY "Users can view own generator versions"
      ON generator_versions FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own generator versions' AND tablename = 'generator_versions'
  ) THEN
    CREATE POLICY "Users can insert own generator versions"
      ON generator_versions FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own generator versions' AND tablename = 'generator_versions'
  ) THEN
    CREATE POLICY "Users can delete own generator versions"
      ON generator_versions FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_user_id ON cover_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_optimized_resumes_user_id ON optimized_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_resume_id ON job_applications(resume_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_job_application_id ON cover_letters(job_application_id);
CREATE INDEX IF NOT EXISTS idx_optimized_resumes_job_application_id ON optimized_resumes(job_application_id);
CREATE INDEX IF NOT EXISTS idx_generator_drafts_user_id ON generator_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_generator_versions_user_id ON generator_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_generator_versions_generator_id ON generator_versions(generator_id);

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

DROP TRIGGER IF EXISTS set_updated_at_generator_drafts ON generator_drafts;
CREATE TRIGGER set_updated_at_generator_drafts
BEFORE UPDATE ON generator_drafts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
