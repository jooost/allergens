-- =============================================================================
-- Allergen Platform — Initial Schema
-- Azure SQL (compatibility level 150+)
-- =============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'AllergenDB')
    CREATE DATABASE [AllergenDB];
GO

USE [AllergenDB];
GO

-- -----------------------------------------------------------------------------
-- Teardown (drop everything in reverse dependency order)
-- -----------------------------------------------------------------------------

-- Full-text index must be dropped before its table (only if FTS is installed)
IF FULLTEXTSERVICEPROPERTY('IsFullTextInstalled') = 1
BEGIN
    IF EXISTS (
        SELECT 1 FROM sys.fulltext_indexes fi
        JOIN sys.tables t ON fi.object_id = t.object_id
        WHERE t.name = 'ProductTranslations'
    )
        DROP FULLTEXT INDEX ON ProductTranslations;

    IF EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = 'AllergenCatalog')
        DROP FULLTEXT CATALOG AllergenCatalog;
END

-- Break circular FK between ProductDocuments <-> DocumentVersions
IF OBJECT_ID('FK_ProductDocuments_CurrentVersion', 'F') IS NOT NULL
    ALTER TABLE ProductDocuments DROP CONSTRAINT FK_ProductDocuments_CurrentVersion;
IF OBJECT_ID('FK_DocumentVersions_ProductDocuments', 'F') IS NOT NULL
    ALTER TABLE DocumentVersions DROP CONSTRAINT FK_DocumentVersions_ProductDocuments;

-- Leaf tables first, then parents
DROP TABLE IF EXISTS AuditLog;
DROP TABLE IF EXISTS CountryTranslations;
DROP TABLE IF EXISTS RegionTranslations;
DROP TABLE IF EXISTS CategoryTranslations;
DROP TABLE IF EXISTS AllergenTranslations;
DROP TABLE IF EXISTS DocumentVersions;
DROP TABLE IF EXISTS ProductDocuments;
DROP TABLE IF EXISTS ProductSuppliers;
DROP TABLE IF EXISTS Suppliers;
DROP TABLE IF EXISTS NutritionalInfo;
DROP TABLE IF EXISTS ProductAllergens;
DROP TABLE IF EXISTS ProductTranslations;
DROP TABLE IF EXISTS UserPermissions;
DROP TABLE IF EXISTS UserProfiles;
DROP TABLE IF EXISTS Products;
DROP TABLE IF EXISTS ProductCategories;
DROP TABLE IF EXISTS Allergens;
DROP TABLE IF EXISTS AllergenIntensity;
DROP TABLE IF EXISTS Countries;
DROP TABLE IF EXISTS Regions;
DROP TABLE IF EXISTS Languages;
GO

-- -----------------------------------------------------------------------------
-- Reference / Lookup Tables
-- -----------------------------------------------------------------------------

CREATE TABLE Regions (
    Id          INT           NOT NULL IDENTITY(1,1),
    Name        NVARCHAR(100) NOT NULL,
    CONSTRAINT PK_Regions PRIMARY KEY (Id),
    CONSTRAINT UQ_Regions_Name UNIQUE (Name)
);

CREATE TABLE Countries (
    Id          INT           NOT NULL IDENTITY(1,1),
    RegionId    INT           NOT NULL,
    Name        NVARCHAR(100) NOT NULL,
    IsoCode     CHAR(2)       NOT NULL,
    IsActive    BIT           NOT NULL CONSTRAINT DF_Countries_IsActive DEFAULT 1,
    CONSTRAINT PK_Countries PRIMARY KEY (Id),
    CONSTRAINT UQ_Countries_IsoCode UNIQUE (IsoCode),
    CONSTRAINT FK_Countries_Regions FOREIGN KEY (RegionId) REFERENCES Regions (Id)
);

CREATE TABLE Languages (
    Id          INT           NOT NULL IDENTITY(1,1),
    IsoCode     VARCHAR(10)   NOT NULL,
    Name        NVARCHAR(100) NOT NULL,
    IsActive    BIT           NOT NULL CONSTRAINT DF_Languages_IsActive DEFAULT 1,
    CONSTRAINT PK_Languages PRIMARY KEY (Id),
    CONSTRAINT UQ_Languages_IsoCode UNIQUE (IsoCode)
);

