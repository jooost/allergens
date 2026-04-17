-- =============================================================================
-- Allergen Platform — Reference Data Seed
-- Run after 001_schema.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Languages
-- -----------------------------------------------------------------------------

SET IDENTITY_INSERT Languages ON;
INSERT INTO Languages (Id, Code, Name, IsActive) VALUES
    (1,  'en', 'English',    1),
    (2,  'fr', 'French',     1),
    (3,  'de', 'German',     1),
    (4,  'es', 'Spanish',    1),
    (5,  'nl', 'Dutch',      1),
    (6,  'it', 'Italian',    1),
    (7,  'pt', 'Portuguese', 1),
    (8,  'da', 'Danish',     1),
    (9,  'sv', 'Swedish',    1),
    (10, 'no', 'Norwegian',  1),
    (11, 'fi', 'Finnish',    1);
SET IDENTITY_INSERT Languages OFF;

-- -----------------------------------------------------------------------------
-- Regions
-- -----------------------------------------------------------------------------

SET IDENTITY_INSERT Regions ON;
INSERT INTO Regions (Id, Name) VALUES
    (1, 'UK & Ireland'),
    (2, 'Northern Europe'),
    (3, 'Southern Europe');
SET IDENTITY_INSERT Regions OFF;

-- -----------------------------------------------------------------------------
-- Countries
-- -----------------------------------------------------------------------------

SET IDENTITY_INSERT Countries ON;
INSERT INTO Countries (Id, RegionId, Name, ISOCode) VALUES
    -- UK & Ireland
    (1,  1, 'United Kingdom', 'GB'),
    (2,  1, 'Ireland',        'IE'),
    -- Northern Europe
    (3,  2, 'Germany',        'DE'),
    (4,  2, 'Netherlands',    'NL'),
    (5,  2, 'Belgium',        'BE'),
    (6,  2, 'Denmark',        'DK'),
    (7,  2, 'Sweden',         'SE'),
    (8,  2, 'Norway',         'NO'),
    (9,  2, 'Finland',        'FI'),
    -- Southern Europe
    (10, 3, 'France',         'FR'),
    (11, 3, 'Spain',          'ES'),
    (12, 3, 'Italy',          'IT'),
    (13, 3, 'Portugal',       'PT');
SET IDENTITY_INSERT Countries OFF;

-- -----------------------------------------------------------------------------
-- Allergen Intensity
-- -----------------------------------------------------------------------------

SET IDENTITY_INSERT AllergenIntensity ON;
INSERT INTO AllergenIntensity (Id, Name) VALUES
    (1, 'Contains'),
    (2, 'May Contain');
SET IDENTITY_INSERT AllergenIntensity OFF;

-- -----------------------------------------------------------------------------
-- Allergens — 14 EU standard (FIR 1169/2011)
-- -----------------------------------------------------------------------------

SET IDENTITY_INSERT Allergens ON;
INSERT INTO Allergens (Id, Name) VALUES
    (1,  'Gluten (Cereals containing gluten)'),
    (2,  'Crustaceans'),
    (3,  'Eggs'),
    (4,  'Fish'),
    (5,  'Peanuts'),
    (6,  'Soybeans'),
    (7,  'Milk'),
    (8,  'Nuts (Tree nuts)'),
    (9,  'Celery'),
    (10, 'Mustard'),
    (11, 'Sesame seeds'),
    (12, 'Sulphur dioxide / Sulphites'),
    (13, 'Lupin'),
    (14, 'Molluscs');
SET IDENTITY_INSERT Allergens OFF;

-- -----------------------------------------------------------------------------
-- Allergen Translations (English — matches canonical names)
-- -----------------------------------------------------------------------------

