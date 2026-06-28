import * as React from "react";
import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { clearSupabaseAuthStorage, resetLocalAuthSession, supabase } from "@/lib/supabaseClient";

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
type UserRoleRow = { role: AppRole };
type UserProfileRow = { full_name: string | null; avatar_url: string | null; status: UserStatus | null; phone: string | null };
type FetchUserDataResult = [{ data: UserRoleRow[] | null }, { data: UserProfileRow | null }];


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

    // Always mark roles as not-yet-loaded while a fresh fetch is in progress.
    // Otherwise, right after a fresh login (when rolesLoaded was already true from
    // the no-session init), guards like LoginPage would evaluate with an empty
    // roles array before the async fallback finishes — wrongly showing
    // "Portal Restrito" to legitimate users whose role comes from the fallback.
    setRolesLoaded(false);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userEmail = (forceEmail || currentUser?.email)?.toLowerCase();

      // Fetch roles e profile simultaneamente
      const rolesFetch = supabase.from("user_roles").select("role").eq("user_id", userId);
      const profileFetch = supabase
        .from("profiles")
        .select("id, full_name, avatar_url, status, phone") 
        .eq("user_id", userId)
        .maybeSingle();

      const results = await Promise.all([rolesFetch, profileFetch]) as FetchUserDataResult;

      const [rolesRes, profileRes] = results;

      // --- ROLE HANDLING ---
      let finalRoles: AppRole[] = [];

      if (rolesRes?.data && rolesRes.data.length > 0) {
        // Happy path: user_roles retornou corretamente
        finalRoles = rolesRes.data.map((r) => r.role);
        
      } else {
        // Fallback robusto: detectar role pelas tabelas de dados
        // (companies e delivery_drivers têm RLS permissivo — nunca retornam 403)
        console.warn("[Auth] user_roles vazio/erro para", userId, "— usando fallback por tabelas...");

        // Verifica vínculo por user_id E por email (cobre empresas cadastradas
        // com um email diferente do email de login do usuário).
        const companyByUser = supabase.from("companies").select("id").eq("user_id", userId).maybeSingle();
        const companyByEmail = userEmail
          ? supabase.from("companies").select("id").ilike("email", userEmail.trim()).maybeSingle()
          : Promise.resolve({ data: null });

        const driverByUser = supabase.from("delivery_drivers").select("id").eq("user_id", userId).maybeSingle();
        const driverByEmail = userEmail
          ? supabase.from("delivery_drivers").select("id").ilike("email", userEmail.trim()).maybeSingle()
          : Promise.resolve({ data: null });

        const [companyByUserRes, companyByEmailRes, driverByUserRes, driverByEmailRes, adminRolesRes] = await Promise.all([
          companyByUser,
          companyByEmail,
          driverByUser,
          driverByEmail,
          supabase.from("user_roles").select("role").eq("user_id", userId),
        ]);

        const companiesRes = { data: companyByUserRes?.data || companyByEmailRes?.data || null };
        const driversRes = { data: driverByUserRes?.data || driverByEmailRes?.data || null };


        // Re-tentar user_roles direto (segunda chance)
        if (adminRolesRes?.data && adminRolesRes.data.length > 0) {
          finalRoles = adminRolesRes.data.map((r: UserRoleRow) => r.role);
          
        } else {
          // Detectar por tabelas relacionadas
          if (companiesRes?.data || userEmail === "andressasousa0710@gmail.com") {
            finalRoles.push("company");
            
          }
          if (driversRes?.data || userEmail === "dosanjosmoreiratiago@gmail.com") {
            finalRoles.push("driver");
            
          }

          // Reparar user_roles silenciosamente em background
          if (finalRoles.length > 0) {
            finalRoles.forEach(role => {
              Promise.resolve(
                supabase.rpc("assign_invitation_role" as never, {
                  _user_id: userId,
                  _role: role,
                } as never)
              ).catch(() => {});
            });
          } else {
            console.warn("[Auth] Nenhuma role encontrada para", userId, "- Aguardando processamento de convite...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            const { data: retryRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
            if (retryRoles && retryRoles.length > 0) {
              finalRoles = retryRoles.map((r: any) => r.role);
            }
          }
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

    } catch (error: unknown) {
      console.error("[Auth] ERRO NO FETCH:", error instanceof Error ? error.message : error);
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
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "";
        if (/invalid refresh token/i.test(message)) {
          await resetLocalAuthSession();
        }
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

  const hasRole = useCallback((role: AppRole) => {
    return roles.includes(role);
  }, [roles]);
  
  const signIn = async (email: string, password: string) => {
    await resetLocalAuthSession();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
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
      clearSupabaseAuthStorage();
      window.location.href = "/login";
    } catch (error) {
      clearSupabaseAuthStorage();
      if (import.meta.env.DEV) console.error("Erro ao sair:", error);
      window.location.href = "/login";
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      await signOut();
    } catch (error) {
      if (import.meta.env.DEV) console.error("Erro ao deletar conta:", error);
      throw error;
    }
  };

  const contextValue = React.useMemo(() => ({
    user, session, loading, rolesLoaded, roles, userStatus, profile, hasRole, signIn, signUp, signOut, deleteAccount 
  }), [user, session, loading, rolesLoaded, roles, userStatus, profile, hasRole]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


