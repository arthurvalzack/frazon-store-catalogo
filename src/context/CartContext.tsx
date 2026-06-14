import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem } from '@/types';
import { CART_KEY, createOrder, getProductById, getVariantStock } from '@/lib/data';

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  isSending: boolean;
  cartError: string;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: CartItem) => boolean;
  removeItem: (productId: string, color: string, size: string) => void;
  updateQuantity: (productId: string, color: string, size: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  getItemQuantity: (productId: string, color: string, size: string) => number;
  sendToWhatsApp: (customerName: string, customerWhatsapp: string) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function safeReadCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(CART_KEY);
    return stored ? JSON.parse(stored) as CartItem[] : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [cartError, setCartError] = useState('');

  useEffect(() => {
    setItems(safeReadCart());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      setCartError('Seu navegador bloqueou o salvamento local do carrinho.');
    }
  }, [items]);

  const addItem = useCallback((newItem: CartItem) => {
    const product = getProductById(newItem.productId);
    if (!product) {
      setCartError('Produto não encontrado. Atualize a página e tente novamente.');
      return false;
    }
    const stock = getVariantStock(product, newItem.color, newItem.size);
    if (stock <= 0) {
      setCartError('Essa variação acabou de ficar indisponível.');
      return false;
    }

    let accepted = true;
    setItems(prev => {
      const existing = prev.find(item => item.productId === newItem.productId && item.color === newItem.color && item.size === newItem.size);
      const currentQty = existing?.quantity || 0;
      const nextQty = currentQty + newItem.quantity;
      if (nextQty > stock) {
        accepted = false;
        setCartError(`Temos apenas ${stock} unidade(s) dessa variação.`);
        return prev;
      }
      setCartError('');
      if (existing) {
        return prev.map(item => item.productId === newItem.productId && item.color === newItem.color && item.size === newItem.size
          ? { ...item, quantity: nextQty }
          : item);
      }
      return [...prev, newItem];
    });
    if (accepted) setIsOpen(true);
    return accepted;
  }, []);

  const removeItem = useCallback((productId: string, color: string, size: string) => {
    setItems(prev => prev.filter(item => !(item.productId === productId && item.color === color && item.size === size)));
  }, []);

  const updateQuantity = useCallback((productId: string, color: string, size: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, color, size);
      return;
    }
    const product = getProductById(productId);
    const stock = product ? getVariantStock(product, color, size) : 0;
    if (quantity > stock) {
      setCartError(`Temos apenas ${stock} unidade(s) dessa variação.`);
      return;
    }
    setCartError('');
    setItems(prev => prev.map(item => item.productId === productId && item.color === color && item.size === size ? { ...item, quantity } : item));
  }, [removeItem]);

  const clearCart = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen(prev => !prev), []);

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((sum, item) => {
    const product = getProductById(item.productId);
    return sum + (product?.price || 0) * item.quantity;
  }, 0), [items]);

  const getItemQuantity = useCallback((productId: string, color: string, size: string) => {
    return items.find(item => item.productId === productId && item.color === color && item.size === size)?.quantity || 0;
  }, [items]);

  const sendToWhatsApp = useCallback(async (customerName: string, customerWhatsapp: string) => {
    if (!items.length || isSending) return;
    const cleanName = customerName.trim();
    const cleanWhatsapp = customerWhatsapp.replace(/\D/g, '');
    if (!cleanName) {
      setCartError('Informe seu nome para finalizar o pedido.');
      return;
    }
    if (!cleanWhatsapp) {
      setCartError('Informe seu WhatsApp para finalizar o pedido.');
      return;
    }
    setIsSending(true);
    setCartError('');
    try {
      const { whatsappUrl } = await createOrder(items, {
        customerName: cleanName,
        customerWhatsapp: cleanWhatsapp,
      });
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      clearCart();
      setIsOpen(false);
    } catch (error) {
      console.error('[FRAZON ORDER ERROR]', error);
      setCartError(error instanceof Error ? error.message : 'Não foi possível finalizar o pedido.');
    } finally {
      setIsSending(false);
    }
  }, [clearCart, isSending, items]);

  return (
    <CartContext.Provider value={{
      items,
      isOpen,
      isSending,
      cartError,
      openCart,
      closeCart,
      toggleCart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      getItemQuantity,
      sendToWhatsApp,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart precisa estar dentro de CartProvider');
  return context;
}
