Allergen & Nutritional Information Management Platform

CLAUDE.md — Project Reference

Project Overview

A pan-European allergen and nutritional information management platform for a cinema chain. The system allows internal operations colleagues to manage allergen and nutritional data for food and beverage products sold across European cinemas. A versioned public API exposes approved product data to guest-facing websites and apps.

Tech Stack

Layer
Technology
Frontend (Internal SPA)
React + MSAL.js
Hosting
Azure Static Web Apps
API
Azure Functions (Node.js, isolated worker)
Database
Azure SQL
File Storage
Azure Blob Storage
API Gateway (Public)
Azure API Management
Auth
Microsoft Entra ID (MSAL)
IaC
Bicep
CDN/Caching
Azure CDN (public API)
Architecture

[Internal SPA]  ──MSAL──►  [Entra ID]
     │
     ▼
[Internal Azure Functions API]  ──►  [Azure SQL]
                                ──►  [Azure Blob Storage]

[Guest Website/App]
     │
     ▼
[Azure API Management]  ──►  [Public Azure Functions API]  ──►  [Azure SQL]
Two separate Function Apps: one for the internal authenticated API, one for the public versioned API
Static Web App hosts the internal React SPA
Azure API Management sits in front of the public Function App for rate limiting, API key management, and versioning
Azure Blob Storage for product document/file uploads with SAS token upload pattern
Authentication & Authorisation

Entra ID App Roles

Four roles defined in the Entra ID app manifest:

Reader
Editor
Manager
Admin
Country-Level Scoping

Entra ID roles define what a user can do. Country-level access is managed in the database via UserPermissions. The API enforces both on every request.

Role Capabilities

Role
Products/Suppliers/Allergens
Users
Countries
Reader
Read only (own countries)
None
Own permitted countries
Editor
Create, edit, publish, rollback (own countries)
None
Own permitted countries
Manager
Read (own countries)
Grant/revoke Reader & Editor within own countries
Own permitted countries only
Admin
Full access, all regions
Full user management, assign any role
All
Rules:

Editors can publish directly — no approval workflow required
Editors and Admins can rollback a published product to a previous state
Managers cannot assign Manager or Admin roles
Managers can only grant permissions to countries they themselves have access to
Admin bypasses the UserPermissions table entirely
Regions & Countries

Three regions, each containing multiple countries:

UK & Ireland — United Kingdom, Ireland
Northern Europe — Germany, Netherlands, Belgium, Denmark, Sweden, Norway, Finland
Southern Europe — France, Spain, Italy, Portugal
Database Schema

Reference / Lookup Tables

Regions             -- Id, Name
Countries           -- Id, RegionId, Name, ISOCode
Languages           -- Id, Code (e.g. 'en', 'fr'), Name, IsActive
AllergenIntensity   -- Id, Name ('Contains', 'May Contain')
Allergens           -- Id, Name (the 14 EU standard allergens)
ProductCategories   -- Id, Name, IsActive
User & Permission Tables

UserProfiles
  Id, EntraObjectId, DisplayName, Email,
  PreferredLanguageId (FK Languages), CreatedAt, LastLoginAt

UserPermissions
  Id, UserEntraObjectId, RegionId (FK), CountryId (FK, nullable — null = whole region),
  Role ('Reader'|'Editor'|'Manager'|'Admin'),
  GrantedBy, GrantedAt
Core Data Tables

Products (primary entity — all other tables reference back to this)
  Id, SKU, CategoryId (FK), CountryId (FK),
  Status ('Draft'|'Active'|'Archived'),
  CreatedBy, CreatedAt, ModifiedBy, ModifiedAt

ProductTranslations
  Id, ProductId (FK), LanguageId (FK), Name, Description

ProductAllergens
  Id, ProductId (FK), AllergenId (FK), IntensityId (FK AllergenIntensity)

