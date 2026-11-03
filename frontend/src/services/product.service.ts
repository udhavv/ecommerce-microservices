import axios from 'axios';
import {
  Product,
  ProductFilterParams,
  ProductListResponse,
  SingleProductResponse,
  UploadImageResponse,
  CreateProductInput,
  UpdateProductInput,
  Category,
} from '@/types/product';
import { getErrorMessage } from '@/lib/axios';

const PRODUCT_BASE_URL =
  process.env.NEXT_PUBLIC_PRODUCT_API_URL || 'http://localhost:4001/api';

export const productApiClient = axios.create({
  baseURL: PRODUCT_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 25000,
});

export const productService = {
  /**
   * Upload an image file directly to Cloudinary via the backend microservice
   */
  async uploadImage(file: File): Promise<{ image_url: string; public_id: string }> {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await productApiClient.post<UploadImageResponse>(
        '/products/upload-image',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (!response.data?.data?.image_url) {
        throw new Error(response.data?.message || 'Failed to upload image to Cloudinary');
      }

      return response.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Fetch products with query parameters (search, seller_id, category, page, etc.)
   */
  async getProducts(params?: ProductFilterParams): Promise<ProductListResponse> {
    try {
      const response = await productApiClient.get<ProductListResponse>('/products', {
        params,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Get single product by id or slug
   */
  async getProduct(idOrSlug: string | number): Promise<Product> {
    try {
      const response = await productApiClient.get<SingleProductResponse>(
        `/products/${idOrSlug}`
      );
      if (!response.data?.data?.product) {
        throw new Error('Product not found');
      }
      return response.data.data.product;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Create a new product (requires seller or admin role)
   */
  async createProduct(data: CreateProductInput): Promise<Product> {
    try {
      const response = await productApiClient.post<SingleProductResponse>(
        '/products',
        data
      );
      if (!response.data?.data?.product) {
        throw new Error(response.data?.message || 'Failed to create product');
      }
      return response.data.data.product;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Update existing product by ID (requires owner seller or admin)
   */
  async updateProduct(id: string | number, data: UpdateProductInput): Promise<Product> {
    try {
      const response = await productApiClient.put<SingleProductResponse>(
        `/products/${id}`,
        data
      );
      if (!response.data?.data?.product) {
        throw new Error(response.data?.message || 'Failed to update product');
      }
      return response.data.data.product;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Soft-delete product by ID (requires owner seller or admin)
   * Also cleans up Cloudinary images associated with this product
   */
  async deleteProduct(id: string | number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await productApiClient.delete<{ success: boolean; message: string }>(
        `/products/${id}`
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * List all categories
   */
  async getCategories(): Promise<Category[]> {
    try {
      const response = await productApiClient.get<{
        success: boolean;
        data: { categories: Category[] };
      }>('/categories');
      return response.data?.data?.categories || [];
    } catch {
      return [];
    }
  },
};

export default productService;
