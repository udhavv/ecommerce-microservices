export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
}

export interface OrderItem {
  id?: number | string;
  order_id?: number | string;
  seller_id?: string;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_name?: string;
  sku: string;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  currency?: string;
}

export interface OrderStatusHistory {
  id: number | string;
  previous_status: string | null;
  new_status: string;
  changed_by: string;
  reason?: string;
  created_at: string;
}

export interface Order {
  id: number | string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  currency: string;
  subtotal: number | string;
  shipping_fee: number | string;
  tax_amount: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  customer_email: string;
  customer_name: string;
  shipping_address: ShippingAddress;
  billing_address?: ShippingAddress | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  history?: OrderStatusHistory[];
}

export interface CreateOrderItemInput {
  product_id: number;
  variant_id: number;
  quantity: number;
}

export interface CreateOrderInput {
  items: CreateOrderItemInput[];
  shipping_address: ShippingAddress;
  billing_address?: ShippingAddress;
  customer_name?: string;
  customer_email?: string;
  idempotency_key?: string;
}

export interface OrderFilterParams {
  page?: number;
  limit?: number;
  status?: string;
  payment_status?: string;
  search?: string;
  user_id?: string;
  seller_id?: string;
  as_seller?: boolean | string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface ListOrdersResponse {
  success: boolean;
  data: {
    orders: Order[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface SingleOrderResponse {
  success: boolean;
  message?: string;
  data: {
    order: Order;
  };
}
