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

const { categoryService } = await import('../../services/category.service.js');
const { AppError } = await import('../../middleware/errorHandler.js');

const makeCategoryRow = (overrides = {}) => ({
  id: 1,
  name: 'Electronics',
  slug: 'electronics',
  description: 'All electronic items',
  parent_id: null,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  product_count: 5,
  ...overrides,
});

describe('Category Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listCategories', () => {
    it('returns a flat list of categories without filters', async () => {
      const rows = [
        makeCategoryRow({ id: 1, name: 'Electronics', slug: 'electronics' }),
        makeCategoryRow({ id: 2, name: 'Audio', slug: 'audio', parent_id: 1 }),
      ];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await categoryService.listCategories();
      expect(result).toEqual(rows);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('filters by is_active boolean flag', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await categoryService.listCategories({ is_active: true });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE c.is_active = $1');
      expect(params).toEqual([true]);
    });

    it('builds a hierarchical tree when tree=true', async () => {
      const rows = [
        makeCategoryRow({ id: 1, name: 'Computers', slug: 'computers', parent_id: null }),
        makeCategoryRow({ id: 2, name: 'Laptops', slug: 'laptops', parent_id: 1 }),
      ];
      mockQuery.mockResolvedValueOnce({ rows });

      const tree = await categoryService.listCategories({ tree: true });
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe(2);
    });
  });

  describe('getCategoryByIdOrSlug', () => {
    it('retrieves category by numeric ID along with subcategories', async () => {
      const cat = makeCategoryRow({ id: 10, name: 'Phones', slug: 'phones' });
      const children = [makeCategoryRow({ id: 11, name: 'Smartphones', parent_id: 10 })];

      mockQuery
        .mockResolvedValueOnce({ rows: [cat] })
        .mockResolvedValueOnce({ rows: children });

      const result = await categoryService.getCategoryByIdOrSlug('10');
      expect(result.id).toBe(10);
      expect(result.children).toEqual(children);
    });

    it('retrieves category by text slug', async () => {
      const cat = makeCategoryRow({ id: 5, name: 'Audio', slug: 'audio' });
      mockQuery
        .mockResolvedValueOnce({ rows: [cat] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await categoryService.getCategoryByIdOrSlug('audio');
      expect(result.slug).toBe('audio');
    });

    it('throws 404 AppError if category is not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(categoryService.getCategoryByIdOrSlug(999)).rejects.toThrow(AppError);
    });
  });

  describe('createCategory', () => {
    it('creates a new category with generated slug', async () => {
      const newCat = makeCategoryRow({ id: 3, name: 'Home Appliances', slug: 'home-appliances' });

      // 1. Slug check (none exists)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 2. Insert category
      mockQuery.mockResolvedValueOnce({ rows: [newCat] });

      const result = await categoryService.createCategory({
        name: 'Home Appliances',
        description: 'Appliances for home',
      });

      expect(result.name).toBe('Home Appliances');
      expect(result.slug).toBe('home-appliances');
    });

    it('throws 409 if category slug is already taken', async () => {
      // Slug check returns existing
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await expect(
        categoryService.createCategory({ name: 'Electronics' })
      ).rejects.toThrow('already taken');
    });

    it('throws 404 if specified parent_id does not exist', async () => {
      // Slug check returns none
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Parent check returns none
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        categoryService.createCategory({ name: 'Gaming Laptops', parent_id: 999 })
      ).rejects.toThrow('Specified parent category does not exist');
    });
  });

  describe('updateCategory', () => {
    it('updates category successfully', async () => {
      const existing = makeCategoryRow({ id: 1, name: 'Old Name', slug: 'old-name' });
      const updated = makeCategoryRow({ id: 1, name: 'New Name', slug: 'new-name' });

      // 1. Existing check
      mockQuery.mockResolvedValueOnce({ rows: [existing] });
      // 2. Slug conflict check
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 3. Update query
      mockQuery.mockResolvedValueOnce({ rows: [updated] });

      const result = await categoryService.updateCategory(1, { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('throws 404 if updating non-existent category', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(categoryService.updateCategory(999, { name: 'Test' })).rejects.toThrow(
        AppError
      );
    });

    it('throws 400 if a category is assigned as its own parent', async () => {
      const existing = makeCategoryRow({ id: 5 });
      mockQuery.mockResolvedValueOnce({ rows: [existing] });

      await expect(
        categoryService.updateCategory(5, { parent_id: 5 })
      ).rejects.toThrow('cannot be its own parent');
    });
  });

  describe('deleteCategory', () => {
    it('deletes category if no products are associated', async () => {
      // 1. Associated product count = 0
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] });
      // 2. Delete query returns deleted row
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Electronics' }] });

      const result = await categoryService.deleteCategory(1);
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');
    });

    it('throws 400 if products are still associated with category', async () => {
      // Associated product count > 0
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] });

      await expect(categoryService.deleteCategory(1)).rejects.toThrow(
        'product(s) are associated with it'
      );
    });

    it('throws 404 if category to delete does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(categoryService.deleteCategory(999)).rejects.toThrow(AppError);
    });
  });
});
