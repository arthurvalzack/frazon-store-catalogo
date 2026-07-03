import type { AdminSession, CartItem, Category, HomeBanner, Order, OrderItem, Product, ProductBadge, ProductColor, ProductImage, ProductVariant, SiteSettings } from '@/types';
import { INVENTORY_DEACTIVATE_WARNING, INVENTORY_SYNC_WARNING, deactivateInventoryProduct, syncInventoryProduct } from '@/lib/inventorySync';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);

const PRODUCT_CACHE_KEY = 'frazon_catalog_products_cache_v1';
const CATEGORY_CACHE_KEY = 'frazon_catalog_categories_cache_v1';
const SETTINGS_CACHE_KEY = 'frazon_site_settings_cache_v1';
const LEGACY_SETTINGS_CACHE_KEY = 'frazon_catalog_settings_cache_v2';
const ADMIN_SESSION_KEY = 'frazon_admin_session_v1';
const CART_KEY = 'frazon_cart_v1';

const DEFAULT_HERO = '';
const DEFAULT_CATEGORY = '';
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200">
  <rect width="900" height="1200" fill="#f5f0ea"/>
  <text x="50%" y="48%" text-anchor="middle" font-family="Arial" font-size="42" fill="#777">Frazon Store</text>
  <text x="50%" y="53%" text-anchor="middle" font-family="Arial" font-size="22" fill="#aaa">Imagem do produto</text>
</svg>`);

export const defaultSettings: SiteSettings = {
  storeName: 'Frazon Store',
  whatsappNumber: '5561998273587',
  heroEyebrow: 'Streetwear masculino',
  heroTitle: 'Estilo que imp\u00f5e',
  heroItalicTitle: 'presen\u00e7a',
  heroSubtitle: 'Pe\u00e7as masculinas selecionadas para quem busca conforto, atitude e presen\u00e7a no dia a dia.',
  heroImage: DEFAULT_HERO,
  heroImageMobile: '',
  heroImageDesktop: '',
  heroTitleLine1: 'VISTA SUA',
  heroTitleLine2: 'ESS\u00caNCIA',
  heroSubtitleLine1: 'ROUPAS PARA HOMENS',
  heroSubtitleLine2: 'QUE IMP\u00d5EM PRESEN\u00c7A',
  heroButtonText: 'EXPLORAR CAT\u00c1LOGO',
  heroTopbarText1: 'NOVIDADES EXCLUSIVAS',
  heroTopbarText2: 'PEDIDO DIRETO NO WHATSAPP',
  heroTopbarText3: 'ENVIO PARA TODO BRASIL',
  homeBanners: [],
  aboutEyebrow: 'Sobre a Frazon Store',
  aboutTitle: 'Streetwear com',
  aboutItalicWord: 'presença',
  aboutText: 'Peças masculinas selecionadas para quem valoriza caimento, identidade e praticidade. Escolha no catálogo e finalize direto pelo WhatsApp.',
  editorialEyebrow: 'Nova seleção',
  editorialTitle: 'Essenciais',
  editorialItalicTitle: 'urbanos',
  editorialText: 'Oversized, dry fit, moletom, corta vento e conjuntos para montar combinações fortes sem complicação.',
  editorialImage: DEFAULT_HERO,
  instagramUrl: '',
  email: '',
  address: 'Brasília, DF — Brasil',
  weekHours: 'Seg — Sex: 10h às 20h',
  saturdayHours: 'Sáb: 10h às 18h',
  footerNote: 'Atendimento rápido pelo WhatsApp.',
};

export const defaultCategories: Category[] = [
  { id: 'cat-oversized', name: 'Oversized', slug: 'oversized', imageUrl: DEFAULT_CATEGORY, isActive: true, sortOrder: 1 },
  { id: 'cat-camisetas', name: 'Camisetas', slug: 'camisetas', imageUrl: DEFAULT_CATEGORY, isActive: true, sortOrder: 2 },
  { id: 'cat-moletom', name: 'Moletom', slug: 'moletom', imageUrl: DEFAULT_CATEGORY, isActive: true, sortOrder: 3 },
  { id: 'cat-corta-vento', name: 'Corta Vento', slug: 'corta-vento', imageUrl: DEFAULT_CATEGORY, isActive: true, sortOrder: 4 },
  { id: 'cat-bermuda-cargo', name: 'Bermuda Cargo', slug: 'bermuda-cargo', imageUrl: DEFAULT_CATEGORY, isActive: true, sortOrder: 5 },
  { id: 'cat-dry-fit', name: 'Dry Fit', slug: 'dry-fit', imageUrl: DEFAULT_CATEGORY, isActive: true, sortOrder: 6 },
  { id: 'cat-conjuntos', name: 'Conjuntos', slug: 'conjuntos', imageUrl: DEFAULT_CATEGORY, isActive: true, sortOrder: 7 },
];

const demoProducts: Product[] = [
  {
    id: 'demo-oversized-preta',
    name: 'Camiseta Oversized Black Essential',
    slug: 'camiseta-oversized-black-essential',
    brand: 'Frazon Store',
    category: 'Oversized',
    categoryId: 'cat-oversized',
    description: 'Camiseta oversized masculina com caimento solto, algodão encorpado e visual minimalista para compor looks streetwear.',
    price: 119.9,
    originalPrice: 149.9,
    colors: [{ name: 'Preto', hex: '#111111' }, { name: 'Branco', hex: '#FAFAFA' }],
    sizes: ['P', 'M', 'G', 'GG'],
    variants: [
      { id: 'v1', color: { name: 'Preto', hex: '#111111' }, size: 'P', stock: 4 },
      { id: 'v2', color: { name: 'Preto', hex: '#111111' }, size: 'M', stock: 8 },
      { id: 'v3', color: { name: 'Preto', hex: '#111111' }, size: 'G', stock: 3 },
      { id: 'v4', color: { name: 'Branco', hex: '#FAFAFA' }, size: 'M', stock: 5 },
    ],
    images: [{ url: DEFAULT_HERO, color: '' }],
    badge: 'bestseller',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

let productsCache: Product[] = [];
let categoriesCache: Category[] = hasSupabaseConfig() ? [] : defaultCategories;
let settingsCache: SiteSettings = normalizeSettingsObject(readStorage<SiteSettings>(
  SETTINGS_CACHE_KEY,
  readStorage<SiteSettings>(LEGACY_SETTINGS_CACHE_KEY, defaultSettings),
));
let inventorySyncWarning = '';
let productsRealtimeSocket: WebSocket | null = null;
let productsRealtimeHeartbeat: number | undefined;
let productsRealtimePoll: number | undefined;
let productsRealtimeJoinTimeout: number | undefined;
let productsRealtimeRef = 1;
let productsRealtimeSubscribers = new Set<(products: Product[]) => void>();
let productsRealtimeVisibilityHandler: (() => void) | null = null;
let productsRealtimeReloading = false;
let productsRealtimeFallbackEnabled = false;
let adminSessionCache: AdminSession | null = null;

type ProductRealtimePayload = {
  eventType?: string;
  type?: string;
  status?: string;
  new?: ProductRow | null;
  old?: Partial<ProductRow> | null;
  data?: {
    eventType?: string;
    type?: string;
    new?: ProductRow | null;
    old?: Partial<ProductRow> | null;
  };
};

type ProductsRealtimeStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

function hasSupabaseConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache é conforto, não fonte da verdade. Se o navegador recusar, seguimos sem quebrar o site.
  }
}

function normalizeSettingsObject(settings: Partial<SiteSettings> | SiteSettings): SiteSettings {
  return { ...defaultSettings, ...settings, homeBanners: normalizeHomeBanners(settings.homeBanners) };
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `item-${Date.now()}`;
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(value) ? value : 0);
}

export function normalizePixDiscountPercent(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

export function formatPixDiscountPercent(value: unknown): string {
  const discount = normalizePixDiscountPercent(value);
  if (!discount) return '';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(discount);
}

export function formatPixDiscountBadge(value: unknown): string {
  const percent = formatPixDiscountPercent(value);
  return percent ? `-${percent}% PIX` : '';
}

export function normalizeWhatsapp(number: string): string {
  return number.replace(/\D/g, '');
}

export function fallbackImage(src?: string): string {
  return src && src.trim() ? src : PLACEHOLDER_IMAGE;
}

function authHeader(token?: string): string {
  return `Bearer ${token || SUPABASE_ANON_KEY}`;
}

function getSession(): AdminSession | null {
  clearLegacyAdminSessionStorage();
  if (!adminSessionCache || !adminSessionCache.accessToken || Date.now() > adminSessionCache.expiresAt) {
    adminSessionCache = null;
    return null;
  }
  return adminSessionCache;
}

export function getAdminSession(): AdminSession | null {
  return getSession();
}

export function isSupabaseConfigured(): boolean {
  return hasSupabaseConfig();
}

export function consumeInventorySyncWarning(): string {
  const warning = inventorySyncWarning;
  inventorySyncWarning = '';
  return warning;
}

async function supabaseFetch<T>(path: string, options: RequestInit = {}, admin = false): Promise<T> {
  if (!hasSupabaseConfig()) throw new Error('Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  const session = admin ? getSession() : null;
  if (admin && !session) throw new Error('Sessão expirada. Faça login novamente.');

  const headers = new Headers(options.headers);
  headers.set('apikey', SUPABASE_ANON_KEY);
  headers.set('Authorization', authHeader(session?.accessToken));
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(readableSupabaseError(details) || `Erro Supabase ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function readableSupabaseError(details: string): string {
  if (!details) return '';
  try {
    const parsed = JSON.parse(details) as { message?: string; hint?: string; details?: string };
    return [parsed.message, parsed.hint || parsed.details].filter(Boolean).join(' ');
  } catch {
    return details;
  }
}

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  category: string | null;
  category_id: string | null;
  description: string | null;
  price: number | string;
  original_price: number | string | null;
  pix_discount_percent?: number | string | null;
  colors: ProductColor[] | null;
  sizes: string[] | null;
  variants: ProductVariant[] | null;
  images: unknown[] | null;
  badge: ProductBadge | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
};

