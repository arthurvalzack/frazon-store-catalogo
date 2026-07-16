import { type KeyboardEvent, type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MessageCircle, Ruler, Shirt, Star, Truck } from 'lucide-react';
import {
  fallbackImage,
  formatPixDiscountBadge,
  formatPrice,
  defaultSettings,
  getActiveCategories,
  getActiveProducts,
  getAvailableColors,
  getAvailableSizes,
  getSettings,
  getProductImageUrl,
  isProductAvailable,
  loadCatalogData,
  normalizeWhatsapp,
  subscribeToCatalogDataChanges,
} from '@/lib/data';
import type { Category, Product, SiteSettings } from "@/types";
import { cn } from '@/utils/cn';

export default function Home() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>(getActiveProducts());
  const [categories, setCategories] = useState<Category[]>(getActiveCategories());
  const [settings, setSettings] = useState<SiteSettings>(() => getSettings());
  const [loadedHeroImages, setLoadedHeroImages] = useState<string[]>(() => {
    const initialHero = getSettings().heroImage.trim();
    return initialHero ? [initialHero] : [];
  });
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  const [heroDragOffset, setHeroDragOffset] = useState(0);
  const [heroDragging, setHeroDragging] = useState(false);
  const heroTouchStartX = useRef<number | null>(null);
  const heroSwipeMoved = useRef(false);
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const localHeroFallback = '/brand/frazon-hero-reference.png';
  const legacyHeroImage = settings.heroImage.trim();
  const fallbackHeroMobileAsset = settings.heroImageMobile.trim() || legacyHeroImage || settings.heroImageDesktop.trim() || localHeroFallback;
  const fallbackHeroDesktopAsset = settings.heroImageDesktop.trim() || legacyHeroImage || settings.heroImageMobile.trim() || localHeroFallback;
  const heroSlides = useMemo(() => {
    const configured = settings.homeBanners
      .slice(0, 4)
      .map((banner, index) => ({
        id: banner.id || `banner_${index + 1}`,
        slotIndex: index,
        mobile: banner.mobile.trim(),
        desktop: banner.desktop.trim(),
        link: sanitizeHeroBannerLink(banner.link || ''),
      }))
      .filter(banner => banner.mobile || banner.desktop);
    return configured.length
      ? configured
      : [{ id: 'fallback', slotIndex: 0, mobile: fallbackHeroMobileAsset, desktop: fallbackHeroDesktopAsset, link: '' }];
  }, [settings.homeBanners, fallbackHeroDesktopAsset, fallbackHeroMobileAsset]);
  const aboutImage = settings.editorialImage.trim() || '/brand/frazon-about-banner.png';
  const isHeroImageLoaded = (src: string) => Boolean(src && loadedHeroImages.includes(src));
  const heroButtonText = textSetting(settings.heroButtonText, defaultSettings.heroButtonText);
  const heroTopbarText1 = textSetting(settings.heroTopbarText1, defaultSettings.heroTopbarText1);
  const heroTopbarText2 = textSetting(settings.heroTopbarText2, defaultSettings.heroTopbarText2);
  const heroTopbarText3 = textSetting(settings.heroTopbarText3, defaultSettings.heroTopbarText3);
  const whatsappUrl = `https://wa.me/${normalizeWhatsapp(settings.whatsappNumber)}`;
  const showHeroButton = heroSlides[currentHeroSlide]?.slotIndex === 0;

  const handleCatalogRealtimeChange = useCallback((nextProducts: Product[], nextCategories: Category[], nextSettings: SiteSettings) => {
    setProducts(nextProducts.filter(isProductAvailable));
    setCategories(nextCategories.filter(category => category.isActive).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    setSettings(nextSettings);
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

  useEffect(() => subscribeToCatalogDataChanges(handleCatalogRealtimeChange), [handleCatalogRealtimeChange]);

  useEffect(() => {
    const heroAssets = Array.from(new Set(heroSlides.flatMap(slide => [slide.mobile || slide.desktop, slide.desktop || slide.mobile]).filter(Boolean)));
    if (!heroAssets.length) {
      setLoadedHeroImages([]);
      return;
    }

    let mounted = true;
    heroAssets.forEach(asset => {
      preloadHomeImage(asset, true, () => {
        if (!mounted) return;
        setLoadedHeroImages(prev => prev.includes(asset) ? prev : [...prev, asset]);
      });
    });
    return () => { mounted = false; };
  }, [heroSlides]);

  useEffect(() => {
    if (currentHeroSlide >= heroSlides.length) setCurrentHeroSlide(0);
  }, [currentHeroSlide, heroSlides.length]);

  useEffect(() => {
    if (heroSlides.length <= 1 || heroDragging) return undefined;
    const timer = window.setInterval(() => {
      setCurrentHeroSlide(current => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [heroDragging, heroSlides.length]);

  useEffect(() => {
    preloadHomeImage(aboutImage, false);
  }, [aboutImage]);

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

  const goToHeroSlide = useCallback((index: number) => {
    setCurrentHeroSlide(index);
    setHeroDragOffset(0);
  }, []);

  const goToNextHeroSlide = useCallback(() => {
    setCurrentHeroSlide(current => (current + 1) % heroSlides.length);
  }, [heroSlides.length]);

  const goToPreviousHeroSlide = useCallback(() => {
    setCurrentHeroSlide(current => (current - 1 + heroSlides.length) % heroSlides.length);
  }, [heroSlides.length]);

  const handleHeroTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (heroSlides.length <= 1) return;
    heroTouchStartX.current = event.touches[0]?.clientX ?? null;
    heroSwipeMoved.current = false;
    setHeroDragging(true);
  };

  const handleHeroTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (heroTouchStartX.current === null || heroSlides.length <= 1) return;
    const nextOffset = event.touches[0].clientX - heroTouchStartX.current;
    if (Math.abs(nextOffset) > 10) heroSwipeMoved.current = true;
    setHeroDragOffset(Math.max(-140, Math.min(140, nextOffset)));
  };

  const handleHeroTouchEnd = () => {
    if (heroSlides.length > 1) {
      if (heroDragOffset <= -45) goToNextHeroSlide();
      else if (heroDragOffset >= 45) goToPreviousHeroSlide();
    }
    heroTouchStartX.current = null;
    setHeroDragging(false);
    setHeroDragOffset(0);
  };

  const openHeroBannerLink = useCallback((link: string) => {
    const target = sanitizeHeroBannerLink(link);
    if (!target) return;
    if (heroSwipeMoved.current) {
      window.setTimeout(() => { heroSwipeMoved.current = false; }, 0);
      return;
    }

    if (target.startsWith('#')) {
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (target.startsWith('/')) {
      navigate(target);
      return;
    }

    try {
      const url = new URL(target, window.location.href);
      if (url.origin === window.location.origin) {
        navigate(`${url.pathname}${url.search}${url.hash}`);
        return;
      }
      window.open(url.href, '_blank', 'noopener,noreferrer');
    } catch {
      // Links invÃ¡lidos jÃ¡ sÃ£o removidos pelo sanitizador.
    }
  }, [navigate]);

  const handleHeroBannerKeyDown = (event: KeyboardEvent<HTMLDivElement>, link: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openHeroBannerLink(link);
  };

  return (
    <div className="min-h-screen w-full bg-cream-50 text-noir-900">
      <section className="w-full bg-black pt-14 text-white lg:pt-20">
        <div className="grid h-[46px] w-full grid-cols-[1fr_1.25fr_1fr] items-stretch overflow-hidden bg-[#c39217] text-[#111111] md:hidden">
          <span className="flex min-w-0 items-center justify-center gap-[5px] overflow-hidden border-r border-black/20 px-1 text-center font-sans text-[8px] font-bold uppercase leading-none tracking-[-0.01em]"><Star className="h-[14px] w-[14px] shrink-0 text-black" /><span className="overflow-hidden text-clip whitespace-nowrap">{heroTopbarText1}</span></span>
          <span className="flex min-w-0 items-center justify-center gap-[4px] overflow-hidden border-r border-black/20 px-1 text-center font-sans text-[7px] font-bold uppercase leading-none tracking-[-0.03em]"><MessageCircle className="h-[13px] w-[13px] shrink-0 text-black" /><span className="overflow-hidden text-clip whitespace-nowrap">{heroTopbarText2}</span></span>
          <span className="flex min-w-0 items-center justify-center gap-[5px] overflow-hidden px-1 text-center font-sans text-[8px] font-bold uppercase leading-none tracking-[-0.01em]"><Truck className="h-[14px] w-[14px] shrink-0 text-black" /><span className="overflow-hidden text-clip whitespace-nowrap">{heroTopbarText3}</span></span>
        </div>

        <div className="hidden h-14 w-full items-center justify-center border-y border-[#9f7615]/30 bg-black px-8 text-sm font-medium uppercase tracking-[0.04em] text-white md:flex">
          <div className="flex w-full max-w-7xl items-center justify-center gap-12 lg:gap-28">
            <span className="inline-flex items-center gap-4"><Star className="h-6 w-6 text-[#c99a22]" />{heroTopbarText1}</span>
            <span className="inline-flex items-center gap-4"><MessageCircle className="h-6 w-6 text-[#c99a22]" />{heroTopbarText2}</span>
            <span className="inline-flex items-center gap-4"><Truck className="h-7 w-7 text-[#c99a22]" />{heroTopbarText3}</span>
          </div>
        </div>

        <div
          className="relative min-h-[710px] w-full overflow-hidden bg-black sm:min-h-[760px] md:min-h-[720px] lg:aspect-[3000/1400] lg:min-h-0"
          onTouchStart={handleHeroTouchStart}
          onTouchMove={handleHeroTouchMove}
          onTouchEnd={handleHeroTouchEnd}
          onTouchCancel={handleHeroTouchEnd}
        >
          <HomeImagePlaceholder className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 overflow-hidden">
            <div
              className={`flex h-full ${heroDragging ? '' : 'transition-transform duration-700 ease-out'}`}
              style={{ transform: `translateX(calc(${-currentHeroSlide * 100}% + ${heroDragOffset}px))` }}
            >
              {heroSlides.map((slide, index) => {
                const mobileSrc = slide.mobile || slide.desktop;
                const desktopSrc = slide.desktop || slide.mobile;
                const bannerLink = slide.slotIndex === 0 ? '/catalog' : slide.link;
                return (
                  <div
                    key={slide.id}
                    role={bannerLink ? 'link' : undefined}
                    tabIndex={bannerLink ? 0 : undefined}
                    onClick={bannerLink ? () => openHeroBannerLink(bannerLink) : undefined}
                    onKeyDown={bannerLink ? event => handleHeroBannerKeyDown(event, bannerLink) : undefined}
                    className={`relative h-full w-full shrink-0 ${bannerLink ? 'cursor-pointer' : ''}`}
                    aria-label={bannerLink ? `Abrir banner ${index + 1}` : undefined}
                  >
                    <img
                      src={mobileSrc}
                      alt={`${settings.storeName} banner ${index + 1}`}
                      className={`absolute inset-0 h-full w-full object-cover object-[55%_center] transition-opacity duration-300 md:hidden ${isHeroImageLoaded(mobileSrc) ? 'opacity-100' : 'opacity-0'}`}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      onLoad={() => setLoadedHeroImages(prev => prev.includes(mobileSrc) ? prev : [...prev, mobileSrc])}
                    />
                    <img
                      src={desktopSrc}
                      alt={`${settings.storeName} banner ${index + 1}`}
                      className={`absolute inset-0 hidden h-full w-full object-cover object-[55%_center] transition-opacity duration-300 md:block lg:object-contain lg:object-center ${isHeroImageLoaded(desktopSrc) ? 'opacity-100' : 'opacity-0'}`}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      onLoad={() => setLoadedHeroImages(prev => prev.includes(desktopSrc) ? prev : [...prev, desktopSrc])}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {showHeroButton && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75 }} className="absolute bottom-[150px] left-[30px] right-6 z-10 overflow-visible md:hidden">
            <Link to="/catalog" className="group flex h-[60px] w-[310px] max-w-[calc(100vw-60px)] items-center justify-between whitespace-nowrap border border-[#c99a22] bg-transparent px-[22px] text-[15px] font-semibold uppercase tracking-[0.08em] text-white transition-colors [font-family:'Montserrat',sans-serif] hover:bg-[#c99a22]/12">
              {heroButtonText}
              <ArrowRight className="h-[22px] w-[22px] shrink-0 text-[#c99a22] transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
          )}

          {showHeroButton && (
          <div className="absolute inset-0 z-20 hidden w-full lg:block">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75 }} className="absolute left-[18%] top-[64%] -translate-x-1/2">
              <Link to="/catalog" className="group inline-flex h-[64px] w-[390px] items-center justify-between whitespace-nowrap border border-[#c99a22] bg-transparent px-11 text-xl font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#c99a22]/12">
                {heroButtonText}
                <ArrowRight className="h-7 w-7 text-[#c99a22] transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </div>
          )}

          {heroSlides.length > 1 && (
            <div className="absolute bottom-[36px] left-0 right-0 z-10 flex justify-center gap-2.5">
              {heroSlides.map((slide, index) => (
                <button
                  key={`${slide.id}-dot`}
                  type="button"
                  aria-label={`Ir para banner ${index + 1}`}
                  onClick={() => goToHeroSlide(index)}
                  className={`h-1.5 rounded-full transition-all ${index === currentHeroSlide ? 'w-5 bg-white/80' : 'w-1.5 bg-white/35 hover:bg-white/60'}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="catalogo" className="w-full bg-cream-50 px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionTitle>Categorias</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-6">
            {categories.map((category, index) => (
              <motion.div key={category.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.04, duration: 0.45 }}>
                <Link to={`/catalog?category=${encodeURIComponent(category.slug)}`} className="group relative block aspect-[1.65/1] overflow-hidden rounded-lg bg-noir-200 lg:aspect-[1.75/1]">
                  <img src={fallbackImage(category.imageUrl)} alt={category.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/48" />
                  <div className="absolute inset-0 flex items-center justify-center px-3 text-center">
                    <span className="text-lg font-black uppercase tracking-[0.03em] text-white drop-shadow sm:text-2xl lg:text-3xl">{category.name}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full bg-cream-50 px-4 pb-10 sm:px-6 lg:px-8 lg:pb-16">
        <div className="mx-auto max-w-7xl">
          <SectionTitle>Novidades da Frazon</SectionTitle>
          <ProductGrid products={newArrivals} loading={loading} />
        </div>
      </section>

      <section className="w-full bg-cream-50 px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-lg bg-noir-900 px-6 py-7 text-white sm:px-10 lg:px-16 lg:py-10">
            <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_20%,#c99a22_0_1px,transparent_1px),linear-gradient(135deg,transparent_48%,rgba(201,154,34,0.35)_49%,transparent_51%)] [background-size:34px_34px,120px_120px]" />
            <div className="relative z-10 flex flex-col items-center gap-5 text-center md:flex-row md:justify-between md:text-left">
              <div className="flex items-center gap-5">
                <div className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white/10 shadow-2xl sm:flex">
                  <MessageCircle className="h-16 w-16 text-[#c99a22]" strokeWidth={2.2} />
                </div>
                <h2 className="max-w-xl text-2xl font-black uppercase leading-tight tracking-[0.04em] lg:text-4xl">
                  Escolha sua pe&ccedil;a e finalize no <span className="text-[#c99a22]">WhatsApp</span>
                </h2>
              </div>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded bg-[#c99a22] px-7 py-3 text-xs font-black uppercase tracking-[0.08em] text-black transition-colors hover:bg-[#d6aa35] lg:px-9 lg:py-4">
                <MessageCircle className="h-4 w-4 text-black" />
                Chamar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-cream-50 px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionTitle>Cat&aacute;logo Completo</SectionTitle>
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:justify-center">
            <button onClick={() => setSelectedCatalogCategory('')} className={`shrink-0 rounded-md px-5 py-3 text-[10px] font-black uppercase tracking-[0.08em] transition-colors ${!selectedCatalogCategory ? 'bg-black text-white' : 'bg-noir-100 text-noir-700 hover:bg-noir-200'}`}>
              Todos
            </button>
            {categories.map(category => (
              <button key={category.id} onClick={() => setSelectedCatalogCategory(category.slug)} className={`shrink-0 rounded-md px-5 py-3 text-[10px] font-black uppercase tracking-[0.08em] transition-colors ${selectedCatalogCategory === category.slug ? 'bg-black text-white' : 'bg-noir-100 text-noir-700 hover:bg-noir-200'}`}>
                {category.name}
              </button>
            ))}
          </div>
          <ProductGrid products={catalogProducts} loading={loading} />
        </div>
      </section>

      <section className="w-full bg-cream-50 px-3 pb-0 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl border-t border-noir-100 pb-8 pt-6 lg:pb-14 lg:pt-8">
          <FinalSectionTitle>Como Comprar</FinalSectionTitle>
          <div className="grid grid-cols-3 gap-2 pt-1 sm:gap-4 lg:gap-10">
            <HowToStep icon={<Shirt className="h-6 w-6 sm:h-10 sm:w-10" />} number="1." title={<>Escolha<br />a pe&ccedil;a</>} text={<>Navegue pelo cat&aacute;logo<br />e escolha seu estilo.</>} />
            <HowToStep icon={<Ruler className="h-6 w-6 sm:h-10 sm:w-10" />} number="2." title={<>Selecione<br />tamanho e cor</>} text={<>Informe o tamanho<br />e a cor desejada.</>} />
            <HowToStep icon={<MessageCircle className="h-6 w-6 sm:h-10 sm:w-10" />} number="3." title={<>Finalize pelo<br />WhatsApp</>} text={<>Fale com nossa equipe<br />e finalize seu pedido.</>} />
          </div>
        </div>
      </section>

      <section
        className="w-full bg-noir-900 bg-cover bg-[70%_center] bg-no-repeat text-white sm:bg-center lg:bg-[center_right]"
        style={{ backgroundImage: `url("${aboutImage}")` }}
      >
        <div className="mx-auto flex min-h-[210px] max-w-7xl items-center px-5 py-5 sm:min-h-[260px] sm:px-8 lg:min-h-[340px] lg:px-10 lg:py-12">
          <div className="w-[58%] max-w-[260px] lg:w-[42%] lg:max-w-lg">
            <h2 className="whitespace-nowrap text-[16px] font-extrabold uppercase leading-tight tracking-[0.04em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-[18px] lg:text-3xl">Sobre a Frazon Store</h2>
            <div className="mb-4 mt-2 h-[2px] w-12 bg-white lg:w-16" />
            <p className="text-[10px] font-medium leading-[1.55] text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] sm:text-[12px] lg:text-base">
              A Frazon Store nasceu da rua e para a rua.<br />
              Criamos pe&ccedil;as que unem presen&ccedil;a, conforto<br />
              e autenticidade para homens que vivem<br />
              seu prop&oacute;sito com atitude.
            </p>
            <p className="mt-2 text-[10px] font-extrabold leading-[1.55] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] sm:text-[12px] lg:text-base">Vista sua ess&ecirc;ncia. Vista Frazon.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function textSetting(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function sanitizeHeroBannerLink(value: string): string {
  const url = value.trim();
  if (!url) return '';
  const lower = url.slice(0, 32).toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:') || lower.startsWith('javascript:')) return '';
  if (url.length > 2048) return '';
  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) return url;
  return '';
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
    <div className="mb-7 flex items-center justify-center gap-6 text-center lg:mb-10">
      <span className="h-px w-10 bg-noir-900 lg:w-16" />
      <h2 className="text-2xl font-black uppercase tracking-[0.06em] text-noir-900 sm:text-3xl lg:text-4xl">{children}</h2>
      <span className="h-px w-10 bg-noir-900 lg:w-16" />
    </div>
  );
}

function FinalSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-center gap-3 text-center sm:mb-8 sm:gap-6">
      <span className="h-px flex-1 bg-noir-200" />
      <span className="h-px w-6 bg-noir-900 sm:w-9" />
      <h2 className="shrink-0 text-xl font-black uppercase tracking-[0.05em] text-noir-900 sm:text-3xl lg:text-4xl">{children}</h2>
      <span className="h-px w-6 bg-noir-900 sm:w-9" />
      <span className="h-px flex-1 bg-noir-200" />
    </div>
  );
}

function ProductGrid({ products, loading }: { products: Product[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-square shimmer rounded-lg" />)}
      </div>
    );
  }

  if (!products.length) {
    return <p className="py-8 text-center text-sm text-noir-400">Nenhum produto dispon&iacute;vel no momento.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
      {products.map((product, index) => (
        <HomeProductCard key={product.id} product={product} index={index} />
      ))}
    </div>
  );
}

function HomeProductCard({ product, index }: { product: Product; index: number }) {
  const availableColors = useMemo(() => getAvailableColors(product), [product]);
  const initialColor = availableColors[0]?.name || '';
  const [selectedColor] = useState(initialColor);
  const availableSizes = useMemo(() => getAvailableSizes(product, selectedColor), [product, selectedColor]);
  const [selectedSize, setSelectedSize] = useState(availableSizes[Math.floor(availableSizes.length / 2)] || availableSizes[0] || '');
  const pixDiscountBadge = formatPixDiscountBadge(product.pixDiscountPercent);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, delay: index * 0.04 }}>
      <Link to={`/product/${product.slug}`} className="group block">
        <div className="product-img-wrapper relative aspect-[3/4] overflow-hidden rounded-sm bg-noir-100">
          <img src={fallbackImage(getProductImageUrl(product.images[0]))} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
          {product.badge && (
            <span className={`absolute left-3 top-3 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${product.badge === 'sale' ? 'bg-red-600 text-white' : product.badge === 'bestseller' ? 'bg-gold-400 text-noir-900' : 'bg-noir-900 text-white'}`}>
              {product.badge === 'new' ? 'NOVO' : product.badge === 'sale' ? 'SALE' : 'BEST'}
            </span>
          )}
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-noir-300 sm:text-[11px]">{product.brand} &middot; {product.category}</p>
              <h3 className="mt-1 text-sm font-medium text-noir-900 underline-offset-2 group-hover:underline">{product.name}</h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-noir-900">{formatPrice(product.price)}</span>
            {pixDiscountBadge && <span className="rounded bg-gold-400 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.04em] text-noir-900">{pixDiscountBadge}</span>}
          </div>
          {product.originalPrice && <p className="text-xs text-noir-300 line-through">{formatPrice(product.originalPrice)}</p>}
          <div className="flex flex-wrap gap-1 pt-1">
            {availableSizes.map(size => (
              <span key={size} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSelectedSize(size); }} className={cn('cursor-pointer border px-1.5 py-0.5 text-[10px] transition-colors', selectedSize === size ? 'border-noir-900 bg-noir-900 text-white' : 'border-noir-200 text-noir-400')}>
                {size}
              </span>
            ))}
          </div>
          <span className="mt-3 inline-flex border border-noir-300 px-5 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition-colors group-hover:border-noir-900 group-hover:bg-noir-900 group-hover:text-white">
            Ver produto
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function HowToStep({ icon, number, title, text }: { icon: React.ReactNode; number: string; title: React.ReactNode; text: React.ReactNode }) {
  return (
    <div className="relative text-center [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:left-[calc(100%-0.55rem)] [&:not(:last-child)]:after:top-[2.35rem] [&:not(:last-child)]:after:h-px [&:not(:last-child)]:after:w-7 [&:not(:last-child)]:after:bg-noir-200 sm:[&:not(:last-child)]:after:left-[calc(100%-2.3rem)] sm:[&:not(:last-child)]:after:top-16 sm:[&:not(:last-child)]:after:w-[4.6rem] lg:[&:not(:last-child)]:after:left-[calc(100%-3.8rem)] lg:[&:not(:last-child)]:after:w-[7.6rem]">
      <div className="mx-auto flex max-w-[118px] flex-col items-center justify-start gap-2 sm:max-w-none sm:flex-row sm:justify-center sm:gap-5 lg:gap-7">
        <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-black text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.06),0_8px_18px_rgba(0,0,0,0.18)] sm:h-[86px] sm:w-[86px] lg:h-[104px] lg:w-[104px]">
          {icon}
        </div>
        <div className="flex items-start justify-center gap-1.5 text-left sm:gap-3">
          <span className="text-2xl font-black leading-none text-noir-900 sm:text-3xl lg:text-4xl">{number}</span>
          <h3 className="max-w-[72px] text-[10px] font-black uppercase leading-[1.05] tracking-[0.02em] text-noir-900 sm:max-w-40 sm:text-sm lg:text-lg">{title}</h3>
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-[102px] text-[10px] font-medium leading-tight text-noir-400 sm:mt-3 sm:max-w-56 sm:text-sm lg:text-base">{text}</p>
    </div>
  );
}

function HomeImagePlaceholder({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <div className={`${className} bg-[linear-gradient(135deg,#050505_0%,#1b1b1d_42%,#050505_100%)]`}>
      <div className="h-full w-full shimmer opacity-10" />
    </div>
  );
}
