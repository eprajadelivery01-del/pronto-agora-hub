import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { token, email, password, fullName, phone, document, companyName } = body;

    // Validate required fields
    if (!token || !email || !password || !fullName) {
      return new Response(JSON.stringify({ error: "token, email, password e fullName são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Validate invitation server-side
    const { data: invitation, error: invError } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invError || !invitation) {
      return new Response(JSON.stringify({ error: "Convite não encontrado ou já utilizado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Convite expirado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify email matches invitation
    if (invitation.email !== email) {
      return new Response(JSON.stringify({ error: "Email não corresponde ao convite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = ["admin", "driver", "company", "customer"];
    if (!validRoles.includes(invitation.role)) {
      return new Response(JSON.stringify({ error: "Role inválido no convite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create user with admin API (server-side)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: invitation.role },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // 3. Update profile
    await supabase.from("profiles").upsert({
      user_id: userId,
      full_name: fullName,
      phone: phone || null,
      document: document || null,
      status: "active",
      role: invitation.role,
    });

    // 4. Assign role safely
    const { data: existingRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", invitation.role);
    if (!existingRoles || existingRoles.length === 0) {
      await supabase.from("user_roles").insert({ user_id: userId, role: invitation.role });
    }

    // 5. Create role-specific records
    if (invitation.role === "driver") {
      const { data: existingDriver } = await supabase.from("delivery_drivers").select("id").eq("user_id", userId).maybeSingle();
      if (!existingDriver) {
         await supabase.from("delivery_drivers").insert({ user_id: userId, full_name: fullName, phone: phone || null });
      } else {
         await supabase.from("delivery_drivers").update({ full_name: fullName, phone: phone || null }).eq("user_id", userId);
      }
    }

    if (invitation.role === "company") {
      const correctName = companyName || fullName;
      const { data: existingCompany } = await supabase.from("companies").select("id").eq("user_id", userId).maybeSingle();
      if (!existingCompany) {
        await supabase.from("companies").insert({ user_id: userId, name: correctName, email: email, phone: phone || null });
      } else {
        await supabase.from("companies").update({ name: correctName, email: email, phone: phone || null }).eq("user_id", userId);
      }
    }

    // 6. Mark invitation as accepted
    await supabase
      .from("invitations")
      .update({ status: "accepted" })
      .eq("token", token);

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
