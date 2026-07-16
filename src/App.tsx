import { useEffect, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

import { CartProvider } from "@/context/CartContext";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartSidebar from "@/components/CartSidebar";
import MetaPageTracker from "@/components/MetaPageTracker";
import CookieConsent from "@/components/CookieConsent";

import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import ProductDetail from "@/pages/ProductDetail";
import Admin from "@/pages/Admin";


function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [pathname]);

  return null;
}

interface StoreLayoutProps {
  children: ReactNode;
}

function StoreLayout({ children }: StoreLayoutProps) {
  return (
    <>
      <Navbar />
      <CartSidebar />

      <main className="min-h-screen">{children}</main>

      <Footer />
      <CookieConsent />
    </>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center pt-20">
      <div className="px-4 text-center">
        <h1 className="mb-4 font-display text-6xl font-bold text-noir-900">
          404
        </h1>

        <p className="mb-8 text-noir-400">Página não encontrada</p>

        <a
          href="/"
          className="bg-noir-900 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-noir-700"
        >
          Voltar ao início
        </a>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Área administrativa sem o layout da loja */}
      <Route path="/admin" element={<Admin />} />

      {/* Páginas públicas da loja */}
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

      {/* Página não encontrada */}
      <Route
        path="*"
        element={
          <StoreLayout>
            <NotFound />
          </StoreLayout>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <MetaPageTracker />
        <ScrollToTop />
        <AppRoutes />
      </CartProvider>
    </BrowserRouter>
  );
}