import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool, sql } from "../utils/db.js";
import { withCors } from "../middleware/cors.js";

// GET /public/v1/allergens
async function listAllergens(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const languageCode = req.query.get("languageCode")?.toLowerCase() ?? "en";
  const pool = await getPool();

  const langResult = await pool
    .request()
    .input("IsoCode", sql.NVarChar(10), languageCode)
    .query("SELECT Id FROM Languages WHERE IsoCode = @IsoCode");
  const langId: number | null = langResult.recordset[0]?.Id ?? null;

  const result = await pool
    .request()
    .input("LangId", sql.Int, langId)
    .query(`
      SELECT a.Id, a.Code, a.SortOrder,
             COALESCE(t.Name, en.Name) AS Name,
             COALESCE(t.Description, en.Description) AS Description
      FROM Allergens a
      LEFT JOIN AllergenTranslations en ON en.AllergenId = a.Id
        AND en.LanguageId = (SELECT Id FROM Languages WHERE IsoCode = 'en')
      LEFT JOIN AllergenTranslations t ON t.AllergenId = a.Id AND t.LanguageId = @LangId
      WHERE a.IsActive = 1
      ORDER BY a.SortOrder, a.Code
    `);

  return withCors({ jsonBody: result.recordset });
}

// GET /public/v1/countries
async function listCountries(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT c.Id, c.Name, c.IsoCode, r.Name AS RegionName
    FROM Countries c
    JOIN Regions r ON r.Id = c.RegionId
    WHERE c.IsActive = 1
    ORDER BY r.Name, c.Name
  `);
  return withCors({ jsonBody: result.recordset });
}

app.http("publicListAllergens", {
  route: "public/v1/allergens",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: listAllergens,
});

app.http("publicListCountries", {
  route: "public/v1/countries",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: listCountries,
});

app.http("publicAllergenOptions", {
  route: "public/v1/allergens/{*rest}",
  methods: ["OPTIONS"],
  authLevel: "anonymous",
  handler: async () => withCors({ status: 204 }),
});

app.http("publicCountriesOptions", {
  route: "public/v1/countries/{*rest}",
  methods: ["OPTIONS"],
  authLevel: "anonymous",
  handler: async () => withCors({ status: 204 }),
});
