import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { getSettings, loadCatalogData } from '@/lib/data';

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Cat\u00e1logo', path: '/catalog' },
  { label: 'Novidades', path: '/catalog?filter=new' },
  { label: 'Sale', path: '/catalog?filter=sale' },
];

export default function Navbar() {
  const { totalItems, openCart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [storeName, setStoreName] = useState(getSettings().storeName);

  useEffect(() => {
    let mounted = true;
    loadCatalogData().then(({ settings }) => {
      if (mounted) setStoreName(settings.storeName);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 bg-noir-900 text-white transition-all duration-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between sm:h-16 lg:h-20">
            <nav className="hidden items-center gap-8 lg:flex">
              {NAV_LINKS.map(link => (
                <Link key={link.path} to={link.path} className="text-[13px] font-bold uppercase tracking-widest text-white/90 transition-opacity duration-200 hover:opacity-70">
                  {link.label}
                </Link>
              ))}
            </nav>

            <button onClick={() => setMobileMenuOpen(true)} className="text-white lg:hidden" aria-label="Abrir menu">
              <Menu className="h-7 w-7" />
            </button>

            <Link to="/" className="absolute left-1/2 -translate-x-1/2 lg:static lg:absolute lg:left-1/2 lg:-translate-x-1/2">
              <img
                src="/brand/frazon-logo.png"
                alt={storeName}
                className="h-[34px] w-auto object-contain md:h-[46px]"
              />
            </Link>

            <div className="flex items-center gap-4">
              <Link to="/catalog" className="hidden text-white/90 sm:block" aria-label="Buscar produtos">
                <Search className="h-[18px] w-[18px]" />
              </Link>
              <button onClick={openCart} className="relative text-white/90" aria-label="Abrir carrinho">
                <ShoppingBag className="h-7 w-7 sm:h-5 sm:w-5" />
                {totalItems > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-noir-900 text-[9px] font-bold text-white ring-1 ring-white/40">
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
                <h2 className="font-serif text-lg font-black uppercase tracking-[0.16em] text-noir-900">{storeName}</h2>
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
