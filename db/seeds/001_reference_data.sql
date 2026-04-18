-- =============================================================================
-- Allergen Platform — Reference Data Seed
-- Run after 001_schema.sql
-- =============================================================================

USE [AllergenDB];
GO

-- -----------------------------------------------------------------------------
-- Languages
-- -----------------------------------------------------------------------------

SET IDENTITY_INSERT Languages ON;
INSERT INTO Languages (Id, IsoCode, Name, IsActive) VALUES
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
INSERT INTO Countries (Id, RegionId, Name, IsoCode) VALUES
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
INSERT INTO Allergens (Id, Code, Name, SortOrder, IsActive) VALUES
    (1,  'GLUTEN',    'Gluten (Cereals containing gluten)', 1,  1),
    (2,  'CRUST',     'Crustaceans',                        2,  1),
    (3,  'EGGS',      'Eggs',                               3,  1),
    (4,  'FISH',      'Fish',                               4,  1),
    (5,  'PEANUTS',   'Peanuts',                            5,  1),
    (6,  'SOY',       'Soybeans',                           6,  1),
    (7,  'MILK',      'Milk',                               7,  1),
    (8,  'NUTS',      'Nuts (Tree nuts)',                   8,  1),
    (9,  'CELERY',    'Celery',                             9,  1),
    (10, 'MUSTARD',   'Mustard',                            10, 1),
    (11, 'SESAME',    'Sesame seeds',                       11, 1),
    (12, 'SULPHITES', 'Sulphur dioxide / Sulphites',        12, 1),
    (13, 'LUPIN',     'Lupin',                              13, 1),
    (14, 'MOLLUSCS',  'Molluscs',                           14, 1);
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

-- -----------------------------------------------------------------------------
-- Sample Products (UK — country 1)
-- -----------------------------------------------------------------------------

SET IDENTITY_INSERT Products ON;
INSERT INTO Products (Id, SKU, CategoryId, CountryId, Status, CreatedBy, ModifiedBy) VALUES
    (1, 'HF-001', 1, 1, 'Active', 'dev-bypass-user', 'dev-bypass-user'),
    (2, 'HF-002', 1, 1, 'Active', 'dev-bypass-user', 'dev-bypass-user'),
    (3, 'SN-001', 3, 1, 'Active', 'dev-bypass-user', 'dev-bypass-user'),
    (4, 'SN-002', 3, 1, 'Draft',  'dev-bypass-user', 'dev-bypass-user'),
    (5, 'BV-001', 5, 1, 'Active', 'dev-bypass-user', 'dev-bypass-user');
SET IDENTITY_INSERT Products OFF;

INSERT INTO ProductTranslations (ProductId, LanguageId, Name, Description) VALUES
    (1, 1, 'Classic Beef Burger',      'Beef patty with lettuce, tomato and cheese'),
    (2, 1, 'Grilled Chicken Wrap',     'Grilled chicken with salad in a flour tortilla'),
    (3, 1, 'Sea Salt Crisps',          'Thinly sliced potato crisps with sea salt'),
    (4, 1, 'BBQ Ribs Snack Pack',      'Slow-cooked pork ribs, BBQ flavour'),
    (5, 1, 'Fresh Orange Juice',       'Freshly squeezed orange juice, 330ml');

INSERT INTO ProductAllergens (ProductId, AllergenId, IntensityId) VALUES
    -- Classic Beef Burger: gluten (bun), milk (cheese), eggs (mayo), sesame (bun)
    (1, 1,  1),  -- Gluten - Contains
    (1, 7,  1),  -- Milk - Contains
    (1, 3,  1),  -- Eggs - Contains
    (1, 11, 1),  -- Sesame - Contains
    -- Grilled Chicken Wrap: gluten (tortilla), eggs (dressing)
    (2, 1,  1),  -- Gluten - Contains
    (2, 3,  1),  -- Eggs - Contains
    -- Sea Salt Crisps: may contain milk
    (3, 7,  2),  -- Milk - May Contain
    -- BBQ Ribs Snack Pack: sulphites, may contain gluten
    (4, 12, 1),  -- Sulphites - Contains
    (4, 1,  2);  -- Gluten - May Contain

