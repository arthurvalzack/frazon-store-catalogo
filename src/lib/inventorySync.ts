import type { Product } from '@/types';

export type InventoryBulkSyncResult = {
  total: number;
  success: number;
  created: number;
  updated: number;
  failed: number;
  failures: Array<{
    productId: string;
    productName: string;
    status: number;
    message: string;
  }>;
};

export const INVENTORY_SYNC_WARNING = 'Produto salvo no catálogo, mas não foi sincronizado com o inventário.';
const LOCAL_API_ERROR = 'Não foi possível sincronizar com o inventário. Verifique se a API local está rodando e se as variáveis de ambiente estão configuradas.';

async function parseSyncResponse(response: Response): Promise<{ text: string; parsed: { error?: string; message?: string } }> {
  const text = await response.text().catch(() => '');
  if (!text) return { text, parsed: {} };

  try {
    return { text, parsed: JSON.parse(text) as { error?: string; message?: string } };
  } catch {
    return { text, parsed: { message: text } };
  }
}

function syncErrorMessage(response: Response, text: string, parsed: { error?: string; message?: string }, fallback: string): string {
  if (response.status === 404) return LOCAL_API_ERROR;
  return parsed.message || parsed.error || text || fallback;
}

export async function syncInventoryProduct(product: Product, accessToken: string): Promise<void> {
  const response = await fetch('/api/sync-inventory-product', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ product }),
  });

  if (!response.ok) {
    const { text, parsed } = await parseSyncResponse(response);
    console.error('[INVENTORY PRODUCT SYNC ERROR]', {
      status: response.status,
      details: text,
      product: {
        id: product.id,
        name: product.name,
        imageCount: product.images.length,
        variantCount: product.variants.length,
      },
    });
    throw new Error(syncErrorMessage(response, text, parsed, `Inventory product sync failed with status ${response.status}`));
  }
}

export async function syncAllInventoryProducts(products: Product[], accessToken: string): Promise<InventoryBulkSyncResult> {
  const response = await fetch('/api/sync-inventory-products', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ products }),
  });

  const { text: details, parsed } = await parseSyncResponse(response) as {
    text: string;
    parsed: Partial<InventoryBulkSyncResult> & { error?: string; message?: string };
  };

  if (!response.ok) {
    console.error('[INVENTORY BULK SYNC ERROR]', {
      status: response.status,
      details,
      productCount: products.length,
    });
    throw new Error(syncErrorMessage(response, details, parsed, `Inventory bulk sync failed with status ${response.status}`));
  }

  return {
    total: Number(parsed.total) || products.length,
    success: Number(parsed.success) || 0,
    created: Number(parsed.created) || 0,
    updated: Number(parsed.updated) || 0,
    failed: Number(parsed.failed) || 0,
    failures: Array.isArray(parsed.failures) ? parsed.failures : [],
  };
}
