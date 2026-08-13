-- Migration: 004_add_note_to_dispositions.sql
-- Description: Add note column to dispositions table for remarks/notes

ALTER TABLE dispositions ADD COLUMN IF NOT EXISTS note TEXT;
