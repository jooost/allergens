import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Eye, Pencil, Archive, SlidersHorizontal, X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, PackageSearch } from "lucide-react";
import { useApi } from "../context/ApiContext.js";
import { useCurrentUser, useHasRole } from "../hooks/useCurrentUser.js";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Select } from "../components/ui/select.js";
import { Badge } from "../components/ui/badge.js";
import { Popover } from "../components/ui/popover.js";
import { AllergenPill } from "../components/AllergenPill.js";
import { cn } from "../lib/utils.js";
import type { ProductFilters } from "../api/products.js";
import type { Country, ProductCategory, Allergen, ProductSummary } from "../types/index.js";

const statusVariant: Record<string, "success" | "warning" | "muted"> = {
  Active: "success",
  Draft: "warning",
  Archived: "muted",
};

const CATEGORY_BORDER = [
  "border-l-red-400", "border-l-blue-400", "border-l-amber-400", "border-l-pink-500",
  "border-l-cyan-500", "border-l-violet-400", "border-l-emerald-400", "border-l-orange-400",
];
function categoryBorder(categoryId: number) {
  return CATEGORY_BORDER[(categoryId - 1) % CATEGORY_BORDER.length];
}

function flag(isoCode: string) {
  return [...isoCode.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function ProductsPage() {
  const api = useApi();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const canEdit = useHasRole("Editor");
  const canManage = useHasRole("Manager");

  const [filters, setFilters] = useState<ProductFilters>({ page: 1, pageSize: 20 });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [allergenPopoverOpen, setAllergenPopoverOpen] = useState(false);
  const [filtersPopoverOpen, setFiltersPopoverOpen] = useState(false);
  const [sortCol, setSortCol] = useState<"sku" | "name" | "updatedAt" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(col: "sku" | "name" | "updatedAt") {
    if (sortCol === col) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortCol(null); setSortDir("asc"); }
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", filters],
    queryFn: () => api.products.list(filters),
    enabled: !!user,
  });

  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: () => api.reference.countries() });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => api.reference.categories() });
  const { data: allergens } = useQuery({ queryKey: ["allergens"], queryFn: () => api.reference.allergens() });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.products.archive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setSelected(new Set()); },
  });

  function update(patch: Partial<ProductFilters>) {
    setFilters((f) => ({ ...f, ...patch, page: 1 }));
    setSelected(new Set());
  }

  function clearAll() {
    setFilters({ page: 1, pageSize: 20 });
    setSelected(new Set());
  }

  function toggleAllergen(id: number) {
    const current = filters.allergenIds ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    update({ allergenIds: next.length > 0 ? next : undefined });
  }

  const unsortedRows = products?.data ?? [];
  const rows = sortCol
    ? [...unsortedRows].sort((a, b) => {
        const va = sortCol === "updatedAt" ? a.updatedAt : (a[sortCol] ?? "");
        const vb = sortCol === "updatedAt" ? b.updatedAt : (b[sortCol] ?? "");
        const cmp = String(va).localeCompare(String(vb), undefined, { numeric: sortCol !== "updatedAt" });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : unsortedRows;
  const allSelected = rows.length > 0 && rows.every((p) => selected.has(p.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((p) => p.id)));
  }

  function toggleRow(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const total = products?.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(start + rows.length - 1, total);

  const selectedAllergenIds = filters.allergenIds ?? [];
  const selectedAllergens = (allergens ?? []).filter((a: Allergen) => selectedAllergenIds.includes(a.id));
  const highlightCodes = new Set(selectedAllergens.map((a: Allergen) => a.code));

  // Active non-allergen filters for chips
  const activeCountry = countries?.find((c: Country) => c.id === filters.countryId);
  const activeCategory = categories?.find((c: ProductCategory) => c.id === filters.categoryId);
  const hasAnyFilter = !!(filters.search || filters.countryId || filters.categoryId || selectedAllergenIds.length > 0);

  const filtersActiveCount = [filters.countryId, filters.categoryId].filter(Boolean).length;

  const STATUS_TABS = ["All", "Active", "Draft", "Archived"] as const;
  type StatusTab = typeof STATUS_TABS[number];
  const activeTab: StatusTab = (filters.status as StatusTab) ?? "All";

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Products</h1>
          <p className="text-sm text-muted-foreground">Manage allergen declarations and nutritional data</p>
        </div>
        {canEdit && (
          <Button asChild>
            <Link to="/products/new"><Plus className="h-4 w-4" />New Product</Link>
          </Button>
        )}
      </div>

      {/* Filter controls */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            value={filters.search ?? ""}
            onChange={(e) => update({ search: e.target.value || undefined })}
            className="pl-8 w-52"
          />
        </div>

        {/* Allergen multi-select popover */}
        <Popover
          open={allergenPopoverOpen}
          onClose={() => setAllergenPopoverOpen(false)}
          align="left"
          className="w-72 p-3"
          trigger={
            <button
              onClick={() => setAllergenPopoverOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors",
                selectedAllergenIds.length > 0
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-white text-foreground hover:bg-gray-50",
              )}
            >
              Allergens
              {selectedAllergenIds.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                  {selectedAllergenIds.length}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </button>
          }
        >
          <p className="mb-2 text-xs font-medium text-muted-foreground">Select allergens to filter</p>
          <div className="flex flex-wrap gap-1.5">
            {(allergens ?? []).map((a: Allergen) => {
              const active = selectedAllergenIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAllergen(a.id)}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border bg-white text-muted-foreground hover:bg-gray-50 hover:text-foreground",
                  )}
                >
                  <AllergenPill code={a.code} presence="Contains" />
                  <span>{a.name}</span>
                </button>
              );
            })}
          </div>
          {selectedAllergenIds.length > 0 && (
            <button
              onClick={() => { update({ allergenIds: undefined }); setAllergenPopoverOpen(false); }}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear allergens
            </button>
          )}
        </Popover>

        {/* Filters popover (Country + Category + Status) */}
        <Popover
          open={filtersPopoverOpen}
          onClose={() => setFiltersPopoverOpen(false)}
          align="left"
          className="w-64 p-4 space-y-3"
          trigger={
            <button
              onClick={() => setFiltersPopoverOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors",
                filtersActiveCount > 0
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-white text-foreground hover:bg-gray-50",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {filtersActiveCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                  {filtersActiveCount}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </button>
          }
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Country</label>
            <Select
              value={String(filters.countryId ?? "")}
              onChange={(e) => update({ countryId: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full"
            >
              <option value="">All countries</option>
              {countries?.map((c: Country) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
            <Select
              value={String(filters.categoryId ?? "")}
              onChange={(e) => update({ categoryId: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full"
            >
              <option value="">All categories</option>
              {categories?.map((c: ProductCategory) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          {filtersActiveCount > 0 && (
            <button
              onClick={() => { update({ countryId: undefined, categoryId: undefined }); setFiltersPopoverOpen(false); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </Popover>

        {/* Clear all */}
        {hasAnyFilter && (
          <button onClick={clearAll} className="text-sm text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div className="mb-3 flex items-center gap-0.5 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => update({ status: tab === "All" ? undefined : tab })}
            className={cn(
              "relative px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Active filter chips */}
      {hasAnyFilter && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {filters.search && (
            <FilterChip label={`"${filters.search}"`} onRemove={() => update({ search: undefined })} />
          )}
          {activeCountry && (
            <FilterChip label={activeCountry.name} onRemove={() => update({ countryId: undefined })} />
          )}
          {activeCategory && (
            <FilterChip label={activeCategory.name} onRemove={() => update({ categoryId: undefined })} />
          )}
          {selectedAllergens.map((a: Allergen) => (
            <FilterChip
              key={a.id}
              label={a.name}
              pill={<AllergenPill code={a.code} presence="Contains" />}
              onRemove={() => toggleAllergen(a.id)}
            />
          ))}
        </div>
      )}

      {/* Record count + bulk actions */}
      <div className="mb-3 flex items-center justify-between min-h-[28px]">
        <span className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : total === 0 ? "No products" : `Showing ${start}–${end} of ${total} products`}
        </span>
        {someSelected && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => selected.forEach((id) => archiveMutation.mutate(id))}
                disabled={archiveMutation.isPending}
              >
                <Archive className="h-3.5 w-3.5" />
                Archive selected
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-gray-50/50">
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
              </th>
              <SortTh label="SKU" col="sku" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Name" col="name" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Contains</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">May Contain</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Country</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
              <SortTh label="Updated" col="updatedAt" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              <th className="w-24 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {rows.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                selected={selected.has(p.id)}
                onToggle={() => toggleRow(p.id)}
                highlightCodes={highlightCodes}
                canEdit={canEdit}
                onEdit={() => navigate(`/products/${p.id}/edit`)}
                onView={() => navigate(`/products/${p.id}`)}
              />
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <PackageSearch className="mb-3 h-10 w-10 text-muted-foreground/40" strokeWidth={1.25} />
                    {hasAnyFilter ? (
                      <>
                        <p className="text-sm font-medium text-gray-700">No products match your filters</p>
                        <p className="mt-1 text-xs text-muted-foreground">Try adjusting or clearing your filters</p>
                        <button onClick={clearAll} className="mt-3 text-xs text-primary hover:underline">Clear all filters</button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-700">No products yet</p>
                        <p className="mt-1 text-xs text-muted-foreground">Get started by creating your first product</p>
                        {canEdit && (
                          <Button asChild size="sm" className="mt-4">
                            <Link to="/products/new"><Plus className="h-3.5 w-3.5" />New Product</Link>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {products && products.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {products.page} of {products.totalPages}</span>
            <Button variant="outline" size="sm" disabled={products.page >= products.totalPages} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface SortThProps {
  label: string;
  col: "sku" | "name" | "updatedAt";
  sortCol: "sku" | "name" | "updatedAt" | null;
  sortDir: "asc" | "desc";
  onSort: (col: "sku" | "name" | "updatedAt") => void;
}

function SortTh({ label, col, sortCol, sortDir, onSort }: SortThProps) {
  const active = sortCol === col;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <button
        onClick={() => onSort(col)}
        className={cn(
          "flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", active ? "opacity-100" : "opacity-30")} />
      </button>
    </th>
  );
}

interface FilterChipProps {
  label: string;
  pill?: ReactNode;
  onRemove: () => void;
}

function FilterChip({ label, pill, onRemove }: FilterChipProps) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-border bg-gray-50 px-2.5 py-0.5 text-xs text-foreground">
      {pill}
      {label}
      <button onClick={onRemove} className="ml-0.5 rounded-full hover:text-foreground text-muted-foreground transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

interface ProductRowProps {
  product: ProductSummary;
  selected: boolean;
  onToggle: () => void;
  highlightCodes: Set<string>;
  canEdit: boolean;
  onEdit: () => void;
  onView: () => void;
}

function ProductRow({ product: p, selected, onToggle, highlightCodes, canEdit, onEdit, onView }: ProductRowProps) {
  const hasFilter = highlightCodes.size > 0;

  return (
    <tr className={cn(
      "group relative transition-colors",
      p.status === "Archived" ? "bg-gray-50/70 opacity-60 hover:opacity-100" : "hover:bg-gray-50/60",
      selected && "bg-primary/5",
    )}>
      <td className="w-8 px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-3.5 w-3.5 rounded border-border accent-primary"
        />
      </td>
      <td className={cn("px-3 py-2 font-mono text-xs border-l-2", categoryBorder(p.categoryId))}>
        <Link to={`/products/${p.id}`} className="font-medium text-primary hover:underline">
          {p.sku}
        </Link>
      </td>
      <td className="px-3 py-2 max-w-[200px] truncate">
        {p.name ?? <span className="italic text-muted-foreground">Untranslated</span>}
      </td>
      {(["Contains", "MayContain"] as const).map((presence) => {
        const group = p.allergens?.filter((a) => a.presence === presence) ?? [];
        return (
          <td key={presence} className="px-3 py-2">
            {group.length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {group.map((a) => (
                  <AllergenPill
                    key={a.allergenId}
                    code={a.code}
                    presence={presence}
                    highlighted={hasFilter && highlightCodes.has(a.code)}
                    dimmed={hasFilter && !highlightCodes.has(a.code)}
                  />
                ))}
              </div>
            )}
          </td>
        );
      })}
      <td className="px-3 py-2 text-xs text-muted-foreground">{p.categoryName}</td>
      <td className="px-3 py-2 whitespace-nowrap text-xs">
        <span className="mr-1">{flag(p.countryCode)}</span>
        <span className="text-muted-foreground">{p.countryCode}</span>
      </td>
      <td className="px-3 py-2">
        <Badge variant={statusVariant[p.status] ?? "muted"}>{p.status}</Badge>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(p.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onView} className="rounded p-1.5 text-muted-foreground hover:bg-gray-100 hover:text-foreground" title="View">
            <Eye className="h-3.5 w-3.5" />
          </button>
          {canEdit && (
            <button onClick={onEdit} className="rounded p-1.5 text-muted-foreground hover:bg-gray-100 hover:text-foreground" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
