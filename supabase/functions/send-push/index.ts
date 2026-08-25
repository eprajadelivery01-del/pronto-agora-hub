// Edge Function: send-push
// Envia notificações push via FCM HTTP v1 usando a Service Account do Firebase.
// Secret necessário: FIREBASE_SERVICE_ACCOUNT_JSON (conteúdo do JSON da service account)
import { createClient } from "npm:@supabase/supabase-js@2";
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SA_RAW = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") ?? Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "";

const FALLBACK_SA: ServiceAccount = {
  project_id: "e-pra-ja-a410d",
  client_email: "firebase-adminsdk-fbsvc@e-pra-ja-a410d.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDEM97wrIbbPEij\n8b51daQwbYH2NTEcAFRxPlPKZo/jguHmXo2R9kB88vb+vcgQW/EAJqJF3LeoT1dv\n7Utm03U2s927sr0ZMgRaqVvDmPx62q/b7XkYxfjwKZ05NIyRuyYneUtkfGKvVOea\nDOvRJ48I8QY9fNo540HLHaoeJw962NcLqlOP/EXlkN8aJc6bGb7BPu6BkPdwv/NS\nZIk2lulHbKBaryOyUKFY8YAxqN30Vi4J7aO8a7Vudtr72LZAM+wlAniSGyyJ04Mk\nWXt3SQCJ5CVxHkeYkCuKpCcs5iCEXAtRo1g4xEDA+Api8fy8AqCUdEd4G42VwZxj\n06aCkci9AgMBAAECggEAASu8vWAuAXYpccOuvf+nrSG8c1UQ4dD9vDQH0x7ctT6g\nX4gvTJIFxn803/D22Rrn7ToQ16aNx+1leXfyVfXAzUS4d+HB5PDVzel2cExUzWLi\nUwRIG5/hrZ2aVwS4W1zyBg7B3WvKsylAmMKCscA3HLrhlPxCLqccY3NLuclKjb0Q\nSN67bgbN+3l/yg2Ru9fx7oWlUppzys1wxY1AdaXaMk2eyEgAZ7YhbIGMwI77LimD\ntxH1C76ez+oq/drrK54eSG+cudLxFZ8JEMsdZflGW8FqkU0OuiUHbmcFX2Gqw1y7\n+yy751Xuhnl9hO+q1/sMptW9paR2MOePauzrt1Z+gQKBgQDkLE071kNtSiVO/q7X\nK3aREWjXbBYkCwdyQmxQDqmQAmg8VNWsIbKzKyx3NWovUEzVn+i9mJ1zYR8xMxOR\nUSx3rnTUL3JKGT+5/I3pdKR6cPx2geC+JbflRRxv5Nao5TC5l7bdbjtNOaTj0/sy\nlmvAAt/MnO3UIebGq8Gdi7WtYQKBgQDcIW7pqHzGiF8r6HQ1EdaxosWj9yyEVss0\nU5/hOnzFS/6Zc1XqlVjUy3n23e9ekIFuOXvMnqW3Hp+qRJL5kWRoKYHQ9CFC0r85\nQvtqZcJiswhjMHG6eLVkaURJVJiVVr9G8EipIGw9ul8Hy3+1RmtK7zUYe1pYJi+X\n9v/hFZSc3QKBgQCxFYzvhrAX7vabo1+wkQPZPMjAgBuC56hkzhZf37FLmgKp6DFZ\nAWI+WaCN+D+r7sdi+FNaakqwlEzwEzL5kiVP0W7MivJJfeUOhGrjJ+rLOEtH8i6p\nhH5/iq6yTMkolY/GSm/a1MVjfvxw8UFAlquTfueQVq7h91mzEPQYQKjEoQKBgAEO\n3BSdbbQalbKFVIGoy0phSOfn2Tvtmt5uhHc1q8HbAqdEKaaN/zZOoBBysqLWuPiJ\nqDGslYlSyVutJrOyYjQp9ujFM5+5mZex3bl+Mbf9uk2XvwQxblXEN8LOeElHeHXj\n08WUVVDao3hLHxsE8qESk0PB3AZOcK4fTs2LKAK1AoGBANTLECrr29ud64EZlEXh\nYF7zc8A0dl+v4lUFiJVxfdLL5USkh6RBmlp2Wtq+whi1SEHT1Eo6/Pk1I4mTVvED\nSSs9ZGIBzdP7R/3qftyrRu6Z//LI5RUZg7fQNAyz05tpGDFvL9Xfg13vWiibUgat\nDV0Y5xzSFP9S3ijgdNKLjM8Z\n-----END PRIVATE KEY-----\n",
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

function b64url(bytes: Uint8Array | string): string {
  const arr = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let bin = "";
  arr.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

let cachedToken: { value: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OAuth falhou: ${JSON.stringify(json)}`);
  cachedToken = { value: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.value;
}

const RETRY_DELAYS_MS = [400, 1200, 3000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Classificação dos erros do FCM HTTP v1
// https://firebase.google.com/docs/reference/fcm/rest/v1/ErrorCode
type Outcome = "success" | "invalid" | "transient" | "auth" | "quota" | "config";

function classifyFcm(httpStatus: number, json: any): { outcome: Outcome; code: string; message: string } {
  const err = json?.error ?? {};
  const details: any[] = Array.isArray(err.details) ? err.details : [];
  const fcmDetail = details.find((d) => String(d?.["@type"] ?? "").includes("FcmError"));
  const code = String(fcmDetail?.errorCode ?? err.status ?? (httpStatus ? `HTTP_${httpStatus}` : "NETWORK"));
  const message = String(err.message ?? "");

  // Token definitivamente inválido -> apagar
  if (
    code === "UNREGISTERED" ||
    code === "NOT_FOUND" ||
    httpStatus === 404 ||
    (code === "INVALID_ARGUMENT" && /not a valid FCM|registration token|Invalid registration/i.test(message))
  ) {
    return { outcome: "invalid", code: code === "HTTP_404" ? "UNREGISTERED" : code, message };
  }
  // Projeto/credencial errados para este token
  if (code === "SENDER_ID_MISMATCH" || httpStatus === 403) return { outcome: "config", code, message };
  if (code === "THIRD_PARTY_AUTH_ERROR" || code === "UNAUTHENTICATED" || httpStatus === 401) {
    return { outcome: "auth", code, message };
  }
  if (code === "QUOTA_EXCEEDED" || httpStatus === 429) return { outcome: "quota", code, message };
  return { outcome: "transient", code, message };
}

type SendResult = {
  ok: boolean;
  status: number;
  attempts: number;
  token: string;
  error?: string;
  invalid?: boolean;
  outcome?: Outcome;
  code?: string;
  response?: unknown;
};

function isRetryable(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function sendToToken(
  reqId: string,
  sa: ServiceAccount,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<SendResult> {
  const isDriverDelivery = data.type === "delivery";
  const channelId = isDriverDelivery ? "delivery-incoming-v9" : "marketplace_orders";
  const soundName = isDriverDelivery ? "notification_sound" : "default";
  
  // Estrutura Padrão Profissional FCM HTTP v1: notification + data + android.priority HIGH + channel_id
    const notifTag = data.deliveryId 
      ? `delivery-${data.deliveryId}` 
      : (data.orderId 
          ? `order-${data.orderId}` 
          : `mkt-${title.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}`);

    const payload: any = {
      message: {
        token,
        notification: { title, body },
        data,
        android: {
          priority: "HIGH",
          collapse_key: notifTag,
          notification: {
            channel_id: channelId,
            sound: soundName,
            default_vibrate_timings: true,
            notification_priority: "PRIORITY_MAX",
            visibility: "PUBLIC",
            tag: notifTag,
          },
        },
      apns: {
        headers: { "apns-priority": "10", "apns-push-type": "alert" },
        payload: { aps: { alert: { title, body }, sound: isDriverDelivery ? "ring.caf" : "default", badge: 1, "mutable-content": 1 } },
      },
    },
  };

  let last: SendResult = { ok: false, status: 0, attempts: 0, token };

  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    try {
      console.log(
        "[FCM_PAYLOAD]",
        JSON.stringify(payload, null, 2)
      );

      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => ({}));
      
      console.log(
        "[FCM_RESPONSE]",
        JSON.stringify(json, null, 2)
      );
      const ms = Date.now() - started;
      const cls = res.ok
        ? { outcome: "success" as Outcome, code: "OK", message: "" }
        : classifyFcm(res.status, json);
      const invalid = cls.outcome === "invalid";

      console.log(
        `[send-push:${reqId}] attempt=${attempt} status=${res.status} ms=${ms} token=${token.slice(0, 12)}… outcome=${cls.outcome} code=${cls.code}`,
        res.ok ? "" : JSON.stringify(json).slice(0, 500),
      );

      last = {
        ok: res.ok,
        status: res.status,
        attempts: attempt,
        token,
        invalid,
        outcome: cls.outcome,
        code: cls.code,
        error: res.ok ? undefined : cls.message,
        response: json,
      };
      if (res.ok || invalid || cls.outcome === "config" || cls.outcome === "auth" || !isRetryable(res.status)) {
        return last;
      }
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      console.error(`[send-push:${reqId}] attempt=${attempt} network error: ${msg}`);
      last = { ok: false, status: 0, attempts: attempt, token, error: msg, outcome: "transient", code: "NETWORK" };
    }

    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay === undefined) break;
    console.log(`[send-push:${reqId}] retry em ${delay}ms (tentativa ${attempt + 1})`);
    await sleep(delay);
  }

  return last;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const reqId = crypto.randomUUID().slice(0, 8);
  const startedAt = Date.now();

  const json = (payload: Record<string, unknown>, status = 200) => {
    console.log(`[send-push:${reqId}] respondendo status=${status} em ${Date.now() - startedAt}ms`);
    return new Response(JSON.stringify({ requestId: reqId, ...payload }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    const body = await req.json().catch(() => ({} as any));

    // Filtro de segurança absoluto: ignora mensagens manuais legadas do Lojista/Entregador
    // para evitar duplicidade de notificações na central.
    const notifBody = String(body.body ?? body.message ?? "");
    if (notifBody && (notifBody.includes("foi atualizado:") || notifBody.includes("mudou para:"))) {
      console.log(`[send-push] Bloqueando push legado manual duplicado: "${notifBody}"`);
      return new Response(JSON.stringify({ requestId: reqId, success: true, message: "Dropped legacy manual notification" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const action = String(body.action ?? "send");
    console.log(`[send-push:${reqId}] action=${action}`, JSON.stringify({
      orderId: body.orderId ?? null,
      userId: body.userId ?? null,
      customerId: body.customerId ?? null,
      hasToken: Boolean(body.token || body.fcmToken),
    }));

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Seleciona tokens ignorando os que estão em quarentena.
    // Se as colunas do ciclo de vida ainda não existirem, cai para a consulta simples.
    const selectTokens = async (column: string, value: string) => {
      const active = await supabase
        .from("device_tokens").select("token").eq(column, value).is("disabled_at", null);
      if (!active.error) return active;
      console.warn(`[send-push:${reqId}] filtro disabled_at indisponível (${active.error.message}); usando fallback`);
      return await supabase.from("device_tokens").select("token").eq(column, value);
    };

    // ---------- LIMPEZA / ROTAÇÃO MANUAL ----------
    if (action === "cleanup") {
      const staleDays = Number(body.staleDays ?? 270);
      const { data, error } = await supabase.rpc("cleanup_device_tokens", { _stale_days: staleDays });
      if (error) {
        console.error(`[send-push:${reqId}] cleanup falhou: ${error.message}`);
        return json({ error: `cleanup falhou: ${error.message}`, hint: "Rode scripts/device_tokens_lifecycle.sql" }, 500);
      }
      console.log(`[send-push:${reqId}] cleanup:`, JSON.stringify(data));
      return json({ cleanup: data });
    }

    // ---------- REGISTRO / ATUALIZAÇÃO DO TOKEN FCM ----------
    if (action === "register_token" || action === "save_token") {
      const fcmToken = String(body.token ?? body.fcmToken ?? "").trim();
      if (!fcmToken) return json({ error: "token ausente" }, 400);

      const userId = body.userId ? String(body.userId) : null;
      const customerId = body.customerId ? String(body.customerId) : null;
      const phone = body.phone ? String(body.phone) : null;
      const platform = body.platform ? String(body.platform) : "unknown";
      const now = new Date().toISOString();
      const outcome: Record<string, string> = {};

      const up = await supabase
        .from("device_tokens")
        .upsert(
          { token: fcmToken, user_id: userId, customer_id: customerId, phone, platform, updated_at: now },
          { onConflict: "token" },
        );
      outcome.device_tokens = up.error ? `erro: ${up.error.message}` : "ok";

      // Reativa o token (sai da quarentena) sempre que o app o registra novamente
      const reset = await supabase
        .from("device_tokens")
        .update({ disabled_at: null, disabled_reason: null, failure_count: 0, last_error_code: null })
        .eq("token", fcmToken);
      outcome.reset = reset.error ? `ignorado: ${reset.error.message}` : "ok";

      // Rotação: remove tokens antigos do mesmo dispositivo/usuário
      if (body.previousToken && String(body.previousToken) !== fcmToken) {
        const del = await supabase.from("device_tokens").delete().eq("token", String(body.previousToken));
        outcome.rotated = del.error ? `erro: ${del.error.message}` : "ok";
      }

      if (userId) {
        const p = await supabase.from("profiles").update({ fcm_token: fcmToken, updated_at: now }).eq("id", userId);
        outcome.profiles = p.error ? `erro: ${p.error.message}` : "ok";
        const c = await supabase.from("customers").update({ fcm_token: fcmToken, updated_at: now }).eq("user_id", userId);
        outcome.customers = c.error ? `erro: ${c.error.message}` : "ok";
      } else if (customerId) {
        const c = await supabase.from("customers").update({ fcm_token: fcmToken, updated_at: now }).eq("id", customerId);
        outcome.customers = c.error ? `erro: ${c.error.message}` : "ok";
      } else if (phone) {
        const c = await supabase.from("customers").update({ fcm_token: fcmToken, updated_at: now }).eq("phone", phone);
        outcome.customers = c.error ? `erro: ${c.error.message}` : "ok";
      }

      console.log(`[send-push:${reqId}] registro do token:`, JSON.stringify(outcome));
      return json({ registered: true, outcome });
    }

    // ---------- ENVIO ----------
    let sa: ServiceAccount = FALLBACK_SA;
    if (SA_RAW) {
      try {
        const parsed = JSON.parse(SA_RAW) as ServiceAccount;
        if (parsed.private_key && parsed.project_id === "e-pra-ja-a410d") {
          sa = parsed;
        } else {
          console.warn(`[send-push:${reqId}] SA_RAW tem project_id '${parsed.project_id}' diferente de 'e-pra-ja-a410d'; usando FALLBACK_SA`);
        }
      } catch (e) {
        console.warn(`[send-push:${reqId}] Erro ao parsear SA_RAW, usando FALLBACK_SA:`, e);
      }
    }

    // ── DETECÇÃO DE TRIGGER DE DELIVERY (webhook do Postgres)
    // Quando body.table === "deliveries" e body.type === "INSERT", significa que uma nova
    // entrega foi criada e precisamos notificar TODOS os entregadores ONLINE via FCM.
    const isDeliveryTrigger = (body.table === "deliveries" || body.schema === "public") &&
      (body.type === "INSERT" || body.type === "UPDATE") && body.record;

    let title: string;
    let message: string;
    const extra: Record<string, string> = {};

    if (isDeliveryTrigger) {
      const rec = body.record;
      const storeName = rec.store_name || rec.company_name || "É Pra Já Delivery";
      const details = rec.details || rec.address || "Nova corrida disponível!";
      const deliveryId = rec.id || "";

      title = `🏬 ${storeName}`;
      message = String(details).slice(0, 400);

      extra.type = "delivery";
      extra.deliveryId = String(deliveryId);
      extra.orderId = String(rec.order_id || "");
      extra.route = `/driver?deliveryId=${deliveryId}`;
      extra.storeName = String(storeName);
      extra.pickup = String(rec.pickup_address || rec.origin_address || "Retirada na Loja");
      extra.dropoff = String(rec.delivery_address || rec.dropoff_address || "Endereço do cliente");
      extra.fee = rec.delivery_fee ? `R$ ${Number(rec.delivery_fee).toFixed(2).replace(".", ",")}` : "";
      extra.address = String(details);
      extra.details = String(details);

      console.log(`[send-push:${reqId}] DELIVERY TRIGGER detectado — deliveryId=${deliveryId} storeName=${storeName}`);

      // Busca TODOS os tokens FCM dos entregadores ONLINE
      const { data: drivers, error: drvErr } = await supabase
        .from("delivery_drivers")
        .select("fcm_token")
        .eq("is_online", true)
        .not("fcm_token", "is", null);

      if (drvErr) {
        console.error(`[send-push:${reqId}] Erro ao buscar entregadores:`, drvErr.message);
      }

      const driverTokens = (drivers ?? [])
        .map((d: any) => d.fcm_token)
        .filter((t: string) => t && t.trim().length > 10);

      console.log(`[send-push:${reqId}] ${driverTokens.length} entregador(es) online com token FCM`);

      if (driverTokens.length === 0) {
        return json({ sent: 0, total: 0, warning: "Nenhum entregador online com token FCM" });
      }

      // Envia FCM para cada entregador usando o channel de alta prioridade
      const accessToken = await getAccessToken(sa);
      const results = await Promise.all(
        driverTokens.map((t: string) => sendToToken(reqId, sa, accessToken, t, title, message, extra)),
      );
      const sent = results.filter((r) => r.ok).length;

      // Saúde dos tokens
      const invalidTokens = results.filter((r) => r.invalid).map((r) => r.token);
      if (invalidTokens.length > 0) {
        await supabase.from("delivery_drivers").update({ fcm_token: null }).in("fcm_token", invalidTokens);
        console.log(`[send-push:${reqId}] ${invalidTokens.length} token(s) de entregador inválido(s) limpo(s)`);
      }

      console.log(`[send-push:${reqId}] DELIVERY BROADCAST enviados ${sent}/${driverTokens.length}`);
      return json({
        sent,
        total: driverTokens.length,
        invalid: invalidTokens.length,
        trigger: "delivery_broadcast",
        results: results.map((r) => ({
          ok: r.ok,
          status: r.status,
          attempts: r.attempts,
          invalid: r.invalid ?? false,
          outcome: r.ok ? "success" : (r.outcome ?? "transient"),
          code: r.code ?? null,
          token: `${r.token.slice(0, 12)}…`,
          error: r.error ?? undefined,
        })),
      });
    }

    // ── FLUXO NORMAL (Marketplace / notificações de pedido para clientes)
    title = String(body.title ?? "É Pra Já").slice(0, 120);
    message = String(body.body ?? body.message ?? "Você tem uma nova atualização.").slice(0, 400);
    if (body.orderId) extra.orderId = String(body.orderId);
    if (body.status) extra.status = String(body.status);
    if (body.url) extra.url = String(body.url);
    if (body.route) extra.route = String(body.route);
    if (!extra.route && extra.orderId) extra.route = `/marketplace/orders/${extra.orderId}`;
    extra.click_action = "FLUTTER_NOTIFICATION_CLICK";

    console.log("[EXTRA_DATA]", extra);

    // Resolve os tokens de destino
    let tokens: string[] = Array.isArray(body.tokens)
      ? body.tokens.filter(Boolean).map(String)
      : body.token
        ? [String(body.token)]
        : [];

    if (tokens.length === 0) {
      let userId: string | null = body.userId ? String(body.userId) : null;
      let customerId: string | null = body.customerId ? String(body.customerId) : null;

      if (!userId && !customerId && body.orderId) {
        const { data: order, error } = await supabase
          .from("orders")
          .select("customer_id, user_id")
          .eq("id", String(body.orderId))
          .maybeSingle();
        if (error) console.error(`[send-push:${reqId}] erro ao buscar pedido:`, error.message);
        customerId = (order as any)?.customer_id ?? null;
        userId = (order as any)?.user_id ?? null;
        console.log(`[send-push:${reqId}] pedido resolvido -> customerId=${customerId} userId=${userId}`);
      }

      const found = new Set<string>();
      const collect = (rows: any[] | null, field: string, source: string) => {
        (rows ?? []).forEach((r) => r?.[field] && found.add(r[field]));
        console.log(`[send-push:${reqId}] ${source}: ${rows?.length ?? 0} linha(s)`);
      };

      if (customerId) {
        const { data, error } = await selectTokens("customer_id", customerId);
        if (error) console.error(`[send-push:${reqId}] device_tokens(customer): ${error.message}`);
        collect(data as any[], "token", "device_tokens(customer)");
        const c = await supabase.from("customers").select("fcm_token").or(`id.eq.${customerId},user_id.eq.${customerId}`);
        if (c.error) console.error(`[send-push:${reqId}] customers: ${c.error.message}`);
        collect(c.data as any[], "fcm_token", "customers");
      }
      if (userId) {
        const { data, error } = await selectTokens("user_id", userId);
        if (error) console.error(`[send-push:${reqId}] device_tokens(user): ${error.message}`);
        collect(data as any[], "token", "device_tokens(user)");
        const p = await supabase.from("profiles").select("fcm_token").eq("id", userId);
        if (p.error) console.error(`[send-push:${reqId}] profiles: ${p.error.message}`);
        collect(p.data as any[], "fcm_token", "profiles");
        const c2 = await supabase.from("customers").select("fcm_token").eq("user_id", userId);
        if (c2.error) console.error(`[send-push:${reqId}] customers(user): ${c2.error.message}`);
        collect(c2.data as any[], "fcm_token", "customers(user)");
      }
      tokens = Array.from(found);

      if (tokens.length === 0 && (body.isBroadcast || body.broadcast || (!userId && !customerId && !body.orderId))) {
        console.log(`[send-push:${reqId}] MODO BROADCAST / MARKETING DETECTADO: Buscando todos os tokens ativos no sistema...`);
        const { data: allDevTokens } = await supabase.from("device_tokens").select("token").is("disabled_at", null);
        (allDevTokens ?? []).forEach((t: any) => t?.token && found.add(t.token));

        const { data: allCustTokens } = await supabase.from("customers").select("fcm_token").not("fcm_token", "is", null);
        (allCustTokens ?? []).forEach((c: any) => c?.fcm_token && found.add(c.fcm_token));

        const { data: allProfTokens } = await supabase.from("profiles").select("fcm_token").not("fcm_token", "is", null);
        (allProfTokens ?? []).forEach((p: any) => p?.fcm_token && found.add(p.fcm_token));

        tokens = Array.from(found);
        console.log(`[send-push:${reqId}] BROADCAST -> ${tokens.length} token(s) encontrado(s)`);
      }

      // Fallback de emergência caso customerId/userId não tenham retornado nenhum token
      if (tokens.length === 0) {
        console.warn(`[send-push:${reqId}] NENHUM token retornado pelos IDs; buscando ultimos dispositivos ativos em device_tokens...`);
        const { data: fallbackTokens } = await supabase
          .from("device_tokens")
          .select("token")
          .is("disabled_at", null)
          .order("updated_at", { ascending: false })
          .limit(10);
        if (fallbackTokens && fallbackTokens.length > 0) {
          fallbackTokens.forEach((t: any) => t?.token && found.add(t.token));
          tokens = Array.from(found);
          console.log(`[send-push:${reqId}] fallback ativado -> ${tokens.length} token(s) ativo(s) resgatado(s)`);
        }
      }
    }

    console.log(`[send-push:${reqId}] ${tokens.length} token(s) alvo`);
    if (tokens.length === 0) {
      return json({ sent: 0, total: 0, warning: "Nenhum token FCM encontrado para o destinatário" });
    }

    const accessToken = await getAccessToken(sa);
    console.log("[BODY_RECEIVED]", body);
    console.log("[TITLE]", title);
    console.log("[MESSAGE]", message);
    console.log("[TOKENS]", tokens);
    console.log("[EXTRA]", extra);
    const results = await Promise.all(
      tokens.map((t) => sendToToken(reqId, sa, accessToken, t, title, message, extra)),
    );
    const sent = results.filter((r) => r.ok).length;

    // ---------- SAÚDE DOS TOKENS: sucesso, quarentena e remoção ----------
    const invalidTokens = results.filter((r) => r.invalid).map((r) => r.token);
    let rpcAvailable = true;
    for (const r of results) {
      const outcome: Outcome = r.ok ? "success" : (r.outcome ?? "transient");
      if (!rpcAvailable) break;
      const { error } = await supabase.rpc("record_push_result", {
        _token: r.token,
        _outcome: outcome,
        _error_code: r.code ?? null,
        _error_message: r.error ?? null,
      });
      if (error) {
        rpcAvailable = false;
        console.warn(`[send-push:${reqId}] record_push_result indisponível (${error.message}); usando limpeza simples`);
      }
    }
    if (!rpcAvailable && invalidTokens.length > 0) {
      await supabase.from("device_tokens").delete().in("token", invalidTokens);
    }
    if (invalidTokens.length > 0) {
      console.log(`[send-push:${reqId}] ${invalidTokens.length} token(s) inválido(s) removido(s)`);
    }
    // Credencial/projeto errados afetam TODOS os envios: destaque nos logs
    const misconfig = results.find((r) => r.outcome === "config" || r.outcome === "auth");
    if (misconfig) {
      console.error(
        `[send-push:${reqId}] problema de credencial FCM (${misconfig.code}): ${misconfig.error ?? ""}`,
      );
      cachedToken = null; // força novo OAuth na próxima chamada
    }

    console.log(`[send-push:${reqId}] enviados ${sent}/${tokens.length}`);
    return json({
      sent,
      total: tokens.length,
      invalid: invalidTokens.length,
      misconfigured: misconfig ? misconfig.code : null,
      results: results.map((r) => ({
        ok: r.ok,
        status: r.status,
        attempts: r.attempts,
        invalid: r.invalid ?? false,
        outcome: r.ok ? "success" : (r.outcome ?? "transient"),
        code: r.code ?? null,
        token: `${r.token.slice(0, 12)}…`,
        error: r.error ?? (r.ok ? undefined : JSON.stringify(r.response).slice(0, 300)),
      })),
    });
  } catch (e) {
    console.error(`[send-push:${reqId}] erro fatal:`, e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