CREATE TABLE AllergenIntensity (
    Id          INT           NOT NULL IDENTITY(1,1),
    Name        NVARCHAR(50)  NOT NULL,
    CONSTRAINT PK_AllergenIntensity PRIMARY KEY (Id),
    CONSTRAINT UQ_AllergenIntensity_Name UNIQUE (Name)
);

CREATE TABLE Allergens (
    Id          INT           NOT NULL IDENTITY(1,1),
    Code        NVARCHAR(20)  NOT NULL,
    Name        NVARCHAR(100) NOT NULL,
    SortOrder   INT           NOT NULL CONSTRAINT DF_Allergens_SortOrder DEFAULT 0,
    IsActive    BIT           NOT NULL CONSTRAINT DF_Allergens_IsActive DEFAULT 1,
    CONSTRAINT PK_Allergens PRIMARY KEY (Id),
    CONSTRAINT UQ_Allergens_Code UNIQUE (Code),
    CONSTRAINT UQ_Allergens_Name UNIQUE (Name)
);

CREATE TABLE ProductCategories (
    Id          INT            NOT NULL IDENTITY(1,1),
    Name        NVARCHAR(100)  NOT NULL,
    Description NVARCHAR(500)  NULL,
    IsActive    BIT            NOT NULL CONSTRAINT DF_ProductCategories_IsActive DEFAULT 1,
    CONSTRAINT PK_ProductCategories PRIMARY KEY (Id),
    CONSTRAINT UQ_ProductCategories_Name UNIQUE (Name)
);

-- -----------------------------------------------------------------------------
-- User & Permission Tables
-- -----------------------------------------------------------------------------

CREATE TABLE UserProfiles (
    Id                  INT           NOT NULL IDENTITY(1,1),
    EntraObjectId       NVARCHAR(36)  NOT NULL,
    DisplayName         NVARCHAR(200) NOT NULL,
    Email               NVARCHAR(254) NOT NULL,
    PreferredLanguageId INT           NULL,
    CreatedAt           DATETIME2     NOT NULL CONSTRAINT DF_UserProfiles_CreatedAt DEFAULT SYSUTCDATETIME(),
    LastLoginAt         DATETIME2     NULL,
    CONSTRAINT PK_UserProfiles PRIMARY KEY (Id),
    CONSTRAINT UQ_UserProfiles_EntraObjectId UNIQUE (EntraObjectId),
    CONSTRAINT FK_UserProfiles_Languages FOREIGN KEY (PreferredLanguageId) REFERENCES Languages (Id)
);

CREATE TABLE UserPermissions (
    Id                  INT           NOT NULL IDENTITY(1,1),
    UserEntraObjectId   NVARCHAR(36)  NOT NULL,
    RegionId            INT           NOT NULL,
    CountryId           INT           NULL,
    Role                NVARCHAR(20)  NOT NULL,
    GrantedBy           NVARCHAR(36)  NOT NULL,
    GrantedAt           DATETIME2     NOT NULL CONSTRAINT DF_UserPermissions_GrantedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_UserPermissions PRIMARY KEY (Id),
    CONSTRAINT FK_UserPermissions_Regions   FOREIGN KEY (RegionId)  REFERENCES Regions (Id),
    CONSTRAINT FK_UserPermissions_Countries FOREIGN KEY (CountryId) REFERENCES Countries (Id),
    CONSTRAINT CK_UserPermissions_Role CHECK (Role IN ('Reader', 'Editor', 'Manager', 'Admin'))
);

CREATE INDEX IX_UserPermissions_UserEntraObjectId ON UserPermissions (UserEntraObjectId);
CREATE INDEX IX_UserPermissions_CountryId         ON UserPermissions (CountryId);

-- -----------------------------------------------------------------------------
-- Core Data Tables
-- -----------------------------------------------------------------------------

