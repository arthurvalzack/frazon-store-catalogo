import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { fallbackImage, formatPixDiscountPercent, formatPrice, getProductById, getProductImageForColor, getProductImageUrl, getVariantStock } from '@/lib/data';

export default function CartSidebar() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, totalItems, totalPrice, sendToWhatsApp, isSending, cartError } = useCart();
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
            onClick={closeCart}
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-[90] flex w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-noir-100 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-5 w-5 text-noir-900" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-noir-900">Carrinho ({totalItems})</h2>
              </div>
              <button onClick={closeCart} className="text-noir-400 transition-colors hover:text-noir-900" aria-label="Fechar carrinho">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <ShoppingBag className="mb-4 h-12 w-12 text-noir-200" />
                  <p className="mb-1 text-sm font-medium text-noir-900">Seu carrinho está vazio</p>
                  <p className="text-xs text-noir-400">Explore o catálogo e adicione as peças que você quer pedir.</p>
                  <button onClick={closeCart} className="mt-6 bg-noir-900 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-noir-700">
                    Continuar comprando
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-noir-100">
                  {items.map(item => {
                    const product = getProductById(item.productId);
                    if (!product) return null;
                    const stock = getVariantStock(product, item.color, item.size);
                    const pixDiscountPercent = formatPixDiscountPercent(product.pixDiscountPercent);
                    return (
                      <div key={`${item.productId}-${item.color}-${item.size}`} className="flex gap-4 px-5 py-4 sm:px-6">
                        <div className="h-24 w-20 shrink-0 overflow-hidden rounded-sm bg-noir-100">
                          <img src={fallbackImage(getProductImageUrl(getProductImageForColor(product, item.color)))} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 text-sm font-medium text-noir-900">{product.name}</h3>
                          <p className="mt-1 text-xs text-noir-400">{item.color} · {item.size}</p>
                          {pixDiscountPercent && <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9f7615]">Pix: -{pixDiscountPercent}%</p>}
                          {stock <= 4 && <p className="mt-1 text-[11px] font-medium text-red-600">Últimas {stock} unidade(s)</p>}
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-noir-900">{formatPrice(product.price * item.quantity)}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateQuantity(item.productId, item.color, item.size, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center border border-noir-200 text-noir-500 transition-colors hover:border-noir-900 hover:text-noir-900" aria-label="Diminuir quantidade">
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-5 text-center text-xs font-semibold text-noir-900">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.productId, item.color, item.size, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center border border-noir-200 text-noir-500 transition-colors hover:border-noir-900 hover:text-noir-900 disabled:opacity-30" disabled={item.quantity >= stock} aria-label="Aumentar quantidade">
                                <Plus className="h-3 w-3" />
                              </button>
                              <button onClick={() => removeItem(item.productId, item.color, item.size)} className="ml-1 text-noir-300 transition-colors hover:text-red-500" aria-label="Remover produto">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-noir-100 px-5 py-5 sm:px-6">
                {cartError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{cartError}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-noir-500">Subtotal</span>
                  <span className="text-lg font-semibold text-noir-900">{formatPrice(totalPrice)}</span>
                </div>
                <p className="mt-1 text-xs text-noir-400">Entrega/retirada e pagamento serão combinados no WhatsApp.</p>
                <div className="mt-4 grid gap-3">
                  <input
                    type="text"
                    value={customerName}
                    onChange={event => setCustomerName(event.target.value)}
                    placeholder="Seu nome"
                    className="w-full rounded-lg border border-noir-200 px-3 py-2.5 text-sm text-noir-900 placeholder-noir-400 focus:border-noir-500 focus:outline-none"
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={customerWhatsapp}
                    onChange={event => setCustomerWhatsapp(event.target.value.replace(/\D/g, ''))}
                    placeholder="Seu WhatsApp"
                    className="w-full rounded-lg border border-noir-200 px-3 py-2.5 text-sm text-noir-900 placeholder-noir-400 focus:border-noir-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => sendToWhatsApp(customerName, customerWhatsapp)}
                  disabled={isSending}
                  className="mt-4 flex w-full items-center justify-center gap-2 bg-emerald-600 py-3.5 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MessageCircle className="h-4 w-4" />
                  {isSending ? 'Salvando pedido...' : 'Concluir no WhatsApp'}
                </button>
                <button onClick={closeCart} className="mt-3 w-full py-1 text-center text-xs uppercase tracking-wider text-noir-400 transition-colors hover:text-noir-900">
                  Continuar comprando
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
