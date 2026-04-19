-- =============================================================================
-- Migration 003 — Add image fields to Products
-- =============================================================================

ALTER TABLE Products
  ADD ImageBlobPath  NVARCHAR(500) NULL,
      ImageFileName  NVARCHAR(200) NULL;
GO
