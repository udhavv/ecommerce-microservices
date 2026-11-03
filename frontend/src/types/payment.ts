export type PaymentMethod =
  | 'MOCK_CARD'
  | 'MOCK_WALLET'
  | 'MOCK_UPI'
  | 'MOCK_NETBANKING'
  | 'CASH_ON_DELIVERY';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type MockAction =
  | 'SUCCESS'
  | 'DECLINE'
  | 'INSUFFICIENT_FUNDS'
  | 'EXPIRED_CARD'
  | 'NETWORK_TIMEOUT';

export interface PaymentTransaction {
  id: number | string;
  payment_id: number | string;
  transaction_type: 'PAYMENT' | 'REFUND';
  amount: number | string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  gateway_response?: Record<string, unknown> | null;
  created_at: string;
}

export interface Payment {
  id: number | string;
  order_id: number | string;
  order_number: string;
  user_id: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  amount: number | string;
  currency: string;
  card_last4?: string | null;
  card_brand?: string | null;
  gateway_transaction_id?: string | null;
  failure_reason?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
  transactions?: PaymentTransaction[];
}

export interface ProcessPaymentInput {
  order_id: number;
  order_number: string;
  amount: number;
  currency?: string;
  payment_method?: PaymentMethod;
  card_number?: string;
  expiry?: string;
  cvv?: string;
  mock_action?: MockAction;
  idempotency_key?: string;
}

export interface ProcessPaymentResponse {
  success: boolean;
  message: string;
  data: {
    payment: Payment;
  };
}

export interface SinglePaymentResponse {
  success: boolean;
  data: {
    payment: Payment;
  };
}

export interface ListPaymentsResponse {
  success: boolean;
  data: {
    payments: Payment[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}