type SettingsRow = {
  store_name: string | null;
  whatsapp_number: string | null;
  hero_eyebrow: string | null;
  hero_title: string | null;
  hero_italic_title: string | null;
  hero_subtitle: string | null;
  hero_image: string | null;
  hero_image_mobile?: string | null;
  hero_image_desktop?: string | null;
  hero_title_line_1?: string | null;
  hero_title_line_2?: string | null;
  hero_subtitle_line_1?: string | null;
  hero_subtitle_line_2?: string | null;
  hero_button_text?: string | null;
  hero_topbar_text_1?: string | null;
  hero_topbar_text_2?: string | null;
  hero_topbar_text_3?: string | null;
  home_banners?: HomeBanner[] | null;
  about_eyebrow: string | null;
  about_title: string | null;
  about_italic_word: string | null;
  about_text: string | null;
  editorial_eyebrow: string | null;
  editorial_title: string | null;
  editorial_italic_title: string | null;
  editorial_text: string | null;
  editorial_image: string | null;
  instagram_url: string | null;
  email: string | null;
  address: string | null;
  week_hours: string | null;
  saturday_hours: string | null;
  footer_note: string | null;
};

type OrderRow = {
  id: string;
  items: OrderItem[] | null;
  subtotal: number | string | null;
  customer_name?: string | null;
  customer_whatsapp?: string | null;
  whatsapp_message: string | null;
  status: Order['status'] | null;
  stock_deducted?: boolean | null;
  completed_at?: string | null;
  created_at: string | null;
};

function rowToProduct(row: ProductRow): Product {
  const variants = Array.isArray(row.variants) ? row.variants : [];
  const colors = Array.isArray(row.colors) && row.colors.length > 0
    ? row.colors
    : uniqueColorsFromVariants(variants);
  const sizes = Array.isArray(row.sizes) && row.sizes.length > 0
    ? row.sizes
    : uniqueSizesFromVariants(variants);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brand: row.brand || defaultSettings.storeName,
    category: row.category || 'Sem categoria',
    categoryId: row.category_id || undefined,
    description: row.description || '',
    price: Number(row.price) || 0,
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    pixDiscountPercent: normalizePixDiscountPercent(row.pix_discount_percent),
    colors,
    sizes,
    variants,
    images: normalizeProductImages(row.images),
    badge: row.badge || undefined,
    isActive: row.is_active !== false,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined,
  };
}

