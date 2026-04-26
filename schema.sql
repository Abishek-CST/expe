-- schema.sql
-- Execute this script in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create expenses table
CREATE TABLE expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    date DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL
);

-- Create settings table (for budget and other configs)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default budget
INSERT INTO settings (key, value) VALUES ('budget', '{"monthly": 1000}') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('theme', '{"mode": "light"}') ON CONFLICT (key) DO NOTHING;

-- Security: Disable RLS for prototyping. 
-- IMPORTANT: For a production app, you should ENABLE ROW LEVEL SECURITY (RLS) 
-- and set up policies so only authorized users can read/write data.
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
