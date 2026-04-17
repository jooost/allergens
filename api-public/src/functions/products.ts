import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool, sql } from "../utils/db.js";
import { withCors } from "../middleware/cors.js";

// GET /public/v1/products
// Query: countryCode (required ISO 2-letter), languageCode, categoryId, allergenId, search, page, pageSize
async function listProducts(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const countryCode = req.query.get("countryCode")?.toUpperCase();
  if (!countryCode) {
    return withCors({ status: 400, jsonBody: { error: "countryCode is required" } });
  }

  const languageCode = req.query.get("languageCode")?.toLowerCase() ?? "en";
  const categoryId = req.query.get("categoryId");
  const allergenId = req.query.get("allergenId");
  const search = req.query.get("search");
  const page = Math.max(1, parseInt(req.query.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.get("pageSize") ?? "20")));
  const offset = (page - 1) * pageSize;

  const pool = await getPool();

  // Resolve country
  const countryResult = await pool
    .request()
    .input("IsoCode", sql.NVarChar(2), countryCode)
    .query("SELECT Id FROM Countries WHERE IsoCode = @IsoCode AND IsActive = 1");
  if (!countryResult.recordset[0]) {
    return withCors({ status: 404, jsonBody: { error: "Country not found" } });
  }
  const countryId = countryResult.recordset[0].Id as number;

  // Resolve language (fallback to English)
  const langResult = await pool
    .request()
    .input("IsoCode", sql.NVarChar(10), languageCode)
    .query("SELECT Id FROM Languages WHERE IsoCode = @IsoCode");
  const langId: number | null = langResult.recordset[0]?.Id ?? null;

  const request = pool.request();
  request.input("CountryId", sql.Int, countryId);
  request.input("LangId", sql.Int, langId);
  request.input("Offset", sql.Int, offset);
  request.input("PageSize", sql.Int, pageSize);

  const conditions = ["p.CountryId = @CountryId", "p.Status = 'Active'"];

  if (categoryId) {
    request.input("CategoryId", sql.Int, parseInt(categoryId));
    conditions.push("p.CategoryId = @CategoryId");
  }
  if (allergenId) {
    request.input("AllergenId", sql.Int, parseInt(allergenId));
    conditions.push(`EXISTS (
      SELECT 1 FROM ProductAllergens pa
      WHERE pa.ProductId = p.Id AND pa.AllergenId = @AllergenId AND pa.Presence != 'Free'
    )`);
  }
  if (search) {
    request.input("Search", sql.NVarChar(200), `"${search.replace(/"/g, "")}"*`);
    conditions.push(`(
      CONTAINS((pt.Name, pt.Description), @Search)
      OR CONTAINS((ptEn.Name, ptEn.Description), @Search)
    )`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const countResult = await pool
    .request()
    .input("CountryId", sql.Int, countryId)
    .input("LangId", sql.Int, langId)
    .query(`
      SELECT COUNT(*) AS Total
      FROM Products p
      LEFT JOIN ProductTranslations pt ON pt.ProductId = p.Id AND pt.LanguageId = @LangId
      LEFT JOIN ProductTranslations ptEn ON ptEn.ProductId = p.Id
        AND ptEn.LanguageId = (SELECT Id FROM Languages WHERE IsoCode = 'en')
      WHERE p.CountryId = @CountryId AND p.Status = 'Active'
    `);

  const dataResult = await request.query(`
    SELECT p.Id, p.Sku, p.CategoryId, pc.Name AS CategoryName, p.Status, p.CreatedAt, p.UpdatedAt,
           COALESCE(pt.Name, ptEn.Name) AS Name,
           COALESCE(pt.Description, ptEn.Description) AS Description
    FROM Products p
    JOIN ProductCategories pc ON pc.Id = p.CategoryId
    LEFT JOIN ProductTranslations pt ON pt.ProductId = p.Id AND pt.LanguageId = @LangId
    LEFT JOIN ProductTranslations ptEn ON ptEn.ProductId = p.Id
      AND ptEn.LanguageId = (SELECT Id FROM Languages WHERE IsoCode = 'en')
    ${where}
    ORDER BY COALESCE(pt.Name, ptEn.Name) ASC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
  `);

  const total = countResult.recordset[0].Total as number;

  return withCors({
    jsonBody: {
      data: dataResult.recordset,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  });
}

// GET /public/v1/products/{id}
async function getProduct(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return withCors({ status: 400, jsonBody: { error: "Invalid id" } });

  const languageCode = req.query.get("languageCode")?.toLowerCase() ?? "en";

  const pool = await getPool();

  const langResult = await pool
    .request()
    .input("IsoCode", sql.NVarChar(10), languageCode)
    .query("SELECT Id FROM Languages WHERE IsoCode = @IsoCode");
  const langId: number | null = langResult.recordset[0]?.Id ?? null;

  const productResult = await pool
    .request()
    .input("Id", sql.Int, id)
    .input("LangId", sql.Int, langId)
    .query(`
      SELECT p.Id, p.Sku, p.CategoryId, pc.Name AS CategoryName, p.Status,
             c.IsoCode AS CountryCode, c.Name AS CountryName,
             COALESCE(pt.Name, ptEn.Name) AS Name,
             COALESCE(pt.Description, ptEn.Description) AS Description,
             COALESCE(pt.Ingredients, ptEn.Ingredients) AS Ingredients,
             COALESCE(pt.StorageInstructions, ptEn.StorageInstructions) AS StorageInstructions
      FROM Products p
      JOIN ProductCategories pc ON pc.Id = p.CategoryId
      JOIN Countries c ON c.Id = p.CountryId
      LEFT JOIN ProductTranslations pt ON pt.ProductId = p.Id AND pt.LanguageId = @LangId
      LEFT JOIN ProductTranslations ptEn ON ptEn.ProductId = p.Id
        AND ptEn.LanguageId = (SELECT Id FROM Languages WHERE IsoCode = 'en')
      WHERE p.Id = @Id AND p.Status = 'Active'
    `);

  if (!productResult.recordset[0]) {
    return withCors({ status: 404, jsonBody: { error: "Product not found" } });
  }

  const product = productResult.recordset[0];

  // Fetch allergens
  const allergensResult = await pool
    .request()
    .input("ProductId", sql.Int, id)
    .input("LangId", sql.Int, langId)
    .query(`
      SELECT a.Id, a.Code, a.SortOrder, pa.Presence,
             COALESCE(at2.Name, atEn.Name) AS Name
      FROM ProductAllergens pa
      JOIN Allergens a ON a.Id = pa.AllergenId
      LEFT JOIN AllergenTranslations atEn ON atEn.AllergenId = a.Id
        AND atEn.LanguageId = (SELECT Id FROM Languages WHERE IsoCode = 'en')
      LEFT JOIN AllergenTranslations at2 ON at2.AllergenId = a.Id AND at2.LanguageId = @LangId
      WHERE pa.ProductId = @ProductId
      ORDER BY a.SortOrder
    `);

  // Fetch nutritional info
  const nutritionResult = await pool
    .request()
    .input("ProductId", sql.Int, id)
    .query(`
      SELECT ServingSizeGrams, EnergyKj, EnergyKcal, FatGrams, SaturatedFatGrams,
             CarbohydrateGrams, SugarsGrams, FibreGrams, ProteinGrams, SaltGrams
      FROM ProductNutritionalInfo
      WHERE ProductId = @ProductId
    `);

  return withCors({
    jsonBody: {
      ...product,
      allergens: allergensResult.recordset,
      nutritionalInfo: nutritionResult.recordset[0] ?? null,
    },
  });
}

// OPTIONS preflight handler
async function optionsHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  return withCors({ status: 204 });
}

app.http("publicListProducts", {
  route: "public/v1/products",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: listProducts,
});

app.http("publicGetProduct", {
  route: "public/v1/products/{id}",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getProduct,
});

app.http("publicProductsOptions", {
  route: "public/v1/products/{*rest}",
  methods: ["OPTIONS"],
  authLevel: "anonymous",
  handler: optionsHandler,
});
