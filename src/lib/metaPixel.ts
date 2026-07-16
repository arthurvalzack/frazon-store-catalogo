const META_PIXEL_SCRIPT_ID = "meta-pixel-script";
const MARKETING_CONSENT_KEY = "frazon_marketing_consent";
export const OPEN_COOKIE_PREFERENCES_EVENT = "frazon:open-cookie-preferences";

export const MARKETING_CONSENT_CHANGED_EVENT =
  "frazon:marketing-consent-changed";

export type MarketingConsent = "accepted" | "rejected" | null;

export interface MetaViewContentData {
  id: string | number;
  name: string;
  price: number;
  category?: string | null;
}

export interface MetaAddToCartData {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  category?: string | null;
}

export interface MetaCheckoutItemData {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
}

export interface MetaInitiateCheckoutData {
  eventId: string;
  items: MetaCheckoutItemData[];
}

type MetaPixelFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: MetaPixelFunction;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
  }
}

let initializedPixelId: string | null = null;
let lastTrackedPage: string | null = null;
let lastTrackedViewContentKey: string | null = null;

function getPixelId(): string | null {
  const pixelId = import.meta.env.VITE_META_PIXEL_ID?.trim();

  if (!pixelId) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Meta Pixel] VITE_META_PIXEL_ID não foi configurado."
      );
    }

    return null;
  }

  return pixelId;
}

export function getMarketingConsent(): MarketingConsent {
  try {
    const value = window.localStorage.getItem(
      MARKETING_CONSENT_KEY
    );

    if (value === "accepted" || value === "rejected") {
      return value;
    }

    return null;
  } catch {
    return null;
  }
}

function saveMarketingConsent(
  consent: Exclude<MarketingConsent, null>
): void {
  try {
    window.localStorage.setItem(
      MARKETING_CONSENT_KEY,
      consent
    );
  } catch {
    console.warn(
      "[Meta Pixel] Não foi possível salvar a preferência de cookies."
    );
  }
}

function createMetaPixelQueue(): void {
  if (window.fbq) {
    return;
  }

  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
      return;
    }

    fbq.queue.push(args);
  }) as MetaPixelFunction;

  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";

  window.fbq = fbq;
  window._fbq = fbq;
}

function loadMetaPixelScript(): void {
  if (document.getElementById(META_PIXEL_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement("script");

  script.id = META_PIXEL_SCRIPT_ID;
  script.async = true;
  script.src =
    "https://connect.facebook.net/en_US/fbevents.js";

  document.head.appendChild(script);
}

export function initializeMetaPixel(): boolean {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return false;
  }

  if (getMarketingConsent() !== "accepted") {
    return false;
  }

  const pixelId = getPixelId();

  if (!pixelId) {
    return false;
  }

  createMetaPixelQueue();
  loadMetaPixelScript();

  if (initializedPixelId !== pixelId) {
    window.fbq?.("init", pixelId);
    window.fbq?.("consent", "grant");

    initializedPixelId = pixelId;
  }

  return true;
}

export function acceptMarketingCookies(): void {
  saveMarketingConsent("accepted");

  lastTrackedPage = null;
  lastTrackedViewContentKey = null;

  initializeMetaPixel();
  window.dispatchEvent(new CustomEvent(MARKETING_CONSENT_CHANGED_EVENT));
}

export function rejectMarketingCookies(): void {
  saveMarketingConsent("rejected");

  window.fbq?.("consent", "revoke");

  lastTrackedPage = null;
  lastTrackedViewContentKey = null;
  window.dispatchEvent(new CustomEvent(MARKETING_CONSENT_CHANGED_EVENT));
}

export function openCookiePreferences(): void {
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_PREFERENCES_EVENT));
}

export function trackPageView(page: string): void {
  if (page.startsWith("/admin")) {
    return;
  }

  if (!initializeMetaPixel()) {
    return;
  }

  if (lastTrackedPage === page) {
    return;
  }

  window.fbq?.("track", "PageView");

  lastTrackedPage = page;

  /*
   * Permite registrar novamente o ViewContent quando
   * o visitante sai de um produto e retorna posteriormente.
   */
  lastTrackedViewContentKey = null;
}

