import { query } from '../config/db.js';
import { generateSlug } from '../utils/slug.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const categoryService = {
  /**
   * List categories, optionally filtering by active state and building tree hierarchy
   */
  async listCategories({ is_active, tree = false } = {}) {
    let sql = `
      SELECT c.*, 
             COUNT(pc.product_id)::int AS product_count
      FROM categories c
      LEFT JOIN product_categories pc ON pc.category_id = c.id
    `;
    const params = [];

    if (typeof is_active === 'boolean') {
      params.push(is_active);
      sql += ` WHERE c.is_active = $${params.length}`;
    }

    sql += ` GROUP BY c.id ORDER BY c.name ASC`;

    const result = await query(sql, params);
    const rows = result.rows;

    if (!tree) {
      return rows;
    }

    // Build hierarchy tree
    const map = new Map();
    const roots = [];

    rows.forEach((cat) => {
      map.set(cat.id, { ...cat, children: [] });
    });

    rows.forEach((cat) => {
      if (cat.parent_id && map.has(cat.parent_id)) {
        map.get(cat.parent_id).children.push(map.get(cat.id));
      } else {
        roots.push(map.get(cat.id));
      }
    });

    return roots;
  },

  /**
   * Get category by ID or unique slug
   */
  async getCategoryByIdOrSlug(identifier) {
    const isNumeric = /^\d+$/.test(String(identifier));
    const sql = `
      SELECT c.*,
             COUNT(pc.product_id)::int AS product_count,
             parent.name AS parent_name
      FROM categories c
      LEFT JOIN categories parent ON parent.id = c.parent_id
      LEFT JOIN product_categories pc ON pc.category_id = c.id
      WHERE ${isNumeric ? 'c.id = $1' : 'c.slug = $1'}
      GROUP BY c.id, parent.name
    `;

    const result = await query(sql, [identifier]);
    if (result.rows.length === 0) {
      throw new AppError('Category not found', 404);
    }

    const category = result.rows[0];

    // Fetch direct children
    const subcats = await query(
      `SELECT * FROM categories WHERE parent_id = $1 ORDER BY name ASC`,
      [category.id]
    );
    category.children = subcats.rows;

    return category;
  },

  /**
   * Create a new category
   */
  async createCategory(data) {
    const slug = data.slug ? generateSlug(data.slug) : generateSlug(data.name);

    if (!slug) {
      throw new AppError('Failed to generate a valid slug for the category', 400);
    }

    // Check slug uniqueness
    const existing = await query('SELECT id FROM categories WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      throw new AppError(`Category slug '${slug}' is already taken.`, 409);
    }

    // Verify parent_id if provided
    if (data.parent_id) {
      const parent = await query('SELECT id FROM categories WHERE id = $1', [data.parent_id]);
      if (parent.rows.length === 0) {
        throw new AppError('Specified parent category does not exist.', 404);
      }
    }

    const sql = `
      INSERT INTO categories (name, slug, description, parent_id, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await query(sql, [
      data.name,
      slug,
      data.description || null,
      data.parent_id || null,
      data.is_active ?? true,
    ]);

    logger.info({ categoryId: result.rows[0].id, name: data.name }, 'Category created');
    return result.rows[0];
  },

  /**
   * Update category
   */
  async updateCategory(id, data) {
    const existing = await query('SELECT * FROM categories WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new AppError('Category not found', 404);
    }

    let slug = existing.rows[0].slug;
    if (data.slug) {
      slug = generateSlug(data.slug);
    } else if (data.name && data.name !== existing.rows[0].name) {
      slug = generateSlug(data.name);
    }

    // Prevent category from being its own parent
    if (data.parent_id && Number(data.parent_id) === Number(id)) {
      throw new AppError('A category cannot be its own parent.', 400);
    }

    // Check if new slug conflicts with another category
    if (slug !== existing.rows[0].slug) {
      const duplicate = await query('SELECT id FROM categories WHERE slug = $1 AND id != $2', [
        slug,
        id,
      ]);
      if (duplicate.rows.length > 0) {
        throw new AppError(`Category slug '${slug}' is already in use.`, 409);
      }
    }

    const sql = `
      UPDATE categories
      SET name = COALESCE($1, name),
          slug = $2,
          description = CASE WHEN $3 IS NULL THEN description ELSE $3 END,
          parent_id = CASE WHEN $4 IS NULL THEN parent_id ELSE $4 END,
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;

    const result = await query(sql, [
      data.name,
      slug,
      data.description,
      data.parent_id,
      data.is_active,
      id,
    ]);

    logger.info({ categoryId: id }, 'Category updated');
    return result.rows[0];
  },

  /**
   * Delete category
   */
  async deleteCategory(id) {
    // Check if products are assigned to this category (RESTRICT constraint)
    const products = await query(
      'SELECT COUNT(*)::int AS count FROM product_categories WHERE category_id = $1',
      [id]
    );

    if (products.rows[0].count > 0) {
      throw new AppError(
        `Cannot delete category: ${products.rows[0].count} product(s) are associated with it. Please reassign or remove them first.`,
        400
      );
    }

    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id, name', [id]);
    if (result.rows.length === 0) {
      throw new AppError('Category not found', 404);
    }

    logger.info({ categoryId: id }, 'Category deleted');
    return { success: true, message: `Category '${result.rows[0].name}' deleted successfully.` };
  },
};

export default categoryService;
