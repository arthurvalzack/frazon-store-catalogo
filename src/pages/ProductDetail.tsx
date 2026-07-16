import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, RotateCcw, Share2, Shield, ShoppingBag, Truck } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { cn } from '@/utils/cn';
import { fallbackImage, findProductImageIndexByColor, formatPixDiscountBadge, formatPrice, getActiveProducts, getAvailableColors, getAvailableSizes, getProductBySlug, getProductImageUrl, getVariantStock, isProductAvailable, loadCatalogData, subscribeToProductsChanges } from '@/lib/data';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/types';
import { trackViewContent } from "@/lib/metaPixel";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const { addItem, openCart } = useCart();

  const handleProductsRealtimeChange = useCallback((nextProducts: Product[]) => {
    if (!slug) return;
    const activeProducts = nextProducts.filter(isProductAvailable);
    const updated = activeProducts.find(item => item.slug === slug);
    setProduct(updated || null);
    if (!updated) return;

    const colors = getAvailableColors(updated);
    setSelectedColor(current => colors.some(color => color.name === current) ? current : colors[0]?.name || '');
    setRelated(activeProducts.filter(item => item.category === updated.category && item.id !== updated.id).slice(0, 4));
  }, [slug]);

  useEffect(() => {
    let mounted = true;
    async function loadProduct() {
      if (!slug) return;
      setLoading(true);
      await loadCatalogData();
      const loaded = await getProductBySlug(slug);
      if (!mounted) return;
      if (loaded) {
        const colors = getAvailableColors(loaded);
        const firstColor = colors[0]?.name || '';
        const sizes = getAvailableSizes(loaded, firstColor);
        setProduct(loaded);
        setSelectedColor(firstColor);
        setSelectedSize(sizes[0] || '');
        setRelated(getActiveProducts().filter(item => item.category === loaded.category && item.id !== loaded.id).slice(0, 4));
      } else {
        setProduct(null);
      }
      setSelectedImage(0);
      setQuantity(1);
      setLoading(false);
      window.scrollTo(0, 0);
    }
    loadProduct();
    return () => { mounted = false; };
  }, [slug]);

  useEffect(() => {
  if (!slug) return undefined;
  return subscribeToProductsChanges(handleProductsRealtimeChange);
}, [handleProductsRealtimeChange, slug]);

