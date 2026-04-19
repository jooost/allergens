import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, X, ImagePlus, FilePlus } from "lucide-react";
import { useApi } from "../context/ApiContext.js";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Select } from "../components/ui/select.js";
import { Label } from "../components/ui/label.js";
import { Textarea } from "../components/ui/textarea.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import { cn } from "../lib/utils.js";
import type { AllergenPresence, ProductDocument } from "../types/index.js";

interface AllergenEntry { allergenId: number; presence: AllergenPresence; notes: string; }
interface TranslationEntry { languageId: number; name: string; description: string; ingredients: string; storageInstructions: string; }

export function ProductFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const productId = isEdit ? parseInt(id!) : null;
  const navigate = useNavigate();
  const api = useApi();
  const qc = useQueryClient();

  const [sku, setSku] = useState("");
  const [primaryName, setPrimaryName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [countryId, setCountryId] = useState<number | "">("");
  const [status, setStatus] = useState<string>("");
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [baseLanguageId, setBaseLanguageId] = useState<number | null>(null);
  const [isVegetarian, setIsVegetarian] = useState<boolean | null>(null);
  const [isVegan, setIsVegan] = useState<boolean | null>(null);
  const [isCoeliacSafe, setIsCoeliacSafe] = useState<boolean | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [, setImageFileName] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("Specification");
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [allergens, setAllergens] = useState<AllergenEntry[]>([]);
  const [nutrition, setNutrition] = useState({
    energyKj: "", energyKcal: "", fatGrams: "", saturatedFatGrams: "",
    carbohydrateGrams: "", sugarsGrams: "", fibreGrams: "", proteinGrams: "", saltGrams: "",
  });

  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => api.reference.categories() });
  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: () => api.reference.countries() });
  const { data: allAllergens } = useQuery({ queryKey: ["allergens"], queryFn: () => api.reference.allergens() });
  const { data: languages } = useQuery({ queryKey: ["languages"], queryFn: () => api.reference.languages() });
  const { data: existing } = useQuery({
    queryKey: ["products", productId],
    queryFn: () => api.products.get(productId!),
    enabled: isEdit && productId !== null,
  });
  const { data: documents, refetch: refetchDocuments } = useQuery<ProductDocument[]>({
    queryKey: ["products", productId, "documents"],
    queryFn: () => api.documents.list(productId!) as Promise<ProductDocument[]>,
    enabled: isEdit && productId !== null,
  });

  useEffect(() => {
    if (!existing) return;
    setSku(existing.sku);
    setPrimaryName(existing.name ?? "");
    setCategoryId(existing.categoryId);
    setCountryId(existing.countryId);
    setStatus(existing.status);
    const mappedTranslations = existing.translations.map((t) => ({
      languageId: t.languageId, name: t.name, description: t.description ?? "",
      ingredients: t.ingredients ?? "", storageInstructions: t.storageInstructions ?? "",
    }));
    setTranslations(mappedTranslations);
    if (mappedTranslations.length > 0) setBaseLanguageId(mappedTranslations[0].languageId);
    setIsVegetarian(existing.isVegetarian ?? null);
    setIsVegan(existing.isVegan ?? null);
    setIsCoeliacSafe(existing.isCoeliacSafe ?? null);
    setImagePreviewUrl(existing.imageUrl ?? null);
    setImageFileName(existing.imageFileName ?? null);
    setAllergens(existing.allergens.map((a) => ({ allergenId: a.allergenId, presence: a.presence, notes: a.notes ?? "" })));
    if (existing.nutritionalInfo) {
      const n = existing.nutritionalInfo;
      setNutrition({
        energyKj: String(n.energyKj ?? ""), energyKcal: String(n.energyKcal ?? ""),
        fatGrams: String(n.fatGrams ?? ""), saturatedFatGrams: String(n.saturatedFatGrams ?? ""),
        carbohydrateGrams: String(n.carbohydrateGrams ?? ""), sugarsGrams: String(n.sugarsGrams ?? ""),
        fibreGrams: String(n.fibreGrams ?? ""), proteinGrams: String(n.proteinGrams ?? ""),
        saltGrams: String(n.saltGrams ?? ""),
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (data: unknown) => isEdit ? api.products.update(productId!, data) : api.products.create(data),
    onSuccess: (product) => { setIsDirty(false); qc.invalidateQueries({ queryKey: ["products"] }); navigate(`/products/${product.id}`); },
  });

  function toNum(v: string): number | null { const n = parseFloat(v); return isNaN(n) ? null : n; }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Merge primaryName into the default language (id=1) translation
    const mergedTranslations = (() => {
      if (!primaryName.trim()) return translations.filter((t) => t.name.trim());
      const baseLangId = baseLanguageId ?? 1;
      const existing = translations.find((t) => t.languageId === baseLangId);
      if (existing) {
        return translations.map((t) => t.languageId === baseLangId ? { ...t, name: primaryName } : t).filter((t) => t.name.trim());
      }
      return [{ languageId: baseLangId, name: primaryName, description: "", ingredients: "", storageInstructions: "" }, ...translations].filter((t) => t.name.trim());
    })();

    saveMutation.mutate({
      sku, categoryId: categoryId || undefined, countryId: countryId || undefined,
      ...(isEdit && status ? { status } : {}),
      isVegetarian, isVegan, isCoeliacSafe,
      translations: mergedTranslations,
      allergens: allergens.map((a) => ({ allergenId: a.allergenId, presence: a.presence, notes: a.notes || null })),
      nutritionalInfo: {
        energyKj: toNum(nutrition.energyKj), energyKcal: toNum(nutrition.energyKcal),
        fatGrams: toNum(nutrition.fatGrams), saturatedFatGrams: toNum(nutrition.saturatedFatGrams),
        carbohydrateGrams: toNum(nutrition.carbohydrateGrams), sugarsGrams: toNum(nutrition.sugarsGrams),
        fibreGrams: toNum(nutrition.fibreGrams), proteinGrams: toNum(nutrition.proteinGrams),
        saltGrams: toNum(nutrition.saltGrams),
      },
    });
  }

  const [activeSection, setActiveSection] = useState("section-details");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const sections = ["section-details", "section-allergens", "section-nutrition", "section-translations", "section-documents"];
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observerRef.current!.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const NAV_SECTIONS = [
    { id: "section-details",      label: "Product Details" },
    { id: "section-allergens",    label: "Allergens" },
    { id: "section-nutrition",    label: "Nutrition" },
    { id: "section-translations", label: "Translations" },
    ...(isEdit ? [{ id: "section-documents", label: "Documents" }] : []),
  ];

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !productId) return;
    setImageError(null);
    setImageUploading(true);
    try {
      const result = await api.image.upload(productId, file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setImageFileName(result.imageFileName);
    } catch (err: any) {
      console.error("Image upload error:", err);
      setImageError(err?.message ?? "Upload failed. Please try again.");
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !productId) return;
    setDocError(null);
    setDocUploading(true);
    try {
      await api.documents.uploadFile(productId, file, docType);
      await refetchDocuments();
    } catch (err: any) {
      setDocError(err?.message ?? "Upload failed");
    } finally {
      setDocUploading(false);
      if (docFileRef.current) docFileRef.current.value = "";
    }
  }

  async function handleImageRemove() {
    if (!productId) return;
    setImageError(null);
    setImageUploading(true);
    try {
      await api.image.remove(productId);
      setImagePreviewUrl(null);
      setImageFileName(null);
    } catch (err: any) {
      console.error("Image remove error:", err);
      setImageError(err?.message ?? "Remove failed. Please try again.");
    } finally {
      setImageUploading(false);
    }
  }

  const sectionComplete: Record<string, boolean> = {
    "section-details":      !!(primaryName.trim() && sku.trim() && categoryId && countryId),
    "section-allergens":    allergens.length > 0,
    "section-nutrition":    Object.values(nutrition).some((v) => v !== ""),
    "section-translations": translations.some((t) => t.name.trim()),
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const backTo = isEdit ? `/products/${productId}` : "/products";
  function navBack() {
    if (isDirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    navigate(backTo);
  }

  function addTranslation(languageId: number) {
    if (translations.find((t) => t.languageId === languageId)) return;
    if (translations.length === 0) setBaseLanguageId(languageId);
    setIsDirty(true);
    setTranslations((ts) => [...ts, { languageId, name: "", description: "", ingredients: "", storageInstructions: "" }]);
  }

  function removeTranslation(languageId: number) {
    setIsDirty(true);
    setTranslations((ts) => ts.filter((x) => x.languageId !== languageId));
  }

  function toggleAllergen(allergenId: number) {
    setIsDirty(true);
    if (allergens.find((a) => a.allergenId === allergenId)) {
      setAllergens((as) => as.filter((a) => a.allergenId !== allergenId));
    } else {
      setAllergens((as) => [...as, { allergenId, presence: "Contains", notes: "" }]);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <button
          type="button"
          onClick={navBack}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isEdit ? "Back to product" : "Products"}
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{isEdit ? "Edit Product" : "New Product"}</h1>
      </div>

      <div className="flex gap-8">
        {/* Sticky section nav */}
        <nav className="hidden lg:block w-40 shrink-0">
          <ul className="sticky top-6 space-y-1">
            {NAV_SECTIONS.map(({ id, label }) => {
              const isActive = activeSection === id;
              const isDone = sectionComplete[id];
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
                    )}
                  >
                    {isDone && !isActive ? (
                      <svg className="h-3 w-3 shrink-0 text-green-500" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="6" className="fill-green-100" />
                        <path d="M3.5 6l1.75 1.75L8.5 4.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isActive ? "bg-primary" : "bg-gray-300")} />
                    )}
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Form */}
        <div className="flex-1 max-w-3xl">
      <form id="product-form" onSubmit={handleSubmit} onChange={() => setIsDirty(true)} className="space-y-4">
        {/* Product details */}
        <Card id="section-details">
          <CardHeader><CardTitle>Product Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="primaryName">Name *</Label>
              <Input
                id="primaryName"
                required
                value={primaryName}
                onChange={(e) => setPrimaryName(e.target.value)}
                placeholder="e.g. Hazelnut Chocolate Bar"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU *</Label>
                <Input id="sku" required value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. HF-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select required value={String(categoryId)} onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value) : "")}>
                  <option value="">Select category…</option>
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Country *</Label>
                <Select required value={String(countryId)} onChange={(e) => setCountryId(e.target.value ? parseInt(e.target.value) : "")}>
                  <option value="">Select country…</option>
                  {countries?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              {isEdit && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Archived">Archived</option>
                  </Select>
                </div>
              )}
            </div>

            {/* Dietary suitability + image row */}
            <div className="flex items-start gap-6 pt-1">
              <div className="flex-1 space-y-2">
                <Label>Dietary Suitability</Label>
                <div className="flex flex-wrap gap-4">
                  {([
                    { label: "Vegetarian", value: isVegetarian, set: setIsVegetarian },
                    { label: "Vegan",      value: isVegan,      set: setIsVegan      },
                    { label: "Coeliac",    value: isCoeliacSafe, set: setIsCoeliacSafe },
                  ] as { label: string; value: boolean | null; set: (v: boolean | null) => void }[]).map(({ label, value, set }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground w-24">{label}</span>
                      <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium">
                        {([true, false] as boolean[]).map((opt) => (
                          <button
                            key={String(opt)}
                            type="button"
                            onClick={() => { set(value === opt ? null : opt); setIsDirty(true); }}
                            className={cn(
                              "px-2.5 py-1.5 transition-colors border-r border-border last:border-r-0",
                              value === opt
                                ? opt ? "bg-green-600 text-white" : "bg-red-100 text-red-700"
                                : "bg-white text-muted-foreground hover:bg-gray-50",
                            )}
                          >
                            {opt ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product image — edit mode only */}
              {isEdit && (
                <div className="shrink-0 flex flex-col items-center gap-2">
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt="Product"
                      className="h-24 w-24 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-border bg-gray-50 text-muted-foreground">
                      <ImagePlus className="h-6 w-6 opacity-40" />
                    </div>
                  )}
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  <Button type="button" variant="outline" size="sm" disabled={imageUploading} onClick={() => imageInputRef.current?.click()} className="w-24 text-xs">
                    {imageUploading ? "Uploading…" : imagePreviewUrl ? "Replace" : "Upload"}
                  </Button>
                  {imagePreviewUrl && (
                    <Button type="button" variant="ghost" size="sm" disabled={imageUploading} onClick={handleImageRemove} className="w-24 text-xs text-destructive hover:text-destructive hover:bg-red-50">
                      Remove
                    </Button>
                  )}
                  {imageError && <p className="text-xs text-destructive text-center w-24">{imageError}</p>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Allergens */}
        <Card id="section-allergens">
          <CardHeader><CardTitle>Allergen Declaration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {allAllergens?.map((a) => {
                const active = !!allergens.find((e) => e.allergenId === a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAllergen(a.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-white text-muted-foreground hover:border-gray-300 hover:text-foreground",
                    )}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
            {allergens.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                {allergens.map((entry) => {
                  const allergen = allAllergens?.find((a) => a.id === entry.allergenId);
                  return (
                    <div key={entry.allergenId} className="flex items-center gap-3">
                      <span className="w-52 shrink-0 text-sm font-medium leading-snug">{allergen?.name}</span>
                      <Select
                        value={entry.presence}
                        onChange={(e) => setAllergens((as) => as.map((a) => a.allergenId === entry.allergenId ? { ...a, presence: e.target.value as AllergenPresence } : a))}
                        className="w-36"
                      >
                        <option value="Contains">Contains</option>
                        <option value="MayContain">May Contain</option>
                        <option value="Free">Free</option>
                      </Select>
                      <Input
                        placeholder="Notes…"
                        value={entry.notes}
                        onChange={(e) => setAllergens((as) => as.map((a) => a.allergenId === entry.allergenId ? { ...a, notes: e.target.value } : a))}
                        className="flex-1"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nutritional info */}
        <Card id="section-nutrition">
          <CardHeader><CardTitle>Nutritional Information <span className="text-sm font-normal text-muted-foreground">(per 100g)</span></CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {([
                { key: "energyKj",           label: "Energy",       unit: "kJ",   placeholder: "0" },
                { key: "energyKcal",         label: "Energy",       unit: "kcal", placeholder: "0" },
                { key: "fatGrams",           label: "Fat",          unit: "g",    placeholder: "0" },
                { key: "saturatedFatGrams",  label: "Saturates",    unit: "g",    placeholder: "0" },
                { key: "carbohydrateGrams",  label: "Carbohydrate", unit: "g",    placeholder: "0" },
                { key: "sugarsGrams",        label: "Sugars",       unit: "g",    placeholder: "0" },
                { key: "fibreGrams",         label: "Fibre",        unit: "g",    placeholder: "0" },
                { key: "proteinGrams",       label: "Protein",      unit: "g",    placeholder: "0" },
                { key: "saltGrams",          label: "Salt",         unit: "g",    placeholder: "0" },
              ] as { key: string; label: string; unit: string; placeholder: string }[]).map(({ key, label, unit, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <div className="flex items-center rounded-md border border-border bg-white focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-colors">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder={placeholder}
                      value={(nutrition as any)[key]}
                      onChange={(e) => setNutrition((n) => ({ ...n, [key]: e.target.value }))}
                      className="w-full bg-transparent px-3 py-2 text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="pr-3 text-xs text-muted-foreground shrink-0">{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Translations */}
        <Card id="section-translations">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Translations</CardTitle>
              <Select
                value=""
                onChange={(e) => { if (e.target.value) addTranslation(parseInt(e.target.value)); e.currentTarget.value = ""; }}
                className="w-48 text-sm"
              >
                <option value="">Add language…</option>
                {languages?.filter((l) => !translations.find((t) => t.languageId === l.id))
                  .map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </div>
          </CardHeader>
          {translations.length > 0 && (
            <CardContent className="space-y-4">
              {translations.map((t) => {
                const lang = languages?.find((l) => l.id === t.languageId);
                return (
                  <div key={t.languageId} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{lang?.name ?? `Language #${t.languageId}`}</span>
                      {t.languageId !== baseLanguageId && (
                        <button
                          type="button"
                          onClick={() => removeTranslation(t.languageId)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Name *</Label>
                      <Input value={t.name} onChange={(e) => setTranslations((ts) => ts.map((x) => x.languageId === t.languageId ? { ...x, name: e.target.value } : x))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Textarea rows={2} value={t.description} onChange={(e) => setTranslations((ts) => ts.map((x) => x.languageId === t.languageId ? { ...x, description: e.target.value } : x))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Ingredients</Label>
                        <Textarea rows={2} value={t.ingredients} onChange={(e) => setTranslations((ts) => ts.map((x) => x.languageId === t.languageId ? { ...x, ingredients: e.target.value } : x))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Storage Instructions</Label>
                        <Textarea rows={2} value={t.storageInstructions} onChange={(e) => setTranslations((ts) => ts.map((x) => x.languageId === t.languageId ? { ...x, storageInstructions: e.target.value } : x))} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        {/* Documents — edit mode only */}
        {isEdit && (
          <Card id="section-documents">
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {documents && documents.length > 0 ? (
                <div className="divide-y divide-border">
                  {documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                      <div>
                        <span className="text-sm font-medium">{d.documentType}</span>
                        {d.currentFileName && (
                          <span className="ml-2 text-sm text-muted-foreground">
                            {d.currentFileName} <span className="text-xs">v{d.currentVersionNumber}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No documents attached</p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
                <Select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-52 text-sm">
                  <option value="Specification">Specification</option>
                  <option value="AllergenDeclaration">Allergen Declaration</option>
                  <option value="NutritionalCertificate">Nutritional Certificate</option>
                  <option value="LabelScan">Label Scan</option>
                  <option value="Other">Other</option>
                </Select>
                <input ref={docFileRef} type="file" className="hidden" onChange={handleDocUpload} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={docUploading}
                  onClick={() => docFileRef.current?.click()}
                >
                  <FilePlus className="h-3.5 w-3.5" />
                  {docUploading ? "Uploading…" : "Upload Document"}
                </Button>
                {docError && <p className="text-xs text-destructive">{docError}</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Spacer so content isn't hidden behind sticky bar */}
        <div className="h-4" />
      </form>
        </div>{/* end flex-1 */}
      </div>{/* end flex gap-8 */}

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-10 -mx-6 border-t border-border bg-white/95 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button type="submit" form="product-form" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}
          </Button>
          <Button type="button" variant="outline" onClick={navBack}>Cancel</Button>
          {saveMutation.isError && (
            <span className="text-sm text-destructive">{(saveMutation.error as Error).message}</span>
          )}
        </div>
      </div>
    </div>
  );
}
