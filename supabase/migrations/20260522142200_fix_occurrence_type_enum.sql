-- Migration: 20260522142200_fix_occurrence_type_enum.sql

BEGIN;

-- Adiciona os valores em inglês ao enum caso o banco tenha sido modificado para português
ALTER TYPE public.occurrence_type ADD VALUE IF NOT EXISTS 'motorcycle_issue';
ALTER TYPE public.occurrence_type ADD VALUE IF NOT EXISTS 'accident';
ALTER TYPE public.occurrence_type ADD VALUE IF NOT EXISTS 'robbery';
ALTER TYPE public.occurrence_type ADD VALUE IF NOT EXISTS 'other';

COMMIT;

NOTIFY pgrst, 'reload schema';