function productToRow(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> | Partial<Product>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (product.name !== undefined) row.name = product.name.trim();
  if (product.slug !== undefined) row.slug = product.slug;
  if (product.brand !== undefined) row.brand = product.brand.trim();
  if (product.category !== undefined) row.category = product.category;
  if (product.categoryId !== undefined) row.category_id = product.categoryId || null;
  if (product.description !== undefined) row.description = product.description;
  if (product.price !== undefined) row.price = Number(product.price) || 0;
  if (product.originalPrice !== undefined) row.original_price = product.originalPrice ? Number(product.originalPrice) : null;
  if (product.pixDiscountPercent !== undefined) row.pix_discount_percent = normalizePixDiscountPercent(product.pixDiscountPercent) ?? null;
  if (product.colors !== undefined) row.colors = product.colors;
  if (product.sizes !== undefined) row.sizes = product.sizes;
  if (product.variants !== undefined) row.variants = sanitizeVariants(product.variants);
  if (product.images !== undefined) row.images = normalizeProductImages(product.images).slice(0, 6);
  if (product.badge !== undefined) row.badge = product.badge || null;
  if (product.isActive !== undefined) row.is_active = product.isActive;
  row.updated_at = new Date().toISOString();
  return row;
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.image_url || DEFAULT_CATEGORY,
    isActive: row.is_active !== false,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at || undefined,
  };
}

function categoryToRow(category: Partial<Category>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (category.name !== undefined) row.name = category.name.trim();
  if (category.slug !== undefined) row.slug = category.slug;
  if (category.imageUrl !== undefined) row.image_url = sanitizeStoredImageUrl(category.imageUrl) || null;
  if (category.isActive !== undefined) row.is_active = category.isActive;
  if (category.sortOrder !== undefined) row.sort_order = Number(category.sortOrder) || 0;
  row.updated_at = new Date().toISOString();
  return row;
}

function normalizeHomeBanners(value: unknown): HomeBanner[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 4)
    .map((banner, index) => {
      const item = banner as Partial<HomeBanner>;
      return {
        id: String(item.id || `banner_${index + 1}`),
        mobile: sanitizeStoredImageUrl(item.mobile),
        desktop: sanitizeStoredImageUrl(item.desktop),
        link: sanitizeStoredBannerLink(item.link),
      };
    });
}

function sanitizeStoredImageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!url) return '';
  const lower = url.slice(0, 32).toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:') || lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return '';
  if (url.length > 2048) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) return url;
  return '';
}

function sanitizeStoredBannerLink(value: unknown): string {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!url) return '';
  const lower = url.slice(0, 32).toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:') || lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return '';
  if (url.length > 2048) return '';
  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) return url;
  return '';
}

function normalizeProductImages(value: unknown): ProductImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 6)
    .map(item => {
      if (typeof item === 'string') return { url: item.trim(), color: '' };
      if (item && typeof item === 'object') {
        const image = item as Partial<ProductImage>;
        return {
          url: typeof image.url === 'string' ? image.url.trim() : '',
          color: typeof image.color === 'string' ? image.color.trim() : '',
        };
      }
      return { url: '', color: '' };
    })
    .map(image => ({ ...image, url: sanitizeStoredImageUrl(image.url) }))
    .filter(image => image.url);
}

function normalizeColorName(value: string): string {
  return value.trim().toLowerCase();
}

export function getProductImageUrl(image?: ProductImage): string {
  return image?.url || '';
}

export function findProductImageIndexByColor(product: Product, color: string): number {
  const target = normalizeColorName(color);
  if (!target) return -1;
  return product.images.findIndex(image => normalizeColorName(image.color || '') === target);
}

export function getProductImageForColor(product: Product, color: string): ProductImage | undefined {
  const index = findProductImageIndexByColor(product, color);
  return index >= 0 ? product.images[index] : product.images[0];
}

function rowToSettings(row?: SettingsRow): SiteSettings {
  if (!row) return defaultSettings;
  return {
    storeName: row.store_name || defaultSettings.storeName,
    whatsappNumber: row.whatsapp_number || defaultSettings.whatsappNumber,
    heroEyebrow: row.hero_eyebrow || defaultSettings.heroEyebrow,
    heroTitle: row.hero_title || defaultSettings.heroTitle,
    heroItalicTitle: row.hero_italic_title || defaultSettings.heroItalicTitle,
    heroSubtitle: row.hero_subtitle || defaultSettings.heroSubtitle,
    heroImage: sanitizeStoredImageUrl(row.hero_image),
    heroImageMobile: sanitizeStoredImageUrl(row.hero_image_mobile) || defaultSettings.heroImageMobile,
    heroImageDesktop: sanitizeStoredImageUrl(row.hero_image_desktop) || defaultSettings.heroImageDesktop,
    heroTitleLine1: row.hero_title_line_1 || defaultSettings.heroTitleLine1,
    heroTitleLine2: row.hero_title_line_2 || defaultSettings.heroTitleLine2,
    heroSubtitleLine1: row.hero_subtitle_line_1 || defaultSettings.heroSubtitleLine1,
    heroSubtitleLine2: row.hero_subtitle_line_2 || defaultSettings.heroSubtitleLine2,
    heroButtonText: row.hero_button_text || defaultSettings.heroButtonText,
    heroTopbarText1: row.hero_topbar_text_1 || defaultSettings.heroTopbarText1,
    heroTopbarText2: row.hero_topbar_text_2 || defaultSettings.heroTopbarText2,
    heroTopbarText3: row.hero_topbar_text_3 || defaultSettings.heroTopbarText3,
    homeBanners: normalizeHomeBanners(row.home_banners),
    aboutEyebrow: row.about_eyebrow || defaultSettings.aboutEyebrow,
    aboutTitle: row.about_title || defaultSettings.aboutTitle,
    aboutItalicWord: row.about_italic_word || defaultSettings.aboutItalicWord,
    aboutText: row.about_text || defaultSettings.aboutText,
    editorialEyebrow: row.editorial_eyebrow || defaultSettings.editorialEyebrow,
    editorialTitle: row.editorial_title || defaultSettings.editorialTitle,
    editorialItalicTitle: row.editorial_italic_title || defaultSettings.editorialItalicTitle,
    editorialText: row.editorial_text || defaultSettings.editorialText,
    editorialImage: sanitizeStoredImageUrl(row.editorial_image),
    instagramUrl: sanitizeStoredBannerLink(row.instagram_url),
    email: row.email || '',
    address: row.address || defaultSettings.address,
    weekHours: row.week_hours || defaultSettings.weekHours,
    saturdayHours: row.saturday_hours || defaultSettings.saturdayHours,
    footerNote: row.footer_note || defaultSettings.footerNote,
  };
}

