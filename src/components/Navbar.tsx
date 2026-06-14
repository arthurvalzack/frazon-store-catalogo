import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { getSettings, loadCatalogData } from '@/lib/data';
import { cn } from '@/utils/cn';

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Catálogo', path: '/catalog' },
  { label: 'Novidades', path: '/catalog?filter=new' },
  { label: 'Sale', path: '/catalog?filter=sale' },
];

export default function Navbar() {
  const { totalItems, openCart } = useCart();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [storeName, setStoreName] = useState(getSettings().storeName);
  const isHome = location.pathname === '/';

  useEffect(() => {
    let mounted = true;
    loadCatalogData().then(({ settings }) => {
      if (mounted) setStoreName(settings.storeName);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <header className={cn(
        'fixed left-0 right-0 top-0 z-50 transition-all duration-500',
        isHome ? 'bg-transparent text-white' : 'border-b border-noir-100 bg-white/95 text-noir-900 backdrop-blur-md'
      )}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between sm:h-16 lg:h-20">
            <nav className="hidden items-center gap-8 lg:flex">
              {NAV_LINKS.map(link => (
                <Link key={link.path} to={link.path} className={cn('text-[13px] font-medium uppercase tracking-widest transition-opacity duration-200 hover:opacity-70', isHome ? 'text-white/90' : 'text-noir-500')}>
                  {link.label}
                </Link>
              ))}
            </nav>

            <button onClick={() => setMobileMenuOpen(true)} className={cn('lg:hidden', isHome ? 'text-white' : 'text-noir-900')} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>

            <Link to="/" className="absolute left-1/2 -translate-x-1/2 lg:static lg:absolute lg:left-1/2 lg:-translate-x-1/2">
              <h1 className={cn('text-lg font-black uppercase tracking-[0.16em] font-display sm:text-2xl lg:text-3xl lg:tracking-[0.25em]', isHome ? 'text-white' : 'text-noir-900')}>
                {storeName}
              </h1>
            </Link>

            <div className="flex items-center gap-4">
              <Link to="/catalog" className={cn('hidden sm:block', isHome ? 'text-white/90' : 'text-noir-500')} aria-label="Buscar produtos">
                <Search className="h-[18px] w-[18px]" />
              </Link>
              <button onClick={openCart} className={cn('relative', isHome ? 'text-white/90' : 'text-noir-900')} aria-label="Abrir carrinho">
                <ShoppingBag className="h-5 w-5" />
                {totalItems > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-noir-900 text-[9px] font-bold text-white">
                    {totalItems}
                  </motion.span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed inset-y-0 left-0 z-[70] w-[86vw] max-w-80 bg-white">
              <div className="flex items-center justify-between border-b border-noir-100 p-6">
                <h2 className="text-lg font-black uppercase tracking-[0.16em] font-display text-noir-900">{storeName}</h2>
                <button onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu">
                  <X className="h-5 w-5 text-noir-900" />
                </button>
              </div>
              <nav className="space-y-1 p-6">
                {NAV_LINKS.map(link => (
                  <Link key={link.path} to={link.path} onClick={() => setMobileMenuOpen(false)} className="flex items-center py-3 text-sm font-medium uppercase tracking-widest text-noir-700 transition-colors hover:text-noir-900">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
