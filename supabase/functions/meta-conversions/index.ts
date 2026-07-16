import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EventName = "InitiateCheckout" | "Purchase";
type RequestBody = { eventName: EventName; orderId: string; eventId: string };
type StoredItem = { productId?: unknown; quantity?: unknown; unitPrice?: unknown; subtotal?: unknown };
type OrderRow = {
  id: string;
  items: unknown;
  subtotal: unknown;
  marketing_consent: boolean;
  meta_fbp: string | null;
  meta_fbc: string | null;
  meta_event_source_url: string | null;
  meta_client_user_agent: string | null;
  stock_deducted: boolean;
  status: string;
  meta_initiate_checkout_event_id: string | null;
  meta_initiate_checkout_sent_at: string | null;
  meta_purchase_sent_at: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const GRAPH_VERSION_PATTERN = /^v\d+\.\d+$/;
const META_TIMEOUT_MS = 9_000;
const REQUEST_KEYS = ["eventId", "eventName", "orderId"];

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function allowedOrigins(raw: string): Set<string> {
  return new Set(raw.split(",").map(normalizeOrigin).filter((value): value is string => Boolean(value)));
}

function responseHeaders(origin: string | null, allowed: Set<string>): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
  if (origin && allowed.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(status: number, body: Record<string, unknown>, origin: string | null, allowed: Set<string>): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin, allowed) });
}

function logConversion(data: {
  orderId: string;
  eventName: EventName;
  phase: string;
  status: string;
  httpStatus?: number;
  errorCode?: string;
}): void {
  console.error(JSON.stringify(data));
}

function parseRequest(value: unknown): RequestBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== REQUEST_KEYS.length || keys.some((key, index) => key !== REQUEST_KEYS[index])) return null;
  const { eventName, orderId, eventId } = record;
  if (eventName !== "InitiateCheckout" && eventName !== "Purchase") return null;
  if (typeof orderId !== "string" || !UUID_PATTERN.test(orderId)) return null;
  if (typeof eventId !== "string" || eventId.length < 10 || eventId.length > 100) return null;
  return { eventName, orderId, eventId };
}

function validateCommercialData(order: OrderRow): { contents: Array<{ id: string; quantity: number; item_price: number }>; value: number; numItems: number } | null {
  if (!Array.isArray(order.items) || order.items.length < 1 || order.items.length > 50) return null;
  const persistedSubtotal = Number(order.subtotal);
  if (!Number.isFinite(persistedSubtotal) || persistedSubtotal <= 0) return null;

  const contents: Array<{ id: string; quantity: number; item_price: number }> = [];
  let calculatedSubtotal = 0;
  let numItems = 0;
  for (const rawItem of order.items as StoredItem[]) {
    if (!rawItem || typeof rawItem !== "object") return null;
    const id = typeof rawItem.productId === "string" ? rawItem.productId.trim() : "";
    const quantity = Number(rawItem.quantity);
    const unitPrice = Number(rawItem.unitPrice);
    const lineSubtotal = Number(rawItem.subtotal);
    if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || !Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(lineSubtotal) || lineSubtotal <= 0) return null;
    const calculatedLine = Number((unitPrice * quantity).toFixed(2));
    if (Math.abs(calculatedLine - lineSubtotal) > 0.01) return null;
    calculatedSubtotal += calculatedLine;
    numItems += quantity;
    contents.push({ id, quantity, item_price: unitPrice });
  }
  calculatedSubtotal = Number(calculatedSubtotal.toFixed(2));
  if (!contents.length || Math.abs(calculatedSubtotal - persistedSubtotal) > 0.01) return null;
  return { contents, value: persistedSubtotal, numItems };
}

function sanitizedMetaError(value: unknown): { message: string; code?: string } {
  if (!value || typeof value !== "object") return { message: "Meta request failed" };
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return { message: "Meta request failed" };
  const record = error as { message?: unknown; code?: unknown };
  const message = typeof record.message === "string" ? record.message.replace(/[\r\n\t]/g, " ").slice(0, 200) : "Meta request failed";
  const code = typeof record.code === "number" || typeof record.code === "string" ? String(record.code).slice(0, 40) : undefined;
  return { message, code };
}

