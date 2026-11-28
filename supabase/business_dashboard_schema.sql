-- ==============================================================================
-- Zuggi Freight Marketplace — Customer Business Dashboard (MVP) Migration
-- Safe Idempotent Migration: STRICTLY uses IF NOT EXISTS (Zero DROP / TRUNCATE)
-- Run in Supabase SQL Editor (PostgreSQL 15+)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. business_profiles: B2B Shipper Legal Entity, 15-Digit GSTIN & Billing Info
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  external_user_id text UNIQUE NOT NULL,
  company_legal_name text NOT NULL DEFAULT '',
  gstin text,
  billing_address text NOT NULL DEFAULT '',
  billing_city text NOT NULL DEFAULT 'Guwahati',
  billing_state text NOT NULL DEFAULT 'Assam',
  billing_pincode text NOT NULL DEFAULT '',
  contact_person text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_profiles_gstin_format_chk CHECK (
    gstin IS NULL
    OR gstin = ''
    OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id
  ON public.business_profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_business_profiles_external_user_id
  ON public.business_profiles (external_user_id);

-- ------------------------------------------------------------------------------
-- 2. saved_addresses: Reusable Warehouse / Factory Pickup & Drop Locations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  external_user_id text NOT NULL,
  label text NOT NULL,
  address_type text NOT NULL DEFAULT 'both'
    CHECK (address_type IN ('pickup', 'drop', 'both')),
  formatted_address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL DEFAULT 'Assam',
  pincode text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  contact_name text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id
  ON public.saved_addresses (user_id);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_external_user_id
  ON public.saved_addresses (external_user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. Additive Document Vault Columns on Existing trips / vs_bookings Tables
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.trips') IS NOT NULL THEN
    ALTER TABLE public.trips
      ADD COLUMN IF NOT EXISTS lr_document_url text,
      ADD COLUMN IF NOT EXISTS gst_invoice_url text,
      ADD COLUMN IF NOT EXISTS pod_document_url text,
      ADD COLUMN IF NOT EXISTS pod_storage_path text;
  END IF;

  IF to_regclass('public.vs_trips') IS NOT NULL THEN
    ALTER TABLE public.vs_trips
      ADD COLUMN IF NOT EXISTS lr_document_url text,
      ADD COLUMN IF NOT EXISTS gst_invoice_url text,
      ADD COLUMN IF NOT EXISTS pod_document_url text,
      ADD COLUMN IF NOT EXISTS pod_storage_path text;
  END IF;

  IF to_regclass('public.vs_bookings') IS NOT NULL THEN
    ALTER TABLE public.vs_bookings
      ADD COLUMN IF NOT EXISTS lr_document_url text,
      ADD COLUMN IF NOT EXISTS gst_invoice_url text,
      ADD COLUMN IF NOT EXISTS pod_document_url text,
      ADD COLUMN IF NOT EXISTS pod_storage_path text;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Updated-At Trigger Function (Idempotent)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zuggi_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_business_profiles_updated_at
      BEFORE UPDATE ON public.business_profiles
      FOR EACH ROW EXECUTE FUNCTION public.zuggi_set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_saved_addresses_updated_at'
  ) THEN
    CREATE TRIGGER trg_saved_addresses_updated_at
      BEFORE UPDATE ON public.saved_addresses
      FOR EACH ROW EXECUTE FUNCTION public.zuggi_set_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Policies — Strict Per-Business Isolation
-- ------------------------------------------------------------------------------
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'business_profiles' AND policyname = 'business_profiles_select_own'
  ) THEN
    CREATE POLICY business_profiles_select_own
      ON public.business_profiles
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'business_profiles' AND policyname = 'business_profiles_insert_own'
  ) THEN
    CREATE POLICY business_profiles_insert_own
      ON public.business_profiles
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'business_profiles' AND policyname = 'business_profiles_update_own'
  ) THEN
    CREATE POLICY business_profiles_update_own
      ON public.business_profiles
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_addresses' AND policyname = 'saved_addresses_select_own'
  ) THEN
    CREATE POLICY saved_addresses_select_own
      ON public.saved_addresses
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_addresses' AND policyname = 'saved_addresses_insert_own'
  ) THEN
    CREATE POLICY saved_addresses_insert_own
      ON public.saved_addresses
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_addresses' AND policyname = 'saved_addresses_update_own'
  ) THEN
    CREATE POLICY saved_addresses_update_own
      ON public.saved_addresses
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_addresses' AND policyname = 'saved_addresses_delete_own'
  ) THEN
    CREATE POLICY saved_addresses_delete_own
      ON public.saved_addresses
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. Supabase Storage Bucket: trip-documents (POD Photos / Signed Receipts)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-documents',
  'trip-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trip_documents_authenticated_read'
  ) THEN
    CREATE POLICY trip_documents_authenticated_read
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'trip-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trip_documents_authenticated_upload'
  ) THEN
    CREATE POLICY trip_documents_authenticated_upload
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'trip-documents');
  END IF;
END $$;
