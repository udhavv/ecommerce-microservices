import { pool, query } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const imageService = {
  /**
   * List images for a product
   */
  async listImages(productId, variantId = null) {
    let sql = `
      SELECT * FROM product_images
      WHERE product_id = $1
    `;
    const params = [productId];

    if (variantId) {
      params.push(variantId);
      sql += ` AND variant_id = $${params.length}`;
    }

    sql += ` ORDER BY is_primary DESC, sort_order ASC, id ASC`;

    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Add image to product
   */
  async createImage(productId, data) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const prod = await client.query(
        'SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL',
        [productId]
      );
      if (prod.rows.length === 0) {
        throw new AppError('Product not found', 404);
      }

      // If this is set as primary and is a main product image (variant_id is null), reset previous primary
      if (data.is_primary && !data.variant_id) {
        await client.query(
          `UPDATE product_images 
           SET is_primary = FALSE 
           WHERE product_id = $1 AND variant_id IS NULL AND is_primary = TRUE`,
          [productId]
        );
      }

      const sql = `
        INSERT INTO product_images
          (product_id, variant_id, image_url, alt_text, sort_order, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const res = await client.query(sql, [
        productId,
        data.variant_id || null,
        data.image_url,
        data.alt_text || null,
        data.sort_order ?? 0,
        data.is_primary ?? false,
      ]);

      await client.query('COMMIT');
      logger.info({ imageId: res.rows[0].id, productId }, 'Product image added');
      return res.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Update an image
   */
  async updateImage(id, data) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existing = await client.query('SELECT * FROM product_images WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new AppError('Image not found', 404);
      }
      const current = existing.rows[0];

      // If updating to primary and variant_id is null, clear other primary images
      if (data.is_primary && !current.variant_id) {
        await client.query(
          `UPDATE product_images 
           SET is_primary = FALSE 
           WHERE product_id = $1 AND variant_id IS NULL AND id != $2`,
          [current.product_id, id]
        );
      }

      const sql = `
        UPDATE product_images
        SET image_url = COALESCE($1, image_url),
            alt_text = CASE WHEN $2 IS NULL THEN alt_text ELSE $2 END,
            sort_order = COALESCE($3, sort_order),
            is_primary = COALESCE($4, is_primary),
            variant_id = CASE WHEN $5 IS NULL THEN variant_id ELSE $5 END
        WHERE id = $6
        RETURNING *
      `;

      const res = await client.query(sql, [
        data.image_url,
        data.alt_text,
        data.sort_order,
        data.is_primary,
        data.variant_id,
        id,
      ]);

      await client.query('COMMIT');
      logger.info({ imageId: id }, 'Product image updated');
      return res.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Delete an image
   */
  async deleteImage(id) {
    const res = await query('DELETE FROM product_images WHERE id = $1 RETURNING id, product_id', [id]);
    if (res.rows.length === 0) {
      throw new AppError('Image not found', 404);
    }

    logger.info({ imageId: id }, 'Product image deleted');
    return { success: true, message: 'Product image deleted successfully.' };
  },
};

export default imageService;
