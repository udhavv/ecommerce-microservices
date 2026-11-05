import { jest } from '@jest/globals';

// In-memory relational tables
export const tables = {
  categories: [],
  products: [],
  product_categories: [],
  product_variants: [],
  product_images: [],
};

let nextIds = {
  category: 1,
  product: 1,
  variant: 1,
  image: 1,
};

export function resetDatabase() {
  tables.categories = [];
  tables.products = [];
  tables.product_categories = [];
  tables.product_variants = [];
  tables.product_images = [];
  nextIds = { category: 1, product: 1, variant: 1, image: 1 };
}

export async function handleQuery(sql, params = []) {
  const query = sql.replace(/\s+/g, ' ').trim();

  // 1. Transactions & Health Checks
  if (
    query === 'BEGIN' ||
    query === 'COMMIT' ||
    query === 'ROLLBACK' ||
    query.startsWith('SELECT 1')
  ) {
    return { rows: [{ '?column?': 1 }], rowCount: 1 };
  }

  // 2. Count Queries (e.g. Total products or Product-Categories check)
  if (query.includes('SELECT COUNT(*)::int AS total FROM products')) {
    const activeProducts = tables.products.filter((p) => !p.deleted_at);
    return { rows: [{ total: activeProducts.length }], rowCount: 1 };
  }

  if (query.includes('SELECT COUNT(*)::int AS count FROM product_categories WHERE category_id = $1')) {
    const [catId] = params;
    const count = tables.product_categories.filter((pc) => String(pc.category_id) === String(catId)).length;
    return { rows: [{ count }], rowCount: 1 };
  }

  // 3. Category Queries
  if (query.includes('FROM categories') && query.includes('WHERE slug = $1') && !query.includes('id !=')) {
    const [slug] = params;
    const cat = tables.categories.find((c) => c.slug === slug);
    return { rows: cat ? [{ ...cat }] : [], rowCount: cat ? 1 : 0 };
  }

  if (query.includes('SELECT id FROM categories WHERE slug = $1 AND id != $2')) {
    const [slug, id] = params;
    const cat = tables.categories.find((c) => c.slug === slug && String(c.id) !== String(id));
    return { rows: cat ? [{ id: cat.id }] : [], rowCount: cat ? 1 : 0 };
  }

  if (query.includes('FROM categories') && (query.includes('WHERE c.id = $1') || query.includes('WHERE c.slug = $1') || query.includes('WHERE id = $1'))) {
    const [idOrSlug] = params;
    const isNum = /^\d+$/.test(String(idOrSlug));
    const cat = tables.categories.find((c) => (isNum ? String(c.id) === String(idOrSlug) : c.slug === idOrSlug));
    if (!cat) return { rows: [], rowCount: 0 };
    return {
      rows: [{
        ...cat,
        product_count: tables.product_categories.filter((pc) => pc.category_id === cat.id).length,
        parent_name: cat.parent_id ? tables.categories.find((p) => p.id === cat.parent_id)?.name || null : null,
      }],
      rowCount: 1,
    };
  }

  if (query.includes('FROM categories WHERE parent_id = $1')) {
    const [parentId] = params;
    const children = tables.categories.filter((c) => String(c.parent_id) === String(parentId));
    return { rows: children.map((c) => ({ ...c })), rowCount: children.length };
  }

  if (query.includes('FROM categories c LEFT JOIN product_categories pc')) {
    const rows = tables.categories.map((c) => ({
      ...c,
      product_count: tables.product_categories.filter((pc) => pc.category_id === c.id).length,
    }));
    return { rows, rowCount: rows.length };
  }

  if (query.includes('INSERT INTO categories')) {
    const [name, slug, description, parent_id, is_active] = params;
    const newCat = {
      id: nextIds.category++,
      name,
      slug,
      description: description || null,
      parent_id: parent_id || null,
      is_active: is_active ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    tables.categories.push(newCat);
    return { rows: [{ ...newCat }], rowCount: 1 };
  }

  if (query.includes('UPDATE categories SET')) {
    const id = params[params.length - 1];
    const cat = tables.categories.find((c) => String(c.id) === String(id));
    if (!cat) return { rows: [], rowCount: 0 };

    if (params[0] !== undefined) cat.name = params[0];
    if (params[1] !== undefined) cat.slug = params[1];
    if (params[2] !== undefined) cat.description = params[2];
    if (params[3] !== undefined) cat.parent_id = params[3];
    if (params[4] !== undefined) cat.is_active = params[4];
    cat.updated_at = new Date();

    return { rows: [{ ...cat }], rowCount: 1 };
  }

  if (query.includes('DELETE FROM categories WHERE id = $1')) {
    const [id] = params;
    const idx = tables.categories.findIndex((c) => String(c.id) === String(id));
    if (idx === -1) return { rows: [], rowCount: 0 };
    const deleted = tables.categories.splice(idx, 1)[0];
    return { rows: [{ id: deleted.id, name: deleted.name }], rowCount: 1 };
  }

  // 4. Product Queries
  if (query.includes('FROM products WHERE slug = $1') || query.includes('SELECT id, deleted_at FROM products WHERE slug = $1')) {
    const [slug] = params;
    const prod = tables.products.find((p) => p.slug === slug);
    return { rows: prod ? [{ id: prod.id, deleted_at: prod.deleted_at }] : [], rowCount: prod ? 1 : 0 };
  }

  if (query.includes('FROM products p WHERE (p.id = $1 OR p.slug = $1') || query.includes('WHERE (p.id = $1') || query.includes('WHERE p.id = $1') || query.includes('WHERE p.slug = $1')) {
    const [idOrSlug] = params;
    const isNum = /^\d+$/.test(String(idOrSlug));
    const prod = tables.products.find((p) =>
      !p.deleted_at && (isNum ? String(p.id) === String(idOrSlug) : p.slug === idOrSlug)
    );
    return { rows: prod ? [{ ...prod }] : [], rowCount: prod ? 1 : 0 };
  }

  if (
    (query.startsWith('SELECT') && query.includes('FROM products WHERE id = $1')) ||
    query.includes('SELECT * FROM products WHERE id = $1') ||
    query.includes('SELECT id, seller_id, name, slug FROM products WHERE id = $1')
  ) {
    const [id] = params;
    const prod = tables.products.find((p) => String(p.id) === String(id) && !p.deleted_at);
    return { rows: prod ? [{ ...prod }] : [], rowCount: prod ? 1 : 0 };
  }

  if (query.includes('SELECT p.id, p.name, p.slug') && query.includes('FROM products p')) {
    // List products
    const activeProducts = tables.products.filter((p) => !p.deleted_at);
    const enriched = activeProducts.map((p) => {
      const vars = tables.product_variants.filter((v) => v.product_id === p.id && v.is_active);
      const img = tables.product_images.find((i) => i.product_id === p.id && i.is_primary);
      const prices = vars.map((v) => Number(v.price));
      const min_price = prices.length ? Math.min(...prices) : 0;
      const max_price = prices.length ? Math.max(...prices) : 0;
      return {
        ...p,
        primary_image: img ? img.image_url : null,
        min_price,
        max_price,
        currency: 'USD',
        variant_count: vars.length,
        categories: tables.product_categories
          .filter((pc) => pc.product_id === p.id)
          .map((pc) => {
            const cat = tables.categories.find((c) => c.id === pc.category_id);
            return cat ? { id: cat.id, name: cat.name, slug: cat.slug } : null;
          })
          .filter(Boolean),
      };
    });
    return { rows: enriched, rowCount: enriched.length };
  }

  if (query.includes('INSERT INTO products')) {
    const [name, slug, description, brand, status, seller_id] = params;
    const newProd = {
      id: nextIds.product++,
      name,
      slug,
      description,
      brand,
      status: status || 'ACTIVE',
      seller_id,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };
    tables.products.push(newProd);
    return { rows: [{ ...newProd }], rowCount: 1 };
  }

  if (query.includes('UPDATE products SET')) {
    const id = params[params.length - 1];
    const prod = tables.products.find((p) => String(p.id) === String(id));
    if (!prod) return { rows: [], rowCount: 0 };

    if (params[0] !== undefined && params[0] !== null) prod.name = params[0];
    if (params[1] !== undefined && params[1] !== null) prod.slug = params[1];
    if (params[2] !== undefined && params[2] !== null) prod.description = params[2];
    if (params[3] !== undefined && params[3] !== null) prod.brand = params[3];
    if (params[4] !== undefined && params[4] !== null) prod.status = params[4];
    prod.updated_at = new Date();

    return { rows: [{ ...prod }], rowCount: 1 };
  }

  if (query.includes('DELETE FROM products WHERE id = $1')) {
    const [id] = params;
    const idx = tables.products.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) return { rows: [], rowCount: 0 };
    const deleted = tables.products.splice(idx, 1)[0];
    // Cascade delete relations
    tables.product_categories = tables.product_categories.filter((pc) => String(pc.product_id) !== String(id));
    tables.product_variants = tables.product_variants.filter((pv) => String(pv.product_id) !== String(id));
    tables.product_images = tables.product_images.filter((pi) => String(pi.product_id) !== String(id));
    return { rows: [{ id: deleted.id, name: deleted.name }], rowCount: 1 };
  }

  // 5. Product Categories Relations
  if (query.includes('SELECT c.id, c.name, c.slug, c.description FROM categories c JOIN product_categories pc')) {
    const [prodId] = params;
    const catIds = tables.product_categories.filter((pc) => String(pc.product_id) === String(prodId)).map((pc) => pc.category_id);
    const cats = tables.categories.filter((c) => catIds.includes(c.id));
    return { rows: cats.map((c) => ({ ...c })), rowCount: cats.length };
  }

  if (query.includes('INSERT INTO product_categories')) {
    const [product_id, category_id] = params;
    const exists = tables.product_categories.some(
      (pc) => String(pc.product_id) === String(product_id) && String(pc.category_id) === String(category_id)
    );
    if (!exists) {
      tables.product_categories.push({ product_id: Number(product_id), category_id: Number(category_id) });
    }
    return { rows: [], rowCount: 1 };
  }

  if (query.includes('DELETE FROM product_categories WHERE product_id = $1')) {
    const [prodId] = params;
    tables.product_categories = tables.product_categories.filter((pc) => String(pc.product_id) !== String(prodId));
    return { rows: [], rowCount: 1 };
  }

  // 6. Product Variants
  if (query.includes('SELECT * FROM product_variants WHERE product_id = $1') || query.includes('SELECT pv.* FROM product_variants pv WHERE pv.product_id = $1')) {
    const [prodId] = params;
    const vars = tables.product_variants.filter((pv) => String(pv.product_id) === String(prodId));
    return { rows: vars.map((v) => ({ ...v })), rowCount: vars.length };
  }

  if (query.includes('SELECT * FROM product_variants WHERE id = $1')) {
    const [id] = params;
    const v = tables.product_variants.find((pv) => String(pv.id) === String(id));
    return { rows: v ? [{ ...v }] : [], rowCount: v ? 1 : 0 };
  }

  if (query.includes('SELECT id FROM product_variants WHERE sku = $1')) {
    const [sku, id] = params;
    const v = tables.product_variants.find((pv) => pv.sku === sku && (!id || String(pv.id) !== String(id)));
    return { rows: v ? [{ id: v.id }] : [], rowCount: v ? 1 : 0 };
  }

  if (query.includes('INSERT INTO product_variants')) {
    const [product_id, sku, variant_name, attributes, price, currency, is_active] = params;
    const newVar = {
      id: nextIds.variant++,
      product_id: Number(product_id),
      sku,
      variant_name: variant_name || null,
      attributes: attributes || {},
      price: Number(price),
      currency: currency || 'USD',
      is_active: is_active ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    tables.product_variants.push(newVar);
    return { rows: [{ ...newVar }], rowCount: 1 };
  }

  if (query.includes('UPDATE product_variants SET')) {
    const id = params[params.length - 1];
    const v = tables.product_variants.find((pv) => String(pv.id) === String(id));
    if (!v) return { rows: [], rowCount: 0 };
    if (params[0] !== undefined) v.sku = params[0];
    if (params[1] !== undefined && params[1] !== null) v.variant_name = params[1];
    if (params[2] !== undefined) v.attributes = params[2];
    if (params[3] !== undefined) v.price = Number(params[3]);
    if (params[4] !== undefined) v.currency = params[4];
    if (params[5] !== undefined) v.is_active = params[5];
    v.updated_at = new Date();
    return { rows: [{ ...v }], rowCount: 1 };
  }

  if (query.includes('DELETE FROM product_variants WHERE id = $1')) {
    const [id] = params;
    const idx = tables.product_variants.findIndex((v) => String(v.id) === String(id));
    if (idx === -1) return { rows: [], rowCount: 0 };
    const deleted = tables.product_variants.splice(idx, 1)[0];
    return { rows: [{ ...deleted }], rowCount: 1 };
  }

  // 7. Product Images
  if (query.includes('SELECT * FROM product_images WHERE product_id = $1') || query.includes('SELECT pi.* FROM product_images pi WHERE pi.product_id = $1') || query.includes('SELECT id, image_url, alt_text FROM product_images WHERE product_id = $1')) {
    const [prodId] = params;
    const imgs = tables.product_images.filter((pi) => String(pi.product_id) === String(prodId));
    return { rows: imgs.map((i) => ({ ...i })), rowCount: imgs.length };
  }

  if (query.includes('SELECT * FROM product_images WHERE id = $1')) {
    const [id] = params;
    const img = tables.product_images.find((pi) => String(pi.id) === String(id));
    return { rows: img ? [{ ...img }] : [], rowCount: img ? 1 : 0 };
  }

  if (query.includes('INSERT INTO product_images')) {
    const [product_id, variant_id, image_url, alt_text, sort_order, is_primary] = params;
    const newImg = {
      id: nextIds.image++,
      product_id: Number(product_id),
      variant_id: variant_id ? Number(variant_id) : null,
      image_url,
      alt_text: alt_text || null,
      sort_order: sort_order ?? 0,
      is_primary: is_primary ?? false,
      created_at: new Date(),
    };
    tables.product_images.push(newImg);
    return { rows: [{ ...newImg }], rowCount: 1 };
  }

  if (query.includes('DELETE FROM product_images WHERE product_id = $1')) {
    const [prodId] = params;
    tables.product_images = tables.product_images.filter((pi) => String(pi.product_id) !== String(prodId));
    return { rows: [], rowCount: 1 };
  }

  if (query.includes('DELETE FROM product_images WHERE id = $1')) {
    const [id] = params;
    const idx = tables.product_images.findIndex((i) => String(i.id) === String(id));
    if (idx === -1) return { rows: [], rowCount: 0 };
    const deleted = tables.product_images.splice(idx, 1)[0];
    return { rows: [{ ...deleted }], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

export const mockClient = {
  query: jest.fn(handleQuery),
  release: jest.fn(),
};

export const mockPool = {
  query: jest.fn(handleQuery),
  connect: jest.fn(async () => mockClient),
  on: jest.fn(),
  end: jest.fn(),
};
