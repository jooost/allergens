# Allergen & Nutritional Information Management Platform

A pan-European allergen and nutritional information management platform for a cinema chain. Internal operations colleagues manage allergen and nutritional data for food and beverage products sold across European cinemas. A versioned public API exposes approved product data to guest-facing websites and apps.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend (Internal SPA) | React 18, Vite, Tailwind CSS v3, TanStack Query v5 |
| Auth (SPA) | MSAL.js (Microsoft Entra ID) |
| Hosting | Azure Static Web Apps |
| Internal API | Azure Functions (Node.js, isolated worker) |
| Database | Azure SQL |
| File Storage | Azure Blob Storage |
| API Gateway (Public) | Azure API Management |
| IaC | Bicep |
| CDN/Caching | Azure CDN (public API) |

---

## Architecture

```
[Internal SPA]  ──MSAL──►  [Entra ID]
     │
     ▼
[Internal Azure Functions API]  ──►  [Azure SQL]
                                ──►  [Azure Blob Storage]

[Guest Website/App]
     │
     ▼
[Azure API Management]  ──►  [Public Azure Functions API]  ──►  [Azure SQL]
```

- Two separate Function Apps: internal authenticated API and public versioned API
- Static Web App hosts the internal React SPA
- Azure API Management sits in front of the public Function App for rate limiting, API key management, and versioning
- Azure Blob Storage for product document/file uploads with SAS token upload pattern

---

## Authentication & Authorisation

### Entra ID App Roles

| Role | Products/Suppliers | Users | Countries |
|---|---|---|---|
| Reader | Read only (own countries) | None | Own permitted |
| Editor | Create, edit, publish, rollback (own countries) | None | Own permitted |
| Manager | Read (own countries) | Grant/revoke Reader & Editor within own countries | Own permitted |
| Admin | Full access, all regions | Full user management | All |

**Rules:**
- Editors can publish directly — no approval workflow required
- Editors can rollback a published product to Draft
- Managers cannot assign Manager or Admin roles
- Managers can only grant permissions within their own country scope
- Admin bypasses the UserPermissions table entirely

### Country-Level Scoping

Entra ID roles define what a user can do. Country-level access is managed in the database via `UserPermissions`. The API enforces both on every request.

---

## Regions & Countries

| Region | Countries |
|---|---|
| UK & Ireland | United Kingdom, Ireland |
| Northern Europe | Germany, Netherlands, Belgium, Denmark, Sweden, Norway, Finland |
| Southern Europe | France, Spain, Italy, Portugal |

---

## Database Schema

### Reference / Lookup Tables

```sql
Regions             -- Id, Name
Countries           -- Id, RegionId, Name, ISOCode
Languages           -- Id, IsoCode (e.g. 'en', 'fr'), Name, IsActive
AllergenIntensity   -- Id, Name ('Contains', 'May Contain')
Allergens           -- Id, Code, Name, SortOrder, Description (EU-14)
ProductCategories   -- Id, Name, Description, IsActive
```

### User & Permission Tables

```sql
UserProfiles
  Id, EntraObjectId, DisplayName, Email,
  PreferredLanguageId (FK Languages), CreatedAt, LastLoginAt

UserPermissions
  Id, UserEntraObjectId, RegionId (FK), CountryId (FK, nullable — null = whole region),
  Role ('Reader'|'Editor'|'Manager'|'Admin'),
  GrantedBy, GrantedAt
```

### Core Data Tables

```sql
Products
  Id, SKU, CategoryId (FK), CountryId (FK),
  Status ('Draft'|'Active'|'Archived'),
  CreatedBy, CreatedAt, ModifiedBy, ModifiedAt

ProductTranslations
  Id, ProductId (FK), LanguageId (FK), Name, Description,
  Ingredients, StorageInstructions

ProductAllergens
  Id, ProductId (FK), AllergenId (FK), IntensityId (FK AllergenIntensity)

NutritionalInfo
  Id, ProductId (FK),
  EnergyKJ, EnergyKcal, Fat, Saturates,
  Carbohydrates, Sugars, Fibre, Protein, Salt
  (all DECIMAL — standard EU FIR 1169/2011 fields)

Suppliers
  Id, Name, CountryId (FK), Address, ContactEmail, ContactPhone, IsActive,
  CreatedBy, CreatedAt, ModifiedBy, ModifiedAt

ProductSuppliers  (junction — a product can have multiple suppliers)
  Id, ProductId (FK), SupplierId (FK),
  Priority (INT, nullable),  -- 1=primary, 2=secondary etc. Unique per product where not null
  IsActive, Notes, CreatedBy, CreatedAt
```