CREATE TABLE Products (
    Id          INT           NOT NULL IDENTITY(1,1),
    SKU         NVARCHAR(100) NOT NULL,
    CategoryId  INT           NOT NULL,
    CountryId   INT           NOT NULL,
    Status      NVARCHAR(10)  NOT NULL CONSTRAINT DF_Products_Status DEFAULT 'Draft',
    CreatedBy   NVARCHAR(36)  NOT NULL,
    CreatedAt   DATETIME2     NOT NULL CONSTRAINT DF_Products_CreatedAt DEFAULT SYSUTCDATETIME(),
    ModifiedBy  NVARCHAR(36)  NOT NULL,
    ModifiedAt  DATETIME2     NOT NULL CONSTRAINT DF_Products_ModifiedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Products PRIMARY KEY (Id),
    CONSTRAINT UQ_Products_SKU_Country UNIQUE (SKU, CountryId),
    CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryId) REFERENCES ProductCategories (Id),
    CONSTRAINT FK_Products_Countries  FOREIGN KEY (CountryId)  REFERENCES Countries (Id),
    CONSTRAINT CK_Products_Status CHECK (Status IN ('Draft', 'Active', 'Archived'))
);

CREATE INDEX IX_Products_CountryId  ON Products (CountryId);
CREATE INDEX IX_Products_CategoryId ON Products (CategoryId);
CREATE INDEX IX_Products_Status     ON Products (Status);

CREATE TABLE ProductTranslations (
    Id          INT            NOT NULL IDENTITY(1,1),
    ProductId   INT            NOT NULL,
    LanguageId  INT            NOT NULL,
    Name        NVARCHAR(200)  NOT NULL,
    Description NVARCHAR(MAX)  NULL,
    CONSTRAINT PK_ProductTranslations PRIMARY KEY (Id),
    CONSTRAINT UQ_ProductTranslations_ProductLanguage UNIQUE (ProductId, LanguageId),
    CONSTRAINT FK_ProductTranslations_Products  FOREIGN KEY (ProductId)  REFERENCES Products (Id),
    CONSTRAINT FK_ProductTranslations_Languages FOREIGN KEY (LanguageId) REFERENCES Languages (Id)
);

-- Full-text index for product search (skipped if FTS is not installed)
IF FULLTEXTSERVICEPROPERTY('IsFullTextInstalled') = 1
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = 'AllergenCatalog')
        CREATE FULLTEXT CATALOG AllergenCatalog AS DEFAULT;

    EXEC sp_executesql N'
        CREATE FULLTEXT INDEX ON ProductTranslations (Name, Description)
            KEY INDEX PK_ProductTranslations
            ON AllergenCatalog
            WITH CHANGE_TRACKING AUTO;';
END

CREATE TABLE ProductAllergens (
    Id          INT NOT NULL IDENTITY(1,1),
    ProductId   INT NOT NULL,
    AllergenId  INT NOT NULL,
    IntensityId INT NOT NULL,
    CONSTRAINT PK_ProductAllergens PRIMARY KEY (Id),
    CONSTRAINT UQ_ProductAllergens_ProductAllergen UNIQUE (ProductId, AllergenId),
    CONSTRAINT FK_ProductAllergens_Products  FOREIGN KEY (ProductId)   REFERENCES Products (Id),
    CONSTRAINT FK_ProductAllergens_Allergens FOREIGN KEY (AllergenId)  REFERENCES Allergens (Id),
    CONSTRAINT FK_ProductAllergens_Intensity FOREIGN KEY (IntensityId) REFERENCES AllergenIntensity (Id)
);

CREATE TABLE NutritionalInfo (
    Id            INT          NOT NULL IDENTITY(1,1),
    ProductId     INT          NOT NULL,
    EnergyKJ      DECIMAL(8,2) NULL,
    EnergyKcal    DECIMAL(8,2) NULL,
    Fat           DECIMAL(8,2) NULL,
    Saturates     DECIMAL(8,2) NULL,
    Carbohydrates DECIMAL(8,2) NULL,
    Sugars        DECIMAL(8,2) NULL,
    Protein       DECIMAL(8,2) NULL,
    Salt          DECIMAL(8,2) NULL,
    CONSTRAINT PK_NutritionalInfo PRIMARY KEY (Id),
    CONSTRAINT UQ_NutritionalInfo_Product UNIQUE (ProductId),
    CONSTRAINT FK_NutritionalInfo_Products FOREIGN KEY (ProductId) REFERENCES Products (Id)
);