function settingsToRow(settings: SiteSettings): Record<string, unknown> {
  return {
    id: 'main',
    store_name: settings.storeName,
    whatsapp_number: normalizeWhatsapp(settings.whatsappNumber),
    hero_eyebrow: settings.heroEyebrow,
    hero_title: settings.heroTitle,
    hero_italic_title: settings.heroItalicTitle,
    hero_subtitle: settings.heroSubtitle,
    hero_image: sanitizeStoredImageUrl(settings.heroImage),
    hero_image_mobile: sanitizeStoredImageUrl(settings.heroImageMobile),
    hero_image_desktop: sanitizeStoredImageUrl(settings.heroImageDesktop),
    hero_title_line_1: settings.heroTitleLine1,
    hero_title_line_2: settings.heroTitleLine2,
    hero_subtitle_line_1: settings.heroSubtitleLine1,
    hero_subtitle_line_2: settings.heroSubtitleLine2,
    hero_button_text: settings.heroButtonText,
    hero_topbar_text_1: settings.heroTopbarText1,
    hero_topbar_text_2: settings.heroTopbarText2,
    hero_topbar_text_3: settings.heroTopbarText3,
    home_banners: normalizeHomeBanners(settings.homeBanners),
    about_eyebrow: settings.aboutEyebrow,
    about_title: settings.aboutTitle,
    about_italic_word: settings.aboutItalicWord,
    about_text: settings.aboutText,
    editorial_eyebrow: settings.editorialEyebrow,
    editorial_title: settings.editorialTitle,
    editorial_italic_title: settings.editorialItalicTitle,
    editorial_text: settings.editorialText,
    editorial_image: sanitizeStoredImageUrl(settings.editorialImage),
    instagram_url: sanitizeStoredBannerLink(settings.instagramUrl),
    email: settings.email,
    address: settings.address,
    week_hours: settings.weekHours,
    saturday_hours: settings.saturdayHours,
    footer_note: settings.footerNote,
    updated_at: new Date().toISOString(),
  };
}

function uniqueColorsFromVariants(variants: ProductVariant[]): ProductColor[] {
  const map = new Map<string, ProductColor>();
  variants.forEach(variant => {
    if (variant.stock > 0 && variant.color?.name) map.set(variant.color.name, variant.color);
  });
  return Array.from(map.values());
}

function uniqueSizesFromVariants(variants: ProductVariant[]): string[] {
  return Array.from(new Set(variants.filter(variant => variant.stock > 0).map(variant => variant.size).filter(Boolean)));
}

function sanitizeVariants(variants: ProductVariant[]): ProductVariant[] {
  return variants
    .filter(variant => variant.color?.name && variant.size)
    .map(variant => ({
      id: variant.id || crypto.randomUUID(),
      color: { name: variant.color.name.trim(), hex: variant.color.hex || '#111111' },
      size: variant.size.trim(),
      stock: Math.max(0, Number(variant.stock) || 0),
    }));
}

export function getVariantStock(product: Product, color: string, size: string): number {
  const variant = product.variants.find(item => item.color.name === color && item.size === size);
  if (variant) return Math.max(0, Number(variant.stock) || 0);
  return product.isActive ? 999 : 0;
}

export function getTotalStock(product: Product): number {
  if (!product.variants.length) return product.isActive ? 999 : 0;
  return product.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock) || 0), 0);
}

export function getAvailableColors(product: Product): ProductColor[] {
  if (!product.variants.length) return product.colors;
  return uniqueColorsFromVariants(product.variants);
}

export function getAvailableSizes(product: Product, color?: string): string[] {
  if (!product.variants.length) return product.sizes;
  const variants = color ? product.variants.filter(variant => variant.color.name === color) : product.variants;
  return uniqueSizesFromVariants(variants);
}

export function isProductAvailable(product: Product): boolean {
  return product.isActive && getTotalStock(product) > 0;
}

export async function loadCatalogData(force = false): Promise<{ products: Product[]; categories: Category[]; settings: SiteSettings }> {
  if (!force && productsCache.length && categoriesCache.length) {
    return { products: productsCache, categories: categoriesCache, settings: settingsCache };
  }

  if (!hasSupabaseConfig()) {
    productsCache = readStorage<Product[]>(PRODUCT_CACHE_KEY, demoProducts);
    categoriesCache = readStorage<Category[]>(CATEGORY_CACHE_KEY, defaultCategories);
    settingsCache = normalizeSettingsObject(readStorage<SiteSettings>(SETTINGS_CACHE_KEY, defaultSettings));
    return { products: productsCache, categories: categoriesCache, settings: settingsCache };
  }

  try {
    const adminRead = Boolean(getSession());
    const [products, categoryRows, settingsRows] = await Promise.all([
      loadProducts(true),
      supabaseFetch<CategoryRow[]>('/rest/v1/categories?select=*&order=sort_order.asc', {}, adminRead),
      supabaseFetch<SettingsRow[]>('/rest/v1/site_settings?select=*&id=eq.main&limit=1', {}, adminRead),
    ]);
    productsCache = products;
    categoriesCache = categoryRows.map(rowToCategory);
    settingsCache = rowToSettings(settingsRows[0]);
    writeStorage(CATEGORY_CACHE_KEY, categoriesCache);
    writeStorage(SETTINGS_CACHE_KEY, settingsCache);
  } catch (error) {
    console.error('[FRAZON CATALOG LOAD ERROR]', error);
    productsCache = readStorage<Product[]>(PRODUCT_CACHE_KEY, []);
    categoriesCache = readStorage<Category[]>(CATEGORY_CACHE_KEY, []);
    settingsCache = normalizeSettingsObject(readStorage<SiteSettings>(SETTINGS_CACHE_KEY, defaultSettings));
  }

  return { products: productsCache, categories: categoriesCache, settings: settingsCache };
}

