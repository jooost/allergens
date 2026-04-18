import { app } from "@azure/functions";
import { authenticate } from "../middleware/auth.js";
import { hasRole, canAccessCountry, getPermittedCountryIds } from "../middleware/rbac.js";
import { getPool, sql } from "../utils/db.js";
import { writeAuditLog } from "../utils/audit.js";
// GET /internal/v1/products
app.http("listProducts", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "internal/v1/products",
    handler: async (req, _ctx) => {
        try {
            const user = await authenticate(req);
            if (!hasRole(user, "Reader"))
                return forbidden();
            const params = req.query;
            const search = params.get("search");
            const country = params.get("country") ? parseInt(params.get("country")) : null;
            const category = params.get("category") ? parseInt(params.get("category")) : null;
            const status = params.get("status");
            const supplier = params.get("supplier") ? parseInt(params.get("supplier")) : null;
            const allergen = params.get("allergen") ? parseInt(params.get("allergen")) : null;
            const page = parseInt(params.get("page") ?? "1", 10);
            const pageSize = Math.min(parseInt(params.get("pageSize") ?? "25", 10), 100);
            const sortBy = params.get("sortBy") ?? "ModifiedAt";
            const sortOrder = params.get("sortOrder") === "asc" ? "ASC" : "DESC";
            const langId = user.preferredLanguageId ?? 1;
            const permittedCountries = await getPermittedCountryIds(user.entraObjectId, user.roles);
            const pool = await getPool();
            const request = pool.request();
            request.input("LangId", sql.Int, langId);
            request.input("FallbackLangId", sql.Int, 1);
            request.input("Offset", sql.Int, (page - 1) * pageSize);
            request.input("PageSize", sql.Int, pageSize);
            let whereClause = "WHERE 1=1";
            if (permittedCountries !== "all") {
                const ids = permittedCountries.join(",");
                whereClause += ` AND p.CountryId IN (${ids || "NULL"})`;
            }
            if (country !== null) {
                request.input("CountryId", sql.Int, country);
                whereClause += " AND p.CountryId = @CountryId";
            }
            if (category !== null) {
                request.input("CategoryId", sql.Int, category);
                whereClause += " AND p.CategoryId = @CategoryId";
            }
            if (status) {
                request.input("Status", sql.NVarChar(10), status);
                whereClause += " AND p.Status = @Status";
            }
            if (supplier !== null) {
                request.input("SupplierId", sql.Int, supplier);
                whereClause += " AND EXISTS (SELECT 1 FROM ProductSuppliers ps WHERE ps.ProductId = p.Id AND ps.SupplierId = @SupplierId AND ps.IsActive = 1)";
            }
            if (allergen !== null) {
                request.input("AllergenId", sql.Int, allergen);
                whereClause += " AND EXISTS (SELECT 1 FROM ProductAllergens pa WHERE pa.ProductId = p.Id AND pa.AllergenId = @AllergenId)";
            }
            if (search) {
                request.input("Search", sql.NVarChar(200), `"${search.replace(/"/g, "")}*"`);
                whereClause += ` AND EXISTS (
          SELECT 1 FROM ProductTranslations pt2
          WHERE pt2.ProductId = p.Id
            AND CONTAINS((pt2.Name, pt2.Description), @Search)
        )`;
            }
            const validSortCols = {
                name: "t.Name",
                category: "pc.Name",
                country: "c.Name",
                modifiedat: "p.ModifiedAt",
                createdat: "p.CreatedAt",
            };
            const orderCol = validSortCols[sortBy.toLowerCase()] ?? "p.ModifiedAt";
            const queryResult = await request.query(`
        SELECT
          p.Id, p.SKU, p.Status, p.CountryId, p.CategoryId,
          p.CreatedAt, p.ModifiedAt,
          COALESCE(t.Name, t_en.Name, p.SKU) AS Name,
          COALESCE(t.Description, t_en.Description) AS Description,
          pc.Name AS CategoryName,
          c.Name AS CountryName,
          c.IsoCode AS CountryISOCode,
          COUNT(*) OVER () AS TotalCount
        FROM Products p
        LEFT JOIN ProductTranslations t    ON t.ProductId = p.Id    AND t.LanguageId = @LangId
        LEFT JOIN ProductTranslations t_en ON t_en.ProductId = p.Id AND t_en.LanguageId = @FallbackLangId
        LEFT JOIN ProductCategories pc     ON pc.Id = p.CategoryId
        LEFT JOIN Countries c              ON c.Id = p.CountryId
        ${whereClause}
        ORDER BY ${orderCol} ${sortOrder}
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
      `);
            const total = queryResult.recordset[0]?.TotalCount ?? 0;
            return json({
                data: queryResult.recordset.map(mapProductSummary),
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            });
        }
        catch (err) {
            return errorResponse(err);
        }
    },
});
// POST /internal/v1/products
app.http("createProduct", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "internal/v1/products",
    handler: async (req, _ctx) => {
        try {
            const user = await authenticate(req);
            if (!hasRole(user, "Editor"))
                return forbidden();
            const body = await req.json();
            const { sku, categoryId, countryId, translations, allergens, nutritionalInfo } = body;
            if (!sku || !categoryId || !countryId) {
                return { status: 400, jsonBody: { error: "sku, categoryId and countryId are required" } };
            }
            const allowed = await canAccessCountry(user.entraObjectId, countryId, "Editor", user.roles);
            if (!allowed)
                return forbidden();
            const pool = await getPool();
            const tx = new sql.Transaction(pool);
            await tx.begin();
            try {
                const productResult = await tx.request()
                    .input("SKU", sql.NVarChar(100), sku)
                    .input("CategoryId", sql.Int, categoryId)
                    .input("CountryId", sql.Int, countryId)
                    .input("CreatedBy", sql.NVarChar(36), user.entraObjectId)
                    .query(`
            INSERT INTO Products (SKU, CategoryId, CountryId, Status, CreatedBy, ModifiedBy)
            OUTPUT INSERTED.Id
            VALUES (@SKU, @CategoryId, @CountryId, 'Draft', @CreatedBy, @CreatedBy)
          `);
                const productId = productResult.recordset[0].Id;
                if (translations?.length) {
                    for (const t of translations) {
                        await tx.request()
                            .input("ProductId", sql.Int, productId)
                            .input("LanguageId", sql.Int, t.languageId)
                            .input("Name", sql.NVarChar(200), t.name)
                            .input("Description", sql.NVarChar(sql.MAX), t.description ?? null)
                            .query(`
                INSERT INTO ProductTranslations (ProductId, LanguageId, Name, Description)
                VALUES (@ProductId, @LanguageId, @Name, @Description)
              `);
                    }
                }
                if (allergens?.length) {
                    for (const a of allergens) {
                        await tx.request()
                            .input("ProductId", sql.Int, productId)
                            .input("AllergenId", sql.Int, a.allergenId)
                            .input("IntensityId", sql.Int, a.intensityId)
                            .query(`
                INSERT INTO ProductAllergens (ProductId, AllergenId, IntensityId)
                VALUES (@ProductId, @AllergenId, @IntensityId)
              `);
                    }
                }
                if (nutritionalInfo) {
                    const n = nutritionalInfo;
                    await tx.request()
                        .input("ProductId", sql.Int, productId)
                        .input("EnergyKJ", sql.Decimal(8, 2), n.energyKJ ?? null)
                        .input("EnergyKcal", sql.Decimal(8, 2), n.energyKcal ?? null)
                        .input("Fat", sql.Decimal(8, 2), n.fat ?? null)
                        .input("Saturates", sql.Decimal(8, 2), n.saturates ?? null)
                        .input("Carbohydrates", sql.Decimal(8, 2), n.carbohydrates ?? null)
                        .input("Sugars", sql.Decimal(8, 2), n.sugars ?? null)
                        .input("Protein", sql.Decimal(8, 2), n.protein ?? null)
                        .input("Salt", sql.Decimal(8, 2), n.salt ?? null)
                        .query(`
              INSERT INTO NutritionalInfo (ProductId, EnergyKJ, EnergyKcal, Fat, Saturates, Carbohydrates, Sugars, Protein, Salt)
              VALUES (@ProductId, @EnergyKJ, @EnergyKcal, @Fat, @Saturates, @Carbohydrates, @Sugars, @Protein, @Salt)
            `);
                }
                await tx.commit();
                await writeAuditLog("Products", productId, "Insert", user.entraObjectId, null, { sku, categoryId, countryId });
                return { status: 201, jsonBody: { id: productId } };
            }
            catch (e) {
                await tx.rollback();
                throw e;
            }
        }
        catch (err) {
            return errorResponse(err);
        }
    },
});
// GET /internal/v1/products/{id}
app.http("getProduct", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "internal/v1/products/{id}",
    handler: async (req, _ctx) => {
        try {
            const user = await authenticate(req);
            if (!hasRole(user, "Reader"))
                return forbidden();
            const productId = parseInt(req.params.id, 10);
            const langId = user.preferredLanguageId ?? 1;
            const pool = await getPool();
            const result = await pool.request()
                .input("ProductId", sql.Int, productId)
                .input("LangId", sql.Int, langId)
                .input("FallbackLangId", sql.Int, 1)
                .query(`
          SELECT
            p.Id, p.SKU, p.Status, p.CountryId, p.CategoryId, p.CreatedBy, p.CreatedAt, p.ModifiedBy, p.ModifiedAt,
            COALESCE(t.Name, t_en.Name, p.SKU) AS Name,
            COALESCE(t.Description, t_en.Description) AS Description,
            pc.Name AS CategoryName,
            c.Name AS CountryName, c.IsoCode AS CountryISOCode
          FROM Products p
          LEFT JOIN ProductTranslations t    ON t.ProductId = p.Id    AND t.LanguageId = @LangId
          LEFT JOIN ProductTranslations t_en ON t_en.ProductId = p.Id AND t_en.LanguageId = @FallbackLangId
          LEFT JOIN ProductCategories pc     ON pc.Id = p.CategoryId
          LEFT JOIN Countries c              ON c.Id = p.CountryId
          WHERE p.Id = @ProductId
        `);
            if (!result.recordset.length)
                return notFound();
            const product = result.recordset[0];
            const allowed = await canAccessCountry(user.entraObjectId, product.CountryId, "Reader", user.roles);
            if (!allowed)
                return forbidden();
            // Fetch related data
            const [allergens, nutritional, translations, suppliers, documents] = await Promise.all([
                pool.request().input("ProductId", sql.Int, productId).query(`
          SELECT pa.AllergenId, pa.IntensityId, a.Name AS AllergenName, ai.Name AS IntensityName
          FROM ProductAllergens pa
          JOIN Allergens a ON a.Id = pa.AllergenId
          JOIN AllergenIntensity ai ON ai.Id = pa.IntensityId
          WHERE pa.ProductId = @ProductId
        `),
                pool.request().input("ProductId", sql.Int, productId).query(`
          SELECT EnergyKJ, EnergyKcal, Fat, Saturates, Carbohydrates, Sugars, Protein, Salt
          FROM NutritionalInfo WHERE ProductId = @ProductId
        `),
                pool.request().input("ProductId", sql.Int, productId).query(`
          SELECT pt.LanguageId, l.IsoCode AS LanguageCode, pt.Name, pt.Description
          FROM ProductTranslations pt JOIN Languages l ON l.Id = pt.LanguageId
          WHERE pt.ProductId = @ProductId
        `),
                pool.request().input("ProductId", sql.Int, productId).query(`
          SELECT ps.Id AS ProductSupplierId, ps.SupplierId, ps.Priority, ps.IsActive,
                 s.Name AS SupplierName, s.CountryId
          FROM ProductSuppliers ps JOIN Suppliers s ON s.Id = ps.SupplierId
          WHERE ps.ProductId = @ProductId
        `),
                pool.request().input("ProductId", sql.Int, productId).query(`
          SELECT pd.Id, pd.DocumentType, pd.IsActive, pd.CreatedAt, pd.CurrentVersionId,
                 dv.VersionNumber AS CurrentVersionNumber, dv.FileName AS CurrentFileName,
                 dv.BlobPath AS CurrentBlobPath, dv.UploadedAt AS CurrentUploadedAt
          FROM ProductDocuments pd
          LEFT JOIN DocumentVersions dv ON dv.Id = pd.CurrentVersionId
          WHERE pd.ProductId = @ProductId AND pd.IsActive = 1
        `),
            ]);
            return json({
                id: product.Id,
                sku: product.SKU,
                status: product.Status,
                countryId: product.CountryId,
                countryName: product.CountryName,
                countryCode: product.CountryISOCode,
                categoryId: product.CategoryId,
                categoryName: product.CategoryName,
                name: product.Name ?? null,
                description: product.Description ?? null,
                updatedAt: product.ModifiedAt,
                createdAt: product.CreatedAt,
                allergens: allergens.recordset.map((r) => ({
                    allergenId: r.AllergenId,
                    allergenName: r.AllergenName,
                    intensityId: r.IntensityId,
                    presence: r.IntensityName === "May Contain" ? "MayContain" : r.IntensityName,
                })),
                nutritionalInfo: nutritional.recordset[0] ? {
                    energyKj: nutritional.recordset[0].EnergyKJ,
                    energyKcal: nutritional.recordset[0].EnergyKcal,
                    fatGrams: nutritional.recordset[0].Fat,
                    saturatedFatGrams: nutritional.recordset[0].Saturates,
                    carbohydrateGrams: nutritional.recordset[0].Carbohydrates,
                    sugarsGrams: nutritional.recordset[0].Sugars,
                    proteinGrams: nutritional.recordset[0].Protein,
                    saltGrams: nutritional.recordset[0].Salt,
                } : null,
                translations: translations.recordset.map((r) => ({
                    languageId: r.LanguageId,
                    languageCode: r.LanguageCode,
                    name: r.Name,
                    description: r.Description ?? null,
                })),
                suppliers: suppliers.recordset.map((r) => ({
                    id: r.ProductSupplierId,
                    supplierId: r.SupplierId,
                    supplierName: r.SupplierName,
                    priority: r.Priority,
                    isActive: r.IsActive,
                })),
                documents: documents.recordset.map((r) => ({
                    id: r.Id,
                    documentType: r.DocumentType,
                    isActive: r.IsActive,
                    createdAt: r.CreatedAt,
                    currentVersionId: r.CurrentVersionId,
                    currentVersionNumber: r.CurrentVersionNumber,
                    currentFileName: r.CurrentFileName,
                    currentBlobPath: r.CurrentBlobPath,
                    currentUploadedAt: r.CurrentUploadedAt,
                })),
            });
        }
        catch (err) {
            return errorResponse(err);
        }
    },
});
// PUT /internal/v1/products/{id}
app.http("updateProduct", {
    methods: ["PUT"],
    authLevel: "anonymous",
    route: "internal/v1/products/{id}",
    handler: async (req, _ctx) => {
        try {
            const user = await authenticate(req);
            if (!hasRole(user, "Editor"))
                return forbidden();
            const productId = parseInt(req.params.id, 10);
            const body = await req.json();
            const pool = await getPool();
            const existing = await pool.request()
                .input("Id", sql.Int, productId)
                .query("SELECT * FROM Products WHERE Id = @Id");
            if (!existing.recordset.length)
                return notFound();
            const old = existing.recordset[0];
            const allowed = await canAccessCountry(user.entraObjectId, old.CountryId, "Editor", user.roles);
            if (!allowed)
                return forbidden();
            if (old.Status === "Archived") {
                return { status: 409, jsonBody: { error: "Cannot edit an Archived product" } };
            }
            const tx = new sql.Transaction(pool);
            await tx.begin();
            try {
                await tx.request()
                    .input("Id", sql.Int, productId)
                    .input("CategoryId", sql.Int, body.categoryId ?? old.CategoryId)
                    .input("ModifiedBy", sql.NVarChar(36), user.entraObjectId)
                    .query(`
            UPDATE Products SET CategoryId = @CategoryId, ModifiedBy = @ModifiedBy, ModifiedAt = SYSUTCDATETIME()
            WHERE Id = @Id
          `);
                if (body.translations?.length) {
                    for (const t of body.translations) {
                        await tx.request()
                            .input("ProductId", sql.Int, productId)
                            .input("LanguageId", sql.Int, t.languageId)
                            .input("Name", sql.NVarChar(200), t.name)
                            .input("Description", sql.NVarChar(sql.MAX), t.description ?? null)
                            .query(`
                MERGE ProductTranslations AS target
                USING (SELECT @ProductId AS ProductId, @LanguageId AS LanguageId) AS src
                  ON target.ProductId = src.ProductId AND target.LanguageId = src.LanguageId
                WHEN MATCHED THEN UPDATE SET Name = @Name, Description = @Description
                WHEN NOT MATCHED THEN INSERT (ProductId, LanguageId, Name, Description) VALUES (@ProductId, @LanguageId, @Name, @Description);
              `);
                    }
                }
                if (body.allergens !== undefined) {
                    await tx.request().input("ProductId", sql.Int, productId)
                        .query("DELETE FROM ProductAllergens WHERE ProductId = @ProductId");
                    for (const a of body.allergens) {
                        await tx.request()
                            .input("ProductId", sql.Int, productId)
                            .input("AllergenId", sql.Int, a.allergenId)
                            .input("IntensityId", sql.Int, a.intensityId)
                            .query("INSERT INTO ProductAllergens (ProductId, AllergenId, IntensityId) VALUES (@ProductId, @AllergenId, @IntensityId)");
                    }
                }
                if (body.nutritionalInfo) {
                    const n = body.nutritionalInfo;
                    await tx.request()
                        .input("ProductId", sql.Int, productId)
                        .input("EnergyKJ", sql.Decimal(8, 2), n.energyKJ ?? null)
                        .input("EnergyKcal", sql.Decimal(8, 2), n.energyKcal ?? null)
                        .input("Fat", sql.Decimal(8, 2), n.fat ?? null)
                        .input("Saturates", sql.Decimal(8, 2), n.saturates ?? null)
                        .input("Carbohydrates", sql.Decimal(8, 2), n.carbohydrates ?? null)
                        .input("Sugars", sql.Decimal(8, 2), n.sugars ?? null)
                        .input("Protein", sql.Decimal(8, 2), n.protein ?? null)
                        .input("Salt", sql.Decimal(8, 2), n.salt ?? null)
                        .query(`
              MERGE NutritionalInfo AS target
              USING (SELECT @ProductId AS ProductId) AS src ON target.ProductId = src.ProductId
              WHEN MATCHED THEN UPDATE SET EnergyKJ=@EnergyKJ, EnergyKcal=@EnergyKcal, Fat=@Fat, Saturates=@Saturates, Carbohydrates=@Carbohydrates, Sugars=@Sugars, Protein=@Protein, Salt=@Salt
              WHEN NOT MATCHED THEN INSERT (ProductId, EnergyKJ, EnergyKcal, Fat, Saturates, Carbohydrates, Sugars, Protein, Salt) VALUES (@ProductId, @EnergyKJ, @EnergyKcal, @Fat, @Saturates, @Carbohydrates, @Sugars, @Protein, @Salt);
            `);
                }
                await tx.commit();
                await writeAuditLog("Products", productId, "Update", user.entraObjectId, old, body);
                return { status: 204 };
            }
            catch (e) {
                await tx.rollback();
                throw e;
            }
        }
        catch (err) {
            return errorResponse(err);
        }
    },
});
// POST /internal/v1/products/{id}/publish
app.http("publishProduct", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "internal/v1/products/{id}/publish",
    handler: async (req, _ctx) => {
        return changeProductStatus(req, "Active", "Editor");
    },
});
// POST /internal/v1/products/{id}/archive
app.http("archiveProduct", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "internal/v1/products/{id}/archive",
    handler: async (req, _ctx) => {
        return changeProductStatus(req, "Archived", "Editor");
    },
});
// POST /internal/v1/products/{id}/rollback
app.http("rollbackProduct", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "internal/v1/products/{id}/rollback",
    handler: async (req, _ctx) => {
        try {
            const user = await authenticate(req);
            if (!hasRole(user, "Editor"))
                return forbidden();
            const productId = parseInt(req.params.id, 10);
            const pool = await getPool();
            const existing = await pool.request()
                .input("Id", sql.Int, productId)
                .query("SELECT * FROM Products WHERE Id = @Id");
            if (!existing.recordset.length)
                return notFound();
            const current = existing.recordset[0];
            const allowed = await canAccessCountry(user.entraObjectId, current.CountryId, "Editor", user.roles);
            if (!allowed)
                return forbidden();
            // Rollback: Active → Draft
            await pool.request()
                .input("Id", sql.Int, productId)
                .input("ModifiedBy", sql.NVarChar(36), user.entraObjectId)
                .query("UPDATE Products SET Status = 'Draft', ModifiedBy = @ModifiedBy, ModifiedAt = SYSUTCDATETIME() WHERE Id = @Id");
            await writeAuditLog("Products", productId, "Rollback", user.entraObjectId, { status: current.Status }, { status: "Draft" });
            return { status: 204 };
        }
        catch (err) {
            return errorResponse(err);
        }
    },
});
async function changeProductStatus(req, newStatus, minimumRole) {
    try {
        const user = await authenticate(req);
        if (!hasRole(user, minimumRole))
            return forbidden();
        const productId = parseInt(req.params.id, 10);
        const pool = await getPool();
        const existing = await pool.request()
            .input("Id", sql.Int, productId)
            .query("SELECT * FROM Products WHERE Id = @Id");
        if (!existing.recordset.length)
            return notFound();
        const old = existing.recordset[0];
        const allowed = await canAccessCountry(user.entraObjectId, old.CountryId, minimumRole, user.roles);
        if (!allowed)
            return forbidden();
        await pool.request()
            .input("Id", sql.Int, productId)
            .input("Status", sql.NVarChar(10), newStatus)
            .input("ModifiedBy", sql.NVarChar(36), user.entraObjectId)
            .query("UPDATE Products SET Status = @Status, ModifiedBy = @ModifiedBy, ModifiedAt = SYSUTCDATETIME() WHERE Id = @Id");
        await writeAuditLog("Products", productId, "StatusChange", user.entraObjectId, { status: old.Status }, { status: newStatus });
        return { status: 204 };
    }
    catch (err) {
        return errorResponse(err);
    }
}
function json(body, status = 200) {
    return { status, jsonBody: body };
}
function notFound() {
    return { status: 404, jsonBody: { error: "Not found" } };
}
function forbidden() {
    return { status: 403, jsonBody: { error: "Forbidden" } };
}
function errorResponse(err) {
    if (err?.status)
        return { status: err.status, jsonBody: { error: err.message } };
    console.error(err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
}
function stripTotalCount(row) {
    const { TotalCount: _, ...rest } = row;
    return rest;
}
function mapProductSummary(row) {
    return {
        id: row.Id,
        sku: row.SKU,
        status: row.Status,
        countryId: row.CountryId,
        countryName: row.CountryName,
        countryCode: row.CountryISOCode,
        categoryId: row.CategoryId,
        categoryName: row.CategoryName,
        name: row.Name ?? null,
        description: row.Description ?? null,
        updatedAt: row.ModifiedAt,
        createdAt: row.CreatedAt,
    };
}