-- -----------------------------------------------------------------------------
-- Supplier Tables
-- -----------------------------------------------------------------------------

CREATE TABLE Suppliers (
    Id          INT           NOT NULL IDENTITY(1,1),
    Name        NVARCHAR(200) NOT NULL,
    CountryId   INT           NOT NULL,
    Address      NVARCHAR(500) NULL,
    ContactEmail NVARCHAR(254) NULL,
    ContactPhone NVARCHAR(50)  NULL,
    IsActive     BIT           NOT NULL CONSTRAINT DF_Suppliers_IsActive DEFAULT 1,
    CreatedBy   NVARCHAR(36)  NOT NULL,
    CreatedAt   DATETIME2     NOT NULL CONSTRAINT DF_Suppliers_CreatedAt DEFAULT SYSUTCDATETIME(),
    ModifiedBy  NVARCHAR(36)  NOT NULL,
    ModifiedAt  DATETIME2     NOT NULL CONSTRAINT DF_Suppliers_ModifiedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Suppliers PRIMARY KEY (Id),
    CONSTRAINT FK_Suppliers_Countries FOREIGN KEY (CountryId) REFERENCES Countries (Id)
);

CREATE INDEX IX_Suppliers_CountryId ON Suppliers (CountryId);

CREATE TABLE ProductSuppliers (
    Id         INT          NOT NULL IDENTITY(1,1),
    ProductId  INT          NOT NULL,
    SupplierId INT          NOT NULL,
    Priority   INT           NULL,
    Notes      NVARCHAR(500) NULL,
    IsActive   BIT           NOT NULL CONSTRAINT DF_ProductSuppliers_IsActive DEFAULT 1,
    CreatedBy  NVARCHAR(36) NOT NULL,
    CreatedAt  DATETIME2    NOT NULL CONSTRAINT DF_ProductSuppliers_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ProductSuppliers PRIMARY KEY (Id),
    CONSTRAINT UQ_ProductSuppliers_ProductSupplier UNIQUE (ProductId, SupplierId),
    CONSTRAINT FK_ProductSuppliers_Products  FOREIGN KEY (ProductId)  REFERENCES Products (Id),
    CONSTRAINT FK_ProductSuppliers_Suppliers FOREIGN KEY (SupplierId) REFERENCES Suppliers (Id)
);

CREATE UNIQUE INDEX UQ_ProductSuppliers_ProductPriority
    ON ProductSuppliers (ProductId, Priority)
    WHERE Priority IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Document / File Tables
-- -----------------------------------------------------------------------------

CREATE TABLE ProductDocuments (
    Id               INT          NOT NULL IDENTITY(1,1),
    ProductId        INT          NOT NULL,
    DocumentType     NVARCHAR(50) NOT NULL,
    CurrentVersionId INT          NULL,
    IsActive         BIT          NOT NULL CONSTRAINT DF_ProductDocuments_IsActive DEFAULT 1,
    CreatedBy        NVARCHAR(36) NOT NULL,
    CreatedAt        DATETIME2    NOT NULL CONSTRAINT DF_ProductDocuments_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ProductDocuments PRIMARY KEY (Id),
    CONSTRAINT FK_ProductDocuments_Products FOREIGN KEY (ProductId) REFERENCES Products (Id),
    CONSTRAINT CK_ProductDocuments_DocumentType CHECK (DocumentType IN ('Specification', 'AllergenDeclaration', 'NutritionalCertificate', 'LabelScan', 'Other'))
);

CREATE TABLE DocumentVersions (
    Id            INT           NOT NULL IDENTITY(1,1),
    DocumentId    INT           NOT NULL,
    VersionNumber INT           NOT NULL,
    FileName      NVARCHAR(255) NOT NULL,
    BlobPath      NVARCHAR(1000) NOT NULL,
    FileSizeBytes BIGINT        NULL,
    UploadedBy    NVARCHAR(36)  NOT NULL,
    UploadedAt    DATETIME2     NOT NULL CONSTRAINT DF_DocumentVersions_UploadedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_DocumentVersions PRIMARY KEY (Id),
    CONSTRAINT UQ_DocumentVersions_DocVersion UNIQUE (DocumentId, VersionNumber),
    CONSTRAINT FK_DocumentVersions_ProductDocuments FOREIGN KEY (DocumentId) REFERENCES ProductDocuments (Id)
);

