type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  brand?: string;
  category?: string;
  description?: string;
  price?: number;
  images?: string[];
  isActive?: boolean;
  variants?: Array<{
    id: string;
    color?: { name?: string; hex?: string };
    size?: string;
    stock?: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

type InventoryRow = {
  id: string;
  external_source: string;
  external_id: string;
  name: string;
  sku: string;
  brand_id: string | null;
  brand_name: string | null;
  category_id: string | null;
  category_name: string | null;
  subcategory_id: string | null;
  subcategory_name: string | null;
  description: string;
  image: string | null;
  images: string[];
  cost_price: number;
  sale_price: number;
  status: 'active' | 'inactive';
  variants: Array<{
    id: string;
    productId: string;
    size: string;
    color: string;
    colorHex: string;
    sku: string;
    quantity: number;
    costPrice: number;
    salePrice: number;
  }>;
  tags: string[];
  min_stock: number;
  total_quantity: number;
  created_at: string;
  updated_at: string;
};

const EXTERNAL_SOURCE = 'frazon_catalog';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const catalogUrl = process.env.CATALOG_SUPABASE_URL;
  const catalogAnonKey = process.env.CATALOG_SUPABASE_ANON_KEY;
  const inventoryUrl = process.env.INVENTORY_SUPABASE_URL;
  const inventoryServiceRoleKey = process.env.INVENTORY_SUPABASE_SERVICE_ROLE_KEY;

  if (!catalogUrl || !catalogAnonKey || !inventoryUrl || !inventoryServiceRoleKey) {
    return res.status(500).json({ error: 'Inventory sync is not configured' });
  }

  const token = getBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const validUser = await validateCatalogUser(catalogUrl, catalogAnonKey, token);
  if (!validUser) return res.status(401).json({ error: 'Unauthorized' });

  const body = parseBody(req.body);
  const product = body?.product as CatalogProduct | undefined;
  if (!isValidProduct(product)) {
    return res.status(400).json({ error: 'Invalid product payload' });
  }

  const inventoryProduct = catalogProductToInventory(product);
  const existingId = await findInventoryProductId(inventoryUrl, inventoryServiceRoleKey, product.id);

  if (existingId) {
    await patchInventoryProduct(inventoryUrl, inventoryServiceRoleKey, existingId, inventoryProduct);
  } else {
    await createInventoryProduct(inventoryUrl, inventoryServiceRoleKey, inventoryProduct);
  }

  return res.status(200).json({ ok: true, id: inventoryProduct.id });
}

function getBearerToken(authorization?: string): string {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

async function validateCatalogUser(catalogUrl: string, anonKey: string, token: string): Promise<boolean> {
  const response = await fetch(`${trimSlash(catalogUrl)}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });
  return response.ok;
}

function parseBody(body: unknown): any {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body;
}

function isValidProduct(product: CatalogProduct | undefined): product is CatalogProduct {
  return Boolean(product?.id && product.name && product.slug);
}

function catalogProductToInventory(product: CatalogProduct): InventoryRow {
  const productId = `catalog_${product.id}`;
  const salePrice = safeNumber(product.price, 0);
  const now = new Date().toISOString();
  const sku = buildProductSku(product.slug || product.name);
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const variants = (Array.isArray(product.variants) ? product.variants : []).map((variant, index) => {
    const color = variant.color?.name || '';
    const size = variant.size || '';
    const variantSku = `${sku}-${slugPart(size || 'UNICO')}-${slugPart(color || 'COR')}-${index + 1}`;
    return {
      id: `inv_${variant.id || `${product.id}_${index + 1}`}`,
      productId,
      size,
      color,
      colorHex: variant.color?.hex || '#000000',
      sku: variantSku,
      quantity: Math.max(0, safeNumber(variant.stock, 0)),
      costPrice: 0,
      salePrice,
    };
  });

  return {
    id: productId,
    external_source: EXTERNAL_SOURCE,
    external_id: product.id,
    name: product.name,
    sku,
    brand_id: null,
    brand_name: product.brand || null,
    category_id: null,
    category_name: product.category || null,
    subcategory_id: null,
    subcategory_name: null,
    description: product.description || '',
    image: images[0] || null,
    images,
    cost_price: 0,
    sale_price: salePrice,
    status: product.isActive === false ? 'inactive' : 'active',
    variants,
    tags: ['frazon_catalog'],
    min_stock: 1,
    total_quantity: variants.reduce((sum, variant) => sum + variant.quantity, 0),
    created_at: product.createdAt || now,
    updated_at: now,
  };
}

async function findInventoryProductId(inventoryUrl: string, serviceRoleKey: string, externalId: string): Promise<string | null> {
  const externalParams = new URLSearchParams({
    select: 'id',
    external_source: `eq.${EXTERNAL_SOURCE}`,
    external_id: `eq.${externalId}`,
    limit: '1',
  });
  const externalResponse = await inventoryFetch(inventoryUrl, serviceRoleKey, `/rest/v1/products?${externalParams.toString()}`);
  const externalRows = await externalResponse.json() as Array<{ id: string }>;
  if (externalRows[0]?.id) return externalRows[0].id;

  const deterministicId = `catalog_${externalId}`;
  const idParams = new URLSearchParams({
    select: 'id',
    id: `eq.${deterministicId}`,
    limit: '1',
  });
  const idResponse = await inventoryFetch(inventoryUrl, serviceRoleKey, `/rest/v1/products?${idParams.toString()}`);
  const idRows = await idResponse.json() as Array<{ id: string }>;
  return idRows[0]?.id || null;
}

async function patchInventoryProduct(inventoryUrl: string, serviceRoleKey: string, id: string, product: InventoryRow): Promise<void> {
  await inventoryFetch(inventoryUrl, serviceRoleKey, `/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(product),
  });
}

async function createInventoryProduct(inventoryUrl: string, serviceRoleKey: string, product: InventoryRow): Promise<void> {
  await inventoryFetch(inventoryUrl, serviceRoleKey, '/rest/v1/products', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(product),
  });
}

async function inventoryFetch(inventoryUrl: string, serviceRoleKey: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('apikey', serviceRoleKey);
  headers.set('Authorization', `Bearer ${serviceRoleKey}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${trimSlash(inventoryUrl)}${path}`, { ...init, headers });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(details || `Inventory Supabase error ${response.status}`);
  }
  return response;
}

function buildProductSku(value: string): string {
  return `FRAZON-${slugPart(value) || 'PRODUTO'}`;
}

function slugPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toUpperCase()
    .slice(0, 48);
}

function safeNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, '');
}