export async function loadProducts(force = false): Promise<Product[]> {
  if (!force && productsCache.length) return productsCache;
  if (!hasSupabaseConfig()) {
    productsCache = readStorage<Product[]>(PRODUCT_CACHE_KEY, demoProducts);
    return productsCache;
  }

  const adminRead = Boolean(getSession());
  const rows = await supabaseFetch<ProductRow[]>('/rest/v1/products?select=*&order=created_at.desc', {}, adminRead);
  productsCache = rows.map(rowToProduct);
  writeStorage(PRODUCT_CACHE_KEY, productsCache);
  return productsCache;
}

export function getProducts(): Product[] {
  return productsCache.length ? productsCache : readStorage<Product[]>(PRODUCT_CACHE_KEY, hasSupabaseConfig() ? [] : demoProducts);
}

export function getActiveProducts(): Product[] {
  return getProducts().filter(isProductAvailable);
}

export function getProductById(id: string): Product | undefined {
  return getProducts().find(product => product.id === id);
}

export function subscribeToProductsChanges(onProductsChange: (products: Product[]) => void): () => void {
  if (!hasSupabaseConfig()) return () => undefined;

  productsRealtimeSubscribers.add(onProductsChange);
  startProductsRealtime();

  return () => {
    productsRealtimeSubscribers.delete(onProductsChange);
    if (productsRealtimeSubscribers.size === 0) stopProductsRealtime();
  };
}

export function subscribeToCatalogDataChanges(
  onCatalogChange: (products: Product[], categories: Category[], settings: SiteSettings) => void,
): () => void {
  return subscribeToTableChanges('catalog', ['products', 'categories', 'site_settings'], async () => {
    const data = await loadCatalogData(true);
    onCatalogChange(data.products, data.categories, data.settings);
  });
}

export function subscribeToOrdersChanges(onOrdersChange: (orders: Order[]) => void): () => void {
  if (!getSession()) return () => undefined;

  return subscribeToTableChanges('orders', ['orders'], async () => {
    onOrdersChange(await listOrders());
  });
}

function subscribeToTableChanges(name: string, tables: string[], reload: () => Promise<void>): () => void {
  if (!hasSupabaseConfig()) return () => undefined;

  let socket: WebSocket | null = null;
  let heartbeat: number | undefined;
  let poll: number | undefined;
  let joinTimeout: number | undefined;
  let ref = 1;
  let stopped = false;
  let fallbackEnabled = false;
  let reloading = false;

  const clearHeartbeat = () => {
    if (!heartbeat) return;
    window.clearInterval(heartbeat);
    heartbeat = undefined;
  };

  const clearJoinTimeout = () => {
    if (!joinTimeout) return;
    window.clearTimeout(joinTimeout);
    joinTimeout = undefined;
  };

  const runReload = async () => {
    if (stopped || reloading) return;
    reloading = true;
    try {
      await reload();
    } catch (error) {
      console.error(`[FRAZON ${name.toUpperCase()} REALTIME REFRESH ERROR]`, error);
      enableFallbackPolling();
    } finally {
      reloading = false;
    }
  };

  const enableFallbackPolling = () => {
    if (stopped || fallbackEnabled || poll) return;
    fallbackEnabled = true;
    if (import.meta.env.DEV) console.info(`[Realtime ${name}] fallback polling enabled`);
    void runReload();
    poll = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void runReload();
    }, 5_000);
  };

  const logStatus = (status: string) => {
    if (import.meta.env.DEV) console.info(`[Realtime ${name}] status: ${status}`);
  };

  if (typeof WebSocket === 'undefined') {
    enableFallbackPolling();
    return () => {
      stopped = true;
      if (poll) window.clearInterval(poll);
    };
  }

  const topic = `realtime:public:${name}`;
  const realtimeUrl = `${SUPABASE_URL.replace(/^http/i, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=1.0.0`;
  socket = new WebSocket(realtimeUrl);

  const send = (event: string, payload: Record<string, unknown>, targetTopic = topic) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ topic: targetTopic, event, payload, ref: String(ref++) }));
  };

  socket.addEventListener('open', () => {
    const session = getSession();
    send('phx_join', {
      config: {
        broadcast: { self: false },
        presence: { key: '' },
        postgres_changes: tables.map(table => ({ event: '*', schema: 'public', table })),
      },
      access_token: session?.accessToken || SUPABASE_ANON_KEY,
    });
    joinTimeout = window.setTimeout(() => {
      logStatus('TIMED_OUT');
      enableFallbackPolling();
    }, 10_000);
    heartbeat = window.setInterval(() => send('heartbeat', {}, 'phoenix'), 30_000);
  });

  socket.addEventListener('message', event => {
    try {
      const message = JSON.parse(event.data as string) as { event?: string; payload?: { status?: string }; ref?: string };
      if (message.event === 'phx_reply' && message.ref === '1') {
        clearJoinTimeout();
        const status = message.payload?.status === 'ok' ? 'SUBSCRIBED' : 'CHANNEL_ERROR';
        logStatus(status);
        if (status !== 'SUBSCRIBED') enableFallbackPolling();
        return;
      }

      if (message.event === 'postgres_changes') void runReload();
    } catch (error) {
      console.error(`[FRAZON ${name.toUpperCase()} REALTIME ERROR]`, error);
      enableFallbackPolling();
    }
  });

  socket.addEventListener('error', () => {
    logStatus('CHANNEL_ERROR');
    enableFallbackPolling();
  });

  socket.addEventListener('close', () => {
    clearHeartbeat();
    clearJoinTimeout();
    if (!stopped) {
      logStatus('CLOSED');
      enableFallbackPolling();
    }
  });

  return () => {
    stopped = true;
    clearHeartbeat();
    clearJoinTimeout();
    if (poll) window.clearInterval(poll);
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) socket.close();
    socket = null;
  };
}

