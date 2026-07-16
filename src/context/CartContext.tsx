import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { CartItem } from "@/types";

import {
  CART_KEY,
  createOrder,
  getProductById,
  getVariantStock,
  sendMetaConversion,
} from "@/lib/data";

import {
  trackAddToCart,
  trackInitiateCheckout,
  getMarketingConsent,
} from "@/lib/metaPixel";

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  isSending: boolean;
  cartError: string;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: CartItem) => boolean;
  removeItem: (
    productId: string,
    color: string,
    size: string
  ) => void;
  updateQuantity: (
    productId: string,
    color: string,
    size: string,
    quantity: number
  ) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  getItemQuantity: (
    productId: string,
    color: string,
    size: string
  ) => number;
  sendToWhatsApp: (
    customerName: string,
    customerWhatsapp: string
  ) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(
  undefined
);

function isValidCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<CartItem>;

  return (
    typeof item.productId === "string" &&
    item.productId.trim().length > 0 &&
    typeof item.color === "string" &&
    item.color.trim().length > 0 &&
    typeof item.size === "string" &&
    item.size.trim().length > 0 &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0
  );
}

function safeReadCart(): CartItem[] {
  try {
    const stored = window.localStorage.getItem(CART_KEY);

    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidCartItem);
  } catch {
    return [];
  }
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>(safeReadCart);
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [cartError, setCartError] = useState("");

  /*
   * Referência síncrona do carrinho.
   *
   * Evita depender do processamento assíncrono do estado do React
   * para validar estoque, calcular quantidades ou enviar pedidos.
   */
  const itemsRef = useRef<CartItem[]>(items);

  /*
   * Bloqueia imediatamente cliques duplicados na finalização,
   * antes mesmo de o estado isSending ser renderizado na interface.
   */
  const isSendingRef = useRef(false);

  const commitItems = useCallback(
    (nextItems: CartItem[]): void => {
      itemsRef.current = nextItems;
      setItems(nextItems);
    },
    []
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CART_KEY,
        JSON.stringify(items)
      );
    } catch {
      setCartError(
        "Seu navegador bloqueou o salvamento local do carrinho."
      );
    }
  }, [items]);

  const addItem = useCallback(
    (newItem: CartItem): boolean => {
      if (
        typeof newItem.productId !== "string" ||
        typeof newItem.color !== "string" ||
        typeof newItem.size !== "string" ||
        !newItem.productId.trim() ||
        !newItem.color.trim() ||
        !newItem.size.trim() ||
        !Number.isInteger(newItem.quantity) ||
        newItem.quantity <= 0
      ) {
        setCartError(
          "Selecione uma variação e uma quantidade válida."
        );

        return false;
      }

      const product = getProductById(newItem.productId);

      if (!product) {
        setCartError(
          "Produto não encontrado. Atualize a página e tente novamente."
        );

        return false;
      }

      const stock = getVariantStock(
        product,
        newItem.color,
        newItem.size
      );

      if (stock <= 0) {
        setCartError(
          "Essa variação acabou de ficar indisponível."
        );

        return false;
      }

      const currentItems = itemsRef.current;

      const existingItem = currentItems.find(
        (item) =>
          item.productId === newItem.productId &&
          item.color === newItem.color &&
          item.size === newItem.size
      );

      const currentQuantity = existingItem?.quantity ?? 0;
      const nextQuantity =
        currentQuantity + newItem.quantity;

      if (nextQuantity > stock) {
        setCartError(
          `Temos apenas ${stock} unidade(s) dessa variação.`
        );

        return false;
      }

      const nextItems = existingItem
        ? currentItems.map((item) =>
            item.productId === newItem.productId &&
            item.color === newItem.color &&
            item.size === newItem.size
              ? {
                  ...item,
                  quantity: nextQuantity,
                }
              : item
          )
        : [...currentItems, newItem];

      commitItems(nextItems);
      setCartError("");
      setIsOpen(true);

      /*
       * AddToCart só é enviado depois que o produto, a variante,
       * a quantidade e o estoque foram validados.
       */
      trackAddToCart({
        id: product.id,
        name: product.name,
        color: newItem.color,
        size: newItem.size,
        price: product.price,
        quantity: newItem.quantity,
        category: product.category ?? null,
      });

      return true;
    },
    [commitItems]
  );

  const removeItem = useCallback(
    (
      productId: string,
      color: string,
      size: string
    ): void => {
      const nextItems = itemsRef.current.filter(
        (item) =>
          !(
            item.productId === productId &&
            item.color === color &&
            item.size === size
          )
      );

      commitItems(nextItems);
      setCartError("");
    },
    [commitItems]
  );

  const updateQuantity = useCallback(
    (
      productId: string,
      color: string,
      size: string,
      quantity: number
    ): void => {
      if (!Number.isInteger(quantity)) {
        setCartError("Informe uma quantidade válida.");
        return;
      }

      if (quantity <= 0) {
        removeItem(productId, color, size);
        return;
      }

      const product = getProductById(productId);

      if (!product) {
        setCartError(
          "Produto não encontrado. Atualize a página e tente novamente."
        );

        return;
      }

      const stock = getVariantStock(
        product,
        color,
        size
      );

      if (stock <= 0) {
        setCartError(
          "Essa variação acabou de ficar indisponível."
        );

        return;
      }

      if (quantity > stock) {
        setCartError(
          `Temos apenas ${stock} unidade(s) dessa variação.`
        );

        return;
      }

      const currentItem = itemsRef.current.find(
        (item) =>
          item.productId === productId &&
          item.color === color &&
          item.size === size
      );

      if (!currentItem) {
        setCartError(
          "O item não foi encontrado no carrinho."
        );

        return;
      }

      const previousQuantity = currentItem.quantity;

      const nextItems = itemsRef.current.map((item) =>
        item.productId === productId &&
        item.color === color &&
        item.size === size
          ? {
              ...item,
              quantity,
            }
          : item
      );

      commitItems(nextItems);
      setCartError("");

      /*
       * Aumentar a quantidade pelo botão "+" representa uma
       * nova adição. É enviada apenas a diferença acrescentada.
       */
      if (quantity > previousQuantity) {
        trackAddToCart({
          id: product.id,
          name: product.name,
          color: currentItem.color,
          size: currentItem.size,
          price: product.price,
          quantity: quantity - previousQuantity,
          category: product.category ?? null,
        });
      }
    },
    [commitItems, removeItem]
  );

  const clearCart = useCallback((): void => {
    commitItems([]);
    setCartError("");
  }, [commitItems]);

  const openCart = useCallback((): void => {
    setIsOpen(true);
  }, []);

  const closeCart = useCallback((): void => {
    setIsOpen(false);
  }, []);

  const toggleCart = useCallback((): void => {
    setIsOpen((current) => !current);
  }, []);

  const totalItems = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),
    [items]
  );

  const totalPrice = useMemo(
    () =>
      items.reduce((sum, item) => {
        const product = getProductById(
          item.productId
        );

        return (
          sum +
          (product?.price ?? 0) * item.quantity
        );
      }, 0),
    [items]
  );

  const getItemQuantity = useCallback(
    (
      productId: string,
      color: string,
      size: string
    ): number =>
      itemsRef.current.find(
        (item) =>
          item.productId === productId &&
          item.color === color &&
          item.size === size
      )?.quantity ?? 0,
    []
  );

  const sendToWhatsApp = useCallback(
    async (
      customerName: string,
      customerWhatsapp: string
    ): Promise<void> => {
      const currentItems = itemsRef.current;

      if (
        !currentItems.length ||
        isSendingRef.current
      ) {
        return;
      }

      const cleanName = customerName
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80);

      const cleanWhatsapp =
        customerWhatsapp.replace(/\D/g, "");

      if (!cleanName) {
        setCartError(
          "Informe seu nome para finalizar o pedido."
        );

        return;
      }

      if (
        cleanWhatsapp.length < 10 ||
        cleanWhatsapp.length > 15
      ) {
        setCartError(
          "Informe um WhatsApp válido para finalizar o pedido."
        );

        return;
      }

      isSendingRef.current = true;
      setIsSending(true);
      setCartError("");

      try {
        const {
          order,
          whatsappUrl,
        } = await createOrder(currentItems, {
          customerName: cleanName,
          customerWhatsapp: cleanWhatsapp,
        });

        /*
         * InitiateCheckout só é disparado após createOrder terminar
         * com sucesso. Portanto, falhas no registro do pedido não
         * são contabilizadas como início de checkout.
         */
        const initiateCheckoutEventId =
          order.metaInitiateCheckoutEventId ??
          `initiate-checkout-${order.id}`;

        trackInitiateCheckout({
          eventId: initiateCheckoutEventId,
          items: order.items.map((item) => ({
            id: item.productId,
            name: item.productName,
            price: item.unitPrice,
            quantity: item.quantity,
          })),
        });

        if (getMarketingConsent() === "accepted" && !order.id.startsWith("local-")) {
          void sendMetaConversion(
            "InitiateCheckout",
            order.id,
            initiateCheckoutEventId
          ).catch(() => undefined);
        }

        window.open(
          whatsappUrl,
          "_blank",
          "noopener,noreferrer"
        );

        clearCart();
        setIsOpen(false);
      } catch (error) {
        console.error(
          "[FRAZON ORDER ERROR]",
          error
        );

        setCartError(
          error instanceof Error
            ? error.message
            : "Não foi possível finalizar o pedido."
        );
      } finally {
        isSendingRef.current = false;
        setIsSending(false);
      }
    },
    [clearCart]
  );

  const contextValue = useMemo<CartContextType>(
    () => ({
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
    }),
    [
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
    ]
  );

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart precisa estar dentro de CartProvider"
    );
  }

  return context;
}
