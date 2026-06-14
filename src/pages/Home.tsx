import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, Ruler, Shirt } from 'lucide-react';
import {
  fallbackImage,
  formatPrice,
  getActiveCategories,
  getActiveProducts,
  getSettings,
  isProductAvailable,
  loadCatalogData,
  normalizeWhatsapp,
  subscribeToProductsChanges,
} from '@/lib/data';
import type { Category, Product, SiteSettings } from '@/types';

export default function Home() {
  const [products, setProducts] = useState<Product[]>(getActiveProducts());
  const [categories, setCategories] = useState<Category[]>(getActiveCategories());
  const [settings, setSettings] = useState<SiteSettings>(() => getSettings());
  const [loadedHeroImage, setLoadedHeroImage] = useState(() => getSettings().heroImage.trim());
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const heroImage = settings.heroImage.trim();
  const heroImageLoaded = Boolean(heroImage && loadedHeroImage === heroImage);
  const whatsappUrl = `https://wa.me/${normalizeWhatsapp(settings.whatsappNumber)}`;

  const handleProductsRealtimeChange = useCallback((nextProducts: Product[]) => {
    setProducts(nextProducts.filter(isProductAvailable));
  }, []);

  useEffect(() => {
    let mounted = true;
    loadCatalogData().then(data => {
      if (!mounted) return;
      setProducts(data.products.filter(isProductAvailable));
      setCategories(data.categories.filter(category => category.isActive).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
      setSettings(data.settings);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => subscribeToProductsChanges(handleProductsRealtimeChange), [handleProductsRealtimeChange]);

  useEffect(() => {
    if (!heroImage) {
      setLoadedHeroImage('');
      return;
    }

    let mounted = true;
    preloadHomeImage(heroImage, true, () => {
      if (mounted) setLoadedHeroImage(heroImage);
    });
    return () => { mounted = false; };
  }, [heroImage]);

  useEffect(() => {
    if (settings.editorialImage) preloadHomeImage(settings.editorialImage, false);
  }, [settings.editorialImage]);

  const availableProducts = useMemo(() => products.filter(isProductAvailable), [products]);
  const newArrivals = useMemo(() => {
    const byBadge = availableProducts.filter(product => product.badge === 'new');
    return (byBadge.length ? byBadge : availableProducts).slice(0, 4);
  }, [availableProducts]);

  const catalogProducts = useMemo(() => {
    if (!selectedCatalogCategory) return availableProducts.slice(0, 8);
    const category = categories.find(item => item.slug === selectedCatalogCategory);
    return availableProducts
      .filter(product => product.categoryId === selectedCatalogCategory || product.category === category?.name || product.category === selectedCatalogCategory)
      .slice(0, 8);
  }, [availableProducts, categories, selectedCatalogCategory]);

  return (
    <div className="bg-noir-900 text-noir-900">
      <div className="mx-auto max-w-[860px] overflow-hidden bg-cream-50 shadow-[0_0_42px_rgba(255,255,255,0.16)]">
        <section className="relative flex min-h-[420px] items-center overflow-hidden bg-noir-900 px-8 pt-20 text-white sm:min-h-[500px] sm:px-14 lg:min-h-[560px]">
          <HomeImagePlaceholder className="absolute inset-0 h-full w-full" />
          {heroImage && (
            <img
              src={heroImage}
              alt={settings.storeName}
              className={`absolute inset-0 h-full w-full object-cover object-[center_top] transition-opacity duration-300 ${heroImageLoaded ? 'opacity-55' : 'opacity-0'}`}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setLoadedHeroImage(heroImage)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/65 to-black/20" />
          <div className="relative z-10 max-w-[360px]">
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }} className="text-[38px] font-black uppercase leading-[0.95] tracking-[0.03em] sm:text-6xl">
              Frazon<br />Store
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.12 }} className="mt-4 text-sm font-medium uppercase tracking-[0.22em] text-white/80 sm:text-base">
              Para quem vive a rua.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.2 }}>
              <Link to="/catalog" className="mt-8 inline-flex min-w-44 items-center justify-center border border-white/80 px-8 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-noir-900">
                Ver cole&ccedil;&atilde;o
              </Link>
            </motion.div>
          </div>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
            <span className="h-1 w-9 rounded-full bg-white" />
            <span className="h-1 w-9 rounded-full bg-white/35" />
          </div>
        </section>

        <section className="px-6 py-9 sm:px-11 sm:py-11">
          <SectionTitle>Categorias</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {categories.slice(0, 6).map((category, index) => (
              <motion.div key={category.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.04, duration: 0.45 }}>
                <Link to={`/catalog?category=${encodeURIComponent(category.slug)}`} className="group relative block aspect-[2.08/1] overflow-hidden rounded-lg bg-noir-200">
                  <img src={fallbackImage(category.imageUrl)} alt={category.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-black/28 transition-colors group-hover:bg-black/42" />
                  <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
                    <span className="text-2xl font-black uppercase tracking-[0.04em] text-white drop-shadow">{category.name}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="px-6 pb-5 sm:px-11">
          <SectionTitle>Novidades da Frazon</SectionTitle>
          <ProductGrid products={newArrivals} loading={loading} compact />
        </section>

        <section className="px-4 py-4 sm:px-4">
          <div className="relative overflow-hidden rounded-lg bg-noir-900 px-6 py-7 text-white sm:px-16">
            <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_20%,#4ade80_0_1px,transparent_1px),linear-gradient(135deg,transparent_48%,rgba(74,222,128,0.35)_49%,transparent_51%)] [background-size:34px_34px,120px_120px]" />
            <div className="relative z-10 flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-center sm:text-left">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/10 shadow-2xl">
                <MessageCircle className="h-16 w-16" strokeWidth={2.2} />
              </div>
              <div>
                <h2 className="max-w-md text-2xl font-black uppercase leading-tight tracking-[0.04em]">
                  Escolha sua pe&ccedil;a e<br className="hidden sm:block" /> finalize no <span className="text-green-500">WhatsApp</span>
                </h2>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded bg-green-500 px-7 py-3 text-xs font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-green-600">
                  <MessageCircle className="h-4 w-4" />
                  Chamar no WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-8 sm:px-11">
          <SectionTitle>Cat&aacute;logo Completo</SectionTitle>
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setSelectedCatalogCategory('')} className={`shrink-0 rounded-md px-5 py-3 text-[10px] font-black uppercase tracking-[0.08em] transition-colors ${!selectedCatalogCategory ? 'bg-black text-white' : 'bg-noir-100 text-noir-700 hover:bg-noir-200'}`}>
              Todos
            </button>
            {categories.slice(0, 6).map(category => (
              <button key={category.id} onClick={() => setSelectedCatalogCategory(category.slug)} className={`shrink-0 rounded-md px-5 py-3 text-[10px] font-black uppercase tracking-[0.08em] transition-colors ${selectedCatalogCategory === category.slug ? 'bg-black text-white' : 'bg-noir-100 text-noir-700 hover:bg-noir-200'}`}>
                {category.name}
              </button>
            ))}
          </div>
          <ProductGrid products={catalogProducts} loading={loading} />
        </section>

        <section className="px-6 pb-8 sm:px-11">
          <SectionTitle>Como Comprar</SectionTitle>
          <div className="grid gap-5 border-t border-noir-100 pt-6 sm:grid-cols-3 sm:gap-8">
            <HowToStep icon={<Shirt className="h-8 w-8" />} number="1." title={<>Escolha a pe&ccedil;a</>} text={<>Navegue pelo cat&aacute;logo e escolha seu estilo.</>} />
            <HowToStep icon={<Ruler className="h-8 w-8" />} number="2." title="Selecione tamanho e cor" text="Informe o tamanho e a cor desejada." />
            <HowToStep icon={<MessageCircle className="h-8 w-8" />} number="3." title="Finalize pelo WhatsApp" text="Fale com nossa equipe e finalize seu pedido." />
          </div>
        </section>

        <section className="relative grid min-h-[250px] overflow-hidden bg-noir-900 text-white sm:grid-cols-[0.9fr_1.1fr]">
          <div className="relative z-10 p-8 sm:p-11">
            <h2 className="text-2xl font-black uppercase tracking-[0.04em]">Sobre a Frazon Store</h2>
            <div className="mt-3 h-px w-24 bg-white" />
            <p className="mt-6 max-w-[320px] text-sm leading-relaxed text-white/80">
              A Frazon Store nasceu da rua e para a rua. Criamos pe&ccedil;as que unem presen&ccedil;a, conforto e autenticidade para homens que vivem seu prop&oacute;sito com atitude.
            </p>
            <p className="mt-3 text-sm font-black">Vista sua ess&ecirc;ncia. Vista Frazon.</p>
          </div>
          <div className="relative min-h-[230px]">
            {settings.editorialImage || heroImage ? (
              <img src={fallbackImage(settings.editorialImage || heroImage)} alt="Sobre a Frazon Store" className="absolute inset-0 h-full w-full object-cover opacity-70" loading="lazy" decoding="async" />
            ) : (
              <HomeImagePlaceholder className="absolute inset-0" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-noir-900 via-noir-900/25 to-transparent" />
          </div>
        </section>
      </div>
    </div>
  );
}

function preloadHomeImage(src: string, highPriority: boolean, onLoad?: () => void) {
  const url = src.trim();
  if (!url) return;

  if (highPriority && typeof document !== 'undefined') {
    const preloadId = 'frazon-home-hero-preload';
    let link = document.getElementById(preloadId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = preloadId;
      link.rel = 'preload';
      link.as = 'image';
      document.head.appendChild(link);
    }
    if (link.href !== url) link.href = url;
  }

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => onLoad?.();
  img.onerror = () => onLoad?.();
  img.src = url;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-7 text-center">
      <span className="h-px w-10 bg-noir-900" />
      <h2 className="text-2xl font-black uppercase tracking-[0.06em] text-noir-900 sm:text-3xl">{children}</h2>
      <span className="h-px w-10 bg-noir-900" />
    </div>
  );
}

function ProductGrid({ products, loading, compact = false }: { products: Product[]; loading: boolean; compact?: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-square shimmer rounded-lg" />)}
      </div>
    );
  }

  if (!products.length) {
    return <p className="py-8 text-center text-sm text-noir-400">Nenhum produto dispon&iacute;vel no momento.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {products.map((product, index) => (
        <HomeProductCard key={product.id} product={product} index={index} compact={compact} />
      ))}
    </div>
  );
}

function HomeProductCard({ product, index, compact }: { product: Product; index: number; compact?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, delay: index * 0.04 }}>
      <Link to={`/product/${product.slug}`} className="group block text-center">
        <div className={`relative overflow-hidden rounded-lg bg-noir-100 ${compact ? 'aspect-square' : 'aspect-[1.05/1]'}`}>
          <img src={fallbackImage(product.images[0])} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
          {product.badge && (
            <span className="absolute left-2 top-2 rounded bg-noir-900 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white">
              {product.badge === 'new' ? 'Novo' : product.badge === 'sale' ? 'Sale' : 'Best'}
            </span>
          )}
        </div>
        <h3 className="mx-auto mt-3 min-h-9 max-w-[150px] text-[11px] font-black uppercase leading-tight text-noir-900 group-hover:underline">
          {product.name}
        </h3>
        <p className="mt-1 text-sm font-black text-noir-900">{formatPrice(product.price)}</p>
        {compact && (
          <span className="mt-3 inline-flex border border-noir-300 px-5 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition-colors group-hover:border-noir-900 group-hover:bg-noir-900 group-hover:text-white">
            Ver produto
          </span>
        )}
      </Link>
    </motion.div>
  );
}

function HowToStep({ icon, number, title, text }: { icon: React.ReactNode; number: string; title: React.ReactNode; text: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-noir-900 text-white">
        {icon}
      </div>
      <div className="mt-3 flex items-start justify-center gap-2">
        <span className="text-xl font-black">{number}</span>
        <h3 className="max-w-28 text-left text-xs font-black uppercase leading-tight">{title}</h3>
      </div>
      <p className="mx-auto mt-2 max-w-36 text-xs leading-snug text-noir-400">{text}</p>
    </div>
  );
}

function HomeImagePlaceholder({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <div className={`${className} bg-[linear-gradient(135deg,#0f0f10_0%,#242424_45%,#0a0a0a_100%)]`}>
      <div className="h-full w-full shimmer opacity-20" />
    </div>
  );
}
