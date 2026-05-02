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
    

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userEmail = (forceEmail || currentUser?.email)?.toLowerCase();

      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 10000)
      );

      // Fetch roles e profile simultaneamente - Seleção mínima absoluta para evitar erro de schema
      const rolesFetch = (supabase as any).from("user_roles").select("role").eq("user_id", userId);
      const profileFetch = (supabase as any)
        .from("profiles")
        .select("id, full_name, avatar_url, status, phone") 
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

      setRoles(finalRoles);

      // --- PROFILE HANDLING ---
      if (profileRes?.data) {
        setProfile({
          full_name: profileRes.data.full_name,
          avatar_url: profileRes.data.avatar_url,
          phone: profileRes.data.phone
        });
        setUserStatus(profileRes.data.status);
      }

    } catch (error: any) {
      if (import.meta.env.DEV) console.error("[Auth] ERRO NO METADATA (Bypassed):", error.message);
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
          const email = currentUser.email?.toLowerCase();
          
          // Re-enable loading once metadata is fetched or just allow it to proceed
          setLoading(false);
          
          setTimeout(() => { if (mounted) fetchUserData(currentUser.id, email); }, 0);
        } else {
          setLoading(false);
        }
      } catch (error) {
        setLoading(false);
      }
    };

    initializeAuth();

    const authListener = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        const currentUser = session?.user;
        setSession(session);
        setUser(currentUser ?? null);

        if (event === "SIGNED_OUT") {
          setRoles([]);
          setProfile(null);
          setUserStatus(null);
          setLoading(false);
        } else if (currentUser) {
          const email = currentUser.email?.toLowerCase();
          setLoading(false);
          setTimeout(() => { if (mounted) fetchUserData(currentUser.id, email); }, 0);
        } else {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      if (authListener?.data?.subscription) {
        authListener.data.subscription.unsubscribe();
      }
    };
  }, []);

  const hasRole = (role: AppRole) => {
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
      if (import.meta.env.DEV) console.error("Erro ao sair:", error);
      window.location.href = "/login";
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ status: "rejected" })
        .eq("user_id", user.id);
      
      if (error) throw error;
      await signOut();
    } catch (error) {
      if (import.meta.env.DEV) console.error("Erro ao deletar conta:", error);
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


