import axios from 'axios';
import {
  CreateOrderInput,
  Order,
  OrderFilterParams,
  ListOrdersResponse,
  SingleOrderResponse,
} from '@/types/order';
import { getErrorMessage } from '@/lib/axios';

const ORDER_BASE_URL =
  process.env.NEXT_PUBLIC_ORDER_API_URL || 'http://localhost:4003/api';

export const orderApiClient = axios.create({
  baseURL: ORDER_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 25000,
});

export const orderService = {
  /**
   * Place a new order and reserve inventory stock atomically
   */
  async createOrder(data: CreateOrderInput): Promise<Order> {
    try {
      console.log('createOrder data:', data);
      const response = await orderApiClient.post<SingleOrderResponse>('/orders', data);
      console.log('createOrder response:', response);
      if (!response.data?.data?.order) {
        throw new Error(response.data?.message || 'Failed to create order');
      }
      return response.data.data.order;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Get an order by database ID
   */
  async getOrderById(id: number | string): Promise<Order> {
    try {
      const response = await orderApiClient.get<SingleOrderResponse>(`/orders/${id}`);
      if (!response.data?.data?.order) {
        throw new Error('Order not found');
      }
      return response.data.data.order;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Get an order by human-readable order number (e.g. ORD-20261102-X9K2)
   */
  async getOrderByNumber(orderNumber: string): Promise<Order> {
    try {
      const response = await orderApiClient.get<SingleOrderResponse>(`/orders/number/${orderNumber}`);
      if (!response.data?.data?.order) {
        throw new Error('Order not found');
      }
      return response.data.data.order;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * List customer or seller orders with filters and pagination
   */
  async listOrders(params?: OrderFilterParams): Promise<ListOrdersResponse> {
    try {
      const response = await orderApiClient.get<ListOrdersResponse>('/orders', {
        params,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Confirm payment settlement directly on an order
   */
  async payOrder(
    id: number | string,
    payload: { payment_method?: string; transaction_id?: string } = {}
  ): Promise<Order> {
    try {
      const response = await orderApiClient.post<SingleOrderResponse>(`/orders/${id}/pay`, payload);
      return response.data.data.order;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Cancel an order and release reserved inventory stock
   */
  async cancelOrder(id: number | string, reason?: string): Promise<Order> {
    try {
      const response = await orderApiClient.post<SingleOrderResponse>(`/orders/${id}/cancel`, {
        reason: reason || 'Customer requested order cancellation',
      });
      return response.data.data.order;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Update order status (Admin / Seller fulfillment)
   */
  async updateOrderStatus(
    id: number | string,
    status: string,
    reason?: string,
    trackingNumber?: string
  ): Promise<Order> {
    try {
      const response = await orderApiClient.patch<SingleOrderResponse>(`/orders/${id}/status`, {
        status,
        reason,
        tracking_number: trackingNumber,
      });
      return response.data.data.order;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },
};

export default orderService;