function startProductsRealtime(): void {
  if (productsRealtimeSocket || productsRealtimePoll) return;

  if (import.meta.env.DEV) console.info('[Realtime products] subscribing');
  productsRealtimeFallbackEnabled = false;
  productsRealtimeRef = 1;

  if (typeof WebSocket === 'undefined') {
    enableProductsFallbackPolling();
    return;
  }

  const realtimeUrl = `${SUPABASE_URL.replace(/^http/i, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=1.0.0`;
  const topic = 'realtime:public:products';
  const socket = new WebSocket(realtimeUrl);
  productsRealtimeSocket = socket;

  const send = (event: string, payload: Record<string, unknown>, targetTopic = topic) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ topic: targetTopic, event, payload, ref: String(productsRealtimeRef++) }));
  };

  socket.addEventListener('open', () => {
    const session = getSession();
    send('phx_join', {
      config: {
        broadcast: { self: false },
        presence: { key: '' },
        postgres_changes: [{ event: '*', schema: 'public', table: 'products' }],
      },
      access_token: session?.accessToken || SUPABASE_ANON_KEY,
    });
    productsRealtimeJoinTimeout = window.setTimeout(() => {
      logProductsRealtimeStatus('TIMED_OUT');
      enableProductsFallbackPolling();
    }, 10_000);
    productsRealtimeHeartbeat = window.setInterval(() => send('heartbeat', {}, 'phoenix'), 30_000);
  });

  socket.addEventListener('message', event => {
    try {
      const message = JSON.parse(event.data as string) as { event?: string; payload?: ProductRealtimePayload; ref?: string };
      if (message.event === 'phx_reply' && message.ref === '1') {
        clearProductsJoinTimeout();
        const status = message.payload?.status === 'ok' ? 'SUBSCRIBED' : 'CHANNEL_ERROR';
        logProductsRealtimeStatus(status);
        if (status !== 'SUBSCRIBED') enableProductsFallbackPolling();
        return;
      }

      if (message.event !== 'postgres_changes') return;
      if (import.meta.env.DEV) console.info('[Realtime products] payload:', message.payload);
      void reloadProductsForSubscribers();
    } catch (error) {
      console.error('[FRAZON PRODUCTS REALTIME ERROR]', error);
      enableProductsFallbackPolling();
    }
  });

  socket.addEventListener('error', () => {
    logProductsRealtimeStatus('CHANNEL_ERROR');
    enableProductsFallbackPolling();
  });

  socket.addEventListener('close', () => {
    clearProductsHeartbeat();
    clearProductsJoinTimeout();
    if (productsRealtimeSocket === socket) productsRealtimeSocket = null;
    if (productsRealtimeSubscribers.size > 0) {
      logProductsRealtimeStatus('CLOSED');
      enableProductsFallbackPolling();
    }
  });
}

function enableProductsFallbackPolling(): void {
  if (productsRealtimeFallbackEnabled || productsRealtimePoll) return;
  productsRealtimeFallbackEnabled = true;
  if (import.meta.env.DEV) console.info('[Realtime products] fallback polling enabled');
  void reloadProductsForSubscribers();

  productsRealtimePoll = window.setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    void reloadProductsForSubscribers();
  }, 5_000);

  if (typeof document !== 'undefined' && !productsRealtimeVisibilityHandler) {
    productsRealtimeVisibilityHandler = () => {
      if (!document.hidden) void reloadProductsForSubscribers();
    };
    document.addEventListener('visibilitychange', productsRealtimeVisibilityHandler);
  }
}

async function reloadProductsForSubscribers(): Promise<void> {
  if (productsRealtimeReloading || productsRealtimeSubscribers.size === 0) return;
  productsRealtimeReloading = true;
  try {
    const products = await loadProducts(true);
    productsRealtimeSubscribers.forEach(subscriber => subscriber(products));
  } catch (error) {
    console.error('[FRAZON PRODUCTS REALTIME REFRESH ERROR]', error);
    enableProductsFallbackPolling();
  } finally {
    productsRealtimeReloading = false;
  }
}

function stopProductsRealtime(): void {
  clearProductsHeartbeat();
  clearProductsJoinTimeout();

  if (productsRealtimePoll) {
    window.clearInterval(productsRealtimePoll);
    productsRealtimePoll = undefined;
  }

  if (typeof document !== 'undefined' && productsRealtimeVisibilityHandler) {
    document.removeEventListener('visibilitychange', productsRealtimeVisibilityHandler);
    productsRealtimeVisibilityHandler = null;
  }

  if (productsRealtimeSocket) {
    const socket = productsRealtimeSocket;
    productsRealtimeSocket = null;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
  }

  productsRealtimeFallbackEnabled = false;
}

function clearProductsHeartbeat(): void {
  if (!productsRealtimeHeartbeat) return;
  window.clearInterval(productsRealtimeHeartbeat);
  productsRealtimeHeartbeat = undefined;
}

function clearProductsJoinTimeout(): void {
  if (!productsRealtimeJoinTimeout) return;
  window.clearTimeout(productsRealtimeJoinTimeout);
  productsRealtimeJoinTimeout = undefined;
}

function logProductsRealtimeStatus(status: ProductsRealtimeStatus): void {
  if (import.meta.env.DEV) console.info(`[Realtime products] status: ${status}`);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  if (!productsCache.length) await loadCatalogData();
  return getProducts().find(product => product.slug === slug && isProductAvailable(product));
}

export function getCategories(): Category[] {
  return categoriesCache.length ? categoriesCache : readStorage<Category[]>(CATEGORY_CACHE_KEY, hasSupabaseConfig() ? [] : defaultCategories);
}

export function getActiveCategories(): Category[] {
  return getCategories().filter(category => category.isActive);
}

export function getSettings(): SiteSettings {
  settingsCache = normalizeSettingsObject(readStorage<SiteSettings>(
    SETTINGS_CACHE_KEY,
    readStorage<SiteSettings>(LEGACY_SETTINGS_CACHE_KEY, settingsCache || defaultSettings),
  ));
  return settingsCache;
}

