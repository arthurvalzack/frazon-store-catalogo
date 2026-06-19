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
    const details = await response.text().catch(() => '');
    console.error('[INVENTORY PRODUCT SYNC ERROR]', {
      status: response.status,
      details,
      product: {
        id: product.id,
        name: product.name,
        imageCount: product.images.length,
        variantCount: product.variants.length,
      },
    });
    throw new Error(details || `Inventory product sync failed with status ${response.status}`);
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

  const details = await response.text().catch(() => '');
  let parsed: Partial<InventoryBulkSyncResult> & { error?: string; message?: string } = {};
  if (details) {
    try {
      parsed = JSON.parse(details);
    } catch {
      parsed = { message: details };
    }
  }

  if (!response.ok) {
    console.error('[INVENTORY BULK SYNC ERROR]', {
      status: response.status,
      details,
      productCount: products.length,
    });
    throw new Error(parsed.message || parsed.error || details || `Inventory bulk sync failed with status ${response.status}`);
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
