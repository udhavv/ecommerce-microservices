export interface InventoryItem {
  id: number | string;
  seller_id: string;
  product_id: number | string;
  variant_id: number | string;
  sku?: string | null;
  quantity_available: number;
  quantity_reserved: number;
  total_physical_stock?: number;
  low_stock_threshold: number;
  version?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryMovement {
  id: number | string;
  inventory_id?: number | string | null;
  variant_id: number | string;
  movement_type:
    | 'INITIAL_STOCK'
    | 'STOCK_IN'
    | 'STOCK_OUT'
    | 'RESERVE'
    | 'RELEASE'
    | 'ADJUSTMENT'
    | 'SALE'
    | 'RETURN';
  quantity: number;
  reference_type?: string | null;
  reference_id?: string | null;
  actor_id?: string | null;
  actor_role?: string | null;
  previous_available: number;
  new_available: number;
  previous_reserved: number;
  new_reserved: number;
  reason?: string | null;
  created_at: string;
}

export interface StockAdjustmentInput {
  quantity_change?: number;
  new_quantity?: number;
  movement_type: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'RETURN';
  reason?: string;
  reference_id?: string;
}

export interface InventoryListResponse {
  success: boolean;
  data: {
    items: InventoryItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
  error?: string;
}

export interface SingleInventoryResponse {
  success: boolean;
  message?: string;
  data: {
    item: InventoryItem;
  };
  error?: string;
}

export interface InventoryMovementsResponse {
  success: boolean;
  data: {
    movements: InventoryMovement[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
  error?: string;
}
