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
        // 1. Search in store's own 'customers' table (those manually added or previous manual deliveries)
        let customersQuery = supabase
          .from("customers")
          .select("id, name, phone, cpf")
          .eq("company_id", companyId) // CRITICAL: Only this store's customers
          .or(`name.ilike.%${cleanQuery}%,cpf.ilike.%${cleanQuery}%`);
        
        if (numericQuery) {
          customersQuery = customersQuery.or(`cpf.ilike.%${numericQuery}%,phone.ilike.%${numericQuery}%`);
        }

        const { data: customersData } = await customersQuery.limit(10);

        // 2. Search in 'orders' table for Marketplace customers who bought from THIS store
        // We look for orders with this company_id and join with customers/profiles
        const { data: ordersData } = await supabase
          .from("orders")
          .select(`
            customer_id,
            customers!inner (id, name, phone, cpf)
          `)
          .eq("company_id", companyId)
          .or(`customers.name.ilike.%${cleanQuery}%,customers.phone.ilike.%${numericQuery || cleanQuery}%`)
          .limit(10);

        // Merge and deduplicate
        const merged: any[] = [];
        const seenIds = new Set();

        const addResult = (item: any, source: "loja" | "marketplace") => {
          if (!item || !item.id) return;
          const id = item.id;
          
          if (seenIds.has(id)) return;
          seenIds.add(id);

          merged.push({
            id: item.id,
            name: item.name,
            phone: item.phone || null,
            cpf: item.cpf || null,
            isMarketplace: source === "marketplace"
          });
        };

        // Add manual customers first
        (customersData || []).forEach(c => addResult(c, "loja"));
        
        // Add marketplace customers who bought here
        (ordersData || []).forEach(o => {
          if (o.customers) addResult(o.customers, "marketplace");
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
    
    // Attempt to fetch most recent address from 'addresses' table
    const { data: addresses } = await supabase
      .from("addresses")
      .select("street, number, neighborhood, complement")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let fullAddress = "";
    if (addresses) {
      const parts = [
        addresses.street,
        addresses.number,
        addresses.neighborhood,
        addresses.complement ? `(${addresses.complement})` : null
      ].filter(Boolean);
      fullAddress = parts.join(", ");
    }
    
    console.log("Auto-filling data for", customer.name);
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
                Sugestões Encontradas
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
                    <div className="flex items-center gap-2">
                       <p className="text-sm font-bold text-foreground truncate">{customer.name}</p>
                       {(customer as any).isMarketplace ? (
                         <span className="text-[8px] font-black bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">Marketplace</span>
                       ) : (
                         <span className="text-[8px] font-black bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">Loja</span>
                       )}
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {customer.phone || "Sem Telefone"}
                      </p>
                      {customer.cpf && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Plus className="h-3 w-3" /> CPF: {customer.cpf}
                        </p>
                      )}
                    </div>
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
              <p className="text-xs text-muted-foreground">Continue digitando para cadastrar.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