export function trackViewContent(
  product: MetaViewContentData
): void {
  if (!initializeMetaPixel()) {
    return;
  }

  const contentId = String(product.id).trim();
  const contentName = product.name.trim();
  const value = Number(product.price);

  if (
    !contentId ||
    !contentName ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Meta Pixel] Dados inválidos para o evento ViewContent.",
        product
      );
    }

    return;
  }

  const currentPage =
    `${window.location.pathname}${window.location.search}`;

  const trackingKey = `${currentPage}:${contentId}`;

  /*
   * Evita duplicação por StrictMode, atualizações Realtime
   * ou renderizações adicionais do mesmo produto.
   */
  if (lastTrackedViewContentKey === trackingKey) {
    return;
  }

  const parameters: Record<string, unknown> = {
    content_ids: [contentId],
    content_name: contentName,
    content_type: "product",
    value,
    currency: "BRL",
  };

  const category = product.category?.trim();

  if (category) {
    parameters.content_category = category;
  }

  window.fbq?.("track", "ViewContent", parameters);

  lastTrackedViewContentKey = trackingKey;
}

export function trackAddToCart(
  product: MetaAddToCartData
): void {
  if (!initializeMetaPixel()) {
    return;
  }

  const contentId = String(product.id).trim();
  const contentName = product.name.trim();
  const itemPrice = Number(product.price);
  const quantity = Number(product.quantity);

  if (
    !contentId ||
    !contentName ||
    !Number.isFinite(itemPrice) ||
    itemPrice < 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Meta Pixel] Dados inválidos para o evento AddToCart.",
        product
      );
    }

    return;
  }

  const parameters: Record<string, unknown> = {
    content_ids: [contentId],
    content_name: contentName,
    content_type: "product",
    contents: [
      {
        id: contentId,
        quantity,
        item_price: itemPrice,
      },
    ],
    value: itemPrice * quantity,
    currency: "BRL",
  };

  const category = product.category?.trim();

  if (category) {
    parameters.content_category = category;
  }

  window.fbq?.("track", "AddToCart", parameters);
}

export function trackInitiateCheckout(
  checkout: MetaInitiateCheckoutData
): boolean {
  if (!initializeMetaPixel()) {
    return false;
  }

  const eventId = checkout.eventId.trim();

  if (!eventId || !Array.isArray(checkout.items) || !checkout.items.length) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Meta Pixel] Dados inválidos para InitiateCheckout.",
        checkout
      );
    }

    return false;
  }

  const normalizedItems = checkout.items.map((item) => ({
    id: String(item.id).trim(),
    name: item.name.trim(),
    price: Number(item.price),
    quantity: Number(item.quantity),
  }));

  const hasInvalidItem = normalizedItems.some(
    (item) =>
      !item.id ||
      !item.name ||
      !Number.isFinite(item.price) ||
      item.price <= 0 ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
  );

  if (hasInvalidItem) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Meta Pixel] Existem itens inválidos em InitiateCheckout.",
        normalizedItems
      );
    }

    return false;
  }

  const value = normalizedItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const totalQuantity = normalizedItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const parameters: Record<string, unknown> = {
    content_ids: normalizedItems.map((item) => item.id),
    content_type: "product",
    contents: normalizedItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      item_price: item.price,
    })),
    value: Number(value.toFixed(2)),
    currency: "BRL",
    num_items: totalQuantity,
  };

  window.fbq?.(
    "track",
    "InitiateCheckout",
    parameters,
    {
      eventID: eventId,
    }
  );

  return true;
}

export function resetTrackedPage(): void {
  lastTrackedPage = null;
  lastTrackedViewContentKey = null;
}

export interface MetaAttributionData {
  marketingConsent: boolean;
  fbp: string | null;
  fbc: string | null;
  eventSourceUrl: string | null;
  clientUserAgent: string | null;
}

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

export function getMetaAttribution(): MetaAttributionData {
  const allowed = getMarketingConsent() === "accepted";
  return {
    marketingConsent: allowed,
    fbp: allowed ? readCookie("_fbp") : null,
    fbc: allowed ? readCookie("_fbc") : null,
    eventSourceUrl: allowed ? window.location.href : null,
    clientUserAgent: allowed ? window.navigator.userAgent : null,
  };
}