Deno.serve(async (request) => {
  const originHeader = request.headers.get("Origin");
  const origin = originHeader ? normalizeOrigin(originHeader) : null;
  const origins = allowedOrigins(Deno.env.get("META_ALLOWED_ORIGINS") || "");

  if (originHeader && (!origin || !origins.has(origin))) return json(403, { error: "Origin not allowed" }, null, origins);
  if (request.method === "OPTIONS") {
    if (!origin) return json(403, { error: "Origin required" }, null, origins);
    return new Response(null, { status: 204, headers: {
      ...responseHeaders(origin, origins),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Access-Control-Max-Age": "600",
    } });
  }
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, origin, origins);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pixelId = Deno.env.get("META_PIXEL_ID");
  const capiToken = Deno.env.get("META_CAPI_ACCESS_TOKEN");
  const graphVersion = Deno.env.get("META_GRAPH_API_VERSION");
  const testEventCode = Deno.env.get("META_TEST_EVENT_CODE");
  if (!supabaseUrl || !anonKey || !serviceKey || !pixelId || !capiToken || !graphVersion || !GRAPH_VERSION_PATTERN.test(graphVersion) || origins.size === 0) {
    return json(503, { error: "Server configuration incomplete" }, origin, origins);
  }

  let rawBody: unknown;
  try { rawBody = await request.json(); } catch { return json(400, { error: "Invalid JSON" }, origin, origins); }
  const body = parseRequest(rawBody);
  if (!body) return json(400, { error: "Invalid request" }, origin, origins);
  const { eventName, orderId, eventId } = body;

  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (eventName === "Purchase") {
    const authorization = request.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) return json(401, { error: "Authentication required" }, origin, origins);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user?.email) return json(401, { error: "Authentication required" }, origin, origins);
    const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin");
    if (adminError || isAdmin !== true) return json(403, { error: "Admin access required" }, origin, origins);
  }

  const { data: order, error: orderError } = await adminClient.from("orders")
    .select("id,items,subtotal,marketing_consent,meta_fbp,meta_fbc,meta_event_source_url,meta_client_user_agent,stock_deducted,status,meta_initiate_checkout_event_id,meta_initiate_checkout_sent_at,meta_purchase_sent_at")
    .eq("id", orderId).maybeSingle<OrderRow>();
  if (orderError || !order) return json(404, { error: "Order not found" }, origin, origins);
  if (!order.marketing_consent) return json(202, { skipped: true }, origin, origins);

  if (eventName === "InitiateCheckout") {
    if (order.status !== "whatsapp") return json(409, { error: "Order status not eligible" }, origin, origins);
    if (eventId !== `initiate-checkout-${order.id}` || order.meta_initiate_checkout_event_id !== eventId) return json(409, { error: "Event ID mismatch" }, origin, origins);
    if (order.meta_initiate_checkout_sent_at) return json(200, { deduplicated: true }, origin, origins);
  } else {
    if (eventId !== `purchase-${order.id}`) return json(409, { error: "Event ID mismatch" }, origin, origins);
    if (order.status !== "completed" || !order.stock_deducted) return json(409, { error: "Sale not confirmed" }, origin, origins);
    if (order.meta_purchase_sent_at) return json(200, { deduplicated: true }, origin, origins);
  }

  const commercial = validateCommercialData(order);
  if (!commercial) return json(422, { error: "Invalid persisted order data" }, origin, origins);

  const { data: claimed, error: claimError } = await adminClient.rpc("claim_meta_conversion", { p_order_id: orderId, p_event_name: eventName, p_event_id: eventId });
  if (claimError) {
    logConversion({ orderId, eventName, phase: "claim", status: "error", errorCode: claimError.code });
    return json(500, { error: "Could not claim conversion" }, origin, origins);
  }
  if (claimed !== true) return json(202, { deduplicated: true }, origin, origins);

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website",
    ...(order.meta_event_source_url ? { event_source_url: order.meta_event_source_url } : {}),
    user_data: {
      ...(order.meta_fbp ? { fbp: order.meta_fbp } : {}),
      ...(order.meta_fbc ? { fbc: order.meta_fbc } : {}),
      ...(order.meta_client_user_agent ? { client_user_agent: order.meta_client_user_agent } : {}),
    },
    custom_data: {
      currency: "BRL",
      value: commercial.value,
      content_type: "product",
      content_ids: commercial.contents.map((item) => item.id),
      contents: commercial.contents,
      num_items: commercial.numItems,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), META_TIMEOUT_MS);
  let metaResponse: Response | null = null;
  let failure: {
  message: string;
  code?: string;
} = {
  message: "Conversion request failed",
};
  try {
    metaResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pixelId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${capiToken}` },
      body: JSON.stringify({ data: [event], ...(testEventCode ? { test_event_code: testEventCode } : {}) }),
      signal: controller.signal,
    });
    let metaBody: unknown = null;
    try { metaBody = await metaResponse.json(); } catch { /* A resposta pode não ser JSON. */ }
    if (!metaResponse.ok) failure = sanitizedMetaError(metaBody);
  } catch (error) {
    failure = { message: error instanceof DOMException && error.name === "AbortError" ? "Meta request timeout" : "Meta request failed", code: error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : undefined };
  } finally {
    clearTimeout(timeout);
  }

  const metaAccepted = Boolean(metaResponse?.ok);
  const { error: finishError } = await adminClient.rpc("finish_meta_conversion", {
    p_order_id: orderId,
    p_event_name: eventName,
    p_success: metaAccepted,
    p_error: metaAccepted ? null : failure.message,
  });
  if (finishError) {
    logConversion({ orderId, eventName, phase: "finish", status: "error", httpStatus: metaResponse?.status, errorCode: finishError.code });
    return json(500, { error: metaAccepted ? "Conversion accepted but state persistence failed" : "Conversion state persistence failed" }, origin, origins);
  }
  if (!metaAccepted) {
    logConversion({ orderId, eventName, phase: "send", status: "error", httpStatus: metaResponse?.status, errorCode: failure.code });
    return json(502, { error: "Conversion request failed" }, origin, origins);
  }
  return json(200, { sent: true }, origin, origins);
});
