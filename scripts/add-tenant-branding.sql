-- Migration: add branding fields to tenants table
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS "primaryColor"           TEXT,
  ADD COLUMN IF NOT EXISTS "primaryForegroundColor" TEXT,
  ADD COLUMN IF NOT EXISTS "sidebarColor"           TEXT,
  ADD COLUMN IF NOT EXISTS "accentColor"            TEXT,
  ADD COLUMN IF NOT EXISTS "faviconUrl"             TEXT,
  ADD COLUMN IF NOT EXISTS "appName"                TEXT,
  ADD COLUMN IF NOT EXISTS "loginBannerUrl"         TEXT,
  ADD COLUMN IF NOT EXISTS "supportEmail"           TEXT;
