import { query } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const variantService = {
  /**
   * List all variants for a product
   */
  async listVariants(productId) {
    const res = await query(
      `SELECT * FROM product_variants 
       WHERE product_id = $1 
       ORDER BY id ASC`,
      [productId]
    );
    return res.rows;
  },

  /**
   * Get single variant by ID
   */
  async getVariantById(id) {
    const res = await query('SELECT * FROM product_variants WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      throw new AppError('Variant not found', 404);
    }
    return res.rows[0];
  },

  /**
   * Add variant to a product
   */
  async createVariant(productId, data) {
    // Check product exists
    const prod = await query(
      'SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL',
      [productId]
    );
    if (prod.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    // Check SKU uniqueness
    const existingSku = await query('SELECT id FROM product_variants WHERE sku = $1', [data.sku]);
    if (existingSku.rows.length > 0) {
      throw new AppError(`Variant SKU '${data.sku}' already exists.`, 409);
    }

    const sql = `
      INSERT INTO product_variants
        (product_id, sku, variant_name, attributes, price, currency, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const res = await query(sql, [
      productId,
      data.sku,
      data.variant_name || null,
      data.attributes || {},
      data.price,
      data.currency || 'USD',
      data.is_active ?? true,
    ]);

    logger.info({ variantId: res.rows[0].id, productId, sku: data.sku }, 'Product variant created');
    return res.rows[0];
  },

  /**
   * Update a variant
   */
  async updateVariant(id, data) {
    const existing = await query('SELECT * FROM product_variants WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new AppError('Variant not found', 404);
    }

    if (data.sku && data.sku !== existing.rows[0].sku) {
      const dup = await query(
        'SELECT id FROM product_variants WHERE sku = $1 AND id != $2',
        [data.sku, id]
      );
      if (dup.rows.length > 0) {
        throw new AppError(`SKU '${data.sku}' is already in use by another variant.`, 409);
      }
    }

    const sql = `
      UPDATE product_variants
      SET sku = COALESCE($1, sku),
          variant_name = CASE WHEN $2 IS NULL THEN variant_name ELSE $2 END,
          attributes = COALESCE($3, attributes),
          price = COALESCE($4, price),
          currency = COALESCE($5, currency),
          is_active = COALESCE($6, is_active),
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;

    const res = await query(sql, [
      data.sku,
      data.variant_name,
      data.attributes,
      data.price,
      data.currency,
      data.is_active,
      id,
    ]);

    logger.info({ variantId: id }, 'Product variant updated');
    return res.rows[0];
  },

  /**
   * Delete variant
   */
  async deleteVariant(id) {
    const res = await query('DELETE FROM product_variants WHERE id = $1 RETURNING id, sku, product_id', [id]);
    if (res.rows.length === 0) {
      throw new AppError('Variant not found', 404);
    }

    logger.info({ variantId: id, sku: res.rows[0].sku }, 'Product variant deleted');
    return { success: true, message: `Variant '${res.rows[0].sku}' deleted successfully.` };
  },
};

export default variantService;
