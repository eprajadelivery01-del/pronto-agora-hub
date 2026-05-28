import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Get Auth Header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get Requester Info
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requester }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !requester) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Check if requester IS ADMIN
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Unauthorized: Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, fullName, phone, document, role, vehicle, licensePlate, commissionRate, companyName, address, regionId } = body;

    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: "email, password e role são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = ["admin", "driver", "company", "customer"];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Role inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || "", role: role },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // Update profile with active status (admin-created users skip approval)
    await supabase.from("profiles").upsert({
      user_id: userId,
      full_name: fullName || "",
      phone: phone || null,
      document: document || null,
      status: "active",
      role: role,
    });

    // Assign role
    await supabase.from("user_roles").insert({
      user_id: userId,
      role,
    });

    // If driver, create delivery_drivers record
    if (role === "driver") {
      await supabase.from("delivery_drivers").insert({
        user_id: userId,
        vehicle: vehicle || "motorcycle",
        license_plate: licensePlate || null,
        commission_rate: commissionRate ?? 15,
      });
    }

    // If company, create companies record
    if (role === "company") {
      await supabase.from("companies").insert({
        user_id: userId,
        name: companyName || fullName || "",
        phone: phone || null,
        email: email || null,
        address: address || null,
        region_id: regionId || null,
      });
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