INSERT INTO AllergenTranslations (AllergenId, LanguageId, Name) VALUES
    (1,  1, 'Gluten (Cereals containing gluten)'),
    (2,  1, 'Crustaceans'),
    (3,  1, 'Eggs'),
    (4,  1, 'Fish'),
    (5,  1, 'Peanuts'),
    (6,  1, 'Soybeans'),
    (7,  1, 'Milk'),
    (8,  1, 'Nuts (Tree nuts)'),
    (9,  1, 'Celery'),
    (10, 1, 'Mustard'),
    (11, 1, 'Sesame seeds'),
    (12, 1, 'Sulphur dioxide / Sulphites'),
    (13, 1, 'Lupin'),
    (14, 1, 'Molluscs');

INSERT INTO AllergenTranslations (AllergenId, LanguageId, Name) VALUES
    (1,  2, 'Gluten (Céréales contenant du gluten)'),
    (2,  2, 'Crustacés'),
    (3,  2, 'Œufs'),
    (4,  2, 'Poisson'),
    (5,  2, 'Arachides'),
    (6,  2, 'Soja'),
    (7,  2, 'Lait'),
    (8,  2, 'Fruits à coque'),
    (9,  2, 'Céleri'),
    (10, 2, 'Moutarde'),
    (11, 2, 'Graines de sésame'),
    (12, 2, 'Dioxyde de soufre / Sulfites'),
    (13, 2, 'Lupin'),
    (14, 2, 'Mollusques');

INSERT INTO AllergenTranslations (AllergenId, LanguageId, Name) VALUES
    (1,  3, 'Gluten (glutenhaltige Getreide)'),
    (2,  3, 'Krebstiere'),
    (3,  3, 'Eier'),
    (4,  3, 'Fisch'),
    (5,  3, 'Erdnüsse'),
    (6,  3, 'Sojabohnen'),
    (7,  3, 'Milch'),
    (8,  3, 'Schalenfrüchte'),
    (9,  3, 'Sellerie'),
    (10, 3, 'Senf'),
    (11, 3, 'Sesamsamen'),
    (12, 3, 'Schwefeldioxid / Sulfite'),
    (13, 3, 'Lupinen'),
    (14, 3, 'Weichtiere');

-- -----------------------------------------------------------------------------
-- Region Translations (English)
-- -----------------------------------------------------------------------------

INSERT INTO RegionTranslations (RegionId, LanguageId, Name) VALUES
    (1, 1, 'UK & Ireland'),
    (2, 1, 'Northern Europe'),
    (3, 1, 'Southern Europe');

-- -----------------------------------------------------------------------------
-- Country Translations (English)
-- -----------------------------------------------------------------------------

INSERT INTO CountryTranslations (CountryId, LanguageId, Name) VALUES
    (1,  1, 'United Kingdom'),
    (2,  1, 'Ireland'),
    (3,  1, 'Germany'),
    (4,  1, 'Netherlands'),
    (5,  1, 'Belgium'),
    (6,  1, 'Denmark'),
    (7,  1, 'Sweden'),
    (8,  1, 'Norway'),
    (9,  1, 'Finland'),
    (10, 1, 'France'),
    (11, 1, 'Spain'),
    (12, 1, 'Italy'),
    (13, 1, 'Portugal');

-- -----------------------------------------------------------------------------
-- Product Categories
-- -----------------------------------------------------------------------------

SET IDENTITY_INSERT ProductCategories ON;
INSERT INTO ProductCategories (Id, Name, IsActive) VALUES
    (1, 'Hot Food',        1),
    (2, 'Cold Food',       1),
    (3, 'Snacks',          1),
    (4, 'Confectionery',   1),
    (5, 'Beverages',       1),
    (6, 'Ice Cream',       1),
    (7, 'Combo Meals',     1),
    (8, 'Kids Meals',      1);
SET IDENTITY_INSERT ProductCategories OFF;

INSERT INTO CategoryTranslations (CategoryId, LanguageId, Name) VALUES
    (1, 1, 'Hot Food'),
    (2, 1, 'Cold Food'),
    (3, 1, 'Snacks'),
    (4, 1, 'Confectionery'),
    (5, 1, 'Beverages'),
    (6, 1, 'Ice Cream'),
    (7, 1, 'Combo Meals'),
    (8, 1, 'Kids Meals');
