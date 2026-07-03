const EXTERNAL_SOURCE = 'frazon_catalog';
const LEGACY_EXTERNAL_SOURCE = 'catalog';
const MAX_BODY_BYTES = 50_000;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (getBodySize(req.body) > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  const catalogUrl = process.env.CATALOG_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const catalogAnonKey = process.env.CATALOG_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const inventoryUrl = process.env.INVENTORY_SUPABASE_URL;
  const inventoryServiceRoleKey = process.env.INVENTORY_SUPABASE_SERVICE_ROLE_KEY;

  if (!catalogUrl || !catalogAnonKey || !inventoryUrl || !inventoryServiceRoleKey) {
    const missing = [
      !catalogUrl ? 'CATALOG_SUPABASE_URL or VITE_SUPABASE_URL' : '',
      !catalogAnonKey ? 'CATALOG_SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY' : '',
      !inventoryUrl ? 'INVENTORY_SUPABASE_URL' : '',
      !inventoryServiceRoleKey ? 'INVENTORY_SUPABASE_SERVICE_ROLE_KEY' : '',
    ].filter(Boolean);
    console.error('[INVENTORY PRODUCT DEACTIVATE ERROR]', { status: 500, message: 'Missing environment variables', missing });
    return res.status(500).json({ error: 'Inventory sync is not configured', missing });
  }

  const token = getBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const catalogUser = await getCatalogUser(catalogUrl, catalogAnonKey, token);
  if (!isAuthorizedAdminEmail(catalogUser?.email)) return res.status(401).json({ error: 'Unauthorized' });

  const body = parseBody(req.body);
  const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
  if (!productId || !isSafeId(productId)) return res.status(400).json({ error: 'Invalid productId' });

  try {
    const inventoryId = await findInventoryProductId(inventoryUrl, inventoryServiceRoleKey, productId);
    if (!inventoryId) return res.status(200).json({ ok: true, deactivated: false, reason: 'Inventory product not found' });

    await deactivateInventoryProduct(inventoryUrl, inventoryServiceRoleKey, inventoryId);
    return res.status(200).json({ ok: true, deactivated: true, id: inventoryId });
  } catch (error) {
    const syncError = normalizeSyncError(error);
    console.error('[INVENTORY PRODUCT DEACTIVATE ERROR]', {
      productId,
      status: syncError.status,
      message: syncError.message,
      path: syncError.path,
      details: syncError.details,
    });
    return res.status(502).json({
      error: 'Inventory product deactivate failed',
    });
  }
}

function getBearerToken(authorization?: string): string {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

async function getCatalogUser(catalogUrl: string, anonKey: string, token: string): Promise<{ email?: string } | null> {
  const response = await fetch(`${trimSlash(catalogUrl)}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });
  if (!response.ok) return null;
  return response.json().catch(() => null) as Promise<{ email?: string } | null>;
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

async function findInventoryProductId(inventoryUrl: string, serviceRoleKey: string, externalId: string): Promise<string | null> {
  const externalParams = new URLSearchParams({
    select: 'id',
    external_source: `in.(${EXTERNAL_SOURCE},${LEGACY_EXTERNAL_SOURCE})`,
    external_id: `eq.${externalId}`,
    limit: '1',
  });
  const externalResponse = await inventoryFetch(inventoryUrl, serviceRoleKey, `/rest/v1/products?${externalParams.toString()}`);
  const externalRows = await externalResponse.json() as Array<{ id: string }>;
  if (externalRows[0]?.id) return externalRows[0].id;

  const legacyId = `catalog_${externalId}`;
  const legacyParams = new URLSearchParams({ select: 'id', id: `eq.${legacyId}`, limit: '1' });
  const legacyResponse = await inventoryFetch(inventoryUrl, serviceRoleKey, `/rest/v1/products?${legacyParams.toString()}`);
  const legacyRows = await legacyResponse.json() as Array<{ id: string }>;
  return legacyRows[0]?.id || null;
}

async function deactivateInventoryProduct(inventoryUrl: string, serviceRoleKey: string, id: string): Promise<void> {
  await inventoryFetch(inventoryUrl, serviceRoleKey, `/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'inactive',
      updated_at: new Date().toISOString(),
    }),
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
    throw new InventorySyncError(details || `Inventory Supabase error ${response.status}`, response.status, path, details);
  }
  return response;
}

class InventorySyncError extends Error {
  status: number;
  path: string;
  details: string;

  constructor(message: string, status: number, path: string, details: string) {
    super(message);
    this.name = 'InventorySyncError';
    this.status = status;
    this.path = path;
    this.details = details;
  }
}

function normalizeSyncError(error: unknown): { status: number; message: string; path: string; details: string } {
  if (error instanceof InventorySyncError) {
    return { status: error.status, message: error.message, path: error.path, details: error.details };
  }
  if (error instanceof Error) return { status: 500, message: error.message, path: '', details: '' };
  return { status: 500, message: 'Unknown inventory deactivate error', path: '', details: '' };
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function isAuthorizedAdminEmail(email?: string): boolean {
  if (!email) return false;
  const allowed = (process.env.CATALOG_ADMIN_EMAILS || process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
  return !allowed.length || allowed.includes(email.trim().toLowerCase());
}

function getBodySize(body: unknown): number {
  if (typeof body === 'string') return Buffer.byteLength(body);
  if (!body) return 0;
  return Buffer.byteLength(JSON.stringify(body));
}

function isSafeId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}