NutritionalInfo
  Id, ProductId (FK),
  EnergyKJ, EnergyKcal, Fat, Saturates,
  Carbohydrates, Sugars, Protein, Salt
  (all DECIMAL - standard EU nutrition label fields)

Suppliers
  Id, Name, CountryId (FK), Address, ContactInfo, IsActive,
  CreatedBy, CreatedAt, ModifiedBy, ModifiedAt

ProductSuppliers  (junction — a product can have multiple suppliers)
  Id, ProductId (FK), SupplierId (FK),
  Priority (INT, nullable),  -- optional: 1=primary, 2=first backup etc. Unique per product where not null.
  IsActive (BIT),
  CreatedBy, CreatedAt
Constraints:

Unique constraint on (ProductId, Priority) where Priority IS NOT NULL — prevents duplicate priority values on the same product whilst keeping priority optional
Supplier and Product must belong to the same country — enforced in the API layer, not FK constraint
Document / File Tables

ProductDocuments
  Id, ProductId (FK), FileType ('PDF'|'Image'|'Certificate'|'Other'),
  CurrentVersionId (FK DocumentVersions), IsActive,
  UploadedBy, UploadedAt

DocumentVersions
  Id, ProductDocumentId (FK), VersionNumber (INT),
  FileName, BlobStorageUrl, BlobContainerPath,
  FileSizeBytes, ChangeNotes,
  UploadedBy, UploadedAt
Translation Tables (Dynamic Data)

AllergenTranslations    -- AllergenId (FK), LanguageId (FK), Name, Description
CategoryTranslations    -- CategoryId (FK), LanguageId (FK), Name
RegionTranslations      -- RegionId (FK), LanguageId (FK), Name
CountryTranslations     -- CountryId (FK), LanguageId (FK), Name
Audit Log

AuditLog
  Id, TableName, RecordId, Action ('Insert'|'Update'|'Delete'|'StatusChange'|'Rollback'),
  ChangedBy, ChangedAt,
  OldValues (JSON), NewValues (JSON)
Product Lifecycle

Draft  ──(Editor publishes)──►  Active  ──(Editor/Admin archives)──►  Archived
  ▲                                │
  └──────────(rollback)────────────┘
Only Active products are returned by the public API
Archived products are retained for audit purposes — never hard deleted
Rollback creates a new AuditLog entry with Action = 'Rollback'
Allergens

The 14 EU standard allergens (FIR 1169/2011):

Gluten (Cereals containing gluten)
Crustaceans
Eggs
Fish
Peanuts
Soybeans
Milk
Nuts (Tree nuts)
Celery
Mustard
Sesame seeds
Sulphur dioxide / Sulphites
Lupin
Molluscs
Each allergen on a product has an intensity: Contains or May Contain (cross-contamination).

File Upload Pattern

SPA requests a short-lived SAS upload token from the internal API
SPA uploads the file directly to Azure Blob Storage (Function App is not in the file stream)
SPA calls the internal API to register the document metadata in ProductDocuments / DocumentVersions
Blob container structure:

allergen-docs-{env}/
  /{isoCountryCode}/
    /{productId}/
      /{documentId}/
        v1_filename.pdf
        v2_filename.pdf
Document versioning rules:

Replacing a document creates a new DocumentVersions row and updates CurrentVersionId
Old versions are retained in both Blob Storage and the database
Soft-delete only — blobs and version rows are never hard deleted
Admins can restore any previous version as current
Internationalisation (i18n)

Hybrid Approach

Content Type
Storage
Management
UI strings (labels, buttons, nav, errors)
JSON files bundled with SPA
Source control, deployed with app
Dynamic data (product names, allergen names, category names)
Database translation tables
Managed via admin UI
Language Files (SPA)

Located at /src/locales/{languageCode}.json Example keys:

{
  "nav.products": "Products",
  "label.allergens": "Allergens",
  "status.active": "Active",
  "button.save": "Save",
  "button.publish": "Publish"
}
User Language Preference

