import env from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const productClient = {
  /**
   * Fetch full product details including variants from Product Service
   * @param {number|string} productId
   * @returns {Promise<any>}
   */
  async getProduct(productId) {
    const url = `${env.services.productUrl}/products/${productId}`;
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': 'order-service',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new AppError(`Product #${productId} not found in store catalog`, 404);
        }
        throw new AppError(`Failed to retrieve product #${productId} from product service`, 502);
      }

      const body = await response.json();
      return body.data?.product || body.data || body;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err.message, productId }, 'Error contacting product service');
      throw new AppError(`Product service unavailable: ${err.message}`, 503);
    }
  },

  /**
   * Validate an item being ordered:
   * Confirms product is ACTIVE, variant exists, and returns the snapshot details (price, sku, name)
   */
  async validateOrderItem(productId, variantId) {
    const product = await this.getProduct(productId);

    if (product.status !== 'ACTIVE') {
      throw new AppError(`Product '${product.name}' is currently unavailable for purchase.`, 400);
    }

    const variants = product.variants || [];
    const variant = variants.find((v) => Number(v.id) === Number(variantId));

    if (!variant) {
      throw new AppError(
        `Variant #${variantId} for product '${product.name}' does not exist or has been removed.`,
        400
      );
    }

    if (variant.is_active === false) {
      throw new AppError(
        `Variant '${variant.variant_name || variant.sku}' for '${product.name}' is inactive.`,
        400
      );
    }

    return {
      product_id: Number(product.id),
      variant_id: Number(variant.id),
      product_name: product.name,
      variant_name: variant.variant_name || 'Standard',
      sku: variant.sku,
      unit_price: parseFloat(variant.price),
      currency: variant.currency || product.currency || 'USD',
      seller_id: product.seller_id,
    };
  },
};

export default productClient;
