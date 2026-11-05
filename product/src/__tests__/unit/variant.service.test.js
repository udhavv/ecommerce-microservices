import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../config/db.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const { variantService } = await import('../../services/variant.service.js');
const { AppError } = await import('../../middleware/errorHandler.js');

const makeVariantRow = (overrides = {}) => ({
  id: 1,
  product_id: 10,
  sku: 'SKU-10-BLACK-XL',
  variant_name: 'Black XL',
  attributes: { color: 'Black', size: 'XL' },
  price: 49.99,
  currency: 'USD',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('Variant Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listVariants', () => {
    it('returns all variants for a given product ID', async () => {
      const rows = [makeVariantRow({ id: 1 }), makeVariantRow({ id: 2, sku: 'SKU-10-WHITE-L' })];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await variantService.listVariants(10);
      expect(result).toEqual(rows);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('getVariantById', () => {
    it('returns single variant by ID', async () => {
      const row = makeVariantRow({ id: 5 });
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await variantService.getVariantById(5);
      expect(result.id).toBe(5);
    });

    it('throws 404 AppError if variant not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(variantService.getVariantById(999)).rejects.toThrow(AppError);
    });
  });

  describe('createVariant', () => {
    it('creates a new variant when product exists and SKU is unique', async () => {
      const newVar = makeVariantRow({ id: 3, sku: 'SKU-10-BLUE-M' });

      // 1. Product existence check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      // 2. SKU uniqueness check
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 3. Insert query
      mockQuery.mockResolvedValueOnce({ rows: [newVar] });

      const result = await variantService.createVariant(10, {
        sku: 'SKU-10-BLUE-M',
        variant_name: 'Blue M',
        price: 39.99,
      });

      expect(result.sku).toBe('SKU-10-BLUE-M');
    });

    it('throws 404 if parent product does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        variantService.createVariant(999, { sku: 'SKU-TEST', price: 10 })
      ).rejects.toThrow('Product not found');
    });

    it('throws 409 if SKU is already in use', async () => {
      // 1. Product exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      // 2. SKU already taken
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await expect(
        variantService.createVariant(10, { sku: 'SKU-EXISTING', price: 10 })
      ).rejects.toThrow('already exists');
    });
  });

  describe('updateVariant', () => {
    it('updates variant details successfully', async () => {
      const existing = makeVariantRow({ id: 1, price: 49.99 });
      const updated = makeVariantRow({ id: 1, price: 59.99 });

      // 1. Existing check
      mockQuery.mockResolvedValueOnce({ rows: [existing] });
      // 2. Update query
      mockQuery.mockResolvedValueOnce({ rows: [updated] });

      const result = await variantService.updateVariant(1, { price: 59.99 });
      expect(result.price).toBe(59.99);
    });

    it('throws 404 if updating non-existent variant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(variantService.updateVariant(999, { price: 20 })).rejects.toThrow(AppError);
    });

    it('throws 409 if new SKU is already in use by another variant', async () => {
      const existing = makeVariantRow({ id: 1, sku: 'OLD-SKU' });

      // 1. Existing check
      mockQuery.mockResolvedValueOnce({ rows: [existing] });
      // 2. Duplicate SKU check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 2 }] });

      await expect(variantService.updateVariant(1, { sku: 'NEW-TAKEN-SKU' })).rejects.toThrow(
        'already in use'
      );
    });
  });

  describe('deleteVariant', () => {
    it('deletes variant successfully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, sku: 'SKU-DELETED', product_id: 10 }] });

      const result = await variantService.deleteVariant(1);
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');
    });

    it('throws 404 if variant does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(variantService.deleteVariant(999)).rejects.toThrow(AppError);
    });
  });
});