export async function loginAdmin(email: string, password: string): Promise<AdminSession> {
  if (!hasSupabaseConfig()) throw new Error('Configure o Supabase antes de usar o admin seguro.');
  const requestedEmail = email.trim().toLowerCase();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: requestedEmail, password }),
  });

  if (!response.ok) throw new Error('E-mail ou senha inválidos.');
  const data = await response.json() as { access_token: string; refresh_token?: string; expires_in: number; user?: { email?: string } };
  const authenticatedEmail = (data.user?.email || requestedEmail).trim().toLowerCase();
  if (!isAllowedAdminEmail(authenticatedEmail)) {
    throw new Error('Este e-mail nÃ£o estÃ¡ autorizado a acessar o painel administrativo.');
  }
  const session: AdminSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
    email: authenticatedEmail,
  };
  adminSessionCache = session;
  clearLegacyAdminSessionStorage();
  return session;
}

function isAllowedAdminEmail(email: string): boolean {
  if (!ADMIN_EMAILS.length) return true;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export function logoutAdmin(): void {
  adminSessionCache = null;
  clearLegacyAdminSessionStorage();
}

function clearLegacyAdminSessionStorage(): void {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // Se o navegador bloquear storage, a sessao em memoria continua sendo a fonte.
  }
}

export async function createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const rows = await supabaseFetch<ProductRow[]>('/rest/v1/products?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(productToRow(product)),
  }, true);
  const created = rowToProduct(rows[0]);
  await loadCatalogData(true);
  await trySyncInventoryProduct(created);
  return created;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  const rows = await supabaseFetch<ProductRow[]>(`/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(productToRow(data)),
  }, true);
  const updated = rowToProduct(rows[0]);
  await loadCatalogData(true);
  await trySyncInventoryProduct(updated);
  return updated;
}

export async function deleteProduct(id: string): Promise<void> {
  await supabaseFetch<void>(`/rest/v1/products?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }, true);
  productsCache = productsCache.filter(product => product.id !== id);
  writeStorage(PRODUCT_CACHE_KEY, productsCache);
  await tryDeactivateInventoryProduct(id);
}

async function trySyncInventoryProduct(product: Product): Promise<void> {
  inventorySyncWarning = '';
  const session = getSession();
  if (!session?.accessToken) {
    inventorySyncWarning = INVENTORY_SYNC_WARNING;
    return;
  }

  try {
    await syncInventoryProduct(product, session.accessToken);
  } catch (error) {
    console.error('[INVENTORY PRODUCT SYNC ERROR]', error);
    const details = error instanceof Error ? error.message : '';
    inventorySyncWarning = details ? `${INVENTORY_SYNC_WARNING} ${details}` : INVENTORY_SYNC_WARNING;
  }
}

async function tryDeactivateInventoryProduct(productId: string): Promise<void> {
  inventorySyncWarning = '';
  const session = getSession();
  if (!session?.accessToken) {
    inventorySyncWarning = INVENTORY_DEACTIVATE_WARNING;
    return;
  }

  try {
    await deactivateInventoryProduct(productId, session.accessToken);
  } catch (error) {
    console.error('[INVENTORY PRODUCT DEACTIVATE ERROR]', error);
    const details = error instanceof Error ? error.message : '';
    inventorySyncWarning = details ? `${INVENTORY_DEACTIVATE_WARNING} ${details}` : INVENTORY_DEACTIVATE_WARNING;
  }
}

export async function createCategory(category: Omit<Category, 'id' | 'createdAt'>): Promise<Category> {
  const rows = await supabaseFetch<CategoryRow[]>('/rest/v1/categories?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(categoryToRow(category)),
  }, true);
  const created = rowToCategory(rows[0]);
  await loadCatalogData(true);
  return created;
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  const rows = await supabaseFetch<CategoryRow[]>(`/rest/v1/categories?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(categoryToRow(data)),
  }, true);
  const updated = rowToCategory(rows[0]);
  await loadCatalogData(true);
  return updated;
}

export async function deleteCategory(id: string): Promise<void> {
  const inUse = getProducts().some(product => product.categoryId === id);
  if (inUse) throw new Error('Não exclua uma categoria com produtos vinculados. Desative ou mova os produtos primeiro.');
  await supabaseFetch<void>(`/rest/v1/categories?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }, true);
  await loadCatalogData(true);
}

export async function saveSettings(settings: SiteSettings): Promise<SiteSettings> {
  const rows = await supabaseFetch<SettingsRow[]>('/rest/v1/site_settings?on_conflict=id&select=*', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(settingsToRow(settings)),
  }, true);
  settingsCache = rowToSettings(rows[0]);
  writeStorage(SETTINGS_CACHE_KEY, settingsCache);
  return settingsCache;
}

export async function listOrders(): Promise<Order[]> {
  const rows = await supabaseFetch<OrderRow[]>('/rest/v1/orders?select=*&order=created_at.desc&limit=100', {}, true);
  return rows.map(row => ({
    id: row.id,
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: Number(row.subtotal) || 0,
    customerName: row.customer_name || undefined,
    customerWhatsapp: row.customer_whatsapp || undefined,
    whatsappMessage: row.whatsapp_message || '',
    status: row.status || 'whatsapp',
    stockDeducted: row.stock_deducted === true,
    completedAt: row.completed_at || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  }));
}

export async function confirmOrderSale(orderId: string): Promise<void> {
  await supabaseFetch<void>('/rest/v1/rpc/confirm_order_sale', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId }),
  }, true);
  await loadCatalogData(true);
}

export async function cancelOrder(orderId: string): Promise<void> {
  await supabaseFetch<void>(`/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&status=in.(whatsapp,pending,contacted)&select=*`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'cancelled' }),
  }, true);
}

