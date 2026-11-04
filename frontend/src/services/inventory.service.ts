import {
  InventoryItem,
  StockAdjustmentInput,
  InventoryListResponse,
  SingleInventoryResponse,
  InventoryMovementsResponse,
} from '@/types/inventory';
import { createApiClient, getErrorMessage } from '@/lib/axios';

const INVENTORY_BASE_URL =
  process.env.NEXT_PUBLIC_INVENTORY_API_URL || 'http://localhost:4002/api';

export const inventoryApiClient = createApiClient({
  baseURL: INVENTORY_BASE_URL,
  timeout: 10000,
});

export const inventoryService = {
  /**
   * Fetch inventory items (sellers see own items, admins see all)
   */
  async getInventory(params?: {
    page?: number;
    limit?: number;
    search?: string;
    low_stock_only?: boolean;
    seller_id?: string;
  }): Promise<InventoryListResponse> {
    try {
      const response = await inventoryApiClient.get<InventoryListResponse>('/inventory', {
        params,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Get real-time stock for a single variant (public / catalog)
   */
  async getByVariantId(variantId: number | string): Promise<InventoryItem> {
    try {
      const response = await inventoryApiClient.get<SingleInventoryResponse>(
        `/inventory/variant/${variantId}`
      );
      if (!response.data?.data?.item) {
        throw new Error('Inventory record not found');
      }
      return response.data.data.item;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Get all variant inventory records for a product
   */
  async getByProductId(productId: number | string): Promise<InventoryItem[]> {
    try {
      const response = await inventoryApiClient.get<{
        success: boolean;
        data: { items: InventoryItem[] };
      }>(`/inventory/product/${productId}`);
      return response.data?.data?.items || [];
    } catch {
      return [];
    }
  },

  /**
   * Initialize inventory for a variant
   */
  async createInventory(data: {
    product_id: number | string;
    variant_id: number | string;
    sku?: string;
    quantity_available: number;
    low_stock_threshold?: number;
  }): Promise<InventoryItem> {
    try {
      const response = await inventoryApiClient.post<SingleInventoryResponse>(
        '/inventory',
        data
      );
      if (!response.data?.data?.item) {
        throw new Error(response.data?.message || 'Failed to create inventory item');
      }
      return response.data.data.item;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Adjust stock levels (add, subtract, or set absolute quantity)
   */
  async adjustStock(
    inventoryId: number | string,
    data: StockAdjustmentInput
  ): Promise<InventoryItem> {
    try {
      const response = await inventoryApiClient.patch<SingleInventoryResponse>(
        `/inventory/${inventoryId}/stock`,
        data
      );
      if (!response.data?.data?.item) {
        throw new Error(response.data?.message || 'Failed to adjust stock');
      }
      return response.data.data.item;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * List movement audit log for a variant
   */
  async getMovements(
    variantId: number | string,
    page = 1,
    limit = 20
  ): Promise<InventoryMovementsResponse> {
    try {
      const response = await inventoryApiClient.get<InventoryMovementsResponse>(
        `/inventory/movements/${variantId}`,
        {
          params: { page, limit },
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },
};

export default inventoryService;
