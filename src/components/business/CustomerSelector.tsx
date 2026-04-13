import { useState, useEffect, useRef } from "react";
import { Search, User, Phone, MapPin, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface CustomerSelectorProps {
  companyId: string;
  value: string;
  onChange: (name: string, address?: string) => void;
}

export function CustomerSelector({ companyId, value, onChange }: CustomerSelectorProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Customer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const search = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      
      // In this version, we fetch customers directly from the customers table
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone")
        .ilike("name", `%${query}%`)
        .limit(10);

      if (data) {
        setResults(data);
      }
      setLoading(false);
    };

    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [query, companyId]);

  const handleSelect = async (customer: Customer) => {
    setQuery(customer.name);
    setShowResults(false);
    
    // Fetch most recent address
    const { data: addresses } = await supabase
      .from("addresses")
      .select("street, number, neighborhood, complement")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (addresses) {
      const fullAddress = `${addresses.street}, ${addresses.number}${addresses.neighborhood ? ` - ${addresses.neighborhood}` : ""}${addresses.complement ? ` (${addresses.complement})` : ""}`;
      onChange(customer.name, fullAddress);
    } else {
      onChange(customer.name);
    }
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
            onChange(e.target.value);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Nome completo do cliente"
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
          required
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
      </div>

      {showResults && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-card border border-border rounded-2xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
          {results.length > 0 ? (
            <div className="space-y-1">
              <p className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                Clientes Recentes
              </p>
              {results.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => handleSelect(customer)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 text-left transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{customer.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {customer.phone || "---"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : !loading && (
            <div className="p-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                 <Plus className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-bold text-foreground">Novo Cliente</p>
              <p className="text-xs text-muted-foreground">Continue digitando para cadastrar automaticamente.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
