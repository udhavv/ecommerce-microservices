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

const { imageService } = await import('../../services/image.service.js');
const { AppError } = await import('../../middleware/errorHandler.js');

const makeImageRow = (overrides = {}) => ({
  id: 1,
  product_id: 10,
  variant_id: null,
  image_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  alt_text: 'Sample Product Image',
  sort_order: 0,
  is_primary: true,
  created_at: new Date(),
  ...overrides,
});

describe('Image Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listImages', () => {
    it('returns all images for a given product', async () => {
      const rows = [makeImageRow({ id: 1 }), makeImageRow({ id: 2, is_primary: false })];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await imageService.listImages(10);
      expect(result).toEqual(rows);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('filters images by variantId if provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await imageService.listImages(10, 5);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('variant_id = $2');
      expect(params).toEqual([10, 5]);
    });
  });

  describe('createImage', () => {
    it('creates product image and resets previous primary if new image is primary', async () => {
      const newImg = makeImageRow({ id: 3, is_primary: true });

      // 1. BEGIN
      mockClient.query.mockResolvedValueOnce({});
      // 2. Product existence check
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      // 3. Reset previous primary
      mockClient.query.mockResolvedValueOnce({});
      // 4. Insert image
      mockClient.query.mockResolvedValueOnce({ rows: [newImg] });
      // 5. COMMIT
      mockClient.query.mockResolvedValueOnce({});

      const result = await imageService.createImage(10, {
        image_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        is_primary: true,
      });

      expect(result.id).toBe(3);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('throws 404 if product does not exist and rolls back', async () => {
      // 1. BEGIN
      mockClient.query.mockResolvedValueOnce({});
      // 2. Product check returns 0
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 3. ROLLBACK
      mockClient.query.mockResolvedValueOnce({});

      await expect(
        imageService.createImage(999, { image_url: 'https://sample.jpg' })
      ).rejects.toThrow('Product not found');

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('deleteImage', () => {
    it('deletes image and removes asset from Cloudinary', async () => {
      const img = makeImageRow({ id: 1, image_url: 'https://res.cloudinary.com/test.jpg' });

      // 1. Select existing image
      mockQuery.mockResolvedValueOnce({ rows: [img] });
      // 2. Delete image row
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, product_id: 10 }] });

      const result = await imageService.deleteImage(1);
      expect(result.success).toBe(true);
      expect(mockDeleteCloudinaryImage).toHaveBeenCalledWith(img.image_url);
    });

    it('throws 404 if image to delete does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(imageService.deleteImage(999)).rejects.toThrow(AppError);
    });
  });
});