export async function deleteOrder(orderId: string): Promise<void> {
  await supabaseFetch<void>(`/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
  }, true);
}

export async function createOrder(
  items: CartItem[],
  customer: { customerName: string; customerWhatsapp: string },
): Promise<{ order: Order; message: string; whatsappUrl: string }> {
  const settings = getSettings();
  if (!Array.isArray(items) || !items.length) throw new Error('Adicione pelo menos um produto ao carrinho.');

  const orderItems: OrderItem[] = items.map(item => {
    const product = getProductById(item.productId);
    const quantity = Math.floor(Number(item.quantity) || 0);
    const stock = product ? getVariantStock(product, item.color, item.size) : 0;
    if (!product || quantity <= 0 || quantity > stock || quantity > 99) return null;
    const unitPrice = product?.price || 0;
    return {
      productId: item.productId,
      productName: product?.name || 'Produto removido',
      color: item.color,
      size: item.size,
      quantity,
      unitPrice,
      subtotal: unitPrice * quantity,
      pixDiscountPercent: product?.pixDiscountPercent,
      image: getProductImageUrl(product?.images[0]),
    };
  }).filter((item): item is OrderItem => Boolean(item && item.unitPrice > 0));

  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const orderNumber = generateOrderNumber();
  const customerName = customer.customerName.trim().replace(/\s+/g, ' ').slice(0, 80);
  const customerWhatsapp = normalizeWhatsapp(customer.customerWhatsapp);
  if (!orderItems.length) throw new Error('Seu carrinho nÃ£o possui itens disponÃ­veis para finalizar.');
  if (!customerName) throw new Error('Informe seu nome para finalizar o pedido.');
  if (customerWhatsapp.length < 10 || customerWhatsapp.length > 15) throw new Error('Informe um WhatsApp vÃ¡lido para finalizar o pedido.');

  const message = buildWhatsappMessage(orderItems, subtotal, customerName, customerWhatsapp, orderNumber);
  let order: Order = {
    id: `local-${Date.now()}`,
    items: orderItems,
    subtotal,
    customerName,
    customerWhatsapp,
    whatsappMessage: message,
    status: 'whatsapp',
    createdAt: new Date().toISOString(),
  };

  if (hasSupabaseConfig()) {
    try {
      await supabaseFetch<void>('/rest/v1/orders', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          items: orderItems,
          subtotal,
          customer_name: customerName,
          customer_whatsapp: customerWhatsapp,
          whatsapp_message: message,
          status: 'whatsapp',
        }),
      });
    } catch (error) {
      console.error('[FRAZON ORDER CREATE ERROR]', error);
      throw new Error('NÃ£o foi possÃ­vel registrar o pedido. Tente novamente em instantes.');
    }
  }

  return {
    order,
    message,
    whatsappUrl: `https://wa.me/${normalizeWhatsapp(settings.whatsappNumber)}?text=${encodeURIComponent(message)}`,
  };
}

function generateOrderNumber(): string {
  return String(Math.floor(1000 + Math.random() * 90000));
}

export function buildWhatsappMessage(
  items: OrderItem[],
  subtotal: number,
  customerName: string,
  customerWhatsapp: string,
  orderNumber: string,
): string {
  const SPARKLES = '\u2728';
  const PERSON = '\u{1F464}';
  const PHONE = '\u{1F4F1}';
  const BOX = '\u{1F4E6}';
  const PIN = '\u{1F4CC}';
  const MONEY = '\u{1F4B0}';
  const DELIVERY = '\u{1F69A}';
  const separator = '\u2508'.repeat(11);
  const orderItems = items.map(item => [
    `${PIN} ${item.quantity}x ${item.productName.toUpperCase()}`,
    `Tam: ${item.size} \u2022 ${item.color}`,
    `Valor: ${formatPrice(item.unitPrice)}`,
    formatPixDiscountPercent(item.pixDiscountPercent) ? `Pix: -${formatPixDiscountPercent(item.pixDiscountPercent)}%` : '',
    `Subtotal: ${formatPrice(item.subtotal)}`,
  ].filter(Boolean).join('\n')).join('\n\n');

  return [
    `${SPARKLES} NOVO PEDIDO #${orderNumber} ${SPARKLES}`,
    separator,
    '',
    `${PERSON} CLIENTE`,
    '',
    customerName,
    '',
    `${PHONE} WHATSAPP`,
    '',
    customerWhatsapp,
    '',
    separator,
    '',
    `${BOX} ITENS DO PEDIDO`,
    '',
    orderItems,
    '',
    separator,
    '',
    `${MONEY} TOTAL DO PEDIDO`,
    '',
    formatPrice(subtotal),
    '',
    `${DELIVERY} Entrega ou retirada ser\u00e1 combinada por aqui.`,
  ].join('\n');
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const DEFAULT_IMAGE_MAX_SIZE = 5 * 1024 * 1024;

async function compressImage(file: File, maxSizeBytes = DEFAULT_IMAGE_MAX_SIZE): Promise<Blob> {
  validateImageFile(file, maxSizeBytes);
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 5MB.');
  if (file.size <= 900_000) return file;

  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', 0.82);
  });
}

function validateOriginalImage(file: File, maxSizeBytes = DEFAULT_IMAGE_MAX_SIZE): File {
  validateImageFile(file, maxSizeBytes);
  return file;
}

function validateImageFile(file: File, maxSizeBytes: number): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Envie apenas imagens JPG, PNG ou WEBP.');
  const extension = getFileExtension(file.name);
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) throw new Error('A extensÃ£o da imagem deve ser JPG, PNG ou WEBP.');
  if (file.size > maxSizeBytes) throw new Error(`A imagem deve ter no mÃ¡ximo ${Math.floor(maxSizeBytes / (1024 * 1024))}MB.`);
}

function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function safeUploadBaseName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase();
  return baseName.slice(0, 48) || 'imagem';
}

export async function uploadCatalogImage(file: File, folder: 'products' | 'categories' | 'site' = 'products', options: { preserveOriginal?: boolean; maxSizeBytes?: number } = {}): Promise<string> {
  if (!hasSupabaseConfig()) throw new Error('Configure o Supabase Storage antes de subir imagens.');
  const session = getSession();
  if (!session) throw new Error('Sessão expirada. Faça login novamente.');
  const maxSizeBytes = options.maxSizeBytes || DEFAULT_IMAGE_MAX_SIZE;
  const blob = options.preserveOriginal ? validateOriginalImage(file, maxSizeBytes) : await compressImage(file, maxSizeBytes);
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const safeName = safeUploadBaseName(file.name);
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}.${ext}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authHeader(session.accessToken),
      'Content-Type': blob.type || 'image/jpeg',
      'x-upsert': 'false',
    },
    body: blob,
  });
  if (!response.ok) throw new Error(await response.text().catch(() => 'Falha ao enviar imagem.'));
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

export { CART_KEY };
