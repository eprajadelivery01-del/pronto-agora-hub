import { useState, useEffect, useRef } from "react";
import { Search, User, Phone, MapPin, Plus, Loader2, Home, Briefcase, Heart, ArrowLeft, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  user_id?: string | null;
  name: string;
  phone: string | null;
  cpf: string | null;
}

interface AddressOption {
  id: string;
  label: string;
  fullAddress: string;
  source: "marketplace" | "loja" | "manual";
}

interface CustomerSelectorProps {
  companyId: string;
  value: string;
  onChange: (name: string, address?: string, phone?: string, cpf?: string, addressLabel?: string) => void;
}

const LABEL_ICONS: Record<string, any> = {
  Casa: Home,
  Trabalho: Briefcase,
  "Casa da Mãe": Heart,
  Outro: MapPin,
};

function parseAddressLabel(raw: string): { label: string; address: string } {
  if (!raw) return { label: "Endereço", address: "" };
  const match = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) return { label: match[1], address: match[2] };
  return { label: "Endereço", address: raw };
}

export function CustomerSelector({ companyId, value, onChange }: CustomerSelectorProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Customer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Address picker step
  const [pickerCustomer, setPickerCustomer] = useState<Customer | null>(null);
  const [pickerAddresses, setPickerAddresses] = useState<AddressOption[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setPickerCustomer(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const search = async () => {
      const cleanQuery = query.trim();
      if (cleanQuery.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      const numericQuery = cleanQuery.replace(/\D/g, "");

      try {
        const orConditions: string[] = [`name.ilike.%${cleanQuery}%`, `cpf.ilike.%${cleanQuery}%`];
        if (numericQuery) {
          orConditions.push(`phone.ilike.%${numericQuery}%`);
          orConditions.push(`cpf.ilike.%${numericQuery}%`);
        }
        const { data: customersData } = await supabase
          .from("customers")
          .select("id, user_id, name, phone, cpf")
          .or(orConditions.join(","))
          .limit(10);

        const delOrConditions: string[] = [`customer_name.ilike.%${cleanQuery}%`];
        if (numericQuery) {
          delOrConditions.push(`customer_phone.ilike.%${numericQuery}%`);
          delOrConditions.push(`customer_cpf.ilike.%${numericQuery}%`);
        }
        const { data: deliveriesData } = await supabase
          .from("deliveries")
          .select("id, customer_name, customer_phone, customer_cpf")
          .eq("company_id", companyId)
          .or(delOrConditions.join(","))
          .limit(10);

        const merged: Customer[] = [];
        const seenKeys = new Set<string>();
        const pushCustomer = (c: Customer) => {
          const key = (c.phone || c.name).toLowerCase();
          if (seenKeys.has(key)) return;
          seenKeys.add(key);
          merged.push(c);
        };

        (customersData || []).forEach((c: any) =>
          pushCustomer({ id: c.id, user_id: c.user_id, name: c.name, phone: c.phone, cpf: c.cpf })
        );
        (deliveriesData || []).forEach((d: any) =>
          pushCustomer({
            id: d.id,
            user_id: null,
            name: d.customer_name,
            phone: d.customer_phone,
            cpf: d.customer_cpf,
          })
        );

        setResults(merged);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [query, companyId]);

  const loadAddresses = async (customer: Customer) => {
    setLoadingAddresses(true);
    const addresses: AddressOption[] = [];
    const seen = new Set<string>();

    const add = (label: string, fullAddress: string, source: AddressOption["source"], id: string) => {
      const k = fullAddress.trim().toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      addresses.push({ id, label, fullAddress, source });
    };

    try {
      // 1. From "addresses" table — query by customer_id (customer.id)
      if (customer.id) {
        const { data } = await supabase
          .from("addresses")
          .select("id, customer_id, label, street, number, neighborhood, complement, city")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false });
        (data || []).forEach((a: any) => {
          const parts = [
            a.street,
            a.number,
            a.neighborhood,
            a.city,
            a.complement ? `(${a.complement})` : null,
          ].filter(Boolean);
          add(a.label || "Endereço", parts.join(", "), "marketplace", a.id);
        });
      }

      // 2. From deliveries history (by phone)
      if (customer.phone) {
        const { data } = await supabase
          .from("deliveries")
          .select("id, address, created_at")
          .eq("customer_phone", customer.phone)
          .order("created_at", { ascending: false })
          .limit(20);
        (data || []).forEach((d: any) => {
          if (!d.address) return;
          const parsed = parseAddressLabel(d.address);
          add(parsed.label, parsed.address, "loja", d.id);
        });
      }
    } catch (err) {
      console.error("Erro ao carregar endereços:", err);
    } finally {
      setLoadingAddresses(false);
      setPickerAddresses(addresses);
    }
  };

  const handleCustomerClick = async (customer: Customer) => {
    setPickerCustomer(customer);
    setShowResults(true);
    setPickerAddresses([]);
    await loadAddresses(customer);
  };

  const commitAddress = (address: string, label: string) => {
    if (!pickerCustomer) return;
    setQuery(pickerCustomer.name);
    onChange(pickerCustomer.name, address, pickerCustomer.phone || "", pickerCustomer.cpf || "", label);
    setPickerCustomer(null);
    setShowResults(false);
  };

  const skipAddressPicker = () => {
    if (!pickerCustomer) return;
    setQuery(pickerCustomer.name);
    onChange(pickerCustomer.name, "", pickerCustomer.phone || "", pickerCustomer.cpf || "");
    setPickerCustomer(null);
    setShowResults(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
            setPickerCustomer(null);
            onChange(e.target.value);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Buscar por Nome, CPF ou Telefone..."
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background font-bold outline-none focus:border-primary transition-all text-base"
          required
        />
        {(loading || loadingAddresses) && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
        )}
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-card border border-border rounded-2xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 max-h-[420px] overflow-y-auto">
          {pickerCustomer ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1">
                <button
                  type="button"
                  onClick={() => setPickerCustomer(null)}
                  className="p-1.5 rounded-lg hover:bg-muted"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                  Escolha o endereço de entrega de {pickerCustomer.name}
                </p>
              </div>

              {loadingAddresses ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : pickerAddresses.length === 0 ? (
                <div className="p-4 text-center space-y-3">
                  <p className="text-xs text-muted-foreground">Nenhum endereço cadastrado para este cliente.</p>
                  <button
                    type="button"
                    onClick={skipAddressPicker}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                  >
                    <Pencil className="h-3 w-3" /> Digitar endereço manualmente
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {pickerAddresses.map((addr) => {
                    const Icon = LABEL_ICONS[addr.label] || MapPin;
                    return (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => commitAddress(addr.fullAddress, addr.label)}
                        className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-primary/5 text-left transition-colors group border border-transparent hover:border-primary/20"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black uppercase tracking-wider text-primary">{addr.label}</p>
                            <span className="text-[9px] text-muted-foreground/60">
                              {addr.source === "marketplace" ? "Marketplace" : "Histórico"}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground leading-snug mt-0.5">
                            {addr.fullAddress}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={skipAddressPicker}
                    className="w-full mt-2 flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-xs font-bold text-muted-foreground hover:text-primary transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> Novo endereço (digitar manualmente)
                  </button>
                </div>
              )}
            </div>
          ) : query.length >= 2 || results.length > 0 ? (
            results.length > 0 ? (
              <div className="space-y-1">
                <p className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                  Sugestões Encontradas
                </p>
                {results.map((customer, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleCustomerClick(customer)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 text-left transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {customer.phone || "Sem Telefone"}
                      </p>
                    </div>
                    <MapPin className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            ) : !loading ? (
              <div className="p-4 text-center">
                <p className="text-sm font-bold text-foreground">Novo Cliente</p>
                <p className="text-xs text-muted-foreground">Continue digitando para cadastrar.</p>
              </div>
            ) : null
          ) : null}
        </div>
      )}
    </div>
  );
}