useEffect(() => {
  if (!product) {
    return;
  }

  trackViewContent({
    id: product.id,
    name: product.name,
    price: product.price,
    category: product.category ?? null,
  });
}, [product]);

  const availableColors = useMemo(() => product ? getAvailableColors(product) : [], [product]);
  const availableSizes = useMemo(() => product ? getAvailableSizes(product, selectedColor) : [], [product, selectedColor]);
  const stock = product ? getVariantStock(product, selectedColor, selectedSize) : 0;
  const pixDiscountBadge = formatPixDiscountBadge(product?.pixDiscountPercent);

  useEffect(() => {
    if (availableSizes.length && !availableSizes.includes(selectedSize)) {
      setSelectedSize(availableSizes[0]);
      setQuantity(1);
    }
  }, [availableSizes, selectedSize]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center pt-24"><div className="h-10 w-10 rounded-full border-2 border-noir-200 border-t-noir-900 animate-spin" /></div>;
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <div className="px-4 text-center">
          <p className="mb-4 text-lg text-noir-900 font-display">Produto não encontrado ou indisponível</p>
          <Link to="/catalog" className="text-sm text-noir-500 underline">Voltar ao catálogo</Link>
        </div>
      </div>
    );
  }

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    const sizes = getAvailableSizes(product, color);
    setSelectedSize(sizes[0] || '');
    const imageIndex = findProductImageIndexByColor(product, color);
    if (imageIndex >= 0) setSelectedImage(imageIndex);
    setQuantity(1);
  };

  const handleAdd = () => {
    if (!selectedColor || !selectedSize || stock <= 0) return;
    const ok = addItem({ productId: product.id, color: selectedColor, size: selectedSize, quantity });
    if (ok) {
      setAdded(true);
      setTimeout(() => { setAdded(false); openCart(); }, 600);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 pt-20 lg:pt-24">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs text-noir-400">
          <Link to="/" className="transition-colors hover:text-noir-900">Home</Link>
          <span>/</span>
          <Link to="/catalog" className="transition-colors hover:text-noir-900">Catálogo</Link>
          <span>/</span>
          <span className="text-noir-900">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="aspect-[3/4] overflow-hidden bg-noir-100">
              <motion.img key={selectedImage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} src={fallbackImage(getProductImageUrl(product.images[selectedImage]))} alt={product.name} className="h-full w-full object-cover" />
            </div>
            {product.images.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {product.images.slice(0, 6).map((img, index) => (
                  <button key={`${img.url}-${index}`} onClick={() => setSelectedImage(index)} className={cn('h-24 w-20 shrink-0 overflow-hidden border-2 bg-noir-100 transition-colors', selectedImage === index ? 'border-noir-900' : 'border-transparent')}>
                    <img src={fallbackImage(getProductImageUrl(img))} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-noir-300">{product.brand}</p>
                <h1 className="mt-2 text-2xl text-noir-900 font-display sm:text-3xl">{product.name}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-noir-300 transition-colors hover:text-noir-900" aria-label="Favoritar"><Heart className="h-5 w-5" /></button>
                <button className="p-2 text-noir-300 transition-colors hover:text-noir-900" aria-label="Compartilhar"><Share2 className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-2xl font-semibold text-noir-900">{formatPrice(product.price)}</span>
                {pixDiscountBadge && <span className="rounded bg-[#c99a22] px-2 py-1 text-xs font-black uppercase tracking-[0.04em] text-black">{pixDiscountBadge}</span>}
              </div>
              {product.originalPrice && <p className="text-lg text-noir-300 line-through">{formatPrice(product.originalPrice)}</p>}
            </div>
            <p className="mt-2 text-xs text-noir-400">ou 3x de {formatPrice(product.price / 3)} sem juros</p>

            <div className="mt-6 border-t border-noir-100 pt-6">
              <p className="text-sm leading-relaxed text-noir-600">{product.description}</p>
            </div>

            <div className="mt-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-noir-500">Cor: <span className="text-noir-900">{selectedColor}</span></p>
              <div className="flex gap-2">
                {availableColors.map(color => (
                  <button key={color.name} onClick={() => handleColorChange(color.name)} className={cn('h-10 w-10 rounded-full border-2 transition-all', selectedColor === color.name ? 'scale-110 border-noir-900' : 'border-noir-200')} style={{ backgroundColor: color.hex }} title={color.name} />
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-noir-500">Tamanho: <span className="text-noir-900">{selectedSize}</span></p>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map(size => (
                  <button key={size} onClick={() => { setSelectedSize(size); setQuantity(1); }} className={cn('flex h-12 w-12 items-center justify-center border text-sm font-medium transition-all', selectedSize === size ? 'border-noir-900 bg-noir-900 text-white' : 'border-noir-200 text-noir-700 hover:border-noir-900')}>
                    {size}
                  </button>
                ))}
              </div>
              {stock > 0 && stock <= 4 && <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-red-600">Últimas {stock} unidade(s)</p>}
            </div>

            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-noir-500">Quantidade</p>
              <div className="flex w-fit items-center border border-noir-200">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="flex h-12 w-12 items-center justify-center text-noir-500 transition-colors hover:text-noir-900">−</button>
                <span className="flex h-12 w-12 items-center justify-center border-x border-noir-200 text-sm font-semibold text-noir-900">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(stock, quantity + 1))} disabled={quantity >= stock} className="flex h-12 w-12 items-center justify-center text-noir-500 transition-colors hover:text-noir-900 disabled:opacity-30">+</button>
              </div>
            </div>

            <button onClick={handleAdd} disabled={!selectedSize || !selectedColor || stock <= 0} className={cn('mt-8 flex w-full items-center justify-center gap-3 py-4 text-sm font-semibold uppercase tracking-[0.15em] transition-all duration-300', added ? 'bg-emerald-600 text-white' : 'bg-noir-900 text-white hover:bg-noir-700 disabled:cursor-not-allowed disabled:opacity-40')}>
              <ShoppingBag className="h-4.5 w-4.5" />
              {added ? 'Adicionado ao carrinho!' : stock <= 0 ? 'Indisponível' : 'Adicionar ao carrinho'}
            </button>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-noir-100 pt-8">
              {[
                { icon: Truck, label: 'Entrega', desc: 'A combinar' },
                { icon: RotateCcw, label: 'Troca', desc: 'Consultar' },
                { icon: Shield, label: 'Pedido', desc: 'WhatsApp' },
              ].map(benefit => (
                <div key={benefit.label} className="text-center">
                  <benefit.icon className="mx-auto mb-1.5 h-5 w-5 text-noir-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-noir-700">{benefit.label}</p>
                  <p className="text-[10px] text-noir-400">{benefit.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {related.length > 0 && (
          <section className="mt-20 border-t border-noir-100 pt-16">
            <h2 className="mb-8 text-2xl text-noir-900 font-display">Você também pode gostar</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {related.map((item, index) => <ProductCard key={item.id} product={item} index={index} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
