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

    console.log(`[send-push:${reqId}] Token APNs bruto detectado (${token.slice(0, 10)}...). Testando conversão via BatchImport para [${candidateBundles.join(", ")}]...`);
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
            console.log(`[send-push:${reqId}] Token APNs convertido com sucesso para FCM token via ${bId} (sandbox=${sandbox}):`, mapped.registration_token.slice(0, 15) + "...");
            targetToken = mapped.registration_token;
            converted = true;
            break;
          }
        } catch (errImport) {
          console.warn(`[send-push:${reqId}] Erro BatchImport ${bId} (sandbox=${sandbox}):`, errImport);
        }
      }
      if (converted) break;
    }
  }
  
  // Estrutura Padrão Profissional FCM HTTP v1: notification + data + android.priority HIGH + channel_id
  const notifTag = data.deliveryId 
    ? `delivery-${data.deliveryId}` 
    : (data.orderId 
        ? `order-${data.orderId}` 
        : `mkt-${title.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}`);

  const isDriverDelivery = targetApp === "entregador" && (data.type === "delivery" || data.eventType === "delivery_available" || Boolean(data.deliveryId));

  let payload: any;
  if (isDriverDelivery) {
    // ── NOVA CORRIDA PARA ENTREGADOR: HIGH-PRIORITY DATA-ONLY PAYLOAD ──
    // Para que o Android execute MyFirebaseMessagingService.onMessageReceived()
    // em segundo plano (background / tela apagada), o FCM NÃO pode conter o bloco
    // "notification" no nível raiz para Android. Caso contrário, o Google Play Services
    // intercepta o push e o exibe apenas na barra de notificações sem acionar o código Java.
    // O MyFirebaseMessagingService já cria a notificação nativa com ações (ACEITAR/RECUSAR)
    // e som oficial (notification_sound.mp3), e aciona o OverlayService para abrir o CARD BRANCO.
    payload = {
      message: {
        token: targetToken,
        data: {
          ...data,
          title,
          body,
          message: body,
          app: "entregador",
          bundleId: "br.com.epraja.entregador",
        },
        android: {
          priority: "HIGH",
          collapse_key: notifTag,
        },
        apns: {
          headers: {
            "apns-priority": "10",
            "apns-push-type": "alert"
          },
          payload: {
            aps: {
              alert: { title, body },
              sound: iosSound,
              badge: 1,
              "content-available": 1,
              "mutable-content": 1
            }
          },
        },
      },
    };
  } else {
    // ── DEMAIS NOTIFICAÇÕES (MARKETPLACE, LOJISTA, MARKETING, STATUS DE PEDIDO) ──
    payload = {
      message: {
        token: targetToken,
        notification: { title, body },
        data: {
          ...data,
          app: targetApp,
          bundleId: resolvedBundleId,
        },
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
          headers: {
            "apns-priority": "10",
            "apns-push-type": "alert"
          },
          payload: {
            aps: {
              alert: { title, body },
              sound: iosSound,
              badge: 1,
              "content-available": 1,
              "mutable-content": 1
            }
          },
        },
      },
    };
  }

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
      const companyId = body.companyId ? String(body.companyId) : null;
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

      // Vínculo seguro por Aplicativo (evita contaminação entre Cliente, Lojista e Entregador)
      const driverId = body.driverId ? String(body.driverId) : null;
      const appType = body.app ? String(body.app).toLowerCase() : null;
      const explicitBundle = body.bundleId ? String(body.bundleId).toLowerCase() : null;

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

    // ── DETECÇÃO DE TRIGGER DE DELIVERY (webhook do Postgres ou disparo direto)
    // Quando uma nova entrega é criada ou disponibilizada para entregadores
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

      // Contrato de campos esperados pelo speed-squad (MyFirebaseMessagingService e OverlayService)
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
    extra.click_action = "FLUTTER_NOTIFICATION_CLICK";
    extra.app = String(body.app || "marketplace");
    extra.bundleId = String(body.bundleId || (extra.app === "lojista" ? "br.com.epraja.lojista" : extra.app === "entregador" ? "br.com.epraja.entregador" : "br.com.epraja.appFma"));

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
      let companyId: string | null = body.companyId ? String(body.companyId) : null;
      let orderRecord: any = null;

      if (body.orderId) {
        const { data: order, error } = await supabase
          .from("orders")
          .select("id, customer_id, user_id, company_id, status, order_number, total_amount")
          .eq("id", String(body.orderId))
          .maybeSingle();
        if (error) console.error(`[send-push:${reqId}] erro ao buscar pedido:`, error.message);
        if (order) {
          orderRecord = order;
          if (!customerId) customerId = order.customer_id ?? null;
          if (!userId) userId = order.user_id ?? null;
          if (!companyId) companyId = order.company_id ?? null;
          console.log(`[send-push:${reqId}] pedido resolvido -> customerId=${customerId} userId=${userId} companyId=${companyId} status=${order.status}`);
        }
      }

      const found = new Set<string>();
      const collect = (rows: any[] | null, field: string, source: string) => {
        (rows ?? []).forEach((r) => r?.[field] && found.add(r[field]));
        console.log(`[send-push:${reqId}] ${source}: ${rows?.length ?? 0} linha(s)`);
      };

      const orderStatus = String(body.status || orderRecord?.status || "").toLowerCase();
      const isPendingNewOrder = orderStatus === "pending" || body.type === "new_order" || body.isNewOrder;

      // Se for novo pedido (status 'pending') ou direcionado ao lojista:
      if (companyId && (isPendingNewOrder || body.target === "merchant" || body.forMerchant)) {
        console.log(`[send-push:${reqId}] NOVO PEDIDO PARA LOJISTA detectado! Buscando tokens da empresa: ${companyId}`);
        
        // Customiza título e corpo para o lojista
        title = `📦 NOVO PEDIDO RECEBIDO! 🛎️`;
        const orderNum = orderRecord?.order_number ? `#${orderRecord.order_number}` : (orderRecord?.id ? `#${String(orderRecord.id).slice(0, 5).toUpperCase()}` : "");
        message = `Você recebeu um novo pedido ${orderNum}! Toque para aceitar e começar a preparar.`;
        extra.type = "new_order";
        extra.app = "lojista";
        extra.bundleId = "br.com.epraja.lojista";
        extra.route = "/business/orders";
        extra.companyId = String(companyId);

        // 1. Busca token direto de companies
        const { data: comp } = await supabase
          .from("companies")
          .select("fcm_token")
          .eq("id", companyId)
          .maybeSingle();
        if (comp?.fcm_token) {
          collect([{ token: comp.fcm_token }], "token", "companies(lojista)");
        }

        // 2. Busca tokens dos profiles vinculados a esta empresa
        const { data: profs } = await supabase
          .from("profiles")
          .select("fcm_token, id")
          .eq("company_id", companyId)
          .not("fcm_token", "is", null);
        collect(profs as any[], "fcm_token", "profiles(company_id)");

        // 3. Busca em device_tokens de usuários da empresa
        if (profs && profs.length > 0) {
          for (const p of profs) {
            const { data: dTokens } = await selectTokens("user_id", p.id);
            collect(dTokens as any[], "token", "device_tokens(lojista_user)");
          }
        }
      }

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

        // 2. Configuração mandatória de bundle e app por público (Regras 1, 2 e 3)
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

        // 3. Coleta e Isolamento Absoluto de Destinatários por Público
        const targetTokens = new Set<string>();

        if (targetAudience === "customers") {
          // ── PÚBLICO: CLIENTES (MARKETPLACE - br.com.epraja.appFma) ──
          // NUNCA enviar para br.com.epraja.lojista ou br.com.epraja.entregador.
          // NÃO consultar profiles.fcm_token!
          console.log(`[send-push:${reqId}] [PUSH_MARKETING] Coletando tokens para 'customers' (Marketplace)...`);

          // 3.1. Busca tokens legítimos de clientes na tabela customers
          const { data: custTokens, error: errCust } = await supabase
            .from("customers")
            .select("fcm_token")
            .not("fcm_token", "is", null);
          if (errCust) console.error(`[send-push:${reqId}] customers query error: ${errCust.message}`);
          (custTokens ?? []).forEach((c: any) => c?.fcm_token && targetTokens.add(String(c.fcm_token).trim()));

          // 3.2. Busca em device_tokens onde customer_id NÃO é nulo (garantia de ser cliente)
          const { data: devCustTokens, error: errDev } = await supabase
            .from("device_tokens")
            .select("token")
            .is("disabled_at", null)
            .not("customer_id", "is", null);
          if (errDev) console.error(`[send-push:${reqId}] device_tokens customers error: ${errDev.message}`);
          (devCustTokens ?? []).forEach((t: any) => t?.token && targetTokens.add(String(t.token).trim()));

          // 3.3. Trava de isolamento: Identifica e remove qualquer token pertencente a Lojistas ou Entregadores
          const [storeTokensRes, driverTokensRes] = await Promise.all([
            supabase.from("companies").select("fcm_token").not("fcm_token", "is", null),
            supabase.from("delivery_drivers").select("fcm_token").not("fcm_token", "is", null),
          ]);
          const excludedTokens = new Set<string>();
          (storeTokensRes.data ?? []).forEach((s: any) => s?.fcm_token && excludedTokens.add(String(s.fcm_token).trim()));
          (driverTokensRes.data ?? []).forEach((d: any) => d?.fcm_token && excludedTokens.add(String(d.fcm_token).trim()));

          // Também exclui tokens de profiles com company_id
          const { data: storeProfiles } = await supabase
            .from("profiles")
            .select("fcm_token")
            .not("company_id", "is", null)
            .not("fcm_token", "is", null);
          (storeProfiles ?? []).forEach((p: any) => p?.fcm_token && excludedTokens.add(String(p.fcm_token).trim()));

          let excludedCount = 0;
          for (const exc of excludedTokens) {
            if (targetTokens.has(exc)) {
              targetTokens.delete(exc);
              excludedCount++;
            }
          }
          if (excludedCount > 0) {
            console.log(`[send-push:${reqId}] [PUSH_MARKETING] Isolamento aplicado: ${excludedCount} token(s) de lojista/entregador excluído(s) da campanha customers`);
          }

        } else if (targetAudience === "stores") {
          // ── PÚBLICO: LOJISTAS (br.com.epraja.lojista) ──
          // NUNCA enviar para br.com.epraja.appFma ou br.com.epraja.entregador.
          console.log(`[send-push:${reqId}] [PUSH_MARKETING] Coletando tokens para 'stores' (Lojista)...`);

          // 3.1. Busca tokens em companies
          const { data: compTokens, error: errComp } = await supabase
            .from("companies")
            .select("fcm_token")
            .not("fcm_token", "is", null);
          if (errComp) console.error(`[send-push:${reqId}] companies query error: ${errComp.message}`);
          (compTokens ?? []).forEach((c: any) => c?.fcm_token && targetTokens.add(String(c.fcm_token).trim()));

          // 3.2. Busca tokens em profiles com company_id
          const { data: profTokens, error: errProf } = await supabase
            .from("profiles")
            .select("fcm_token, id")
            .not("company_id", "is", null)
            .not("fcm_token", "is", null);
          if (errProf) console.error(`[send-push:${reqId}] profiles(stores) error: ${errProf.message}`);
          const storeUserIds: string[] = [];
          (profTokens ?? []).forEach((p: any) => {
            if (p?.fcm_token) targetTokens.add(String(p.fcm_token).trim());
            if (p?.id) storeUserIds.push(String(p.id));
          });

          // 3.3. Busca em device_tokens de usuários lojistas
          if (storeUserIds.length > 0) {
            const { data: devStoreTokens } = await supabase
              .from("device_tokens")
              .select("token")
              .is("disabled_at", null)
              .in("user_id", storeUserIds);
            (devStoreTokens ?? []).forEach((t: any) => t?.token && targetTokens.add(String(t.token).trim()));
          }

          // Trava de isolamento: remove qualquer token de cliente ou entregador
          const [custTokensRes, driverTokensRes] = await Promise.all([
            supabase.from("customers").select("fcm_token").not("fcm_token", "is", null),
            supabase.from("delivery_drivers").select("fcm_token").not("fcm_token", "is", null),
          ]);
          const excludedTokens = new Set<string>();
          (custTokensRes.data ?? []).forEach((c: any) => c?.fcm_token && excludedTokens.add(String(c.fcm_token).trim()));
          (driverTokensRes.data ?? []).forEach((d: any) => d?.fcm_token && excludedTokens.add(String(d.fcm_token).trim()));
          for (const exc of excludedTokens) {
            targetTokens.delete(exc);
          }

        } else if (targetAudience === "drivers") {
          // ── PÚBLICO: ENTREGADORES (br.com.epraja.entregador) ──
          // NUNCA enviar para br.com.epraja.appFma ou br.com.epraja.lojista.
          console.log(`[send-push:${reqId}] [PUSH_MARKETING] Coletando tokens para 'drivers' (Entregador)...`);

          // 3.1. Busca tokens em delivery_drivers
          const { data: driverTokens, error: errDrv } = await supabase
            .from("delivery_drivers")
            .select("fcm_token, user_id")
            .not("fcm_token", "is", null);
          if (errDrv) console.error(`[send-push:${reqId}] delivery_drivers query error: ${errDrv.message}`);
          const driverUserIds: string[] = [];
          (driverTokens ?? []).forEach((d: any) => {
            if (d?.fcm_token) targetTokens.add(String(d.fcm_token).trim());
            if (d?.user_id) driverUserIds.push(String(d.user_id));
          });

          // 3.2. Busca em device_tokens de entregadores
          if (driverUserIds.length > 0) {
            const { data: devDriverTokens } = await supabase
              .from("device_tokens")
              .select("token")
              .is("disabled_at", null)
              .in("user_id", driverUserIds);
            (devDriverTokens ?? []).forEach((t: any) => t?.token && targetTokens.add(String(t.token).trim()));
          }

          // Trava de isolamento: remove qualquer token de cliente ou lojista
          const [custTokensRes, compTokensRes] = await Promise.all([
            supabase.from("customers").select("fcm_token").not("fcm_token", "is", null),
            supabase.from("companies").select("fcm_token").not("fcm_token", "is", null),
          ]);
          const excludedTokens = new Set<string>();
          (custTokensRes.data ?? []).forEach((c: any) => c?.fcm_token && excludedTokens.add(String(c.fcm_token).trim()));
          (compTokensRes.data ?? []).forEach((s: any) => s?.fcm_token && excludedTokens.add(String(s.fcm_token).trim()));
          for (const exc of excludedTokens) {
            targetTokens.delete(exc);
          }
        }

        tokens = Array.from(targetTokens);

        // 4. Log de auditoria obrigatório (Regra 13)
        console.log(
          `[PUSH_MARKETING]\ncampaign=${campaignId}\naudience=${targetAudience}\nbundle=${extra.bundleId}\napp=${extra.app}\nrecipients=${tokens.length}`
        );
        if (tokens.length > 0) {
          const masked = tokens.map((t) => t.length > 14 ? `${t.slice(0, 8)}...${t.slice(-6)}` : "***");
          console.log(`[PUSH_MARKETING_TOKENS] [${masked.join(", ")}]`);
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
    console.log("[TOKENS]", tokens.map((t) => t.length > 14 ? `${t.slice(0, 8)}...${t.slice(-6)}` : "***"));
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
