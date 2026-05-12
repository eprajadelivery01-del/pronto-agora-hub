import { useState, useEffect, useRef } from "react";
import { Search, User, Phone, MapPin, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
}

interface CustomerSelectorProps {
  companyId: string;
  value: string;
  onChange: (name: string, address?: string, phone?: string, cpf?: string) => void;
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
      const cleanQuery = query.trim();
      if (cleanQuery.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      
      const numericQuery = cleanQuery.replace(/\D/g, "");

      try {
        // 1. Search in 'customers' table
        let customersQuery = supabase
          .from("customers")
          .select("id, name, phone, cpf")
          .or(`name.ilike.%${cleanQuery}%,cpf.ilike.%${cleanQuery}%`);
        
        if (numericQuery) {
          customersQuery = customersQuery.or(`cpf.ilike.%${numericQuery}%,phone.ilike.%${numericQuery}%`);
        }

        const { data: customersData } = await customersQuery.limit(10);

        // 2. Search in 'deliveries' table
        const { data: deliveriesData } = await supabase
          .from("deliveries")
          .select("id, customer_name, customer_phone, customer_cpf")
          .eq("company_id", companyId)
          .or(`customer_name.ilike.%${cleanQuery}%` + (numericQuery ? `,customer_phone.ilike.%${numericQuery}%` : ''))
          .limit(10);

        // Merge and deduplicate
        const merged: any[] = [];
        const seenNames = new Set();

        const addResult = (item: any, source: "loja" | "marketplace") => {
          if (!item || !item.name) return;
          const name = item.name.toLowerCase();
          
          if (seenNames.has(name)) return;
          seenNames.add(name);

          merged.push({
            id: item.id,
            name: item.name,
            phone: item.phone || item.customer_phone || null,
            cpf: item.cpf || item.customer_cpf || null,
            isMarketplace: source === "marketplace"
          });
        };

        // Add manual customers first
        (customersData || []).forEach(c => addResult({ ...c }, "loja"));
        
        // Add deliveries history customers
        (deliveriesData || []).forEach(d => {
          addResult({
            id: d.id,
            name: d.customer_name,
            phone: d.customer_phone,
            cpf: d.customer_cpf
          }, "loja");
        });

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

  const handleSelect = async (customer: any) => {
    setQuery(customer.name);
    setShowResults(false);
    
    let fullAddress = "";
    if (customer.id) {
        const { data: addresses } = await supabase
        .from("addresses")
        .select("street, number, neighborhood, complement")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

        if (addresses) {
        const parts = [
            addresses.street,
            addresses.number,
            addresses.neighborhood,
            addresses.complement ? `(${addresses.complement})` : null
        ].filter(Boolean);
        fullAddress = parts.join(", ");
        }
    }
    
    if (!fullAddress) {
        const { data: lastDelivery } = await supabase
            .from("deliveries")
            .select("address")
            .eq("customer_name", customer.name)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (lastDelivery) fullAddress = lastDelivery.address;
    }

    onChange(customer.name, fullAddress, customer.phone || "", customer.cpf || "");
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
          placeholder="Nome ou CPF do cliente"
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-border bg-background font-bold outline-none focus:border-primary transition-all text-base"
          required
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
      </div>

      {showResults && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-card border border-border rounded-2xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200">
          {results.length > 0 ? (
            <div className="space-y-1">
              <p className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                Sugestões Encontradas
              </p>
              {results.map((customer, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(customer)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 text-left transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                       <p className="text-sm font-bold text-foreground truncate">{customer.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {customer.phone || "Sem Telefone"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : !loading && (
            <div className="p-4 text-center">
              <p className="text-sm font-bold text-foreground">Novo Cliente</p>
              <p className="text-xs text-muted-foreground">Continue digitando para cadastrar.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
