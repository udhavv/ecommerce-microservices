import {
  createInventorySchema,
  adjustStockSchema,
  reserveStockSchema,
  confirmReservationSchema,
  releaseReservationSchema,
  listInventoryQuerySchema,
} from '../../validators/inventory.validators.js';

describe('Inventory Validators Unit Tests', () => {
  describe('createInventorySchema', () => {
    it('should validate and parse valid inventory creation data', () => {
      const input = {
        product_id: 10,
        variant_id: 101,
        sku: 'SKU-TEST-101',
        quantity_available: 50,
        low_stock_threshold: 10,
      };

      const result = createInventorySchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data.quantity_available).toBe(50);
      expect(result.data.low_stock_threshold).toBe(10);
    });

    it('should apply defaults for optional fields', () => {
      const input = {
        product_id: '5',
        variant_id: '50',
      };

      const result = createInventorySchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data.product_id).toBe(5);
      expect(result.data.variant_id).toBe(50);
      expect(result.data.quantity_available).toBe(0);
      expect(result.data.low_stock_threshold).toBe(5);
    });

    it('should fail if quantity_available or low_stock_threshold is negative', () => {
      const negativeStock = { product_id: 1, variant_id: 1, quantity_available: -5 };
      expect(createInventorySchema.safeParse(negativeStock).success).toBe(false);

      const negativeThreshold = { product_id: 1, variant_id: 1, low_stock_threshold: -1 };
      expect(createInventorySchema.safeParse(negativeThreshold).success).toBe(false);
    });

    it('should fail if product_id or variant_id is missing or non-positive', () => {
      expect(createInventorySchema.safeParse({ variant_id: 1 }).success).toBe(false);
      expect(createInventorySchema.safeParse({ product_id: 0, variant_id: 1 }).success).toBe(false);
      expect(createInventorySchema.safeParse({ product_id: 1, variant_id: -2 }).success).toBe(false);
    });
  });

  describe('adjustStockSchema', () => {
    it('should validate with quantity_change provided', () => {
      const input = {
        quantity_change: 15,
        movement_type: 'STOCK_IN',
        reason: 'Restocking inventory',
      };

      const result = adjustStockSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data.quantity_change).toBe(15);
      expect(result.data.movement_type).toBe('STOCK_IN');
    });

    it('should validate with new_quantity provided', () => {
      const input = {
        new_quantity: 100,
        reason: 'Physical count audit',
      };

      const result = adjustStockSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data.new_quantity).toBe(100);
      expect(result.data.movement_type).toBe('ADJUSTMENT'); // Default
    });

    it('should fail if neither quantity_change nor new_quantity is provided', () => {
      const input = {
        reason: 'No stock details',
      };

      const result = adjustStockSchema.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Either quantity_change or new_quantity must be provided.');
    });

    it('should fail if movement_type is not in the allowed enum', () => {
      const input = {
        quantity_change: 5,
        movement_type: 'INVALID_TYPE',
      };

      expect(adjustStockSchema.safeParse(input).success).toBe(false);
    });
  });

  describe('reserveStockSchema', () => {
    it('should validate a correct reserve request', () => {
      const input = {
        order_id: 'ORD-999',
        items: [
          { variant_id: 1, quantity: 2 },
          { variant_id: 2, quantity: 1 },
        ],
        expires_in_minutes: 20,
        idempotency_key: 'key-abc-123',
      };

      const result = reserveStockSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.expires_in_minutes).toBe(20);
    });

    it('should fail if items array is empty or missing', () => {
      expect(reserveStockSchema.safeParse({ order_id: 'ORD-1', items: [] }).success).toBe(false);
      expect(reserveStockSchema.safeParse({ order_id: 'ORD-1' }).success).toBe(false);
    });

    it('should fail if quantity is less than 1', () => {
      const input = {
        order_id: 'ORD-1',
        items: [{ variant_id: 1, quantity: 0 }],
      };
      expect(reserveStockSchema.safeParse(input).success).toBe(false);
    });
  });

  describe('confirmReservationSchema', () => {
    it('should validate with valid order_id', () => {
      const result = confirmReservationSchema.safeParse({ order_id: 'ORD-777', order_number: 'ORD-NUM-777' });
      expect(result.success).toBe(true);
      expect(result.data.order_id).toBe('ORD-777');
    });

    it('should fail if order_id is empty', () => {
      expect(confirmReservationSchema.safeParse({ order_id: '' }).success).toBe(false);
      expect(confirmReservationSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('releaseReservationSchema', () => {
    it('should validate with order_id and optional fallback items', () => {
      const input = {
        order_id: 'ORD-CANCELLED',
        reason: 'Customer requested cancellation',
        items: [{ variant_id: 10, quantity: 3 }],
      };

      const result = releaseReservationSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(1);
    });
  });

  describe('listInventoryQuerySchema', () => {
    it('should coerce and supply defaults for query parameters', () => {
      const query = {
        page: '2',
        limit: '15',
        search: 'phone',
        low_stock_only: 'true',
      };

      const result = listInventoryQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(15);
      expect(result.data.low_stock_only).toBe(true);
      expect(result.data.search).toBe('phone');
    });

    it('should validate UUID format for seller_id if supplied', () => {
      const validUUID = { seller_id: '123e4567-e89b-12d3-a456-426614174000' };
      expect(listInventoryQuerySchema.safeParse(validUUID).success).toBe(true);

      const invalidUUID = { seller_id: 'not-a-uuid' };
      expect(listInventoryQuerySchema.safeParse(invalidUUID).success).toBe(false);
    });
  });
});