Stored in UserProfiles.PreferredLanguageId
Loaded on login, applied globally to SPA and all API data requests
User can change in profile settings — triggers language bundle reload
Default fallback: English (en)
API Language Behaviour

Internal API: serves translations based on user's PreferredLanguageId
Public API: accepts ?lang= query param or Accept-Language header
Fallback chain: requested language → English → raw value
API Design

Internal API (Authenticated)

Base: /internal/v1/ Auth: Entra ID Bearer token (MSAL)

Key endpoints:

# Products
GET    /internal/v1/products?search=&country=&category=&status=&supplier=&allergen=&page=&pageSize=&sortBy=&sortOrder=
POST   /internal/v1/products
GET    /internal/v1/products/{id}
PUT    /internal/v1/products/{id}
POST   /internal/v1/products/{id}/publish
POST   /internal/v1/products/{id}/rollback
POST   /internal/v1/products/{id}/archive

# Product Suppliers
GET    /internal/v1/products/{id}/suppliers
POST   /internal/v1/products/{id}/suppliers
PUT    /internal/v1/products/{id}/suppliers/{productSupplierId}
DELETE /internal/v1/products/{id}/suppliers/{productSupplierId}

# Suppliers
GET    /internal/v1/suppliers?country=
POST   /internal/v1/suppliers
GET    /internal/v1/suppliers/{id}
PUT    /internal/v1/suppliers/{id}

# Documents
POST   /internal/v1/products/{id}/documents/upload-token
POST   /internal/v1/products/{id}/documents
GET    /internal/v1/products/{id}/documents
DELETE /internal/v1/products/{id}/documents/{docId}
POST   /internal/v1/products/{id}/documents/{docId}/restore-version/{versionId}

# User Management (Manager/Admin)
GET    /internal/v1/users
POST   /internal/v1/users/{entraId}/permissions
DELETE /internal/v1/users/{entraId}/permissions/{permissionId}

# Reference Data
GET    /internal/v1/allergens
GET    /internal/v1/categories
GET    /internal/v1/countries
GET    /internal/v1/languages

# Audit
GET    /internal/v1/audit?recordId=&table=&from=&to=
Public API (Unauthenticated)

Base: /v1/ (via Azure API Management) Auth: API key (header or query param) Returns: Active products only

GET  /v1/products?country=GB&category=snacks&lang=en&allergen=&page=&pageSize=
GET  /v1/products/{id}?lang=fr
GET  /v1/allergens?lang=de
GET  /v1/categories?lang=en
Public API rules:

Never returns Draft or Archived products
Always requires country filter (or defaults to all active)
Supports allergen filtering (e.g. "free from nuts")
Responses cached via Azure CDN / APIM policy
Versioned from day one — breaking changes increment to /v2/
Search & Filtering (Internal UI)

Product list view filter bar supports:

