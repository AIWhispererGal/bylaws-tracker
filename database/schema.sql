-- BYLAWS AMENDMENT TRACKER DATABASE SCHEMA
-- Run this in your Supabase SQL editor

-- Table 1: Document sections (like Article V, Section 1)
CREATE TABLE IF NOT EXISTS bylaw_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id VARCHAR(255) NOT NULL,
  section_citation VARCHAR(255) NOT NULL,
  section_title TEXT,
  original_text TEXT,
  new_text TEXT,
  final_text TEXT,
  
  -- Locking fields
  locked_by_committee BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMP,
  locked_by VARCHAR(255),
  selected_suggestion_id UUID,
  committee_notes TEXT,
  
  -- Board approval
  board_approved BOOLEAN DEFAULT FALSE,
  board_approved_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table 2: Suggestions for each section
CREATE TABLE IF NOT EXISTS bylaw_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES bylaw_sections(id) ON DELETE CASCADE,
  google_suggestion_id VARCHAR(255),
  
  suggested_text TEXT,
  rationale TEXT,
  author_email VARCHAR(255),
  author_name VARCHAR(255),
  
  status VARCHAR(50) DEFAULT 'open',
  support_count INTEGER DEFAULT 0,
  committee_selected BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table 3: Who likes which suggestion
CREATE TABLE IF NOT EXISTS bylaw_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID REFERENCES bylaw_suggestions(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  vote_type VARCHAR(20),
  is_preferred BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(suggestion_id, user_email)
);

-- Create indexes for speed
CREATE INDEX IF NOT EXISTS idx_sections_doc ON bylaw_sections(doc_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_section ON bylaw_suggestions(section_id);

-- Grant permissions (adjust for your Supabase setup)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
