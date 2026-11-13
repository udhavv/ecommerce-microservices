import { jest } from '@jest/globals';
import { AppError } from '../../middleware/errorHandler.js';

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    services: {
      productUrl: 'http://product-service:4001/api',
    },
  },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { default: productClient } = await import('../../services/product.client.js');

describe('Product Client Unit Tests (Orders Service)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('getProduct', () => {
    it('should return product data on successful fetch', async () => {
      const mockProduct = { id: 10, name: 'Cool Shoes', status: 'ACTIVE' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { product: mockProduct },
        }),
      });

      const result = await productClient.getProduct(10);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://product-service:4001/api/products/10',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-internal-service': 'order-service',
          }),
        })
      );
      expect(result).toEqual(mockProduct);
    });

    it('should throw AppError 404 when product service returns 404', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(productClient.getProduct(999)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Product #999 not found in store catalog',
      });
    });

    it('should throw AppError 502 when product service returns 500 error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(productClient.getProduct(10)).rejects.toMatchObject({
        statusCode: 502,
      });
    });

    it('should throw AppError 503 when fetch fails due to network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Connection timed out'));

      await expect(productClient.getProduct(10)).rejects.toMatchObject({
        statusCode: 503,
      });
    });
  });

  describe('validateOrderItem', () => {
    const activeProduct = {
      id: 5,
      name: 'Wireless Mouse',
      status: 'ACTIVE',
      currency: 'USD',
      seller_id: 'seller-555',
      variants: [
        {
          id: 501,
          variant_name: 'Black',
          sku: 'WM-BLK',
          price: '29.99',
          is_active: true,
        },
        {
          id: 502,
          variant_name: 'White',
          sku: 'WM-WHT',
          price: '29.99',
          is_active: false, // Inactive variant
        },
      ],
    };

    it('should validate and return item snapshot details for active product and variant', async () => {
      jest.spyOn(productClient, 'getProduct').mockResolvedValueOnce(activeProduct);

      const itemSnapshot = await productClient.validateOrderItem(5, 501);

      expect(itemSnapshot).toEqual({
        product_id: 5,
        variant_id: 501,
        product_name: 'Wireless Mouse',
        variant_name: 'Black',
        sku: 'WM-BLK',
        unit_price: 29.99,
        currency: 'USD',
        seller_id: 'seller-555',
      });
    });

    it('should throw AppError 400 when product status is not ACTIVE', async () => {
      const draftProduct = { ...activeProduct, status: 'DRAFT' };
      jest.spyOn(productClient, 'getProduct').mockResolvedValueOnce(draftProduct);

      await expect(productClient.validateOrderItem(5, 501)).rejects.toMatchObject({
        statusCode: 400,
        message: "Product 'Wireless Mouse' is currently unavailable for purchase.",
      });
    });

    it('should throw AppError 400 when variant ID is not found in product variants', async () => {
      jest.spyOn(productClient, 'getProduct').mockResolvedValueOnce(activeProduct);

      await expect(productClient.validateOrderItem(5, 999)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("Variant #999 for product 'Wireless Mouse' does not exist"),
      });
    });

    it('should throw AppError 400 when variant is explicitly marked inactive', async () => {
      jest.spyOn(productClient, 'getProduct').mockResolvedValueOnce(activeProduct);

      await expect(productClient.validateOrderItem(5, 502)).rejects.toMatchObject({
        statusCode: 400,
        message: "Variant 'White' for 'Wireless Mouse' is inactive.",
      });
    });
  });
});
