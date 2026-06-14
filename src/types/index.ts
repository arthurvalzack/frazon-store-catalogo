export type ProductBadge = 'new' | 'sale' | 'bestseller';

export interface ProductColor {
  name: string;
  hex: string;
}

export interface ProductVariant {
  id: string;
  color: ProductColor;
  size: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  categoryId?: string;
  description: string;
  price: number;
  originalPrice?: number;
  colors: ProductColor[];
  sizes: string[];
  variants: ProductVariant[];
  images: string[];
  badge?: ProductBadge;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
}

export interface SiteSettings {
  storeName: string;
  whatsappNumber: string;
  heroEyebrow: string;
  heroTitle: string;
  heroItalicTitle: string;
  heroSubtitle: string;
  heroImage: string;
  aboutEyebrow: string;
  aboutTitle: string;
  aboutItalicWord: string;
  aboutText: string;
  editorialEyebrow: string;
  editorialTitle: string;
  editorialItalicTitle: string;
  editorialText: string;
  editorialImage: string;
  instagramUrl: string;
  email: string;
  address: string;
  weekHours: string;
  saturdayHours: string;
  footerNote: string;
}

export interface CartItem {
  productId: string;
  color: string;
  size: string;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  image?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  whatsappMessage: string;
  status: 'whatsapp' | 'pending' | 'contacted' | 'completed' | 'completed_sale' | 'cancelled';
  stockDeducted?: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface AdminSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email: string;
}

export const SIZES = ['P', 'M', 'G', 'GG', 'XG', 'XGG', 'Único'];

export const PRODUCT_COLORS: ProductColor[] = [
  { name: 'Preto', hex: '#111111' },
  { name: 'Branco', hex: '#FAFAFA' },
  { name: 'Cinza', hex: '#8C8C8C' },
  { name: 'Chumbo', hex: '#343434' },
  { name: 'Azul Marinho', hex: '#1C2951' },
  { name: 'Verde Militar', hex: '#4A5D23' },
  { name: 'Bege', hex: '#C7B299' },
  { name: 'Marrom', hex: '#6B4423' },
  { name: 'Vinho', hex: '#722F37' },
  { name: 'Vermelho', hex: '#B91C1C' },
];
