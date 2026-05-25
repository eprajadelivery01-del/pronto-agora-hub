import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type AppRole = "admin" | "company" | "driver" | "customer";
type UserStatus = "pending" | "active" | "rejected";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoaded: boolean;
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
  const [rolesLoaded, _setRolesLoaded] = useState(false);
  const rolesLoadedRef = useRef(false);
  const setRolesLoaded = (val: boolean) => {
    rolesLoadedRef.current = val;
    _setRolesLoaded(val);
  };
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const fetchingRef = useRef<string | null>(null);

  const fetchUserData = async (userId: string, forceEmail?: string) => {
    if (fetchingRef.current === userId) return;
    fetchingRef.current = userId;
    
    // Only set rolesLoaded to false if we haven't loaded them yet
    if (!rolesLoadedRef.current) {
      setRolesLoaded(false);
    }

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userEmail = (forceEmail || currentUser?.email)?.toLowerCase();

      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 10000)
      );

      // Fetch roles e profile simultaneamente
      const rolesFetch = supabase.from("user_roles").select("role").eq("user_id", userId);
      const profileFetch = supabase
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
      if (rolesRes?.data && rolesRes.data.length > 0) {
        finalRoles = rolesRes.data.map((r: any) => r.role as AppRole);
        console.log("[Auth] Roles carregadas:", finalRoles);
      } else {
        // AUTO-REPARO: roles vazias — tenta consertar via RPC
        console.warn("[Auth] Roles vazias para", userId, "— tentando auto-reparo...");
        try {
          const { data: repairData, error: repairError } = await supabase.rpc("fix_user_permissions" as any);
          if (repairData?.success) {
            console.log("[Auth] Auto-reparo OK. Buscando roles novamente...");
            const { data: retryData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
            if (retryData && retryData.length > 0) {
              finalRoles = retryData.map((r: any) => r.role as AppRole);
              console.log("[Auth] Roles após reparo:", finalRoles);
            } else {
              console.error("[Auth] Auto-reparo não atribuiu roles. user_id:", userId);
            }
          } else {
            console.warn("[Auth] Auto-reparo falhou:", repairError?.message || repairData);
          }
        } catch (repairErr: any) {
          console.error("[Auth] Erro no auto-reparo:", repairErr?.message);
        }
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
      console.error("[Auth] ERRO NO FETCH:", error.message);
    } finally {
      fetchingRef.current = null;
      setRolesLoaded(true);
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
          
          setTimeout(() => { if (mounted) fetchUserData(currentUser.id, email); }, 0);
        } else {
          setRolesLoaded(true);
          setLoading(false);
        }
      } catch (error) {
        setRolesLoaded(true);
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
          setRolesLoaded(true);
          setProfile(null);
          setUserStatus(null);
          setLoading(false);
        } else if (event === "TOKEN_REFRESHED") {
          // Ignore token refreshed events to prevent infinite reload loops
          return;
        } else if (currentUser) {
          const email = currentUser.email?.toLowerCase();
          setTimeout(() => { if (mounted) fetchUserData(currentUser.id, email); }, 0);
        } else {
          setRolesLoaded(true);
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
      const { error } = await supabase
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
      user, session, loading, rolesLoaded, roles, userStatus, profile, hasRole, signIn, signUp, signOut, deleteAccount 
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


