import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Boxes, Camera, Edit2, Image, ListOrdered, LogOut, Package, Plus, Save, Settings, Trash2, Upload, X, type LucideIcon } from 'lucide-react';
import type { AdminSession, Category, Order, Product, ProductBadge, ProductVariant, SiteSettings } from '@/types';
import { PRODUCT_COLORS, SIZES } from '@/types';
import { cn } from '@/utils/cn';
import { cancelOrder, confirmOrderSale, consumeInventorySyncWarning, createCategory, createProduct, deleteCategory, deleteOrder, deleteProduct, formatPrice, generateSlug, getAdminSession, getSettings, isSupabaseConfigured, listOrders, loadCatalogData, loginAdmin, logoutAdmin, saveSettings, subscribeToProductsChanges, updateCategory, updateProduct, uploadCatalogImage } from '@/lib/data';

type AdminTab = 'products' | 'categories' | 'site' | 'orders';

type ProductForm = {
  id?: string;
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  price: string;
  originalPrice: string;
  images: string[];
  badge: '' | ProductBadge;
  isActive: boolean;
  variants: ProductVariant[];
};

type CategoryForm = {
  id?: string;
  name: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: string;
};

const emptyProductForm: ProductForm = {
  name: '',
  brand: 'Frazon Store',
  categoryId: '',
  description: '',
  price: '',
  originalPrice: '',
  images: [],
  badge: '',
  isActive: true,
  variants: [{ id: crypto.randomUUID(), color: PRODUCT_COLORS[0], size: 'M', stock: 1 }],
};

const emptyCategoryForm: CategoryForm = {
  name: '',
  imageUrl: '',
  isActive: true,
  sortOrder: '1',
};

