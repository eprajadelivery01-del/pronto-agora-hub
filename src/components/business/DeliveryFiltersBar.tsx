import { Search, SlidersHorizontal, X } from "lucide-react";

export type DeliveryStatusFilter = "all" | "pending" | "moving" | "assigned";
export type DeliveryDateFilter = "all" | "today" | "yesterday" | "7d" | "30d";
export type DeliverySort = "main" | "newest" | "oldest" | "value";

export interface DeliveryFilters {
  status: DeliveryStatusFilter;
  date: DeliveryDateFilter;
  sort: DeliverySort;
  search: string;
}

export const DEFAULT_DELIVERY_FILTERS: DeliveryFilters = {
  status: "all",
  date: "all",
  sort: "main",
  search: "",
};

const STATUS_OPTIONS: { value: DeliveryStatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "assigned", label: "Aceitas" },
  { value: "moving", label: "Em rota" },
];

const DATE_OPTIONS: { value: DeliveryDateFilter; label: string }[] = [
  { value: "all", label: "Qualquer data" },
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
];

const SORT_OPTIONS: { value: DeliverySort; label: string }[] = [
  { value: "main", label: "Ordenação principal" },
  { value: "newest", label: "Recém-criadas" },
  { value: "oldest", label: "Mais antigas" },
  { value: "value", label: "Maior valor" },
];

interface Props {
  filters: DeliveryFilters;
  onChange: (filters: DeliveryFilters) => void;
  resultCount: number;
}

const selectClass =
  "rounded-2xl border border-border/60 bg-background px-4 py-2.5 text-xs font-black uppercase tracking-widest text-foreground outline-none focus:border-primary transition-colors";

export function DeliveryFiltersBar({ filters, onChange, resultCount }: Props) {
  const isDirty =
    filters.status !== "all" || filters.date !== "all" || filters.sort !== "main" || !!filters.search.trim();

  return (
    <div className="rounded-[2rem] border border-border/50 bg-card p-4 md:p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Filtros</span>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Buscar por cliente ou endereço..."
            className="w-full rounded-2xl border border-border/60 bg-background pl-9 pr-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary transition-colors"
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value as DeliveryStatusFilter })}
          className={selectClass}
          aria-label="Filtrar por status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.date}
          onChange={(e) => onChange({ ...filters, date: e.target.value as DeliveryDateFilter })}
          className={selectClass}
          aria-label="Filtrar por data"
        >
          {DATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value as DeliverySort })}
          className={selectClass}
          aria-label="Ordenar entregas"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {isDirty && (
          <button
            onClick={() => onChange({ ...DEFAULT_DELIVERY_FILTERS })}
            className="flex items-center gap-1.5 rounded-2xl bg-muted px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/70 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </button>
        )}
      </div>

      <p className="text-[11px] font-bold text-muted-foreground px-1">
        {resultCount} entrega(s) encontrada(s)
      </p>
    </div>
  );
}

const MOVING = ["accepted", "collecting", "in_route", "in_transit"];

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function matchesDeliveryFilters(
  item: { status?: string | null; created_at?: string | null; customer_name?: string | null; address?: string | null },
  filters: DeliveryFilters
): boolean {
  const status = (item.status || "").toLowerCase();

  if (filters.status === "pending" && !["pending", "broadcasted"].includes(status)) return false;
  if (filters.status === "assigned" && status !== "accepted") return false;
  if (filters.status === "moving" && !MOVING.includes(status)) return false;

  if (filters.date !== "all") {
    if (!item.created_at) return false;
    const created = new Date(item.created_at);
    const today = startOfDay(new Date());
    if (filters.date === "today" && created < today) return false;
    if (filters.date === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (created < yesterday || created >= today) return false;
    }
    if (filters.date === "7d") {
      const limit = new Date(today);
      limit.setDate(limit.getDate() - 6);
      if (created < limit) return false;
    }
    if (filters.date === "30d") {
      const limit = new Date(today);
      limit.setDate(limit.getDate() - 29);
      if (created < limit) return false;
    }
  }

  const term = filters.search.trim().toLowerCase();
  if (term) {
    const haystack = `${item.customer_name || ""} ${item.address || ""}`.toLowerCase();
    if (!haystack.includes(term)) return false;
  }

  return true;
}

export function sortDeliveries<T extends { created_at?: string | null; value?: number | null }>(
  items: T[],
  sort: DeliverySort,
  getValue?: (item: T) => number
): T[] {
  if (sort === "main") return items;
  const list = [...items];
  const time = (i: T) => (i.created_at ? new Date(i.created_at).getTime() : 0);
  if (sort === "newest") return list.sort((a, b) => time(b) - time(a));
  if (sort === "oldest") return list.sort((a, b) => time(a) - time(b));
  const val = (i: T) => (getValue ? getValue(i) : Number(i.value ?? 0));
  return list.sort((a, b) => val(b) - val(a));
}