-- -----------------------------------------------------------------------------
-- Suppliers
-- -----------------------------------------------------------------------------

SET IDENTITY_INSERT Suppliers ON;
INSERT INTO Suppliers (Id, Name, CountryId, Address, ContactEmail, ContactPhone, IsActive, CreatedBy, ModifiedBy) VALUES
    (1, 'Premier Proteins Ltd',      1, '12 Industrial Park, Coventry, CV1 4AB',       'orders@premierproteins.co.uk',  '+44 24 7600 1234', 1, 'dev-bypass-user', 'dev-bypass-user'),
    (2, 'Golden Harvest Bakeries',   1, '88 Mill Road, Leeds, LS9 8TZ',                'supply@goldenharvest.co.uk',    '+44 11 3240 5678', 1, 'dev-bypass-user', 'dev-bypass-user'),
    (3, 'Nordic Fresh Produce',      7, 'Hamngatan 22, 111 47 Stockholm',               'trading@nordicfresh.se',        '+46 8 555 0199',   1, 'dev-bypass-user', 'dev-bypass-user'),
    (4, 'Iberian Snack Co.',         11, 'Calle Industria 45, 28021 Madrid',            'b2b@iberiansnack.es',           '+34 91 234 5678',  1, 'dev-bypass-user', 'dev-bypass-user'),
    (5, 'Continental Oils & Fats',   3, 'Industriestraße 18, 20457 Hamburg',            'supply@continentaloils.de',     '+49 40 3000 7890', 1, 'dev-bypass-user', 'dev-bypass-user');
SET IDENTITY_INSERT Suppliers OFF;

-- -----------------------------------------------------------------------------
-- Product Suppliers
-- -----------------------------------------------------------------------------

SET IDENTITY_INSERT ProductSuppliers ON;
INSERT INTO ProductSuppliers (Id, ProductId, SupplierId, Priority, Notes, CreatedBy) VALUES
    -- Classic Beef Burger: primary protein supplier + bakery for buns
    (1, 1, 1, 1, 'Primary beef patty supplier — weekly delivery',     'dev-bypass-user'),
    (2, 1, 2, 2, 'Sesame bun supplier',                               'dev-bypass-user'),
    -- Grilled Chicken Wrap: primary protein supplier + bakery for tortillas
    (3, 2, 1, 1, 'Chicken breast supplier',                           'dev-bypass-user'),
    (4, 2, 2, 2, 'Flour tortilla supplier',                           'dev-bypass-user'),
    -- Sea Salt Crisps: Spanish snack manufacturer
    (5, 3, 4, 1, 'Primary crisps manufacturer',                       'dev-bypass-user'),
    -- BBQ Ribs Snack Pack: primary protein + oils/flavourings
    (6, 4, 1, 1, 'Pork ribs supplier',                                'dev-bypass-user'),
    (7, 4, 5, 2, 'BBQ seasoning and cooking oil',                     'dev-bypass-user');
SET IDENTITY_INSERT ProductSuppliers OFF;

-- -----------------------------------------------------------------------------
-- Nutritional Info (per 100g)
-- -----------------------------------------------------------------------------

SET IDENTITY_INSERT NutritionalInfo ON;
INSERT INTO NutritionalInfo (Id, ProductId, EnergyKJ, EnergyKcal, Fat, Saturates, Carbohydrates, Sugars, Protein, Salt) VALUES
    (1, 1, 1042, 249, 12.4, 4.8, 19.2, 3.1, 17.8, 0.92),  -- Classic Beef Burger
    (2, 2,  728, 174,  5.1, 1.2, 18.6, 2.4, 14.2, 0.74),  -- Grilled Chicken Wrap
    (3, 3, 2214, 530, 31.2, 2.9, 54.8, 0.6,  6.1, 1.24),  -- Sea Salt Crisps
    (4, 4, 1389, 332, 21.4, 7.6,  8.2, 5.8, 27.3, 1.68),  -- BBQ Ribs Snack Pack
    (5, 5,  184,  44,  0.2, 0.0, 10.4, 9.8,  0.7, 0.01);  -- Fresh Orange Juice
SET IDENTITY_INSERT NutritionalInfo OFF;
