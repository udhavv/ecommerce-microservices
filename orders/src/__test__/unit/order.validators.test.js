import {
  createOrderSchema,
  updateOrderStatusSchema,
  payOrderSchema,
  cancelOrderSchema,
  listOrdersQuerySchema,
} from '../../validators/order.validators.js';

describe('Order Validators Unit Tests', () => {
  describe('createOrderSchema', () => {
    const validOrderData = {
      items: [
        { product_id: 1, variant_id: 10, quantity: 2 },
        { product_id: '2', variant_id: '20', quantity: 1 }, // String coerced to number
      ],
      shipping_address: {
        street: '123 Market St',
        city: 'Metropolis',
        state: 'NY',
        postal_code: '10001',
        country: 'USA',
        phone: '1234567890',
      },
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      idempotency_key: 'idem-key-123',
    };

    it('should validate and parse a valid order payload with coerced string IDs', () => {
      const parsed = createOrderSchema.parse(validOrderData);
      expect(parsed.items[0].product_id).toBe(1);
      expect(parsed.items[1].product_id).toBe(2);
      expect(parsed.items[1].variant_id).toBe(20);
      expect(parsed.shipping_address.city).toBe('Metropolis');
    });

    it('should allow optional billing_address', () => {
      const withBilling = {
        ...validOrderData,
        billing_address: {
          street: '456 Financial Ave',
          city: 'Metropolis',
          state: 'NY',
          postal_code: '10002',
          country: 'USA',
          phone: '9876543210',
        },
      };
      const parsed = createOrderSchema.parse(withBilling);
      expect(parsed.billing_address.street).toBe('456 Financial Ave');
    });

    it('should reject if items array is empty', () => {
      const invalid = { ...validOrderData, items: [] };
      expect(() => createOrderSchema.parse(invalid)).toThrow();
    });

    it('should reject if item quantity is less than 1 or greater than 100', () => {
      const invalidLow = {
        ...validOrderData,
        items: [{ product_id: 1, variant_id: 1, quantity: 0 }],
      };
      expect(() => createOrderSchema.parse(invalidLow)).toThrow('Quantity must be at least 1');

      const invalidHigh = {
        ...validOrderData,
        items: [{ product_id: 1, variant_id: 1, quantity: 101 }],
      };
      expect(() => createOrderSchema.parse(invalidHigh)).toThrow('Maximum 100 units per item');
    });

    it('should reject if phone number in shipping_address has less than 10 characters', () => {
      const invalidPhone = {
        ...validOrderData,
        shipping_address: {
          ...validOrderData.shipping_address,
          phone: '12345',
        },
      };
      expect(() => createOrderSchema.parse(invalidPhone)).toThrow('phone number is required');
    });

    it('should reject invalid email format', () => {
      const invalidEmail = {
        ...validOrderData,
        customer_email: 'not-an-email',
      };
      expect(() => createOrderSchema.parse(invalidEmail)).toThrow();
    });
  });

  describe('updateOrderStatusSchema', () => {
    it('should accept valid status enum values', () => {
      const validStatuses = [
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
        'FAILED',
      ];

      for (const status of validStatuses) {
        const parsed = updateOrderStatusSchema.parse({
          status,
          reason: 'Routine update',
          tracking_number: 'TRK-12345',
        });
        expect(parsed.status).toBe(status);
        expect(parsed.tracking_number).toBe('TRK-12345');
      }
    });

    it('should reject invalid status strings', () => {
      expect(() => updateOrderStatusSchema.parse({ status: 'INVALID_STATUS' })).toThrow();
    });
  });

  describe('payOrderSchema', () => {
    it('should supply default payment_method CREDIT_CARD', () => {
      const parsed = payOrderSchema.parse({});
      expect(parsed.payment_method).toBe('CREDIT_CARD');
    });

    it('should preserve explicit payment_method and transaction_id', () => {
      const parsed = payOrderSchema.parse({
        payment_method: 'PAYPAL',
        transaction_id: 'txn-789',
      });
      expect(parsed.payment_method).toBe('PAYPAL');
      expect(parsed.transaction_id).toBe('txn-789');
    });
  });

  describe('cancelOrderSchema', () => {
    it('should provide default cancellation reason', () => {
      const parsed = cancelOrderSchema.parse({});
      expect(parsed.reason).toBe('Customer requested cancellation');
    });

    it('should accept custom reason with at least 3 characters', () => {
      const parsed = cancelOrderSchema.parse({ reason: 'Found cheaper alternative' });
      expect(parsed.reason).toBe('Found cheaper alternative');
    });

    it('should reject reason with less than 3 characters', () => {
      expect(() => cancelOrderSchema.parse({ reason: 'No' })).toThrow(
        'A cancellation reason is required'
      );
    });
  });

  describe('listOrdersQuerySchema', () => {
    it('should transform and apply default values when query is empty', () => {
      const parsed = listOrdersQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sort_by).toBe('created_at');
      expect(parsed.sort_order).toBe('desc');
    });

    it('should correctly parse and clamp custom page and limit strings', () => {
      const parsed = listOrdersQuerySchema.parse({
        page: '5',
        limit: '500', // exceeds max 100
        sort_order: 'asc',
        status: 'CONFIRMED',
      });
      expect(parsed.page).toBe(5);
      expect(parsed.limit).toBe(100);
      expect(parsed.sort_order).toBe('asc');
      expect(parsed.status).toBe('CONFIRMED');
    });

    it('should clamp invalid or negative page numbers to 1', () => {
      const parsed = listOrdersQuerySchema.parse({ page: '-10' });
      expect(parsed.page).toBe(1);
    });
  });
});