### Document / File Tables

```sql
ProductDocuments
  Id, ProductId (FK),
  DocumentType ('Specification'|'AllergenDeclaration'|'NutritionalCertificate'|'LabelScan'|'Other'),
  CurrentVersionId (FK DocumentVersions), IsActive,
  CreatedBy, CreatedAt

DocumentVersions
  Id, ProductDocumentId (FK), VersionNumber (INT),
  FileName, BlobPath, FileSizeBytes, ChangeNotes,
  UploadedBy, UploadedAt
```

### Audit Log

```sql
AuditLog
  Id, TableName, RecordId,
  Action ('Insert'|'Update'|'Delete'),
  ChangedBy (EntraObjectId), ChangedAt,
  OldValues (JSON), NewValues (JSON)
```

Audit entries are written in application code on every mutating operation. The `ChangedBy` field is resolved to a display name at query time via a JOIN to `UserProfiles`. Audit rows are immutable — never updated or deleted.

---

## Product Lifecycle

```
Draft  ──(Editor publishes)──►  Active  ──(Manager archives)──►  Archived
  ▲                                │
  └──────────(Editor reverts)──────┘
```

- Only Active products are returned by the public API
- Archived products are retained for audit — never hard deleted
- Status, country, and category are all editable via the update endpoint (Editor role required)

---

## Allergens

The 14 EU standard allergens (FIR 1169/2011):

Gluten (Cereals containing gluten), Crustaceans, Eggs, Fish, Peanuts, Soybeans, Milk, Nuts (Tree nuts), Celery, Mustard, Sesame seeds, Sulphur dioxide / Sulphites, Lupin, Molluscs

Each allergen on a product has an intensity: **Contains** (IntensityId=1) or **May Contain** (IntensityId=2). The API accepts either the legacy `intensityId` integer or the string `presence` field (`"Contains"` / `"MayContain"`) — both are mapped correctly.

---

## File Upload Pattern

1. SPA requests a short-lived SAS upload token from the internal API
2. SPA uploads the file directly to Azure Blob Storage
3. SPA calls the internal API to register document metadata in `ProductDocuments` / `DocumentVersions`

Blob container structure:
```
allergen-docs-{env}/
  /{isoCountryCode}/
    /{productId}/
      /{documentId}/
        v1_filename.pdf
        v2_filename.pdf
```

Old versions are retained in both Blob Storage and the database. Soft-delete only — blobs and version rows are never hard deleted.

---

## API Design

### Internal API (Authenticated)

Base: `/internal/v1/`  Auth: Entra ID Bearer token (MSAL)

```
# Products
GET    /internal/v1/products?search=&country=&category=&status=&supplier=&allergen=1,2,3&page=&pageSize=&sortBy=&sortOrder=
POST   /internal/v1/products
GET    /internal/v1/products/{id}
PUT    /internal/v1/products/{id}          -- accepts sku, categoryId, countryId, status, translations, allergens, nutritionalInfo
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
GET    /internal/v1/reference/allergens
GET    /internal/v1/reference/categories
GET    /internal/v1/reference/countries
GET    /internal/v1/reference/languages

# Audit (Manager/Admin)
GET    /internal/v1/audit?tableName=&recordId=&action=&changedBy=&from=&to=&page=&pageSize=
```

**Allergen filter:** accepts comma-separated IDs — `allergen=1,3,5` filters products containing any of those allergens.

### Public API (Unauthenticated)

Base: `/v1/` (via Azure API Management)  Auth: API key  Returns: Active products only

```
GET  /v1/products?country=GB&category=snacks&lang=en&allergen=&page=&pageSize=
GET  /v1/products/{id}?lang=fr
GET  /v1/allergens?lang=de
GET  /v1/categories?lang=en
```

---

## Internal SPA

### UI Overview

Built with React 18 + Vite + Tailwind CSS v3. Fully light theme using CSS custom property design tokens (HSL-based). Components follow a shadcn/ui-style pattern using `class-variance-authority` and `cn()` (clsx + tailwind-merge).

### Pages

| Route | Description | Min Role |
|---|---|---|
| `/products` | Product list with filters | Reader |
| `/products/new` | Create product | Editor |
| `/products/:id` | Product detail (read view) | Reader |
| `/products/:id/edit` | Edit product | Editor |
| `/suppliers` | Supplier list + inline edit | Reader |
| `/users` | User permission management | Manager |
| `/audit` | Full audit log | Manager |

### Products List

