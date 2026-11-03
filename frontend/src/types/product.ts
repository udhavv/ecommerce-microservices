export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parent_id?: number | null;
  is_active?: boolean;
}

export interface ProductVariant {
  id: number;
  product_id: number | string;
  sku: string;
  variant_name?: string | null;
  attributes?: Record<string, unknown>;
  price: number | string;
  currency: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductImage {
  id: number;
  product_id: number | string;
  variant_id?: number | null;
  image_url: string;
  alt_text?: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at?: string;
}

export interface Product {
  id: number | string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  seller_id: string;
  created_at: string;
  updated_at: string;
  primary_image?: string | null;
  min_price?: number | string;
  max_price?: number | string;
  currency?: string;
  variant_count?: number;
  categories?: Category[];
  variants?: ProductVariant[];
  images?: ProductImage[];
}

export interface ProductFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  seller_id?: string;
  category_id?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  brand?: string;
  min_price?: number;
  max_price?: number;
  sort_by?: 'created_at' | 'name' | 'price' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

export interface ProductListResponse {
  success: boolean;
  data: {
    products: Product[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
  error?: string;
}

export interface SingleProductResponse {
  success: boolean;
  message?: string;
  data: {
    product: Product;
  };
  error?: string;
}

export interface UploadImageResponse {
  success: boolean;
  message?: string;
  data: {
    image_url: string;
    public_id: string;
  };
  error?: string;
}

export interface CreateProductInput {
  name: string;
  slug?: string;
  description: string;
  brand: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  price: number;
  currency?: string;
  image_url: string;
  public_id?: string;
  initial_stock?: number;
  low_stock_threshold?: number;
  category_ids: number[];
  variants?: Array<{
    sku: string;
    variant_name?: string;
    price: number;
    currency?: string;
    is_active?: boolean;
  }>;
  images?: Array<{
    image_url: string;
    alt_text?: string;
    is_primary?: boolean;
    sort_order?: number;
  }>;
}

export interface UpdateProductInput {
  name?: string;
  slug?: string;
  description?: string;
  brand?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  price?: number;
  currency?: string;
  image_url?: string;
  public_id?: string;
  category_ids?: number[];
  variants?: Array<{
    sku: string;
    variant_name?: string;
    price: number;
    currency?: string;
    is_active?: boolean;
  }>;
  images?: Array<{
    image_url: string;
    alt_text?: string;
    is_primary?: boolean;
    sort_order?: number;
  }>;
}
