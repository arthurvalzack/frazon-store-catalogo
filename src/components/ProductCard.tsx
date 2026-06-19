import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import type { Product } from '@/types';
import { fallbackImage, formatPrice, getAvailableColors, getAvailableSizes, getProductImageForColor, getProductImageUrl, getVariantStock } from '@/lib/data';
import { useCart } from '@/context/CartContext';
import { cn } from '@/utils/cn';

interface ProductCardProps {
  product: Product;
  index?: number;
}

export default function ProductCard({ product, index = 0 }: ProductCardProps) {
  const availableColors = useMemo(() => getAvailableColors(product), [product]);
  const initialColor = availableColors[0]?.name || '';
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const availableSizes = useMemo(() => getAvailableSizes(product, selectedColor), [product, selectedColor]);
  const [selectedSize, setSelectedSize] = useState(availableSizes[Math.floor(availableSizes.length / 2)] || availableSizes[0] || '');
  const [isHovered, setIsHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const stock = getVariantStock(product, selectedColor, selectedSize);
  const productImage = getProductImageForColor(product, selectedColor) || product.images[0];

  const handleAddToCart = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedColor || !selectedSize || stock <= 0) return;
    const ok = addItem({ productId: product.id, color: selectedColor, size: selectedSize, quantity: 1 });
    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1200);
    }
  };

  const badgeColors: Record<string, string> = {
    new: 'bg-noir-900 text-white',
    sale: 'bg-red-600 text-white',
    bestseller: 'bg-gold-400 text-noir-900',
  };

  const badgeLabels: Record<string, string> = {
    new: 'NOVO',
    sale: 'SALE',
    bestseller: 'BEST',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.6, delay: index * 0.08 }}>
      <Link to={`/product/${product.slug}`} className="group block">
        <div className="product-img-wrapper relative aspect-[3/4] overflow-hidden rounded-sm bg-noir-100" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
          {!imgLoaded && <div className="absolute inset-0 shimmer" />}
          <img src={fallbackImage(getProductImageUrl(productImage))} alt={product.name} className={cn('product-img h-full w-full object-cover transition-transform duration-700 ease-out', imgLoaded ? 'opacity-100' : 'opacity-0')} onLoad={() => setImgLoaded(true)} loading="lazy" />
          <div className="product-overlay absolute inset-0 bg-black/10 opacity-0 transition-opacity duration-300" />

          {product.badge && (
            <span className={cn('absolute left-3 top-3 px-2.5 py-1 text-[10px] font-bold tracking-wider', badgeColors[product.badge])}>
              {badgeLabels[product.badge]}
            </span>
          )}

          {stock > 0 && stock <= 4 && (
            <span className="absolute right-3 top-3 bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600">
              Últimas {stock}
            </span>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
            <div className="flex justify-center gap-2">
              <motion.button onClick={handleAddToCart} whileTap={{ scale: 0.95 }} disabled={!selectedColor || !selectedSize || stock <= 0} className={cn('quick-view-btn flex items-center gap-2 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider opacity-100 transition-all duration-300 sm:text-xs lg:translate-y-2 lg:opacity-0', added ? 'bg-emerald-600 text-white' : 'bg-white text-noir-900 hover:bg-noir-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60')}>
                <ShoppingBag className="h-3.5 w-3.5" />
                {added ? 'Adicionado!' : 'Adicionar'}
              </motion.button>
            </div>
          </div>

          {availableColors.length > 1 && isHovered && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="absolute right-3 top-12 flex flex-col gap-1.5">
              {availableColors.map(color => (
                <button key={color.name} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSelectedColor(color.name); const sizes = getAvailableSizes(product, color.name); setSelectedSize(sizes[0] || ''); }} className={cn('h-4 w-4 rounded-full border-2 transition-all', selectedColor === color.name ? 'scale-110 border-noir-900' : 'border-white/80')} style={{ backgroundColor: color.hex }} title={color.name} />
              ))}
            </motion.div>
          )}
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-noir-300 sm:text-[11px]">{product.brand} · {product.category}</p>
              <h3 className="mt-1 text-sm font-medium text-noir-900 underline-offset-2 group-hover:underline">{product.name}</h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-noir-900">{formatPrice(product.price)}</span>
            {product.originalPrice && <span className="text-xs text-noir-300 line-through">{formatPrice(product.originalPrice)}</span>}
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {availableSizes.map(size => (
              <span key={size} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSelectedSize(size); }} className={cn('cursor-pointer border px-1.5 py-0.5 text-[10px] transition-colors', selectedSize === size ? 'border-noir-900 bg-noir-900 text-white' : 'border-noir-200 text-noir-400')}>
                {size}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
