import { createClient } from '@supabase/supabase-js';

// Next.js only inlines NEXT_PUBLIC_* when accessed via static property access.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing env var NEXT_PUBLIC_SUPABASE_URL. Check your .env and restart the dev server.'
  );
}
if (!supabaseAnonKey) {
  throw new Error(
    'Missing env var NEXT_PUBLIC_SUPABASE_ANON_KEY. Check your .env and restart the dev server.'
  );
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          original_content: string | null;
          structured_data: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          original_content?: string | null;
          structured_data?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          original_content?: string | null;
          structured_data?: any;
          updated_at?: string;
        };
        Relationships: [];
      };
      job_applications: {
        Row: {
          id: string;
          user_id: string;
          resume_id: string | null;
          company_name: string;
          job_title: string;
          job_description: string;
          keywords: any;
          match_score: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          resume_id?: string | null;
          company_name: string;
          job_title: string;
          job_description: string;
          keywords?: any;
          match_score?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          resume_id?: string | null;
          company_name?: string;
          job_title?: string;
          job_description?: string;
          keywords?: any;
          match_score?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cover_letters: {
        Row: {
          id: string;
          user_id: string;
          job_application_id: string;
          content: string;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_application_id: string;
          content: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      optimized_resumes: {
        Row: {
          id: string;
          user_id: string;
          job_application_id: string;
          original_resume_id: string;
          optimized_content: any;
          suggestions: any;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_application_id: string;
          original_resume_id: string;
          optimized_content: any;
          suggestions?: any;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          optimized_content?: any;
          suggestions?: any;
          version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      generator_drafts: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          payload: any;
          resume_html: string | null;
          cover_html: string | null;
          resume_style: string;
          resume_template: string;
          cover_template: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          payload?: any;
          resume_html?: string | null;
          cover_html?: string | null;
          resume_style?: string;
          resume_template?: string;
          cover_template?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          payload?: any;
          resume_html?: string | null;
          cover_html?: string | null;
          resume_style?: string;
          resume_template?: string;
          cover_template?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      generator_versions: {
        Row: {
          id: string;
          user_id: string;
          generator_id: string;
          doc_type: string;
          content: string;
          version_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          generator_id: string;
          doc_type: string;
          content: string;
          version_index?: number;
          created_at?: string;
        };
        Update: {
          content?: string;
          version_index?: number;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
