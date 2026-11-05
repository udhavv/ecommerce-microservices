import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn(async () => mockClient),
  query: mockQuery,
};

const mockDeleteCloudinaryImage = jest.fn(async () => true);

jest.unstable_mockModule('../../config/db.js', () => ({
  pool: mockPool,
  query: mockQuery,
}));

jest.unstable_mockModule('../../config/cloudinary.js', () => ({
  deleteCloudinaryImage: mockDeleteCloudinaryImage,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock global fetch for inventory service calls
global.fetch = jest.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true }),
  text: async () => 'ok',
}));

const { productService } = await import('../../services/product.service.js');
const { AppError } = await import('../../middleware/errorHandler.js');

const makeProductRow = (overrides = {}) => ({
  id: 1,
  name: 'Sony WH-1000XM5',
  slug: 'sony-wh-1000xm5',
  description: 'Industry Leading Noise Canceling Wireless Headphones',
  brand: 'Sony',
  status: 'ACTIVE',
  seller_id: '11111111-1111-1111-1111-111111111111',
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  ...overrides,
});

describe('Product Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listProducts', () => {
    it('returns paginated products with aggregated details and active status default', async () => {
      const products = [makeProductRow({ id: 1 }), makeProductRow({ id: 2, name: 'Bose 700' })];

      // 1. Count query
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
      // 2. Data query
      mockQuery.mockResolvedValueOnce({ rows: products });

      const result = await productService.listProducts({ page: 1, limit: 10 });
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.products).toEqual(products);

      const [countSql, countParams] = mockQuery.mock.calls[0];
      expect(countSql).toContain('p.deleted_at IS NULL');
      expect(countParams).toContain('ACTIVE');
    });

    it('applies search, seller_id, brand, and price range filters', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [makeProductRow()] });

      await productService.listProducts({
        search: 'wireless',
        seller_id: '11111111-1111-1111-1111-111111111111',
        brand: 'Sony',
        min_price: 100,
        max_price: 500,
      });

      const [countSql, countParams] = mockQuery.mock.calls[0];
      expect(countSql).toContain('p.seller_id =');
      expect(countSql).toContain('p.brand ILIKE');
      expect(countParams).toContain('%wireless%');
      expect(countParams).toContain('Sony');
      expect(countParams).toContain(100);
      expect(countParams).toContain(500);
    });
  });

  describe('getProductByIdOrSlug', () => {
    it('retrieves product by numeric ID and populates categories, variants, and images', async () => {
      const prod = makeProductRow({ id: 10 });
      const categories = [{ id: 1, name: 'Audio', slug: 'audio' }];
      const variants = [{ id: 101, sku: 'SONY-BLK', price: 399.99 }];
      const images = [{ id: 201, image_url: 'https://img.com/sony.jpg', is_primary: true }];

      // 1. Product row
      mockQuery.mockResolvedValueOnce({ rows: [prod] });
      // 2. Categories
      mockQuery.mockResolvedValueOnce({ rows: categories });
      // 3. Variants
      mockQuery.mockResolvedValueOnce({ rows: variants });
      // 4. Images
      mockQuery.mockResolvedValueOnce({ rows: images });

      const result = await productService.getProductByIdOrSlug('10');
      expect(result.id).toBe(10);
      expect(result.categories).toEqual(categories);
      expect(result.variants).toEqual(variants);
      expect(result.images).toEqual(images);
    });

    it('retrieves product by slug', async () => {
      const prod = makeProductRow({ id: 10, slug: 'sony-wh-1000xm5' });

      mockQuery
        .mockResolvedValueOnce({ rows: [prod] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await productService.getProductByIdOrSlug('sony-wh-1000xm5');
      expect(result.slug).toBe('sony-wh-1000xm5');
    });

    it('throws 404 AppError if product does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(productService.getProductByIdOrSlug(999)).rejects.toThrow(AppError);
    });
  });

  describe('createProduct', () => {
    const validData = {
      name: 'Sony WH-1000XM5',
      description: 'Top wireless headphones',
      brand: 'Sony',
      price: 399.99,
      category_ids: [1],
      image_url: 'https://res.cloudinary.com/test/sony.jpg',
    };

    it('throws 401 if sellerId is missing', async () => {
      await expect(productService.createProduct(null, validData)).rejects.toThrow(
        'Seller identity is required'
      );
    });

    it('throws 400 if required fields are missing', async () => {
      await expect(
        productService.createProduct('seller-1', { ...validData, name: '' })
      ).rejects.toThrow('Product name is required');

      await expect(
        productService.createProduct('seller-1', { ...validData, description: '' })
      ).rejects.toThrow('Product description is required');

      await expect(
        productService.createProduct('seller-1', { ...validData, brand: '' })
      ).rejects.toThrow('Product brand is required');

      await expect(
        productService.createProduct('seller-1', { ...validData, price: -5 })
      ).rejects.toThrow('Product price is required and must be zero or positive');

      await expect(
        productService.createProduct('seller-1', { ...validData, category_ids: [] })
      ).rejects.toThrow('At least one product category is required');

      await expect(
        productService.createProduct('seller-1', { ...validData, image_url: null, images: [] })
      ).rejects.toThrow('Product image is required');
    });

    it('creates product in a transaction and notifies inventory service', async () => {
      const createdProd = makeProductRow({ id: 5 });
      const createdVar = { id: 50, sku: 'SKU-5-001', price: 399.99 };
      const createdImg = { id: 500, image_url: validData.image_url, is_primary: true };

      // 1. BEGIN
      mockClient.query.mockResolvedValueOnce({});
      // 2. Slug uniqueness check
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 3. Insert product
      mockClient.query.mockResolvedValueOnce({ rows: [createdProd] });
      // 4. Insert category relation
      mockClient.query.mockResolvedValueOnce({});
      // 5. Insert variant
      mockClient.query.mockResolvedValueOnce({ rows: [createdVar] });
      // 6. Insert image
      mockClient.query.mockResolvedValueOnce({ rows: [createdImg] });
      // 7. COMMIT
      mockClient.query.mockResolvedValueOnce({});

      const result = await productService.createProduct('seller-1', validData);

      expect(result.id).toBe(5);
      expect(result.variants).toEqual([createdVar]);
      expect(result.images).toEqual([createdImg]);
      expect(mockClient.release).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalled();
    });

    it('throws 409 if product slug is already taken and active', async () => {
      // 1. BEGIN
      mockClient.query.mockResolvedValueOnce({});
      // 2. Slug check returns active product
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 9, deleted_at: null }] });
      // 3. ROLLBACK
      mockClient.query.mockResolvedValueOnce({});

      await expect(productService.createProduct('seller-1', validData)).rejects.toThrow(
        'already in use'
      );
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('updateProduct', () => {
    const user = { id: 'seller-1', roles: ['seller'] };

    it('updates product when user is the owner', async () => {
      const existing = makeProductRow({ id: 1, seller_id: 'seller-1' });
      const updated = makeProductRow({ id: 1, name: 'Sony WH-1000XM5 Updated', slug: 'sony-wh-1000xm5-updated' });

      // 1. BEGIN
      mockClient.query.mockResolvedValueOnce({});
      // 2. Check existing product
      mockClient.query.mockResolvedValueOnce({ rows: [existing] });
      // 3. Slug duplicate check
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 4. Update product query
      mockClient.query.mockResolvedValueOnce({ rows: [updated] });
      // 5. COMMIT
      mockClient.query.mockResolvedValueOnce({});

      const result = await productService.updateProduct(1, user, { name: 'Sony WH-1000XM5 Updated' });
      expect(result.name).toBe('Sony WH-1000XM5 Updated');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('allows admin to update product owned by someone else', async () => {
      const adminUser = { id: 'admin-99', roles: ['admin', 'user'] };
      const existing = makeProductRow({ id: 1, seller_id: 'seller-different' });
      const updated = makeProductRow({ id: 1, name: 'Admin Edited Name', slug: 'admin-edited-name' });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [existing] }) // existing product
        .mockResolvedValueOnce({ rows: [] }) // slug check
        .mockResolvedValueOnce({ rows: [updated] }) // update query
        .mockResolvedValueOnce({}); // COMMIT

      const result = await productService.updateProduct(1, adminUser, { name: 'Admin Edited Name' });
      expect(result.name).toBe('Admin Edited Name');
    });

    it('throws 403 Forbidden if user is not owner and not admin', async () => {
      const unauthorizedUser = { id: 'seller-intruder', roles: ['seller'] };
      const existing = makeProductRow({ id: 1, seller_id: 'seller-owner' });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [existing] })
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        productService.updateProduct(1, unauthorizedUser, { name: 'Hack Attempt' })
      ).rejects.toThrow('Forbidden: You can only edit products that you have listed');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('throws 404 if product does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // 0 rows
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        productService.updateProduct(999, user, { name: 'Test' })
      ).rejects.toThrow('Product not found');
    });
  });

  describe('deleteProduct', () => {
    const user = { id: 'seller-1', roles: ['seller'] };

    it('hard-deletes product, removes Cloudinary images, and notifies inventory service', async () => {
      const existing = makeProductRow({ id: 1, seller_id: 'seller-1' });
      const images = [{ id: 10, image_url: 'https://res.cloudinary.com/test/prod1.jpg', alt_text: 'prod1' }];

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [existing] }) // check ownership
        .mockResolvedValueOnce({ rows: images }) // get images
        .mockResolvedValueOnce({ rows: [{ id: 1, name: existing.name }] }) // DELETE products
        .mockResolvedValueOnce({}); // COMMIT

      const result = await productService.deleteProduct(1, user);
      expect(result.success).toBe(true);
      expect(mockDeleteCloudinaryImage).toHaveBeenCalledWith(images[0].image_url);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('throws 403 Forbidden if user is not product owner and not admin', async () => {
      const otherUser = { id: 'other-seller', roles: ['seller'] };
      const existing = makeProductRow({ id: 1, seller_id: 'seller-1' });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [existing] })
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(productService.deleteProduct(1, otherUser)).rejects.toThrow('Forbidden');
    });

    it('throws 404 if product does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(productService.deleteProduct(999, user)).rejects.toThrow(AppError);
    });
  });
});
