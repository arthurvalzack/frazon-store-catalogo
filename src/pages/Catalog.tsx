import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { getActiveCategories, getActiveProducts, isProductAvailable, loadCatalogData, subscribeToProductsChanges } from '@/lib/data';
import type { Category, Product } from '@/types';

export default function Catalog() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>(getActiveProducts());
  const [categories, setCategories] = useState<Category[]>(getActiveCategories());
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const perPage = 12;
  const filterParam = searchParams.get('filter');

  const handleProductsRealtimeChange = useCallback((nextProducts: Product[]) => {
    setProducts(nextProducts.filter(isProductAvailable));
  }, []);

  useEffect(() => {
    let mounted = true;
    loadCatalogData().then(data => {
      if (!mounted) return;
      setProducts(data.products.filter(isProductAvailable));
      setCategories(data.categories.filter(category => category.isActive));
      setSelectedCategory(searchParams.get('category') || '');
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [searchParams]);

  useEffect(() => {
    return subscribeToProductsChanges(handleProductsRealtimeChange);
  }, [handleProductsRealtimeChange]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, filterParam, sortBy]);

  const selectedCategoryName = useMemo(() => categories.find(category => category.slug === selectedCategory)?.name || selectedCategory, [categories, selectedCategory]);

  const filtered = useMemo(() => {
    let result = [...products];
    if (selectedCategory) {
      const categoryName = categories.find(category => category.slug === selectedCategory)?.name;
      result = result.filter(product => product.categoryId === selectedCategory || product.category === categoryName || product.category === selectedCategory);
    }
    if (filterParam === 'new') result = result.filter(product => product.badge === 'new');
    if (filterParam === 'sale') result = result.filter(product => product.badge === 'sale');
    if (filterParam === 'bestseller') result = result.filter(product => product.badge === 'bestseller');

    switch (sortBy) {
      case 'price-asc': return result.sort((a, b) => a.price - b.price);
      case 'price-desc': return result.sort((a, b) => b.price - a.price);
      case 'name': return result.sort((a, b) => a.name.localeCompare(b.name));
      default: return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [categories, filterParam, products, selectedCategory, sortBy]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const title = filterParam === 'new' ? 'Novidades' : filterParam === 'sale' ? 'Sale' : filterParam === 'bestseller' ? 'Mais vendidos' : selectedCategoryName || 'Catálogo';

  return (
    <div className="min-h-screen bg-cream-50 pt-20 lg:pt-24">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-noir-300">{filterParam === 'new' ? 'Acabou de chegar' : filterParam === 'sale' ? 'Promoções' : 'Coleção completa'}</p>
          <h1 className="text-3xl text-noir-900 font-display sm:text-4xl lg:text-5xl">{title}</h1>
          <p className="mt-2 text-sm text-noir-400">{filtered.length} produto{filtered.length !== 1 ? 's' : ''} disponível{filtered.length !== 1 ? 'is' : ''}</p>
        </motion.div>

        <div className="mt-8 flex items-center justify-between border-t border-noir-100 pt-6">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-noir-500 transition-colors hover:text-noir-900">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {selectedCategory && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-noir-900 text-[9px] text-white">1</span>}
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-noir-400 sm:inline">Ordenar:</span>
            <select value={sortBy} onChange={event => setSortBy(event.target.value)} className="cursor-pointer border-none bg-transparent text-xs font-medium text-noir-700 focus:outline-none">
              <option value="newest">Mais recentes</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
              <option value="name">Nome A-Z</option>
            </select>
          </div>
        </div>

        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
            <div className="border-b border-noir-100 py-6">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedCategory('')} className={`border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${!selectedCategory ? 'border-noir-900 bg-noir-900 text-white' : 'border-noir-200 text-noir-500 hover:border-noir-900'}`}>Todos</button>
                {categories.map(category => (
                  <button key={category.id} onClick={() => setSelectedCategory(category.slug)} className={`border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${selectedCategory === category.slug ? 'border-noir-900 bg-noir-900 text-white' : 'border-noir-200 text-noir-500 hover:border-noir-900'}`}>
                    {category.name}
                  </button>
                ))}
              </div>
              {selectedCategory && (
                <button onClick={() => setSelectedCategory('')} className="mt-3 flex items-center gap-1 text-xs text-noir-400 transition-colors hover:text-noir-900">
                  <X className="h-3 w-3" /> Limpar filtros
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[3/4] shimmer rounded-sm" />)}
          </div>
        ) : paged.length === 0 ? (
          <div className="py-20 text-center">
            <p className="mb-2 text-lg text-noir-900 font-display">Nenhum produto disponível</p>
            <p className="text-sm text-noir-400">Tente outra categoria ou fale com a loja pelo WhatsApp.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            {paged.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(currentPage => (
              <button key={currentPage} onClick={() => { setPage(currentPage); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`h-10 w-10 text-sm font-medium transition-colors ${currentPage === page ? 'bg-noir-900 text-white' : 'text-noir-500 hover:text-noir-900'}`}>
                {currentPage}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
