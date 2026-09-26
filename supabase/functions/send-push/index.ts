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
  isIosToken = false,
): Promise<SendResult> {
  // Identificação explícita dos aplicativos:
  // Marketplace → app: 'marketplace', bundleId: 'br.com.epraja.appFma'
  // Lojista → app: 'lojista', bundleId: 'br.com.epraja.lojista'
  // Entregador → app: 'entregador', bundleId: 'br.com.epraja.entregador'

  const explicitApp = (data.app || data.target || "").toLowerCase();
  const explicitBundle = data.bundleId;

  let targetApp: "marketplace" | "lojista" | "entregador";
  if (explicitApp === "entregador" || explicitApp === "driver" || data.type === "delivery") {
    targetApp = "entregador";
  } else if (explicitApp === "lojista" || explicitApp === "merchant" || explicitApp === "company" || data.type === "new_order" || Boolean(data.companyId)) {
    targetApp = "lojista";
  } else {
    targetApp = "marketplace";
  }

  let defaultBundleId: string;
  let defaultSound: string;
  let channelId: string;

  if (targetApp === "entregador") {
    defaultBundleId = "br.com.epraja.entregador";
    defaultSound = "notification_sound.mp3";
    channelId = "delivery-incoming-v9";
  } else if (targetApp === "lojista") {
    defaultBundleId = "br.com.epraja.lojista";
    defaultSound = "notification_sound.mp3";
    channelId = "lojista_orders_v2";
  } else {
    defaultBundleId = "br.com.epraja.appFma";
    defaultSound = "default";
    channelId = "marketplace_orders";
  }

  const resolvedBundleId = explicitBundle || defaultBundleId;
  const soundName = targetApp === "marketplace" ? "default" : "notification_sound";
  const iosSound = defaultSound;

  let targetToken = token;
  const isApnsHex = /^[0-9a-fA-F]{64}$/.test(token.trim());
  if (isApnsHex) {
    const candidateBundles = [
      resolvedBundleId,
      "br.com.epraja.appFma",
      "br.com.epraja.lojista",
      "br.com.epraja.entregador"
    ].filter((val, idx, self) => self.indexOf(val) === idx);

    let converted = false;
    for (const bId of candidateBundles) {
      for (const sandbox of [false, true]) {
        try {
          const importRes = await fetch("https://iid.googleapis.com/iid/v1:batchImport", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "access_token_auth": "true",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              application: bId,
              sandbox: sandbox,
              apns_tokens: [token.trim()]
            })
          });
          const importData = await importRes.json();
          const mapped = importData?.results?.[0];
          if (mapped?.status === "OK" && mapped.registration_token) {
            targetToken = mapped.registration_token;
            converted = true;
            break;
          }
        } catch (errImport) {}
      }
      if (converted) break;
    }
  }
  
  const notifTag = data.deliveryId 
    ? `delivery-${data.deliveryId}` 
    : (data.orderId 
        ? `order-${data.orderId}` 
        : `mkt-${title.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}`);

  const isIos = isIosToken || data.platform === "ios" || data.isIos === "true";
  const isDriverDelivery = targetApp === "entregador" && (data.type === "delivery" || data.eventType === "delivery_available" || Boolean(data.deliveryId));

  let payload: any;
  if (isDriverDelivery) {
    payload = {
      message: {
        token: targetToken,
        ...(isIos ? {
          notification: {
            title,
            body,
          },
        } : {}),
        data: {
          ...data,
          title,
          body,
          message: body,
          sound: "notification_sound.mp3",
          channel_id: "delivery-incoming-v9",
          priority: "high",
          platform: isIos ? "ios" : "android",
        },
        android: {
          priority: "HIGH",
          ttl: "45s",
          direct_boot_ok: true,
        },
        apns: {
          headers: {
            "apns-priority": "10",
            "apns-push-type": "alert",
            "apns-topic": resolvedBundleId,
          },
          payload: {
            aps: {
              alert: { title, body },
              sound: "default",
              badge: 1,
            },
          },
        },
      },
    };
  } else {
    payload = {
      message: {
        token: targetToken,
        notification: {
          title,
          body,
          ...(data.url ? { image: data.url } : {}),
        },
        data: {
          ...data,
          title,
          body,
          message: body,
          tag: notifTag
        },
        android: {
          priority: "HIGH",
          notification: {
            sound: soundName,
            channel_id: channelId,
            tag: notifTag,
            default_sound: targetApp === "marketplace",
            default_vibrate_timings: true,
            visibility: "PUBLIC",
            notification_priority: "PRIORITY_MAX"
          }
        },
        apns: {
          headers: {
            "apns-priority": "10",
            "apns-push-type": "alert",
            "apns-topic": resolvedBundleId,
          },
          payload: {
            aps: {
              alert: { title, body },
              sound: "default",
              badge: 1,
            },
          },
        },
      },
    };
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let last: SendResult = { ok: false, status: 0, attempts: 0, token };

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    last.attempts = attempt + 1;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      last.status = res.status;
      const resJson = await res.json().catch(() => null);
      last.response = resJson;

      if (res.ok) {
        last.ok = true;
        last.outcome = "success";
        return last;
      }

      const classified = classifyFcm(res.status, resJson);
      last.outcome = classified.outcome;
      last.code = classified.code;
      last.error = `${classified.code}: ${classified.message || JSON.stringify(resJson)}`;
      last.invalid = classified.outcome === "invalid";

      if (last.invalid || classified.outcome === "config" || classified.outcome === "auth") {
        return last;
      }

      if (!isRetryable(res.status) && attempt > 0) return last;
    } catch (e) {
      last.error = (e as Error)?.message ?? String(e);
      last.outcome = "transient";
    }

    if (attempt === RETRY_DELAYS_MS.length) break;
    const delay = RETRY_DELAYS_MS[attempt] + Math.floor(Math.random() * 200);
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
    const notifBody = String(body.body ?? body.message ?? "");
    if (notifBody && (notifBody.includes("foi atualizado:") || notifBody.includes("mudou para:"))) {
      return new Response(JSON.stringify({ requestId: reqId, success: true, message: "Dropped legacy manual notification" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const action = String(body.action ?? "send");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const selectTokens = async (column: string, value: string) => {
      const active = await supabase
        .from("device_tokens").select("token").eq(column, value).is("disabled_at", null);
      if (!active.error) return active;
      return await supabase.from("device_tokens").select("token").eq(column, value);
    };

    // ---------- LIMPEZA / ROTAÇÃO MANUAL ----------
    if (action === "cleanup") {
      const staleDays = Number(body.staleDays ?? 270);
      const { data, error } = await supabase.rpc("cleanup_device_tokens", { _stale_days: staleDays });
      if (error) {
        console.error(`[send-push:${reqId}] cleanup falhou: ${error.message}`);
        return json({ error: `cleanup falhou: ${error.message}` }, 500);
      }
      return json({ cleanup: data });
    }

    // ---------- REGISTRO / ATUALIZAÇÃO DO TOKEN FCM ----------
    if (action === "register_token" || action === "save_token") {
      const fcmToken = String(body.token ?? body.fcmToken ?? "").trim();
      if (!fcmToken) return json({ error: "token ausente" }, 400);

      const userId = body.userId ? String(body.userId) : null;
      const customerId = body.customerId ? String(body.customerId) : null;
      const companyId = body.companyId ? String(body.companyId) : null;
      const phone = body.phone ? String(body.phone) : null;
      const platform = body.platform ? String(body.platform) : "unknown";
      const appType = body.app ? String(body.app).toLowerCase().trim() : null;
      const explicitBundle = body.bundleId ? String(body.bundleId).trim() : null;
      const now = new Date().toISOString();
      const outcome: Record<string, string> = {};

      const up = await supabase
        .from("device_tokens")
        .upsert(
          {
            token: fcmToken,
            user_id: userId,
            customer_id: customerId,
            phone,
            platform,
            app: appType,
            bundle_id: explicitBundle,
            updated_at: now
          },
          { onConflict: "token" },
        );
      outcome.device_tokens = up.error ? `erro: ${up.error.message}` : "ok";

      // Reativa o token (sai da quarentena) sempre que o app o registra novamente
      const reset = await supabase
        .from("device_tokens")
        .update({ disabled_at: null, app: appType, bundle_id: explicitBundle, updated_at: now })
        .eq("token", fcmToken);
      outcome.reset = reset.error ? `ignorado: ${reset.error.message}` : "ok";

      // Rotação: remove tokens antigos do mesmo dispositivo/usuário
      if (body.previousToken && String(body.previousToken) !== fcmToken) {
        const del = await supabase.from("device_tokens").delete().eq("token", String(body.previousToken));
        outcome.rotated = del.error ? `erro: ${del.error.message}` : "ok";
      }

      // Vínculo seguro por Aplicativo (evita contaminação entre Cliente, Lojista e Entregador)
      const driverId = body.driverId ? String(body.driverId) : null;

      if (companyId || appType === "lojista" || explicitBundle === "br.com.epraja.lojista") {
        // 1. App Lojista
        if (companyId) {
          const comp = await supabase.from("companies").update({ fcm_token: fcmToken, updated_at: now }).eq("id", companyId);
          outcome.companies = comp.error ? `erro: ${comp.error.message}` : "ok";
        }
        if (userId) {
          const p = await supabase.from("profiles").update({ fcm_token: fcmToken, updated_at: now }).eq("id", userId);
          outcome.profiles = p.error ? `erro: ${p.error.message}` : "ok";
        }
      } else if (driverId || appType === "entregador" || body.isDriver || explicitBundle === "br.com.epraja.entregador") {
        // 2. App Entregador
        if (driverId) {
          const drv = await supabase.from("delivery_drivers").update({ fcm_token: fcmToken, updated_at: now }).eq("id", driverId);
          outcome.delivery_drivers = drv.error ? `erro: ${drv.error.message}` : "ok";
        } else if (userId) {
          const drv = await supabase.from("delivery_drivers").update({ fcm_token: fcmToken, updated_at: now }).eq("user_id", userId);
          outcome.delivery_drivers = drv.error ? `erro: ${drv.error.message}` : "ok";
        }
      } else {
        // 3. App Marketplace / Cliente
        if (customerId) {
          const c = await supabase.from("customers").update({ fcm_token: fcmToken, updated_at: now }).eq("id", customerId);
          outcome.customers = c.error ? `erro: ${c.error.message}` : "ok";
        } else if (userId) {
          const c = await supabase.from("customers").update({ fcm_token: fcmToken, updated_at: now }).eq("user_id", userId);
          outcome.customers = c.error ? `erro: ${c.error.message}` : "ok";
        } else if (phone) {
          const c = await supabase.from("customers").update({ fcm_token: fcmToken, updated_at: now }).eq("phone", phone);
          outcome.customers = c.error ? `erro: ${c.error.message}` : "ok";
        }
      }

      console.log(`[send-push:${reqId}] registro do token (app=${appType}, bundle=${explicitBundle}):`, JSON.stringify(outcome));
      return json({ registered: true, outcome });
    }

    // ---------- ENVIO ----------
    let sa: ServiceAccount | null = null;
    if (SA_RAW) {
      try {
        const parsed = JSON.parse(SA_RAW) as ServiceAccount;
        if (parsed.private_key && parsed.client_email && parsed.project_id) {
          sa = parsed;
        }
      } catch (e) {
        console.error(`[send-push:${reqId}] Erro ao parsear FIREBASE_SERVICE_ACCOUNT_JSON:`, e);
      }
    }

    if (!sa) {
      return json({ error: "Configuração do Firebase ausente: configure o secret FIREBASE_SERVICE_ACCOUNT_JSON no painel do Supabase." }, 500);
    }

    // ── DETECÇÃO DE TRIGGER DE DELIVERY (webhook do Postgres ou disparo direto)
    const isDeliveryTrigger = (
      body.table === "deliveries" ||
      body.table === "available_deliveries" ||
      body.type === "delivery" ||
      body.type === "new_delivery" ||
      body.eventType === "delivery_available"
    ) && (body.record || body.deliveryId || body.id);

    let title: string;
    let message: string;
    const extra: Record<string, string> = {};

    if (isDeliveryTrigger) {
      const rec = body.record || body;
      const storeName = rec.store_name || rec.company_name || rec.storeName || "É Pra Já Delivery";
      const details = rec.details || rec.address || "Nova corrida disponível!";
      const deliveryId = rec.id || rec.deliveryId || rec.delivery_id || "";
      const companyId = rec.company_id || rec.companyId || "";
      const pickup = rec.pickup_address || rec.origin_address || rec.store_address || rec.pickup || "Retirada na Loja";
      const dropoff = rec.delivery_address || rec.dropoff_address || rec.customer_address || rec.dropoff || rec.address || "Endereço do cliente";
      const rawFee = rec.delivery_fee ?? rec.price ?? rec.value ?? rec.commission ?? rec.driver_fee ?? rec.earnings ?? rec.fee ?? "";
      const feeFormatted = (rawFee !== "" && rawFee !== null && rawFee !== undefined)
        ? (typeof rawFee === "number" || (!isNaN(Number(rawFee)) && Number(rawFee) > 0)
            ? `R$ ${Number(rawFee).toFixed(2).replace(".", ",")}`
            : String(rawFee))
        : "";

      title = `🏬 ${storeName}`;
      message = String(details).slice(0, 400);

      extra.type = "delivery";
      extra.eventType = "delivery_available";
      extra.app = "entregador";
      extra.bundleId = "br.com.epraja.entregador";
      extra.deliveryId = String(deliveryId);
      extra.delivery_id = String(deliveryId);
      extra.id = String(deliveryId);
      extra.orderId = String(rec.order_id || rec.orderId || "");
      extra.order_id = String(rec.order_id || rec.orderId || "");
      extra.companyId = String(companyId);
      extra.company_id = String(companyId);
      extra.storeName = String(storeName);
      extra.store_name = String(storeName);
      extra.pickup = String(pickup);
      extra.pickupAddress = String(pickup);
      extra.pickup_address = String(pickup);
      extra.dropoff = String(dropoff);
      extra.deliveryAddress = String(dropoff);
      extra.delivery_address = String(dropoff);
      extra.fee = feeFormatted;
      extra.earnings = feeFormatted;
      extra.delivery_fee = feeFormatted;
      extra.address = String(details);
      extra.details = String(details);
      extra.title = title;
      extra.body = message;
      extra.message = message;
      extra.route = `/driver?deliveryId=${deliveryId}`;

      console.log(`[send-push:${reqId}] DELIVERY TRIGGER detectado — deliveryId=${deliveryId} storeName=${storeName}`);

      const { data: drivers, error: drvErr } = await supabase
        .from("delivery_drivers")
        .select("user_id, fcm_token")
        .eq("is_online", true);

      if (drvErr) {
        console.error(`[send-push:${reqId}] Erro ao buscar entregadores:`, drvErr.message);
      }

      const directTokens = (drivers ?? [])
        .map((d: any) => d.fcm_token)
        .filter((t: string) => t && t.trim().length > 10);

      const onlineUserIds = (drivers ?? [])
        .map((d: any) => d.user_id)
        .filter((u: string) => Boolean(u));

      // Busca TODOS os tokens ativos dos entregadores online em device_tokens (cobre iPhone e múltiplos aparelhos do mesmo motorista!)
      let additionalTokens: string[] = [];
      const tokenPlatformMap = new Map<string, string>();

      if (onlineUserIds.length > 0) {
        const { data: devTokens } = await supabase
          .from("device_tokens")
          .select("token, platform")
          .in("user_id", onlineUserIds)
          .is("disabled_at", null);
        if (devTokens) {
          for (const dt of devTokens) {
            const tk = String(dt?.token || "").trim();
            if (tk.length > 10) {
              additionalTokens.push(tk);
              if (dt.platform) {
                tokenPlatformMap.set(tk, String(dt.platform).toLowerCase());
              }
            }
          }
        }
      }

      const allDriverTokens = Array.from(new Set([...directTokens, ...additionalTokens]));

      // Preenche plataforma também para tokens diretos se existirem em device_tokens
      const missingTokens = directTokens.filter(t => !tokenPlatformMap.has(t));
      if (missingTokens.length > 0) {
        const { data: dtExtra } = await supabase
          .from("device_tokens")
          .select("token, platform")
          .in("token", missingTokens);
        (dtExtra ?? []).forEach((dt: any) => {
          if (dt?.token && dt?.platform) {
            tokenPlatformMap.set(String(dt.token).trim(), String(dt.platform).toLowerCase());
          }
        });
      }

      if (allDriverTokens.length === 0) {
        return json({ sent: 0, total: 0, warning: "Nenhum entregador online com token FCM" });
      }

      const accessToken = await getAccessToken(sa);
      const results = await Promise.all(
        allDriverTokens.map((t: string) => {
          const isIos = tokenPlatformMap.get(t) === "ios";
          return sendToToken(reqId, sa, accessToken, t, title, message, extra, isIos);
        }),
      );
      const sent = results.filter((r) => r.ok).length;

      const invalidTokens = results.filter((r) => r.invalid).map((r) => r.token);
      if (invalidTokens.length > 0) {
        await supabase.from("delivery_drivers").update({ fcm_token: null }).in("fcm_token", invalidTokens);
      }

      return json({
        sent,
        total: allDriverTokens.length,
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

    // ── FLUXO TRANSACIONAL (Marketplace / Lojista)
    title = String(body.title ?? "É Pra Já").slice(0, 120);
    message = String(body.body ?? body.message ?? "Você tem uma nova atualização.").slice(0, 400);
    if (body.orderId) extra.orderId = String(body.orderId);
    if (body.status) extra.status = String(body.status);
    if (body.url) extra.url = String(body.url);
    if (body.route) extra.route = String(body.route);
    extra.click_action = "FLUTTER_NOTIFICATION_CLICK";
    extra.app = String(body.app || "marketplace");
    extra.bundleId = String(body.bundleId || (extra.app === "lojista" ? "br.com.epraja.lojista" : extra.app === "entregador" ? "br.com.epraja.entregador" : "br.com.epraja.appFma"));

    let tokens: string[] = Array.isArray(body.tokens)
      ? body.tokens.filter(Boolean).map(String)
      : body.token
        ? [String(body.token)]
        : [];

    if (tokens.length === 0) {
      let userId: string | null = body.userId ? String(body.userId) : null;
      let customerId: string | null = body.customerId ? String(body.customerId) : null;
      let companyId: string | null = body.companyId ? String(body.companyId) : null;
      let orderRecord: any = null;

      if (body.orderId) {
        const { data: order, error } = await supabase
          .from("orders")
          .select("id, customer_id, user_id, company_id, status, order_number, total_amount")
          .eq("id", String(body.orderId))
          .maybeSingle();
        if (order) {
          orderRecord = order;
          if (!customerId) customerId = order.customer_id ?? null;
          if (!userId) userId = order.user_id ?? null;
          if (!companyId) companyId = order.company_id ?? null;
        }
      }

      const found = new Set<string>();
      const collect = (rows: any[] | null, field: string) => {
        (rows ?? []).forEach((r) => r?.[field] && found.add(r[field]));
      };

      const orderStatus = String(body.status || orderRecord?.status || "").toLowerCase();
      const isPendingNewOrder = orderStatus === "pending" || body.type === "new_order" || body.isNewOrder;

      // Notificação de novo pedido para Lojista
      if (companyId && (isPendingNewOrder || body.target === "merchant" || body.forMerchant)) {
        title = `📦 NOVO PEDIDO RECEBIDO! 🛎️`;
        const orderNum = orderRecord?.order_number ? `#${orderRecord.order_number}` : (orderRecord?.id ? `#${String(orderRecord.id).slice(0, 5).toUpperCase()}` : "");
        message = `Você recebeu um novo pedido ${orderNum}! Toque para aceitar e começar a preparar.`;
        extra.type = "new_order";
        extra.app = "lojista";
        extra.bundleId = "br.com.epraja.lojista";
        extra.route = "/business/orders";
        extra.companyId = String(companyId);

        const { data: comp } = await supabase
          .from("companies")
          .select("fcm_token")
          .eq("id", companyId)
          .maybeSingle();
        if (comp?.fcm_token) collect([{ token: comp.fcm_token }], "token");

        const { data: devStoreTokens } = await supabase
          .from("device_tokens")
          .select("token")
          .is("disabled_at", null)
          .or("app.eq.lojista,bundle_id.eq.br.com.epraja.lojista");
        collect(devStoreTokens as any[], "token");
      }

      // Notificação de pedido para Cliente (Marketplace)
      if (customerId) {
        const { data: devCust } = await supabase
          .from("device_tokens")
          .select("token")
          .eq("customer_id", customerId)
          .is("disabled_at", null);
        collect(devCust as any[], "token");

        const c = await supabase.from("customers").select("fcm_token").or(`id.eq.${customerId},user_id.eq.${customerId}`);
        collect(c.data as any[], "fcm_token");
      }

      if (userId && !companyId && !isPendingNewOrder) {
        const { data: devUser } = await supabase
          .from("device_tokens")
          .select("token")
          .eq("user_id", userId)
          .or("app.eq.marketplace,bundle_id.eq.br.com.epraja.appFma,app.is.null")
          .is("disabled_at", null);
        collect(devUser as any[], "token");

        const c2 = await supabase.from("customers").select("fcm_token").eq("user_id", userId);
        collect(c2.data as any[], "fcm_token");
      }

      tokens = Array.from(found);

      // ── MODO MARKETING / BROADCAST SEGMENTADO ─────────────────────
      const isMarketingBroadcast = Boolean(
        body.isBroadcast ||
        body.broadcast ||
        body.target_audience ||
        body.audience ||
        (!userId && !customerId && !companyId && !body.orderId && !body.driverId)
      );

      if (tokens.length === 0 && isMarketingBroadcast) {
        // 1. Determinação estrita do público alvo (target_audience)
        const rawAudience = String(
          body.target_audience ?? body.audience ?? body.target ?? "customers"
        ).trim().toLowerCase();

        let targetAudience: "customers" | "stores" | "drivers";
        if (rawAudience === "stores" || rawAudience === "lojista" || rawAudience === "lojistas" || rawAudience === "merchants") {
          targetAudience = "stores";
        } else if (rawAudience === "drivers" || rawAudience === "entregador" || rawAudience === "entregadores" || rawAudience === "motoboys") {
          targetAudience = "drivers";
        } else {
          // "all", "customers", "clientes" ou default -> estritamente CLIENTES DO MARKETPLACE
          targetAudience = "customers";
        }

        const campaignId = String(body.campaign_id || body.campaignId || body.id || "manual");

        // 2. Configuração mandatória de bundle e app por público
        if (targetAudience === "stores") {
          extra.app = "lojista";
          extra.bundleId = "br.com.epraja.lojista";
          extra.type = "marketing";
        } else if (targetAudience === "drivers") {
          extra.app = "entregador";
          extra.bundleId = "br.com.epraja.entregador";
          extra.type = "marketing";
        } else {
          extra.app = "marketplace";
          extra.bundleId = "br.com.epraja.appFma";
          extra.type = "marketing";
        }

        // 3. Coleta e Isolamento Absoluto de Destinatários por Público (Positive Filtering)
        const targetTokens = new Set<string>();

        if (targetAudience === "customers") {
          // ── PÚBLICO: CLIENTES (MARKETPLACE - br.com.epraja.appFma) ──
          console.log(`[send-push:${reqId}] [PUSH_MARKETING] Coletando tokens exclusivos de 'customers' (Marketplace)...`);

          // 3.1. Tokens em device_tokens filtrados ESTRITAMENTE com AND: app = 'marketplace' AND bundle_id = 'br.com.epraja.appFma'
          const { data: devCustTokens, error: errDev } = await supabase
            .from("device_tokens")
            .select("token")
            .is("disabled_at", null)
            .eq("app", "marketplace")
            .eq("bundle_id", "br.com.epraja.appFma");
          if (errDev) console.error(`[send-push:${reqId}] device_tokens customers error: ${errDev.message}`);
          (devCustTokens ?? []).forEach((t: any) => t?.token && targetTokens.add(String(t.token).trim()));

          // 3.2. Proteção Adicional de Expurgo Cruzado (Safety Net)
          const [storeTokensRes, driverTokensRes, otherAppDevTokens] = await Promise.all([
            supabase.from("companies").select("fcm_token").not("fcm_token", "is", null),
            supabase.from("delivery_drivers").select("fcm_token").not("fcm_token", "is", null),
            supabase.from("device_tokens").select("token").or("app.eq.lojista,app.eq.entregador,bundle_id.eq.br.com.epraja.lojista,bundle_id.eq.br.com.epraja.entregador")
          ]);
          const excludedTokens = new Set<string>();
          (storeTokensRes.data ?? []).forEach((s: any) => s?.fcm_token && excludedTokens.add(String(s.fcm_token).trim()));
          (driverTokensRes.data ?? []).forEach((d: any) => d?.fcm_token && excludedTokens.add(String(d.fcm_token).trim()));
          (otherAppDevTokens.data ?? []).forEach((d: any) => d?.token && excludedTokens.add(String(d.token).trim()));

          let excludedCount = 0;
          for (const exc of excludedTokens) {
            if (targetTokens.has(exc)) {
              targetTokens.delete(exc);
              excludedCount++;
            }
          }
          if (excludedCount > 0) {
            console.log(`[send-push:${reqId}] [PUSH_MARKETING] Expurgo cruzado removeu ${excludedCount} token(s) incompatíveis da campanha customers`);
          }

        } else if (targetAudience === "stores") {
          // ── PÚBLICO: LOJISTAS (br.com.epraja.lojista) ──
          console.log(`[send-push:${reqId}] [PUSH_MARKETING] Coletando tokens exclusivos de 'stores' (Lojista)...`);

          // 3.1. Tokens em device_tokens filtrados ESTRITAMENTE com AND: app = 'lojista' AND bundle_id = 'br.com.epraja.lojista'
          const { data: devStoreTokens, error: errDevStore } = await supabase
            .from("device_tokens")
            .select("token")
            .is("disabled_at", null)
            .eq("app", "lojista")
            .eq("bundle_id", "br.com.epraja.lojista");
          if (errDevStore) console.error(`[send-push:${reqId}] device_tokens stores error: ${errDevStore.message}`);
          (devStoreTokens ?? []).forEach((t: any) => t?.token && targetTokens.add(String(t.token).trim()));

          // 3.2. Proteção Adicional de Expurgo Cruzado (Safety Net)
          const [custTokensRes, driverTokensRes, otherAppDevTokens] = await Promise.all([
            supabase.from("customers").select("fcm_token").not("fcm_token", "is", null),
            supabase.from("delivery_drivers").select("fcm_token").not("fcm_token", "is", null),
            supabase.from("device_tokens").select("token").or("app.eq.marketplace,app.eq.entregador,bundle_id.eq.br.com.epraja.appFma,bundle_id.eq.br.com.epraja.entregador")
          ]);
          const excludedTokens = new Set<string>();
          (custTokensRes.data ?? []).forEach((c: any) => c?.fcm_token && excludedTokens.add(String(c.fcm_token).trim()));
          (driverTokensRes.data ?? []).forEach((d: any) => d?.fcm_token && excludedTokens.add(String(d.fcm_token).trim()));
          (otherAppDevTokens.data ?? []).forEach((d: any) => d?.token && excludedTokens.add(String(d.token).trim()));

          let excludedCount = 0;
          for (const exc of excludedTokens) {
            if (targetTokens.has(exc)) {
              targetTokens.delete(exc);
              excludedCount++;
            }
          }
          if (excludedCount > 0) {
            console.log(`[send-push:${reqId}] [PUSH_MARKETING] Expurgo cruzado removeu ${excludedCount} token(s) incompatíveis da campanha stores`);
          }

        } else if (targetAudience === "drivers") {
          // ── PÚBLICO: ENTREGADORES (br.com.epraja.entregador) ──
          console.log(`[send-push:${reqId}] [PUSH_MARKETING] Coletando tokens exclusivos de 'drivers' (Entregador)...`);

          // 3.1. Tokens em device_tokens filtrados ESTRITAMENTE com AND: app = 'entregador' AND bundle_id = 'br.com.epraja.entregador'
          const { data: devDriverTokens, error: errDevDrv } = await supabase
            .from("device_tokens")
            .select("token")
            .is("disabled_at", null)
            .eq("app", "entregador")
            .eq("bundle_id", "br.com.epraja.entregador");
          if (errDevDrv) console.error(`[send-push:${reqId}] device_tokens drivers error: ${errDevDrv.message}`);
          (devDriverTokens ?? []).forEach((t: any) => t?.token && targetTokens.add(String(t.token).trim()));

          // 3.2. Proteção Adicional de Expurgo Cruzado (Safety Net)
          const [custTokensRes, compTokensRes, otherAppDevTokens] = await Promise.all([
            supabase.from("customers").select("fcm_token").not("fcm_token", "is", null),
            supabase.from("companies").select("fcm_token").not("fcm_token", "is", null),
            supabase.from("device_tokens").select("token").or("app.eq.marketplace,app.eq.lojista,bundle_id.eq.br.com.epraja.appFma,bundle_id.eq.br.com.epraja.lojista")
          ]);
          const excludedTokens = new Set<string>();
          (custTokensRes.data ?? []).forEach((c: any) => c?.fcm_token && excludedTokens.add(String(c.fcm_token).trim()));
          (compTokensRes.data ?? []).forEach((s: any) => s?.fcm_token && excludedTokens.add(String(s.fcm_token).trim()));
          (otherAppDevTokens.data ?? []).forEach((d: any) => d?.token && excludedTokens.add(String(d.token).trim()));

          let excludedCount = 0;
          for (const exc of excludedTokens) {
            if (targetTokens.has(exc)) {
              targetTokens.delete(exc);
              excludedCount++;
            }
          }
          if (excludedCount > 0) {
            console.log(`[send-push:${reqId}] [PUSH_MARKETING] Expurgo cruzado removeu ${excludedCount} token(s) incompatíveis da campanha drivers`);
          }
        }

        tokens = Array.from(targetTokens);

        // 4. Log de auditoria
        console.log(
          `[PUSH_MARKETING]\ncampaign=${campaignId}\naudience=${targetAudience}\nbundle=${extra.bundleId}\napp=${extra.app}\nrecipients=${tokens.length}`
        );
      }
    }

    console.log(`[send-push:${reqId}] ${tokens.length} token(s) alvo`);
    if (tokens.length === 0) {
      return json({
        sent: 0,
        total: 0,
        warning: `Nenhum token FCM válido encontrado para o público alvo: ${extra.app || 'desconhecido'}`
      });
    }

    const accessToken = await getAccessToken(sa);
    const results = await Promise.all(
      tokens.map((t) => sendToToken(reqId, sa, accessToken, t, title, message, extra)),
    );
    const sent = results.filter((r) => r.ok).length;

    // Log detalhado dos resultados do envio via FCM
    console.log(`[send-push:${reqId}] Envio finalizado. Total: ${tokens.length}, Sucesso: ${sent}, Falhas: ${tokens.length - sent}`);

    return json({
      sent,
      total: tokens.length,
      invalid: results.filter((r) => r.invalid).length,
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
  } catch (e) {
    console.error(`[send-push:${reqId}] erro fatal:`, e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
