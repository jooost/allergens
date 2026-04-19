import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, MoreHorizontal, Archive, RotateCcw } from "lucide-react";
import { useApi } from "../context/ApiContext.js";
import { useHasRole } from "../hooks/useCurrentUser.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import { Popover } from "../components/ui/popover.js";
import { cn } from "../lib/utils.js";
import type { AllergenPresence, AuditEntry } from "../types/index.js";

// Maps BCP-47 language code → representative country ISO-2 for flag emoji
const LANG_FLAG: Record<string, string> = {
  en: "GB", fr: "FR", de: "DE", es: "ES", it: "IT", pt: "PT",
  nl: "NL", pl: "PL", cs: "CZ", sk: "SK", hu: "HU", ro: "RO",
  bg: "BG", hr: "HR", da: "DK", fi: "FI", el: "GR", lt: "LT",
  lv: "LV", et: "EE", sl: "SI", sv: "SE", mt: "MT", ga: "IE",
  nb: "NO", uk: "UA", ru: "RU", tr: "TR", ar: "SA", zh: "CN",
  ja: "JP", ko: "KR",
};

function langFlag(isoCode: string): string {
  const country = LANG_FLAG[isoCode.toLowerCase().split("-")[0]];
  if (!country) return "";
  return [...country.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

const statusVariant: Record<string, "success" | "warning" | "muted"> = {
  Active: "success",
  Draft: "warning",
  Archived: "muted",
};

const allergenVariant: Record<AllergenPresence, "contains" | "maycontain" | "free"> = {
  Contains: "contains",
  MayContain: "maycontain",
  Free: "free",
};

const allergenLabel: Record<AllergenPresence, string> = {
  Contains: "Contains",
  MayContain: "May Contain",
  Free: "Free",
};

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const productId = parseInt(id!);
  const api = useApi();
  const qc = useQueryClient();
  const canEdit = useHasRole("Editor");
  const canManage = useHasRole("Manager");

  const { data: product, isLoading } = useQuery({
    queryKey: ["products", productId],
    queryFn: () => api.products.get(productId),
    enabled: !isNaN(productId),
  });

  const { data: allergens } = useQuery({
    queryKey: ["allergens"],
    queryFn: () => api.reference.allergens(),
  });

  const { data: languages } = useQuery({
    queryKey: ["languages"],
    queryFn: () => api.reference.languages(),
  });

  const { data: auditLog } = useQuery({
    queryKey: ["audit", "Products", productId],
    queryFn: () => api.audit.query({ tableName: "Products", recordId: productId, pageSize: 50 }),
    enabled: canManage && !isNaN(productId),
  });

  const [overflowOpen, setOverflowOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["products", productId] });
  const publishMutation = useMutation({ mutationFn: () => api.products.publish(productId), onSuccess: invalidate });
  const archiveMutation = useMutation({ mutationFn: () => api.products.archive(productId), onSuccess: invalidate });
  const rollbackMutation = useMutation({ mutationFn: () => api.products.rollback(productId), onSuccess: invalidate });

  const showOverflow =
    (canEdit && product?.status === "Active") ||
    (canManage && product?.status === "Active");

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!product) return <div className="p-6 text-muted-foreground">Product not found.</div>;

  const nutri = product.nutritionalInfo;

  return (
    <div className="p-6 max-w-4xl">
      {/* Back + header */}
      <div className="mb-5">
        <Link to="/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          Products
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {product.imageUrl && (
              <>
                <button
                  onClick={() => setLightboxOpen(true)}
                  className="shrink-0 rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary/40 transition-all"
                  title="View full image"
                >
                  <img
                    src={product.imageUrl}
                    alt={product.name ?? product.sku}
                    className="h-24 w-24 object-cover"
                  />
                </button>
                {lightboxOpen && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={() => setLightboxOpen(false)}
                  >
                    <img
                      src={product.imageUrl!}
                      alt={product.name ?? product.sku}
                      className="max-h-[85vh] max-w-[85vw] rounded-lg shadow-2xl object-contain"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={() => setLightboxOpen(false)}
                      className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </>
            )}
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold text-gray-900">{product.name ?? product.sku}</h1>
              <Badge variant={statusVariant[product.status] ?? "muted"}>{product.status}</Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && product.status === "Draft" && (
              <Button size="sm" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
                Publish
              </Button>
            )}

            {canEdit && (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/products/${productId}/edit`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Link>
              </Button>
            )}

            {showOverflow && (
              <Popover
                open={overflowOpen}
                onClose={() => setOverflowOpen(false)}
                align="right"
                className="min-w-[160px] py-1"
                trigger={
                  <button
                    onClick={() => setOverflowOpen((v) => !v)}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:bg-gray-50 hover:text-foreground transition-colors"
                    title="More actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                }
              >
                {canEdit && product.status === "Active" && (
                  <button
                    onClick={() => { rollbackMutation.mutate(); setOverflowOpen(false); }}
                    disabled={rollbackMutation.isPending}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                    Revert to Draft
                  </button>
                )}
                {canManage && product.status === "Active" && (
                  <button
                    onClick={() => { archiveMutation.mutate(); setOverflowOpen(false); }}
                    disabled={archiveMutation.isPending}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-red-50 disabled:opacity-50",
                      "text-red-600",
                    )}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archive
                  </button>
                )}
              </Popover>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Product details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-0.5">SKU</dt>
                <dd className="font-mono text-gray-900">{product.sku}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Status</dt>
                <dd><Badge variant={statusVariant[product.status] ?? "muted"}>{product.status}</Badge></dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Category</dt>
                <dd className="text-gray-900">{product.categoryName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Country</dt>
                <dd className="text-gray-900">{product.countryName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Created</dt>
                <dd className="text-gray-900">{new Date(product.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd>
                {product.createdBy && <dd className="text-xs text-muted-foreground mt-0.5">{product.createdBy}</dd>}
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Last edited</dt>
                <dd className="text-gray-900">{new Date(product.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd>
                {product.updatedBy && <dd className="text-xs text-muted-foreground mt-0.5">{product.updatedBy}</dd>}
              </div>
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Dietary Suitability</dt>
                <dd className="flex flex-wrap gap-2">
                  {([
                    { label: "Vegetarian", value: product.isVegetarian },
                    { label: "Vegan",      value: product.isVegan      },
                    { label: "Coeliac",    value: product.isCoeliacSafe },
                  ] as { label: string; value: boolean | null }[]).map(({ label, value }) => (
                    <span
                      key={label}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                        value === true  ? "bg-green-50 text-green-700 ring-green-600/20"
                        : value === false ? "bg-red-50 text-red-600 ring-red-500/20"
                        : "bg-gray-50 text-muted-foreground ring-gray-300/50",
                      )}
                    >
                      {value === true ? "✓" : value === false ? "✗" : "—"}
                      {" "}{label}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Allergens */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Allergen Declaration</CardTitle>
          </CardHeader>
          <CardContent>
            {product.allergens.length === 0 ? (
              <p className="text-sm text-muted-foreground">No allergens declared</p>
            ) : (
              <div className="space-y-3">
                {(["Contains", "MayContain", "Free"] as AllergenPresence[]).map((presence) => {
                  const group = product.allergens.filter((pa) => pa.presence === presence);
                  return (
                    <div key={presence} className="flex items-start gap-3">
                      <span className="w-24 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
                        {allergenLabel[presence]}
                      </span>
                      {group.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {group.map((pa) => {
                            const allergen = allergens?.find((a) => a.id === pa.allergenId);
                            return (
                              <Badge key={pa.allergenId} variant={allergenVariant[pa.presence]}>
                                {allergen?.name ?? `Allergen #${pa.allergenId}`}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nutritional info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nutritional Information</CardTitle>
          </CardHeader>
          <CardContent>
            {!nutri ? (
              <p className="text-sm text-muted-foreground">Not provided</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {([
                    ["Energy (kJ)",          nutri.energyKj,           false],
                    ["Energy (kcal)",        nutri.energyKcal,         false],
                    ["Fat (g)",              nutri.fatGrams,           false],
                    ["of which saturates",   nutri.saturatedFatGrams,  true],
                    ["Carbohydrate (g)",     nutri.carbohydrateGrams,  false],
                    ["of which sugars",      nutri.sugarsGrams,        true],
                    ["Fibre (g)",            nutri.fibreGrams,         false],
                    ["Protein (g)",          nutri.proteinGrams,       false],
                    ["Salt (g)",             nutri.saltGrams,          false],
                  ] as [string, number | null | undefined, boolean][]).map(([label, value, sub]) => (
                    <tr key={label}>
                      <td className={cn("py-1.5 pr-4", sub ? "pl-4 text-xs text-muted-foreground/70" : "text-muted-foreground")}>
                        {label}
                      </td>
                      <td className={cn("py-1.5 tabular-nums", sub ? "text-xs text-muted-foreground/70" : "font-medium")}>
                        {value ?? <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Suppliers */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            {product.suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suppliers assigned</p>
            ) : (
              <div className="divide-y divide-border">
                {product.suppliers.map((s) => (
                  <div key={s.id} className="flex items-start justify-between py-2 first:pt-0 last:pb-0">
                    <div>
                      <div className="font-medium">{s.supplierName}</div>
                      {s.notes && <div className="text-xs text-muted-foreground mt-0.5">{s.notes}</div>}
                    </div>
                    {s.priority != null && (
                      <span
                        className="text-xs text-muted-foreground"
                        title="Supplier preference order — 1 = primary, higher = fallback"
                      >
                        {s.priority === 1 ? "Primary" : s.priority === 2 ? "Secondary" : `Fallback ${s.priority}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Translations */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Translations</CardTitle>
          </CardHeader>
          <CardContent>
            {product.translations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No translations</p>
            ) : (
              <div className="divide-y divide-border">
                {product.translations.map((t) => (
                  <div key={t.languageId} className="py-3 first:pt-0 last:pb-0">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {(() => {
                        const lang = languages?.find((l) => l.id === t.languageId);
                        const emoji = lang ? langFlag(lang.isoCode) : "";
                        return (
                          <>
                            {emoji && <span className="text-sm leading-none">{emoji}</span>}
                            {lang?.name ?? `Language #${t.languageId}`}
                          </>
                        );
                      })()}
                    </div>
                    <div className="font-medium">{t.name}</div>
                    {t.description && <div className="mt-1 text-sm text-muted-foreground">{t.description}</div>}
                    {t.ingredients && (
                      <div className="mt-2">
                        <div className="text-xs font-medium text-muted-foreground mb-0.5">Ingredients</div>
                        <div className="text-sm">{t.ingredients}</div>
                      </div>
                    )}
                    {t.storageInstructions && (
                      <div className="mt-2">
                        <div className="text-xs font-medium text-muted-foreground mb-0.5">Storage Instructions</div>
                        <div className="text-sm">{t.storageInstructions}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {product.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents attached</p>
            ) : (
              <div className="divide-y divide-border">
                {product.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                    <div>
                      <span className="font-medium">{d.documentType}</span>
                      {d.currentFileName && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          {d.currentFileName} <span className="text-xs">v{d.currentVersionNumber}</span>
                        </span>
                      )}
                    </div>
                    {!d.isActive && <Badge variant="muted">Inactive</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {/* Audit history — managers only */}
        {canManage && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Audit History</CardTitle>
            </CardHeader>
            <CardContent>
              {!auditLog?.data?.length ? (
                <p className="text-sm text-muted-foreground">No audit entries found</p>
              ) : (
                <ol className="relative border-l border-border ml-2">
                  {auditLog.data.map((entry: AuditEntry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

const ACTION_COLOUR: Record<string, string> = {
  Insert:       "bg-green-500",
  Delete:       "bg-red-500",
  Update:       "bg-blue-400",
  StatusChange: "bg-amber-400",
  Rollback:     "bg-amber-400",
};

const FIELD_LABELS: Record<string, string> = {
  status:         "Status",
  sku:            "SKU",
  categoryId:     "Category",
  countryId:      "Country",
  isVegetarian:   "Vegetarian",
  isVegan:        "Vegan",
  isCoeliacSafe:  "Coeliac",
  imageBlobPath:  "Image",
  imageFileName:  "Image file",
};

function formatFieldName(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "None";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") return "—";
  const str = String(val);
  return str.length > 50 ? str.slice(0, 50) + "…" : str;
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const dotColour = ACTION_COLOUR[entry.action] ?? "bg-gray-400";

  const changedFields = entry.newValues
    ? Object.entries(entry.newValues).filter(([k, v]) => entry.oldValues?.[k] !== v)
    : [];

  const summary =
    entry.action === "Insert" ? "Created product" :
    entry.action === "Delete" ? "Deleted" :
    changedFields.length === 0 ? "No recorded changes" :
    null;

  return (
    <li className="mb-5 ml-4 last:mb-0">
      <span className={cn("absolute -left-[7px] h-3.5 w-3.5 rounded-full ring-2 ring-white", dotColour)} />

      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-gray-800">{entry.changedBy}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(entry.changedAt).toLocaleString("en-GB", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
      </div>

      {summary ? (
        <p className="text-xs text-muted-foreground">{summary}</p>
      ) : (
        <div className="space-y-1">
          {changedFields.map(([key, newVal]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <span className="w-28 shrink-0 font-medium text-gray-600">{formatFieldName(key)}</span>
              <span className="text-muted-foreground line-through truncate max-w-[100px]">
                {formatValue(entry.oldValues?.[key])}
              </span>
              <span className="text-muted-foreground shrink-0">→</span>
              <span className="text-gray-800 truncate max-w-[100px]">{formatValue(newVal)}</span>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
