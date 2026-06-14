import type { Product } from '@/types';

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
    throw new Error(details || INVENTORY_SYNC_WARNING);
  }
}