-- Back-fill the FK now that DocumentVersions exists
ALTER TABLE ProductDocuments
    ADD CONSTRAINT FK_ProductDocuments_CurrentVersion
        FOREIGN KEY (CurrentVersionId) REFERENCES DocumentVersions (Id);

-- -----------------------------------------------------------------------------
-- Translation Tables
-- -----------------------------------------------------------------------------

CREATE TABLE AllergenTranslations (
    AllergenId  INT            NOT NULL,
    LanguageId  INT            NOT NULL,
    Name        NVARCHAR(200)  NOT NULL,
    Description NVARCHAR(1000) NULL,
    CONSTRAINT PK_AllergenTranslations PRIMARY KEY (AllergenId, LanguageId),
    CONSTRAINT FK_AllergenTranslations_Allergens FOREIGN KEY (AllergenId) REFERENCES Allergens (Id),
    CONSTRAINT FK_AllergenTranslations_Languages FOREIGN KEY (LanguageId) REFERENCES Languages (Id)
);

CREATE TABLE CategoryTranslations (
    CategoryId  INT           NOT NULL,
    LanguageId  INT           NOT NULL,
    Name        NVARCHAR(200) NOT NULL,
    CONSTRAINT PK_CategoryTranslations PRIMARY KEY (CategoryId, LanguageId),
    CONSTRAINT FK_CategoryTranslations_Categories FOREIGN KEY (CategoryId) REFERENCES ProductCategories (Id),
    CONSTRAINT FK_CategoryTranslations_Languages  FOREIGN KEY (LanguageId) REFERENCES Languages (Id)
);

CREATE TABLE RegionTranslations (
    RegionId    INT           NOT NULL,
    LanguageId  INT           NOT NULL,
    Name        NVARCHAR(100) NOT NULL,
    CONSTRAINT PK_RegionTranslations PRIMARY KEY (RegionId, LanguageId),
    CONSTRAINT FK_RegionTranslations_Regions   FOREIGN KEY (RegionId)   REFERENCES Regions (Id),
    CONSTRAINT FK_RegionTranslations_Languages FOREIGN KEY (LanguageId) REFERENCES Languages (Id)
);

CREATE TABLE CountryTranslations (
    CountryId   INT           NOT NULL,
    LanguageId  INT           NOT NULL,
    Name        NVARCHAR(100) NOT NULL,
    CONSTRAINT PK_CountryTranslations PRIMARY KEY (CountryId, LanguageId),
    CONSTRAINT FK_CountryTranslations_Countries FOREIGN KEY (CountryId)  REFERENCES Countries (Id),
    CONSTRAINT FK_CountryTranslations_Languages FOREIGN KEY (LanguageId) REFERENCES Languages (Id)
);

-- -----------------------------------------------------------------------------
-- Audit Log
-- -----------------------------------------------------------------------------

CREATE TABLE AuditLog (
    Id        BIGINT         NOT NULL IDENTITY(1,1),
    TableName NVARCHAR(100)  NOT NULL,
    RecordId  INT            NOT NULL,
    Action    NVARCHAR(20)   NOT NULL,
    ChangedBy NVARCHAR(36)   NOT NULL,
    ChangedAt DATETIME2      NOT NULL CONSTRAINT DF_AuditLog_ChangedAt DEFAULT SYSUTCDATETIME(),
    OldValues NVARCHAR(MAX)  NULL,
    NewValues NVARCHAR(MAX)  NULL,
    CONSTRAINT PK_AuditLog PRIMARY KEY (Id),
    CONSTRAINT CK_AuditLog_Action CHECK (Action IN ('Insert', 'Update', 'Delete', 'StatusChange', 'Rollback'))
);

CREATE INDEX IX_AuditLog_TableName_RecordId ON AuditLog (TableName, RecordId);
CREATE INDEX IX_AuditLog_ChangedBy          ON AuditLog (ChangedBy);
CREATE INDEX IX_AuditLog_ChangedAt          ON AuditLog (ChangedAt DESC);
