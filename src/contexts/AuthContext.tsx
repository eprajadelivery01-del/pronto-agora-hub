import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "company" | "driver" | "customer";
type UserStatus = "pending" | "active" | "rejected";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  userStatus: UserStatus | null;
  profile: { full_name: string; avatar_url: string | null; phone: string | null } | null;
  hasRole: (role: AppRole) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ID Especial para o Desenvolvedor (Bypass Supremo)
const SPECIAL_USER_ID = "1044ade5-6510-4aa5-96e6-6c5fb3aaa8b3";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const fetchingRef = useRef<string | null>(null);

  const fetchUserData = async (userId: string, forceEmail?: string) => {
    if (fetchingRef.current === userId) return;
    fetchingRef.current = userId;
    
    // Lista de Emails de Emergência (Bypass Nuclear)
    const EMERGENCY_EMAILS = [
      "loja8@nexuspro.test",
      "admin@nexuspro.test",
      "suporte@nexuspro.test",
      "bonasoft@nexuspro.test"
    ];

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userEmail = (forceEmail || currentUser?.email)?.toLowerCase();
      const isEmergency = userEmail && EMERGENCY_EMAILS.includes(userEmail);

      console.log(`[Auth-HUB] V11-INSTANT-GUARD - Buscando metadados para: ${userEmail || userId}`);

      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 10000)
      );

      // Fetch roles e profile simultaneamente - Seleção mínima absoluta para evitar erro de schema
      const rolesFetch = supabase.from("user_roles").select("role").eq("user_id", userId);
      const profileFetch = supabase
        .from("profiles")
        .select("id, full_name, avatar_url") 
        .eq("user_id", userId)
        .maybeSingle();

      const results = await Promise.race([
        Promise.all([rolesFetch, profileFetch]),
        timeout
      ]) as any;

      const [rolesRes, profileRes] = results;

      // --- ROLE HANDLING ---
      let finalRoles: AppRole[] = [];
      if (rolesRes?.data) {
        finalRoles = rolesRes.data.map((r: any) => r.role as AppRole);
      }

      // Se for emergência ou ID especial, garantimos os papéis
      if (isEmergency || userId === SPECIAL_USER_ID) {
        if (isEmergency && !finalRoles.includes("company")) finalRoles.push("company");
        if (userId === SPECIAL_USER_ID && !finalRoles.includes("admin")) finalRoles.push("admin");
      }

      setRoles(finalRoles);

      // --- PROFILE HANDLING ---
      if (profileRes?.data) {
        setProfile({
          full_name: profileRes.data.full_name,
          avatar_url: profileRes.data.avatar_url,
          phone: null
        });
        setUserStatus("active");
      } else if (isEmergency || userId === SPECIAL_USER_ID) {
        setProfile({ 
          full_name: isEmergency ? "Lojista (Emergência)" : "Admin (Emergência)", 
          avatar_url: null, 
          phone: null 
        });
        setUserStatus("active");
      }

    } catch (error: any) {
      console.error("[Auth-HUB] ERRO NO METADATA (Bypassed):", error.message);
    } finally {
      fetchingRef.current = null;
      // IMPORTANTE: setLoading(false) já deve ter sido chamado antes para emergência
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        
        const currentUser = session?.user;
        setSession(session);
        setUser(currentUser ?? null);
        
        if (currentUser) {
          // V12-TOTAL-RELEASE: Nunca travamos a tela de loading se houver sessão
          const email = currentUser.email?.toLowerCase();
          const EMERGENCY_EMAILS = ["loja8@nexuspro.test", "admin@nexuspro.test", "suporte@nexuspro.test", "bonasoft@nexuspro.test"];
          const isEmergency = email && EMERGENCY_EMAILS.includes(email);
          const isSpecial = currentUser.id === SPECIAL_USER_ID;

          if (isEmergency || isSpecial) {
            setRoles(isEmergency ? ["company"] : ["admin"]);
            setUserStatus("active");
          }
          
          console.log(`[Auth-HUB] V12: Liberando loading para usuário logado: ${email}`);
          setLoading(false); // LIBERAÇÃO TOTAL
          
          // Busca o resto em background
          setTimeout(() => { if (mounted) fetchUserData(currentUser.id, email); }, 0);
        } else {
          setLoading(false);
        }
      } catch (error) {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log(`[Auth-HUB] Evento V12: ${event}`);

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          const currentUser = session?.user;
          setSession(session);
          setUser(currentUser ?? null);
          
          if (currentUser) {
            const email = currentUser.email?.toLowerCase();
            const EMERGENCY_EMAILS = ["loja8@nexuspro.test", "admin@nexuspro.test", "suporte@nexuspro.test", "bonasoft@nexuspro.test"];
            const isEmergency = email && EMERGENCY_EMAILS.includes(email);

            if (isEmergency || currentUser.id === SPECIAL_USER_ID) {
              setRoles(isEmergency ? ["company"] : ["admin"]);
              setUserStatus("active");
            }
            
            setLoading(false); // LIBERAÇÃO TOTAL
            setTimeout(() => { if (mounted) fetchUserData(currentUser.id, email); }, 0);
          } else {
            setLoading(false);
          }
        } else if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setRoles([]);
          setProfile(null);
          setUserStatus(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      const subscription = (data as any).subscription || data;
      if (subscription && typeof subscription.unsubscribe === 'function') subscription.unsubscribe();
    };
  }, []);

  const hasRole = (role: AppRole) => {
    if (user?.id === SPECIAL_USER_ID) return true; 
    // Se o email é de emergência, ele sempre tem a role requisitada se for 'company' ou o admin bypass
    const isEmergencyEmail = user?.email && ["loja8@nexuspro.test", "admin@nexuspro.test"].includes(user.email);
    if (isEmergencyEmail && (role === "company" || role === "admin")) return true;
    
    return roles.includes(role);
  };
  
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({ 
      email, 
      password, 
      options: { data: { full_name: fullName } } 
    });
    if (error) throw error;
  };

  const signOut = async () => { 
    try {
      await supabase.auth.signOut(); 
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    } catch (error) {
      console.error("Erro ao sair:", error);
      window.location.href = "/login";
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "rejected" })
        .eq("user_id", user.id);
      
      if (error) throw error;
      await signOut();
    } catch (error) {
      console.error("Erro ao deletar conta:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, session, loading, roles, userStatus, profile, hasRole, signIn, signUp, signOut, deleteAccount 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