- Dense table with hover-reveal row actions (View, Edit)
- Category colour-coded left border; country shown as flag emoji + ISO code
- Bulk selection with archive action
- **Filter bar:** Search input · Allergens multi-select popover (all 14 allergens, toggleable pills) · Filters button (Country, Category) · Status tab bar (All / Active / Draft / Archived)
- Active filters shown as removable chips beneath the controls; "Clear all" link
- Column sorting on SKU, Name, Updated (client-side, ascending/descending/off cycle)
- Empty state with context-aware CTA (filtered vs. truly empty)

### Product Detail (Read View)

- **Action bar:** Status badge + Edit button always visible; Publish for Draft products; Revert to Draft and Archive in `···` overflow menu (Archive is red-tinted)
- **Product Details card:** SKU, Status, Category, Country, Created (with user), Last Edited (with user)
- **Allergen Declaration:** Grouped by presence — Contains / May Contain / Free rows
- **Nutritional Information:** Hierarchical table — saturates indented under Fat, sugars under Carbohydrate
- **Suppliers:** Priority shown as Primary / Secondary / Fallback N with tooltip
- **Translations:** Language name with flag emoji, expandable per-language fields
- **Audit History:** Timeline of all changes (Managers only) with expandable field-level diffs

### Product Form (Edit/Create)

- **Sticky left nav:** Section anchor list (Product Details · Allergens · Nutrition · Translations) with active section highlight via IntersectionObserver; visible on `lg` screens
- **Sticky footer:** Save/Cancel bar always visible regardless of scroll position, frosted-glass treatment
- **Product Details card:** Name (maps to default language translation), SKU, Category, Country, Status (edit mode only)
- **Allergen Declaration:** Toggle buttons for all 14 allergens; presence (Contains / May Contain / Free) and notes per allergen; full regulatory name displayed without truncation
- **Nutritional Information:** Spinner-free decimal inputs (`step="0.1"`) with inline unit suffix (g / kJ / kcal) and placeholder example values

### Sidebar

- Sections: **Catalogue** (Products, Suppliers) · **Admin** (Users, Audit Log — Manager only)
- User avatar (initial letter), display name, email in footer
- Settings + Sign out buttons
- Logo image at top; clicking navigates to `/products`

---

## Internationalisation (i18n)

**Hybrid approach:**

| Content | Storage |
|---|---|
| UI strings (labels, buttons, nav) | JSON files bundled with SPA |
| Dynamic data (product names, allergen names, category names) | Database translation tables |

- User's preferred language stored in `UserProfiles.PreferredLanguageId`
- Internal API serves translations based on `PreferredLanguageId`; fallback chain: requested language → English → raw value
- Public API accepts `?lang=` query param or `Accept-Language` header

---

## Azure Infrastructure (Bicep)

Resources provisioned per environment (dev / staging / prod):

- Azure Static Web Apps
- Azure Function App — Internal API (isolated worker plan)
- Azure Function App — Public API (isolated worker plan)
- Azure SQL Server + Database
- Azure Blob Storage Account + Containers (`allergen-docs-{env}`)
- Azure API Management (public API gateway)
- Azure CDN Profile + Endpoint
- Azure Key Vault (connection strings, storage keys, APIM subscription keys)
- App Insights + Log Analytics Workspace

Resource naming convention: `{resourceType}-allergen-{environment}` e.g. `func-allergen-internal-prod`

All secrets stored in Key Vault, referenced via Key Vault references in Function App settings:
```
SQLCONNSTR_Default: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=sql-connection-string)'
```

**Environment isolation:** each environment deploys to its own resource group (`rg-allergen-dev`, `rg-allergen-staging`, `rg-allergen-prod`).

---

## CI/CD

```
push to main   →  deploy to dev
release tag    →  deploy to staging  →  manual approval  →  deploy to prod
```

Pipeline: `az login` (federated identity) → `az deployment group create` with environment parameter file.

---

## Key Business Rules

- One product = one set of allergen data. If allergen data differs by market, it is a different product.
- Products are the primary entity — suppliers, allergens, nutritional info, documents all reference back to Products.
- Suppliers are scoped to a single country.
- A product can have multiple suppliers (primary, secondary etc.) managed via `ProductSuppliers`.
- Supplier priority per product is optional; where set, values must be unique per product.
- Products can only be managed by users with permission for that product's country.
- The public API must never expose Draft or Archived products under any circumstances.
- All file deletions are soft deletes — blobs and version history are retained.
- Allergen intensity must be "Contains" or "May Contain" — boolean flags are insufficient.
- Nutritional values follow EU FIR 1169/2011 label fields.
- Audit rows are immutable — never updated or deleted.
