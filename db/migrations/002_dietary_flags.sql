-- =============================================================================
-- Migration 002 — Add dietary suitability flags to Products
-- =============================================================================

ALTER TABLE Products
  ADD IsVegetarian  BIT NULL,
      IsVegan       BIT NULL,
      IsCoeliacSafe BIT NULL;
GO