export default function Admin() {
  const [session, setSession] = useState<AdminSession | null>(getAdminSession());
  const [tab, setTab] = useState<AdminTab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(getSettings());
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [editingProduct, setEditingProduct] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (session) void refreshData();
  }, [session]);

  const handleProductsRealtimeChange = useCallback((nextProducts: Product[]) => {
    setProducts(nextProducts);
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    return subscribeToProductsChanges(handleProductsRealtimeChange);
  }, [handleProductsRealtimeChange, session]);

  async function refreshData() {
    setLoading(true);
    setError('');
    try {
      const data = await loadCatalogData(true);
      setProducts(data.products);
      setCategories(data.categories);
      setSettings(data.settings);
      if (getAdminSession()) {
        const recentOrders = await listOrders();
        setOrders(recentOrders);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const nextSession = await loginAdmin(email, password);
      setSession(nextSession);
      showToast('Login realizado.');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Falha no login.');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logoutAdmin();
    setSession(null);
  }

  function openNewProduct() {
    setProductForm({ ...emptyProductForm, brand: settings.storeName, categoryId: categories[0]?.id || '' });
    setEditingProduct(true);
  }

  function openEditProduct(product: Product) {
    const category = categories.find(item => item.id === product.categoryId || item.name === product.category);
    setProductForm({
      id: product.id,
      name: product.name,
      brand: product.brand,
      categoryId: category?.id || product.categoryId || '',
      description: product.description,
      price: String(product.price),
      originalPrice: product.originalPrice ? String(product.originalPrice) : '',
      images: product.images.slice(0, 3),
      badge: product.badge || '',
      isActive: product.isActive,
      variants: product.variants.length ? product.variants : [{ id: crypto.randomUUID(), color: product.colors[0] || PRODUCT_COLORS[0], size: product.sizes[0] || 'M', stock: 1 }],
    });
    setEditingProduct(true);
  }

  function addVariant() {
    setProductForm(prev => ({
      ...prev,
      variants: [...prev.variants, { id: crypto.randomUUID(), color: PRODUCT_COLORS[0], size: 'M', stock: 1 }],
    }));
  }

  function updateVariant(id: string, data: Partial<ProductVariant>) {
    setProductForm(prev => ({
      ...prev,
      variants: prev.variants.map(variant => variant.id === id ? { ...variant, ...data } : variant),
    }));
  }

  function removeVariant(id: string) {
    setProductForm(prev => ({ ...prev, variants: prev.variants.filter(variant => variant.id !== id) }));
  }

  async function handleProductImages(files: FileList | null) {
    if (!files?.length) return;
    const availableSlots = 3 - productForm.images.length;
    if (availableSlots <= 0) {
      showToast('Limite de 3 fotos por produto.');
      return;
    }
    setLoading(true);
    try {
      const selectedFiles = Array.from(files).slice(0, availableSlots);
      const urls = await Promise.all(selectedFiles.map(file => uploadCatalogImage(file, 'products')));
      setProductForm(prev => ({ ...prev, images: [...prev.images, ...urls].slice(0, 3) }));
      showToast('Imagem enviada.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Erro ao enviar imagem.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSingleImage(file: File | undefined, type: 'category' | 'hero' | 'editorial') {
    if (!file) return;
    setLoading(true);
    try {
      const folder = type === 'category' ? 'categories' : 'site';
      const url = await uploadCatalogImage(file, folder);
      if (type === 'category') setCategoryForm(prev => ({ ...prev, imageUrl: url }));
      if (type === 'hero') setSettings(prev => ({ ...prev, heroImage: url }));
      if (type === 'editorial') setSettings(prev => ({ ...prev, editorialImage: url }));
      showToast('Imagem enviada.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Erro ao enviar imagem.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProduct() {
    const selectedCategory = categories.find(category => category.id === productForm.categoryId);
    const positiveVariants = productForm.variants.filter(variant => Number(variant.stock) > 0);
    if (!productForm.name.trim() || !productForm.price || !selectedCategory) {
      setError('Preencha nome, preço e categoria.');
      return;
    }
    if (!positiveVariants.length) {
      setError('Cadastre pelo menos uma cor/tamanho com estoque maior que zero.');
      return;
    }
    setLoading(true);
    setError('');
    const colors = Array.from(new Map(positiveVariants.map(variant => [variant.color.name, variant.color])).values());
    const sizes = Array.from(new Set(positiveVariants.map(variant => variant.size)));
    const payload = {
      name: productForm.name.trim(),
      slug: generateSlug(productForm.name),
      brand: productForm.brand.trim() || settings.storeName,
      category: selectedCategory.name,
      categoryId: selectedCategory.id,
      description: productForm.description.trim(),
      price: Number(productForm.price),
      originalPrice: productForm.originalPrice ? Number(productForm.originalPrice) : undefined,
      images: productForm.images.slice(0, 3),
      badge: productForm.badge || undefined,
      isActive: productForm.isActive,
      colors,
      sizes,
      variants: productForm.variants,
    };
    try {
      if (productForm.id) await updateProduct(productForm.id, payload);
      else await createProduct(payload);
      const inventoryWarning = consumeInventorySyncWarning();
      await refreshData();
      setEditingProduct(false);
      showToast(inventoryWarning || (productForm.id ? 'Produto atualizado.' : 'Produto criado.'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar produto.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProduct(product: Product) {
    if (!window.confirm(`Excluir ${product.name}?`)) return;
    setLoading(true);
    try {
      await deleteProduct(product.id);
      await refreshData();
      showToast('Produto excluído.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Erro ao excluir produto.');
    } finally {
      setLoading(false);
    }
  }

  function openNewCategory() {
    setCategoryForm({ ...emptyCategoryForm, sortOrder: String(categories.length + 1) });
    setEditingCategory(true);
  }

  function openEditCategory(category: Category) {
    setCategoryForm({ id: category.id, name: category.name, imageUrl: category.imageUrl, isActive: category.isActive, sortOrder: String(category.sortOrder) });
    setEditingCategory(true);
  }

  async function handleSaveCategory() {
    if (!categoryForm.name.trim()) {
      setError('Informe o nome da categoria.');
      return;
    }
    setLoading(true);
    setError('');
    const payload = {
      name: categoryForm.name.trim(),
      slug: generateSlug(categoryForm.name),
      imageUrl: categoryForm.imageUrl,
      isActive: categoryForm.isActive,
      sortOrder: Number(categoryForm.sortOrder) || 0,
    };
    try {
      if (categoryForm.id) await updateCategory(categoryForm.id, payload);
      else await createCategory(payload);
      await refreshData();
      setEditingCategory(false);
      showToast(categoryForm.id ? 'Categoria atualizada.' : 'Categoria criada.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar categoria.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCategory(category: Category) {
    if (!window.confirm(`Excluir categoria ${category.name}?`)) return;
    setLoading(true);
    try {
      await deleteCategory(category.id);
      await refreshData();
      showToast('Categoria excluída.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Erro ao excluir categoria.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    setLoading(true);
    setError('');
    try {
      const saved = await saveSettings(settings);
      setSettings(saved);
      showToast('Site atualizado.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar configurações.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmOrder(order: Order) {
    if (order.stockDeducted || order.status === 'completed' || order.status === 'completed_sale') return;
    setLoading(true);
    setError('');
    try {
      await confirmOrderSale(order.id);
      await refreshData();
      showToast('Venda confirmada e estoque atualizado.');
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Erro ao confirmar venda.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelOrder(order: Order) {
    if (order.status === 'cancelled' || order.stockDeducted) return;
    setLoading(true);
    setError('');
    try {
      await cancelOrder(order.id);
      await refreshData();
      showToast('Pedido cancelado.');
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Erro ao cancelar pedido.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteOrder(order: Order) {
    const completed = order.stockDeducted || order.status === 'completed' || order.status === 'completed_sale';
    const message = completed
      ? 'Este pedido já teve venda confirmada e estoque baixado. Excluir o pedido NÃO vai devolver o estoque. Deseja continuar?'
      : 'Tem certeza que deseja excluir este pedido? Essa ação não pode ser desfeita.';
    if (!window.confirm(message)) return;
    setLoading(true);
    setError('');
    try {
      await deleteOrder(order.id);
      await refreshData();
      showToast('Pedido excluído.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Erro ao excluir pedido.');
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const active = products.filter(product => product.isActive).length;
    const stock = products.reduce((sum, product) => sum + product.variants.reduce((total, variant) => total + Math.max(0, Number(variant.stock) || 0), 0), 0);
    const revenue = orders.reduce((sum, order) => sum + order.subtotal, 0);
    return { active, stock, revenue };
  }, [orders, products]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-noir-900 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <h1 className="mb-2 text-center text-3xl font-black uppercase tracking-[0.2em] text-white font-display">Frazon Store</h1>
          <p className="mb-8 text-center text-xs uppercase tracking-wider text-noir-400">Painel administrativo</p>
          {!configured && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-100">
              Supabase ainda não configurado. Preencha <strong>VITE_SUPABASE_URL</strong> e <strong>VITE_SUPABASE_ANON_KEY</strong> no arquivo .env antes de usar o admin.
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" value={email} onChange={event => { setEmail(event.target.value); setError(''); }} placeholder="E-mail do admin" className="w-full rounded-lg border border-noir-700 bg-noir-800 px-4 py-3 text-sm text-white placeholder-noir-500 focus:border-noir-500 focus:outline-none" required />
            <input type="password" value={password} onChange={event => { setPassword(event.target.value); setError(''); }} placeholder="Senha" className="w-full rounded-lg border border-noir-700 bg-noir-800 px-4 py-3 text-sm text-white placeholder-noir-500 focus:border-noir-500 focus:outline-none" required />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={loading || !configured} className="w-full rounded-lg bg-white py-3 text-sm font-semibold uppercase tracking-wider text-noir-900 transition-colors hover:bg-noir-100 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="sticky top-0 z-40 border-b border-noir-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-noir-900 font-display sm:text-lg">Frazon Store</h1>
            <p className="hidden text-[11px] uppercase tracking-wider text-noir-400 sm:block">Admin conectado: {session.email}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-noir-500 transition-colors hover:text-noir-900">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={Package} label="Produtos ativos" value={String(stats.active)} />
          <StatCard icon={Boxes} label="Estoque total" value={String(stats.stock)} />
          <StatCard icon={BarChart3} label="Pedidos salvos" value={formatPrice(stats.revenue)} />
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          <TabButton active={tab === 'products'} onClick={() => setTab('products')} icon={Package}>Produtos</TabButton>
          <TabButton active={tab === 'categories'} onClick={() => setTab('categories')} icon={Boxes}>Categorias</TabButton>
          <TabButton active={tab === 'site'} onClick={() => setTab('site')} icon={Settings}>Editar site</TabButton>
          <TabButton active={tab === 'orders'} onClick={() => setTab('orders')} icon={ListOrdered}>Pedidos</TabButton>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading && <div className="mb-4 rounded-lg border border-noir-100 bg-white px-4 py-3 text-sm text-noir-500">Processando...</div>}

        {tab === 'products' && (
          <section className="rounded-xl border border-noir-100 bg-white p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-noir-900">Produtos</h2>
                <p className="text-sm text-noir-400">Adicione produtos, fotos, preços e estoque por cor/tamanho.</p>
              </div>
              <button onClick={openNewProduct} className="flex items-center justify-center gap-2 bg-noir-900 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-noir-700">
                <Plus className="h-4 w-4" /> Novo produto
              </button>
            </div>

            {editingProduct ? (
              <ProductEditor
                form={productForm}
                categories={categories}
                setForm={setProductForm}
                onCancel={() => setEditingProduct(false)}
                onSave={handleSaveProduct}
                addVariant={addVariant}
                updateVariant={updateVariant}
                removeVariant={removeVariant}
                onImages={handleProductImages}
                loading={loading}
              />
            ) : (
              <div className="divide-y divide-noir-100">
                {products.map(product => <ProductRow key={product.id} product={product} onEdit={() => openEditProduct(product)} onDelete={() => handleDeleteProduct(product)} />)}
                {!products.length && <EmptyState text="Nenhum produto cadastrado ainda." />}
              </div>
            )}
          </section>
        )}

        {tab === 'categories' && (
          <section className="rounded-xl border border-noir-100 bg-white p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-noir-900">Categorias</h2>
                <p className="text-sm text-noir-400">Edite os blocos que aparecem na home e nos filtros.</p>
              </div>
              <button onClick={openNewCategory} className="flex items-center justify-center gap-2 bg-noir-900 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-noir-700">
                <Plus className="h-4 w-4" /> Nova categoria
              </button>
            </div>

            {editingCategory ? (
              <CategoryEditor form={categoryForm} setForm={setCategoryForm} onCancel={() => setEditingCategory(false)} onSave={handleSaveCategory} onImage={file => handleSingleImage(file, 'category')} loading={loading} />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categories.map(category => <CategoryCard key={category.id} category={category} onEdit={() => openEditCategory(category)} onDelete={() => handleDeleteCategory(category)} />)}
              </div>
            )}
          </section>
        )}

        {tab === 'site' && (
          <SiteEditor settings={settings} setSettings={setSettings} onSave={handleSaveSettings} onImage={handleSingleImage} loading={loading} />
        )}

        {tab === 'orders' && (
          <ConfirmableOrdersPanel orders={orders} onRefresh={refreshData} onConfirm={handleConfirmOrder} onCancel={handleCancelOrder} onDelete={handleDeleteOrder} loading={loading} />
        )}
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-noir-900 px-6 py-3 text-sm font-medium text-white shadow-xl">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="rounded-xl border border-noir-100 bg-white p-4"><Icon className="mb-3 h-5 w-5 text-noir-400" /><p className="text-xs uppercase tracking-wider text-noir-400">{label}</p><p className="mt-1 text-xl font-semibold text-noir-900">{value}</p></div>;
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: LucideIcon; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn('flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors', active ? 'border-noir-900 bg-noir-900 text-white' : 'border-noir-200 bg-white text-noir-500 hover:border-noir-900 hover:text-noir-900')}><Icon className="h-4 w-4" />{children}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-noir-500">{label}</span>{children}</label>;
}

const inputClass = 'w-full rounded-lg border border-noir-200 px-3 py-2.5 text-sm text-noir-900 focus:border-noir-500 focus:outline-none';

function ProductEditor({ form, categories, setForm, onCancel, onSave, addVariant, updateVariant, removeVariant, onImages, loading }: {
  form: ProductForm;
  categories: Category[];
  setForm: React.Dispatch<React.SetStateAction<ProductForm>>;
  onCancel: () => void;
  onSave: () => void;
  addVariant: () => void;
  updateVariant: (id: string, data: Partial<ProductVariant>) => void;
  removeVariant: (id: string) => void;
  onImages: (files: FileList | null) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nome do produto *"><input value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} className={inputClass} placeholder="Ex: Camiseta Oversized Preta" /></Field>
        <Field label="Marca"><input value={form.brand} onChange={event => setForm(prev => ({ ...prev, brand: event.target.value }))} className={inputClass} /></Field>
        <Field label="Categoria *"><select value={form.categoryId} onChange={event => setForm(prev => ({ ...prev, categoryId: event.target.value }))} className={inputClass}><option value="">Selecione...</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
        <Field label="Preço *"><input type="number" step="0.01" value={form.price} onChange={event => setForm(prev => ({ ...prev, price: event.target.value }))} className={inputClass} placeholder="0.00" /></Field>
        <Field label="Preço antigo / promoção"><input type="number" step="0.01" value={form.originalPrice} onChange={event => setForm(prev => ({ ...prev, originalPrice: event.target.value }))} className={inputClass} placeholder="Opcional" /></Field>
        <Field label="Etiqueta"><select value={form.badge} onChange={event => setForm(prev => ({ ...prev, badge: event.target.value as ProductForm['badge'] }))} className={inputClass}><option value="">Nenhuma</option><option value="new">Novo</option><option value="sale">Sale</option><option value="bestseller">Mais vendido</option></select></Field>
        <div className="md:col-span-2"><Field label="Descrição"><textarea value={form.description} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} className={inputClass} rows={4} placeholder="Descrição curta e vendedora." /></Field></div>
      </div>

      <div className="rounded-lg border border-noir-100 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-noir-900">Fotos do produto</h3><p className="text-xs text-noir-400">Até 3 imagens. O sistema comprime arquivos grandes antes do upload.</p></div>
          <label className="flex cursor-pointer items-center gap-2 bg-noir-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-noir-700">
            <Upload className="h-4 w-4" /> Enviar
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={event => onImages(event.target.files)} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {form.images.map((url, index) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded bg-noir-100">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button onClick={() => setForm(prev => ({ ...prev, images: prev.images.filter((_, imageIndex) => imageIndex !== index) }))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-noir-700"><X className="h-3 w-3" /></button>
            </div>
          ))}
          {form.images.length === 0 && <div className="col-span-3 rounded-lg bg-noir-50 p-6 text-center text-sm text-noir-400">Nenhuma imagem enviada.</div>}
        </div>
      </div>

      <div className="rounded-lg border border-noir-100 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-noir-900">Estoque por cor e tamanho *</h3><p className="text-xs text-noir-400">Só aparece no site o que tiver estoque maior que zero.</p></div>
          <button onClick={addVariant} className="flex items-center gap-2 border border-noir-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-noir-700 hover:border-noir-900"><Plus className="h-4 w-4" /> Variação</button>
        </div>
        <div className="space-y-2">
          {form.variants.map(variant => (
            <div key={variant.id} className="grid grid-cols-12 gap-2 rounded-lg bg-noir-50 p-2">
              <select value={variant.color.name} onChange={event => updateVariant(variant.id, { color: PRODUCT_COLORS.find(color => color.name === event.target.value) || PRODUCT_COLORS[0] })} className="col-span-5 rounded border border-noir-200 bg-white px-2 py-2 text-xs sm:col-span-4">
                {PRODUCT_COLORS.map(color => <option key={color.name} value={color.name}>{color.name}</option>)}
              </select>
              <select value={variant.size} onChange={event => updateVariant(variant.id, { size: event.target.value })} className="col-span-3 rounded border border-noir-200 bg-white px-2 py-2 text-xs sm:col-span-3">
                {SIZES.map(size => <option key={size} value={size}>{size}</option>)}
              </select>
              <input type="number" min="0" value={variant.stock} onChange={event => updateVariant(variant.id, { stock: Number(event.target.value) })} className="col-span-3 rounded border border-noir-200 bg-white px-2 py-2 text-xs sm:col-span-3" placeholder="Qtd" />
              <button onClick={() => removeVariant(variant.id)} className="col-span-1 flex items-center justify-center text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-noir-100 p-4">
        <div><h3 className="text-sm font-semibold text-noir-900">Produto ativo</h3><p className="text-xs text-noir-400">Produtos inativos não aparecem para o cliente.</p></div>
        <button onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))} className={cn('h-6 w-12 rounded-full p-0.5 transition-colors', form.isActive ? 'bg-emerald-500' : 'bg-noir-300')}><div className={cn('h-5 w-5 rounded-full bg-white shadow transition-transform', form.isActive ? 'translate-x-6' : 'translate-x-0')} /></button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button onClick={onCancel} className="border border-noir-200 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-noir-600 hover:border-noir-900">Cancelar</button>
        <button onClick={onSave} disabled={loading} className="flex items-center justify-center gap-2 bg-noir-900 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white hover:bg-noir-700 disabled:opacity-50"><Save className="h-4 w-4" /> Salvar produto</button>
      </div>
    </div>
  );
}

function ProductRow({ product, onEdit, onDelete }: { product: Product; onEdit: () => void; onDelete: () => void }) {
  const totalStock = product.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock) || 0), 0);
  return <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="h-16 w-12 overflow-hidden rounded bg-noir-100"><img src={product.images[0] || ''} alt="" className="h-full w-full object-cover" /></div><div><h3 className="text-sm font-semibold text-noir-900">{product.name}</h3><p className="text-xs text-noir-400">{product.category} · {formatPrice(product.price)} · estoque {totalStock}</p><p className={cn('mt-1 text-[11px] font-semibold uppercase tracking-wider', product.isActive ? 'text-emerald-600' : 'text-noir-300')}>{product.isActive ? 'Ativo' : 'Inativo'}</p></div></div><div className="flex gap-2"><button onClick={onEdit} className="flex items-center gap-1 border border-noir-200 px-3 py-2 text-xs text-noir-600 hover:border-noir-900"><Edit2 className="h-3.5 w-3.5" /> Editar</button><button onClick={onDelete} className="flex items-center gap-1 border border-red-200 px-3 py-2 text-xs text-red-600 hover:border-red-500"><Trash2 className="h-3.5 w-3.5" /> Excluir</button></div></div>;
}

function CategoryEditor({ form, setForm, onCancel, onSave, onImage, loading }: { form: CategoryForm; setForm: React.Dispatch<React.SetStateAction<CategoryForm>>; onCancel: () => void; onSave: () => void; onImage: (file: File | undefined) => void; loading: boolean }) {
  return <div className="space-y-4"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Nome da categoria"><input value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} className={inputClass} /></Field><Field label="Ordem"><input type="number" value={form.sortOrder} onChange={event => setForm(prev => ({ ...prev, sortOrder: event.target.value }))} className={inputClass} /></Field><div className="md:col-span-2"><Field label="Imagem da categoria"><div className="flex gap-2"><input value={form.imageUrl} onChange={event => setForm(prev => ({ ...prev, imageUrl: event.target.value }))} className={inputClass} placeholder="URL ou envie arquivo" /><label className="flex cursor-pointer items-center gap-2 bg-noir-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white"><Camera className="h-4 w-4" /><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => onImage(event.target.files?.[0])} /></label></div></Field></div></div><div className="flex items-center justify-between rounded-lg border border-noir-100 p-4"><span className="text-sm font-semibold text-noir-900">Categoria ativa</span><button onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))} className={cn('h-6 w-12 rounded-full p-0.5 transition-colors', form.isActive ? 'bg-emerald-500' : 'bg-noir-300')}><div className={cn('h-5 w-5 rounded-full bg-white shadow transition-transform', form.isActive ? 'translate-x-6' : 'translate-x-0')} /></button></div><div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><button onClick={onCancel} className="border border-noir-200 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-noir-600">Cancelar</button><button onClick={onSave} disabled={loading} className="bg-noir-900 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50">Salvar categoria</button></div></div>;
}

function CategoryCard({ category, onEdit, onDelete }: { category: Category; onEdit: () => void; onDelete: () => void }) {
  return <div className="overflow-hidden rounded-lg border border-noir-100"><div className="aspect-[4/3] bg-noir-100"><img src={category.imageUrl} alt={category.name} className="h-full w-full object-cover" /></div><div className="p-4"><h3 className="font-semibold text-noir-900">{category.name}</h3><p className="text-xs text-noir-400">Ordem {category.sortOrder} · {category.isActive ? 'Ativa' : 'Inativa'}</p><div className="mt-3 flex gap-2"><button onClick={onEdit} className="flex-1 border border-noir-200 px-3 py-2 text-xs text-noir-600">Editar</button><button onClick={onDelete} className="border border-red-200 px-3 py-2 text-xs text-red-600">Excluir</button></div></div></div>;
}

function SiteEditor({ settings, setSettings, onSave, onImage, loading }: { settings: SiteSettings; setSettings: React.Dispatch<React.SetStateAction<SiteSettings>>; onSave: () => void; onImage: (file: File | undefined, type: 'category' | 'hero' | 'editorial') => void; loading: boolean }) {
  const set = (field: keyof SiteSettings, value: string) => setSettings(prev => ({ ...prev, [field]: value }));
  return <section className="rounded-xl border border-noir-100 bg-white p-4 sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-noir-900">Editar site inteiro</h2><p className="text-sm text-noir-400">Nome, WhatsApp, textos, banners e contato.</p></div><button onClick={onSave} disabled={loading} className="flex items-center justify-center gap-2 bg-noir-900 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50"><Save className="h-4 w-4" /> Salvar site</button></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Nome da loja"><input value={settings.storeName} onChange={event => set('storeName', event.target.value)} className={inputClass} /></Field><Field label="WhatsApp"><input value={settings.whatsappNumber} onChange={event => set('whatsappNumber', event.target.value)} className={inputClass} /></Field><Field label="Instagram URL"><input value={settings.instagramUrl} onChange={event => set('instagramUrl', event.target.value)} className={inputClass} /></Field><Field label="E-mail"><input value={settings.email} onChange={event => set('email', event.target.value)} className={inputClass} /></Field><Field label="Endereço"><input value={settings.address} onChange={event => set('address', event.target.value)} className={inputClass} /></Field><Field label="Horário semana"><input value={settings.weekHours} onChange={event => set('weekHours', event.target.value)} className={inputClass} /></Field><Field label="Horário sábado"><input value={settings.saturdayHours} onChange={event => set('saturdayHours', event.target.value)} className={inputClass} /></Field><Field label="Nota rodapé"><input value={settings.footerNote} onChange={event => set('footerNote', event.target.value)} className={inputClass} /></Field><div className="md:col-span-2"><h3 className="mb-3 mt-3 text-sm font-semibold text-noir-900">Banner principal</h3></div><Field label="Texto pequeno"><input value={settings.heroEyebrow} onChange={event => set('heroEyebrow', event.target.value)} className={inputClass} /></Field><Field label="Título"><input value={settings.heroTitle} onChange={event => set('heroTitle', event.target.value)} className={inputClass} /></Field><Field label="Título itálico"><input value={settings.heroItalicTitle} onChange={event => set('heroItalicTitle', event.target.value)} className={inputClass} /></Field><Field label="Imagem hero"><ImageInput value={settings.heroImage} onChange={value => set('heroImage', value)} onFile={file => onImage(file, 'hero')} /></Field><div className="md:col-span-2"><Field label="Subtítulo"><textarea value={settings.heroSubtitle} onChange={event => set('heroSubtitle', event.target.value)} className={inputClass} rows={3} /></Field></div><div className="md:col-span-2"><h3 className="mb-3 mt-3 text-sm font-semibold text-noir-900">Sobre</h3></div><Field label="Texto pequeno"><input value={settings.aboutEyebrow} onChange={event => set('aboutEyebrow', event.target.value)} className={inputClass} /></Field><Field label="Título"><input value={settings.aboutTitle} onChange={event => set('aboutTitle', event.target.value)} className={inputClass} /></Field><Field label="Palavra destaque"><input value={settings.aboutItalicWord} onChange={event => set('aboutItalicWord', event.target.value)} className={inputClass} /></Field><div className="md:col-span-2"><Field label="Texto sobre"><textarea value={settings.aboutText} onChange={event => set('aboutText', event.target.value)} className={inputClass} rows={3} /></Field></div><div className="md:col-span-2"><h3 className="mb-3 mt-3 text-sm font-semibold text-noir-900">Banner editorial</h3></div><Field label="Texto pequeno"><input value={settings.editorialEyebrow} onChange={event => set('editorialEyebrow', event.target.value)} className={inputClass} /></Field><Field label="Título"><input value={settings.editorialTitle} onChange={event => set('editorialTitle', event.target.value)} className={inputClass} /></Field><Field label="Título itálico"><input value={settings.editorialItalicTitle} onChange={event => set('editorialItalicTitle', event.target.value)} className={inputClass} /></Field><Field label="Imagem editorial"><ImageInput value={settings.editorialImage} onChange={value => set('editorialImage', value)} onFile={file => onImage(file, 'editorial')} /></Field><div className="md:col-span-2"><Field label="Texto editorial"><textarea value={settings.editorialText} onChange={event => set('editorialText', event.target.value)} className={inputClass} rows={3} /></Field></div></div></section>;
}

function ImageInput({ value, onChange, onFile }: { value: string; onChange: (value: string) => void; onFile: (file: File | undefined) => void }) {
  return <div className="flex gap-2"><input value={value} onChange={event => onChange(event.target.value)} className={inputClass} /><label className="flex cursor-pointer items-center gap-2 bg-noir-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white"><Image className="h-4 w-4" /><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => onFile(event.target.files?.[0])} /></label></div>;
}

function OrdersPanel({ orders, onRefresh }: { orders: Order[]; onRefresh: () => void }) {
  return <section className="rounded-xl border border-noir-100 bg-white p-4 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-noir-900">Pedidos salvos</h2><p className="text-sm text-noir-400">Pedidos são registrados antes de abrir o WhatsApp.</p></div><button onClick={onRefresh} className="border border-noir-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-noir-600">Atualizar</button></div><div className="space-y-3">{orders.map(order => <div key={order.id} className="rounded-lg border border-noir-100 p-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-noir-900">Pedido {order.id.slice(0, 8)}</p><p className="text-xs text-noir-400">{new Date(order.createdAt).toLocaleString('pt-BR')}</p></div><p className="text-sm font-semibold text-noir-900">{formatPrice(order.subtotal)}</p></div><ul className="mt-3 space-y-1 text-xs text-noir-500">{order.items.map(item => <li key={`${order.id}-${item.productId}-${item.size}-${item.color}`}>{item.quantity}x {item.productName} · {item.color} · {item.size}</li>)}</ul></div>)}{!orders.length && <EmptyState text="Nenhum pedido salvo ainda." />}</div></section>;
}

function ConfirmableOrdersPanel({ orders, onRefresh, onConfirm, onCancel, onDelete, loading }: { orders: Order[]; onRefresh: () => void; onConfirm: (order: Order) => void; onCancel: (order: Order) => void; onDelete: (order: Order) => void; loading: boolean }) {
  return (
    <section className="rounded-xl border border-noir-100 bg-white p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-noir-900">Pedidos salvos</h2>
          <p className="text-sm text-noir-400">Pedidos são registrados antes de abrir o WhatsApp.</p>
        </div>
        <button onClick={onRefresh} className="border border-noir-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-noir-600">Atualizar</button>
      </div>
      <div className="space-y-3">
        {orders.map(order => {
          const completed = order.stockDeducted || order.status === 'completed' || order.status === 'completed_sale';
          const cancelled = order.status === 'cancelled';
          return (
            <div key={order.id} className="rounded-lg border border-noir-100 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-noir-900">Pedido {order.id.slice(0, 8)}</p>
                  <p className="text-xs text-noir-400">{new Date(order.createdAt).toLocaleString('pt-BR')}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-noir-500">Status: {completed ? 'Venda confirmada' : cancelled ? 'Cancelado' : 'Pendente'}</p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <p className="text-sm font-semibold text-noir-900">{formatPrice(order.subtotal)}</p>
                  {completed ? (
                    <span className="text-xs font-semibold text-emerald-600">Venda confirmada</span>
                  ) : cancelled ? (
                    <span className="text-xs font-semibold text-red-600">Cancelado</span>
                  ) : (
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <button onClick={() => onConfirm(order)} disabled={loading} className="border border-emerald-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 hover:border-emerald-600 disabled:opacity-50">Confirmar venda</button>
                      <button onClick={() => onCancel(order)} disabled={loading} className="border border-red-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-red-600 hover:border-red-500 disabled:opacity-50">Cancelar pedido</button>
                    </div>
                  )}
                  <button onClick={() => onDelete(order)} disabled={loading} className="border border-red-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-red-600 hover:border-red-500 disabled:opacity-50">Excluir pedido</button>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-noir-500">
                {order.items.map(item => <li key={`${order.id}-${item.productId}-${item.size}-${item.color}`}>{item.quantity}x {item.productName} · {item.color} · {item.size}</li>)}
              </ul>
            </div>
          );
        })}
        {!orders.length && <EmptyState text="Nenhum pedido salvo ainda." />}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg bg-noir-50 p-8 text-center text-sm text-noir-400">{text}</div>;
}
