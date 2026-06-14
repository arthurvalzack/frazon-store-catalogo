import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { CartProvider } from '@/context/CartContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartSidebar from '@/components/CartSidebar';
import Home from '@/pages/Home';
import Catalog from '@/pages/Catalog';
import ProductDetail from '@/pages/ProductDetail';
import Admin from '@/pages/Admin';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <CartSidebar />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Admin - separate layout */}
      <Route path="/admin" element={<Admin />} />

      {/* Customer pages - store layout */}
      <Route
        path="/"
        element={
          <StoreLayout>
            <Home />
          </StoreLayout>
        }
      />
      <Route
        path="/catalog"
        element={
          <StoreLayout>
            <Catalog />
          </StoreLayout>
        }
      />
      <Route
        path="/product/:slug"
        element={
          <StoreLayout>
            <ProductDetail />
          </StoreLayout>
        }
      />

      {/* 404 */}
      <Route path="*" element={<StoreLayout><NotFound /></StoreLayout>} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center pt-20">
      <div className="text-center px-4">
        <h1 className="text-6xl font-display font-bold text-noir-900 mb-4">404</h1>
        <p className="text-noir-400 mb-8">Página não encontrada</p>
        <a href="/" className="px-6 py-3 bg-noir-900 text-white text-xs font-semibold tracking-wider uppercase hover:bg-noir-700 transition-colors">
          Voltar ao Início
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <ScrollToTop />
        <AppRoutes />
      </CartProvider>
    </BrowserRouter>
  );
}
