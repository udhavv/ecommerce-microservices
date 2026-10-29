import { pool, query } from '../config/db.js';
import { generateSlug } from '../utils/slug.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const productService = {
  /**
   * List products with rich filtering, search, sorting, and pagination
   */
  async listProducts(filters) {
    const {
      page = 1,
      limit = 20,
      search,
      seller_id,
      category_id,
      status,
      brand,
      min_price,
      max_price,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = filters;

    const offset = (page - 1) * limit;
    const conditions = ['p.deleted_at IS NULL'];
    const params = [];

    // Filter by seller
    if (seller_id) {
      params.push(seller_id);
      conditions.push(`p.seller_id = $${params.length}`);
    }

    // Filter by status (default to ACTIVE unless specified or seller filtering their own)
    if (status) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    } else if (!seller_id) {
      // By default, public catalog only shows ACTIVE products
      params.push('ACTIVE');
      conditions.push(`p.status = $${params.length}`);
    }

    // Filter by brand
    if (brand) {
      params.push(brand);
      conditions.push(`p.brand ILIKE $${params.length}`);
    }

    // Search keyword in name, description, brand, or SKU
    if (search) {
      params.push(`%${search}%`);
      const paramIdx = `$${params.length}`;
      conditions.push(`(
        p.name ILIKE ${paramIdx} OR 
        p.description ILIKE ${paramIdx} OR 
        p.brand ILIKE ${paramIdx} OR
        EXISTS (
          SELECT 1 FROM product_variants pv 
          WHERE pv.product_id = p.id AND pv.sku ILIKE ${paramIdx}
        )
      )`);
    }

    // Filter by category
    if (category_id) {
      params.push(category_id);
      conditions.push(`EXISTS (
        SELECT 1 FROM product_categories pc 
        WHERE pc.product_id = p.id AND pc.category_id = $${params.length}
      )`);
    }

    // Price range filters
    if (min_price !== undefined) {
      params.push(min_price);
      conditions.push(`EXISTS (
        SELECT 1 FROM product_variants pv 
        WHERE pv.product_id = p.id AND pv.price >= $${params.length}
      )`);
    }

    if (max_price !== undefined) {
      params.push(max_price);
      conditions.push(`EXISTS (
        SELECT 1 FROM product_variants pv 
        WHERE pv.product_id = p.id AND pv.price <= $${params.length}
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total records matching criteria
    const countSql = `SELECT COUNT(*)::int AS total FROM products p ${whereClause}`;
    const countResult = await query(countSql, params);
    const total = countResult.rows[0]?.total || 0;

    // Sorting safe mapping
    const sortFieldMap = {
      created_at: 'p.created_at',
      name: 'p.name',
      updated_at: 'p.updated_at',
      price: 'min_price',
    };
    const orderDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const orderBy = sortFieldMap[sort_by] || 'p.created_at';

    // Fetch products with aggregated primary image, categories, and price summary
    const dataSql = `
      SELECT 
        p.id,
        p.name,
        p.slug,
        p.description,
        p.brand,
        p.status,
        p.seller_id,
        p.created_at,
        p.updated_at,
        COALESCE(
          (SELECT img.image_url 
           FROM product_images img 
           WHERE img.product_id = p.id 
           ORDER BY img.is_primary DESC, img.sort_order ASC, img.id ASC 
           LIMIT 1), 
          NULL
        ) AS primary_image,
        COALESCE(MIN(pv.price), 0) AS min_price,
        COALESCE(MAX(pv.price), 0) AS max_price,
        COALESCE(MIN(pv.currency), 'USD') AS currency,
        COUNT(DISTINCT pv.id)::int AS variant_count,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug))
          FILTER (WHERE c.id IS NOT NULL), '[]'
        ) AS categories
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = TRUE
      LEFT JOIN product_categories pc ON pc.product_id = p.id
      LEFT JOIN categories c ON c.id = pc.category_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const dataResult = await query(dataSql, [...params, limit, offset]);

    return {
      products: dataResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get single product by ID or Slug with all variants, categories, and images
   */
  async getProductByIdOrSlug(identifier) {
    const isNumeric = /^\d+$/.test(String(identifier));
    const condition = isNumeric ? 'p.id = $1' : 'p.slug = $1';

    const productSql = `
      SELECT p.*
      FROM products p
      WHERE ${condition} AND p.deleted_at IS NULL
    `;

    const productResult = await query(productSql, [identifier]);
    if (productResult.rows.length === 0) {
      throw new AppError('Product not found', 404);
    }

    const product = productResult.rows[0];

    // Fetch categories
    const categoriesResult = await query(
      `SELECT c.id, c.name, c.slug, c.description
       FROM categories c
       JOIN product_categories pc ON pc.category_id = c.id
       WHERE pc.product_id = $1
       ORDER BY c.name ASC`,
      [product.id]
    );

    // Fetch variants
    const variantsResult = await query(
      `SELECT pv.*
       FROM product_variants pv
       WHERE pv.product_id = $1
       ORDER BY pv.id ASC`,
      [product.id]
    );

    // Fetch images
    const imagesResult = await query(
      `SELECT pi.*
       FROM product_images pi
       WHERE pi.product_id = $1
       ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC`,
      [product.id]
    );

    return {
      ...product,
      categories: categoriesResult.rows,
      variants: variantsResult.rows,
      images: imagesResult.rows,
    };
  },

  /**
   * Create a new product with seller ownership in a transaction
   */
  async createProduct(sellerId, data) {
    if (!sellerId) {
      throw new AppError('Seller identity is required to create a product.', 401);
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const slug = data.slug ? generateSlug(data.slug) : generateSlug(data.name);
      if (!slug) {
        throw new AppError('A valid name or slug is required to generate product slug', 400);
      }

      // Check slug uniqueness
      const existing = await client.query('SELECT id FROM products WHERE slug = $1', [slug]);
      if (existing.rows.length > 0) {
        throw new AppError(`Product slug '${slug}' is already in use.`, 409);
      }

      // Insert product with seller_id
      const productSql = `
        INSERT INTO products (name, slug, description, brand, status, seller_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const productRes = await client.query(productSql, [
        data.name,
        slug,
        data.description || null,
        data.brand || null,
        data.status || 'DRAFT',
        sellerId,
      ]);
      const product = productRes.rows[0];

      // Insert category relations
      if (Array.isArray(data.category_ids) && data.category_ids.length > 0) {
        for (const catId of data.category_ids) {
          await client.query(
            `INSERT INTO product_categories (product_id, category_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [product.id, catId]
          );
        }
      }

      // Insert variants
      const createdVariants = [];
      if (Array.isArray(data.variants) && data.variants.length > 0) {
        for (const v of data.variants) {
          const vRes = await client.query(
            `INSERT INTO product_variants 
              (product_id, sku, variant_name, attributes, price, currency, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
              product.id,
              v.sku,
              v.variant_name || null,
              v.attributes || {},
              v.price,
              v.currency || 'USD',
              v.is_active ?? true,
            ]
          );
          createdVariants.push(vRes.rows[0]);
        }
      }

      // Insert images
      const createdImages = [];
      if (Array.isArray(data.images) && data.images.length > 0) {
        for (const img of data.images) {
          const imgRes = await client.query(
            `INSERT INTO product_images
              (product_id, variant_id, image_url, alt_text, sort_order, is_primary)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
              product.id,
              img.variant_id || null,
              img.image_url,
              img.alt_text || null,
              img.sort_order ?? 0,
              img.is_primary ?? false,
            ]
          );
          createdImages.push(imgRes.rows[0]);
        }
      }

      await client.query('COMMIT');
      logger.info({ productId: product.id, sellerId, name: product.name }, 'Product created by seller');

      return {
        ...product,
        variants: createdVariants,
        images: createdImages,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Update existing product with ownership verification
   */
  async updateProduct(id, user, data) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );
      if (existing.rows.length === 0) {
        throw new AppError('Product not found', 404);
      }

      const product = existing.rows[0];
      const isOwner = String(product.seller_id) === String(user.id);
      const isAdmin = user.roles && user.roles.includes('admin');

      if (!isOwner && !isAdmin) {
        throw new AppError('Forbidden: You can only edit products that you have listed.', 403);
      }

      let slug = product.slug;
      if (data.slug) {
        slug = generateSlug(data.slug);
      } else if (data.name && data.name !== product.name) {
        slug = generateSlug(data.name);
      }

      if (slug !== product.slug) {
        const dup = await client.query('SELECT id FROM products WHERE slug = $1 AND id != $2', [
          slug,
          id,
        ]);
        if (dup.rows.length > 0) {
          throw new AppError(`Slug '${slug}' is already taken by another product`, 409);
        }
      }

      const updateSql = `
        UPDATE products
        SET name = COALESCE($1, name),
            slug = $2,
            description = CASE WHEN $3 IS NULL THEN description ELSE $3 END,
            brand = CASE WHEN $4 IS NULL THEN brand ELSE $4 END,
            status = COALESCE($5, status),
            updated_at = NOW()
        WHERE id = $6
        RETURNING *
      `;

      const result = await client.query(updateSql, [
        data.name,
        slug,
        data.description,
        data.brand,
        data.status,
        id,
      ]);

      // If category_ids is provided, synchronize categories
      if (Array.isArray(data.category_ids)) {
        await client.query('DELETE FROM product_categories WHERE product_id = $1', [id]);
        for (const catId of data.category_ids) {
          await client.query(
            'INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)',
            [id, catId]
          );
        }
      }

      await client.query('COMMIT');
      logger.info({ productId: id, userId: user.id }, 'Product updated');

      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Delete product (soft-delete) with ownership verification
   */
  async deleteProduct(id, user) {
    const existing = await query(
      'SELECT seller_id, name FROM products WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (existing.rows.length === 0) {
      throw new AppError('Product not found or already deleted', 404);
    }

    const product = existing.rows[0];
    const isOwner = String(product.seller_id) === String(user.id);
    const isAdmin = user.roles && user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: You can only delete products that you have listed.', 403);
    }

    const sql = `
      UPDATE products
      SET deleted_at = NOW(),
          status = 'ARCHIVED',
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name
    `;
    const result = await query(sql, [id]);

    logger.info({ productId: id, userId: user.id }, 'Product soft-deleted');
    return { success: true, message: `Product '${result.rows[0].name}' deleted successfully.` };
  },
};

export default productService;