Free-text search (searches product name and description via SQL Full Text Search on ProductTranslations)
Country (scoped to user's permitted countries)
Category
Supplier
Status
Allergen presence / intensity
Sorting: product name, category, supplier, country, last modified date

Pagination: offset/page pattern — ?page=1&pageSize=25

URL state: all active filters reflected as URL query params (shareable links, browser back support)

Required SQL indexes: country, category, supplier, status, full-text on ProductTranslations

Translation fallback in search: queries ProductTranslations filtered to user's preferred language; falls back to English if no translation exists.

Azure Infrastructure (Bicep)

IaC tool: Bicep — chosen as the project is Azure-only, Bicep has full first-class support for all required resources, no state management overhead, and integrates cleanly with GitHub Actions / Azure DevOps.

Resources provisioned per environment (dev / staging / prod)

Azure Static Web Apps
Azure Function App — Internal API (isolated worker plan)
Azure Function App — Public API (isolated worker plan)
Azure SQL Server + Database
Azure Blob Storage Account + Containers (allergen-docs-{env})
Azure API Management (public API gateway)
Azure CDN Profile + Endpoint
Azure Key Vault (connection strings, storage keys, APIM subscription keys)
App Insights + Log Analytics Workspace
Module Structure

/infra
  main.bicep                    -- entry point, orchestrates all modules
  main.parameters.dev.json      -- dev environment parameter values
  main.parameters.staging.json
  main.parameters.prod.json
  /modules
    staticWebApp.bicep
    functionAppInternal.bicep
    functionAppPublic.bicep
    sqlServer.bicep
    blobStorage.bicep
    apiManagement.bicep
    cdn.bicep
    keyVault.bicep
    monitoring.bicep            -- App Insights + Log Analytics
Parameterisation

All environment-specific values are parameterised — never hardcoded in modules:

@allowed(['dev', 'staging', 'prod'])
param environment string

param location string = resourceGroup().location
param sqlAdminLogin string
@secure()
param sqlAdminPassword string
Resource naming convention: {resourceType}-allergen-{environment} e.g. func-allergen-internal-prod, sql-allergen-prod

Key Vault Integration

All secrets (SQL connection strings, Blob Storage keys, APIM subscription keys, Entra ID client secrets) are stored in Key Vault. Function Apps reference secrets via Key Vault references in app settings rather than storing values directly:

SQLCONNSTR_Default: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=sql-connection-string)'
CI/CD Integration

Bicep deployments triggered via GitHub Actions (or Azure DevOps) pipeline:

on: push to main  →  deploy to dev
on: release tag   →  deploy to staging  →  manual approval gate  →  deploy to prod
Pipeline steps: az login (federated identity / service principal) → az deployment group create with the appropriate parameter file per environment.

Environment Isolation

Each environment deploys to its own Azure Resource Group:

rg-allergen-dev
rg-allergen-staging
rg-allergen-prod
This ensures complete isolation with independent scaling, access control, and cost tracking per environment.

Entra ID App Registration

Single app registration with exposed API scopes
App roles defined in manifest: Reader, Editor, Manager, Admin
Role assignments managed in Entra ID (Enterprise Applications)
Country-level scoping managed in database UserPermissions — not in Entra ID
Audit Log Behaviour

Written in application code (Function App), not SQL triggers
Every INSERT, UPDATE, DELETE, status change, and rollback is logged
OldValues and NewValues stored as JSON snapshots of the affected row
Immutable — audit rows are never updated or deleted
Queryable via internal API for compliance review
Build Order

SQL Schema — all tables, constraints, indexes, seed data (allergens, languages, regions, countries)
Azure Infrastructure (Bicep) — all resources, Key Vault references
Entra ID App Registration — app roles, scopes, manifest
Internal Azure Functions API — auth middleware, RBAC + country permission checks, CRUD endpoints, audit logging
Public Azure Functions API — versioned, API key auth, Active products only, caching headers
React SPA — MSAL auth, role-aware routing, language loading, product management UI, search/filter, document upload
Key Business Rules

One product = one set of allergen data. If allergen data differs, it is a different product.
Products are the primary entity — suppliers, allergens, nutritional info, documents all reference back to Products.
Suppliers are scoped to a single country — a supplier cannot span multiple countries.
A supplier can be linked to many products within their country.
A product can have multiple suppliers (primary, backup etc) — managed via ProductSuppliers.
Supplier priority against a product is optional. If provided, no two suppliers on the same product can share the same priority value.
When linking a supplier to a product, both must belong to the same country — enforced in the API layer.
Products can only be managed by users with permission for that product's country.
The public API must never expose Draft or Archived products under any circumstances.
All file deletions are soft deletes — blobs and version history are retained.
Managers cannot grant permissions beyond their own country access scope.
Nutritional values follow standard EU FIR 1169/2011 label fields.
Allergen intensity must be tracked as either "Contains" or "May Contain" — boolean flags are insufficient.

