import {
  Payment,
  ProcessPaymentInput,
  ProcessPaymentResponse,
  SinglePaymentResponse,
  ListPaymentsResponse,
} from '@/types/payment';
import { createApiClient, getErrorMessage } from '@/lib/axios';

const PAYMENT_BASE_URL =
  process.env.NEXT_PUBLIC_PAYMENT_API_URL || 'http://localhost:4004/api';

export const paymentApiClient = createApiClient({
  baseURL: PAYMENT_BASE_URL,
  timeout: 25000,
});

export const paymentService = {
  /**
   * Process a simulated payment through the mock payment gateway
   */
  async processPayment(data: ProcessPaymentInput): Promise<Payment> {
    try {
      const response = await paymentApiClient.post<ProcessPaymentResponse>(
        '/payments/process',
        data
      );
      if (!response.data?.data?.payment) {
        throw new Error(response.data?.message || 'Payment processing failed');
      }
      return response.data.data.payment;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Fetch payment by payment ID
   */
  async getPaymentById(id: number | string): Promise<Payment> {
    try {
      const response = await paymentApiClient.get<SinglePaymentResponse>(`/payments/${id}`);
      if (!response.data?.data?.payment) {
        throw new Error('Payment record not found');
      }
      return response.data.data.payment;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Fetch payment associated with a given order ID
   */
  async getPaymentByOrderId(orderId: number | string): Promise<Payment> {
    try {
      const response = await paymentApiClient.get<SinglePaymentResponse>(`/payments/order/${orderId}`);
      if (!response.data?.data?.payment) {
        throw new Error('Payment record for this order not found');
      }
      return response.data.data.payment;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * List payments with filtering
   */
  async listPayments(params?: Record<string, unknown>): Promise<ListPaymentsResponse> {
    try {
      const response = await paymentApiClient.get<ListPaymentsResponse>('/payments', {
        params,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Issue a refund for a payment
   */
  async refundPayment(
    id: number | string,
    amount?: number,
    reason?: string
  ): Promise<Payment> {
    try {
      const response = await paymentApiClient.post<SinglePaymentResponse>(
        `/payments/${id}/refund`,
        { amount, reason }
      );
      return response.data.data.payment;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },
};

export default paymentService;
