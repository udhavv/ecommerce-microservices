import inventoryService from '../../services/inventory.service.js';
import logger from '../../utils/logger.js';
import { query } from '../../config/db.js';

export async function handleProductEvent(content) {
  const { event, product, productId, sellerId } = content;

  logger.info({ event, productId, sellerId }, 'Handling product event in inventory service');

  // When a new product is created, initialize inventory records for all variants
  if (event === 'product.created' || content.type === 'product.created') {
    const p = product || content;
    const variants = p.variants || [];
    const targetSellerId = p.seller_id || sellerId;

    for (const v of variants) {
      try {
        await inventoryService.createInventoryItem(
          {
            product_id: p.id,
            variant_id: v.id,
            sku: v.sku,
            quantity_available: v.initial_stock || 10,
            low_stock_threshold: v.low_stock_threshold || 5,
          },
          targetSellerId
        );
      } catch (err) {
        logger.warn(
          { variantId: v.id, err: err.message },
          'Could not auto-initialize inventory item for variant'
        );
      }
    }
  }

  // When a product is deleted, deactivate its inventory items
  if (event === 'product.deleted' || content.type === 'product.deleted') {
    const id = productId || content.productId || product?.id;
    if (id) {
      await query(
        `UPDATE inventory SET is_active = FALSE, updated_at = NOW() WHERE product_id = $1`,
        [id]
      );
      logger.info({ productId: id }, 'Deactivated inventory items for deleted product');
    }
  }
}

export default handleProductEvent;
