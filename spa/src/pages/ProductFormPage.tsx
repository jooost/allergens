import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../context/ApiContext.js";
import type { AllergenPresence } from "../types/index.js";

interface AllergenEntry {
  allergenId: number;
  presence: AllergenPresence;
  notes: string;
}

interface TranslationEntry {
  languageId: number;
  name: string;
  description: string;
  ingredients: string;
  storageInstructions: string;
}

export function ProductFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const productId = isEdit ? parseInt(id!) : null;
  const navigate = useNavigate();
  const api = useApi();
  const qc = useQueryClient();
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [countryId, setCountryId] = useState<number | "">("");
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [allergens, setAllergens] = useState<AllergenEntry[]>([]);
  const [nutrition, setNutrition] = useState({
    servingSizeGrams: "",
    energyKj: "",
    energyKcal: "",
    fatGrams: "",
    saturatedFatGrams: "",
    carbohydrateGrams: "",
    sugarsGrams: "",
    fibreGrams: "",
    proteinGrams: "",
    saltGrams: "",
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.reference.categories(),
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: () => api.reference.countries(),
  });

  const { data: allAllergens } = useQuery({
    queryKey: ["allergens"],
    queryFn: () => api.reference.allergens(),
  });

  const { data: languages } = useQuery({
    queryKey: ["languages"],
    queryFn: () => api.reference.languages(),
  });

  const { data: existing } = useQuery({
    queryKey: ["products", productId],
    queryFn: () => api.products.get(productId!),
    enabled: isEdit && productId !== null,
  });

  useEffect(() => {
    if (!existing) return;
    setSku(existing.sku);
    setCategoryId(existing.categoryId);
    setCountryId(existing.countryId);
    setTranslations(
      existing.translations.map((t) => ({
        languageId: t.languageId,
        name: t.name,
        description: t.description ?? "",
        ingredients: t.ingredients ?? "",
        storageInstructions: t.storageInstructions ?? "",
      })),
    );
    setAllergens(
      existing.allergens.map((a) => ({
        allergenId: a.allergenId,
        presence: a.presence,
        notes: a.notes ?? "",
      })),
    );
    if (existing.nutritionalInfo) {
      const n = existing.nutritionalInfo;
      setNutrition({
        servingSizeGrams: String(n.servingSizeGrams ?? ""),
        energyKj: String(n.energyKj ?? ""),
        energyKcal: String(n.energyKcal ?? ""),
        fatGrams: String(n.fatGrams ?? ""),
        saturatedFatGrams: String(n.saturatedFatGrams ?? ""),
        carbohydrateGrams: String(n.carbohydrateGrams ?? ""),
        sugarsGrams: String(n.sugarsGrams ?? ""),
        fibreGrams: String(n.fibreGrams ?? ""),
        proteinGrams: String(n.proteinGrams ?? ""),
        saltGrams: String(n.saltGrams ?? ""),
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (data: unknown) =>
      isEdit ? api.products.update(productId!, data) : api.products.create(data),
    onSuccess: (product) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate(`/products/${product.id}`);
    },
  });

  function toNum(v: string): number | null {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      sku,
      categoryId: categoryId || undefined,
      countryId: countryId || undefined,
      translations: translations.filter((t) => t.name.trim()),
      allergens: allergens.map((a) => ({
        allergenId: a.allergenId,
        presence: a.presence,
        notes: a.notes || null,
      })),
      nutritionalInfo: {
        servingSizeGrams: toNum(nutrition.servingSizeGrams),
        energyKj: toNum(nutrition.energyKj),
        energyKcal: toNum(nutrition.energyKcal),
        fatGrams: toNum(nutrition.fatGrams),
        saturatedFatGrams: toNum(nutrition.saturatedFatGrams),
        carbohydrateGrams: toNum(nutrition.carbohydrateGrams),
        sugarsGrams: toNum(nutrition.sugarsGrams),
        fibreGrams: toNum(nutrition.fibreGrams),
        proteinGrams: toNum(nutrition.proteinGrams),
        saltGrams: toNum(nutrition.saltGrams),
      },
    };
    saveMutation.mutate(payload);
  }

  function addTranslation(languageId: number) {
    if (translations.find((t) => t.languageId === languageId)) return;
    setTranslations((ts) => [
      ...ts,
      { languageId, name: "", description: "", ingredients: "", storageInstructions: "" },
    ]);
  }

  function updateTranslation(languageId: number, patch: Partial<TranslationEntry>) {
    setTranslations((ts) =>
      ts.map((t) => (t.languageId === languageId ? { ...t, ...patch } : t)),
    );
  }

  function toggleAllergen(allergenId: number) {
    if (allergens.find((a) => a.allergenId === allergenId)) {
      setAllergens((as) => as.filter((a) => a.allergenId !== allergenId));
    } else {
      setAllergens((as) => [...as, { allergenId, presence: "Contains", notes: "" }]);
    }
  }

  function updateAllergen(allergenId: number, patch: Partial<AllergenEntry>) {
    setAllergens((as) =>
      as.map((a) => (a.allergenId === allergenId ? { ...a, ...patch } : a)),
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to={isEdit ? `/products/${productId}` : "/products"}>← Back</Link>
      </div>
      <h2>{isEdit ? "Edit Product" : "New Product"}</h2>

      <form onSubmit={handleSubmit}>
        <section style={{ marginBottom: 24 }}>
          <h3>Basic Info</h3>
          <label style={{ display: "block", marginBottom: 8 }}>
            SKU *
            <input
              required
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              style={{ display: "block", marginTop: 4, padding: "6px 10px", width: 300 }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Category *
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value) : "")}
              style={{ display: "block", marginTop: 4, padding: "6px 10px" }}
            >
              <option value="">Select…</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          {!isEdit && (
            <label style={{ display: "block", marginBottom: 8 }}>
              Country *
              <select
                required
                value={countryId}
                onChange={(e) => setCountryId(e.target.value ? parseInt(e.target.value) : "")}
                style={{ display: "block", marginTop: 4, padding: "6px 10px" }}
              >
                <option value="">Select…</option>
                {countries?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
        </section>

        <section style={{ marginBottom: 24 }}>
          <h3>Translations</h3>
          <select
            onChange={(e) => {
              if (e.target.value) addTranslation(parseInt(e.target.value));
              e.target.value = "";
            }}
            style={{ marginBottom: 12, padding: "6px 10px" }}
          >
            <option value="">+ Add language…</option>
            {languages
              ?.filter((l) => !translations.find((t) => t.languageId === l.id))
              .map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
          </select>
          {translations.map((t) => {
            const lang = languages?.find((l) => l.id === t.languageId);
            return (
              <details key={t.languageId} style={{ marginBottom: 12, border: "1px solid #ddd", borderRadius: 4 }}>
                <summary style={{ padding: "8px 12px", cursor: "pointer", fontWeight: 500 }}>
                  {lang?.name ?? `Language #${t.languageId}`}
                </summary>
                <div style={{ padding: 12 }}>
                  {[
                    { field: "name", label: "Name *" },
                    { field: "description", label: "Description" },
                    { field: "ingredients", label: "Ingredients" },
                    { field: "storageInstructions", label: "Storage Instructions" },
                  ].map(({ field, label }) => (
                    <label key={field} style={{ display: "block", marginBottom: 8 }}>
                      {label}
                      <textarea
                        value={(t as any)[field]}
                        onChange={(e) => updateTranslation(t.languageId, { [field]: e.target.value } as any)}
                        rows={field === "name" ? 1 : 3}
                        style={{ display: "block", marginTop: 4, padding: "6px 10px", width: "100%" }}
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTranslations((ts) => ts.filter((x) => x.languageId !== t.languageId))}
                    style={{ color: "#d9534f", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              </details>
            );
          })}
        </section>

        <section style={{ marginBottom: 24 }}>
          <h3>Allergens</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allAllergens?.map((a) => {
              const entry = allergens.find((e) => e.allergenId === a.id);
              return (
                <div
                  key={a.id}
                  style={{
                    border: `2px solid ${entry ? "#337ab7" : "#ddd"}`,
                    borderRadius: 4,
                    padding: "4px 10px",
                    cursor: "pointer",
                    background: entry ? "#e8f0fe" : "#fff",
                  }}
                  onClick={() => toggleAllergen(a.id)}
                >
                  {a.name}
                </div>
              );
            })}
          </div>
          {allergens.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {allergens.map((entry) => {
                const allergen = allAllergens?.find((a) => a.id === entry.allergenId);
                return (
                  <div key={entry.allergenId} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ minWidth: 140, fontWeight: 500 }}>{allergen?.name}</span>
                    <select
                      value={entry.presence}
                      onChange={(e) => updateAllergen(entry.allergenId, { presence: e.target.value as AllergenPresence })}
                      style={{ padding: "4px 8px" }}
                    >
                      <option value="Contains">Contains</option>
                      <option value="MayContain">May Contain</option>
                      <option value="Free">Free</option>
                    </select>
                    <input
                      placeholder="Notes…"
                      value={entry.notes}
                      onChange={(e) => updateAllergen(entry.allergenId, { notes: e.target.value })}
                      style={{ flex: 1, padding: "4px 8px" }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ marginBottom: 24 }}>
          <h3>Nutritional Information (per 100g)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
            {[
              { key: "servingSizeGrams", label: "Serving Size (g)" },
              { key: "energyKj", label: "Energy (kJ)" },
              { key: "energyKcal", label: "Energy (kcal)" },
              { key: "fatGrams", label: "Fat (g)" },
              { key: "saturatedFatGrams", label: "Saturated Fat (g)" },
              { key: "carbohydrateGrams", label: "Carbohydrate (g)" },
              { key: "sugarsGrams", label: "Sugars (g)" },
              { key: "fibreGrams", label: "Fibre (g)" },
              { key: "proteinGrams", label: "Protein (g)" },
              { key: "saltGrams", label: "Salt (g)" },
            ].map(({ key, label }) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  step="0.01"
                  value={(nutrition as any)[key]}
                  onChange={(e) => setNutrition((n) => ({ ...n, [key]: e.target.value }))}
                  style={{ display: "block", marginTop: 4, padding: "6px 10px", width: "100%" }}
                />
              </label>
            ))}
          </div>
        </section>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            style={{ padding: "8px 20px", background: "#337ab7", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            {saveMutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}
          </button>
          {saveMutation.isError && (
            <span style={{ color: "#d9534f" }}>
              {(saveMutation.error as Error).message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
