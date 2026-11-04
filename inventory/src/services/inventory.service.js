import { query, withTransaction } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import inventoryPublisher from '../events/publishers/inventory.publisher.js';

export const inventoryService = {
  /**
   * List inventory items with filtering, search, pagination, and multi-tenant security
   */
  async listInventory(filters, user) {
    const {
      page = 1,
      limit = 20,
      search,
      low_stock_only = false,
      seller_id,
    } = filters;

    const offset = (page - 1) * limit;
    const conditions = ['is_active = TRUE'];
    const params = [];

    // Security check: Sellers can strictly view only their own inventory items
    const isSeller = user?.roles?.includes('seller');
    const isAdmin = user?.roles?.includes('admin');

    if (isSeller && !isAdmin) {
      params.push(user.id);
      conditions.push(`seller_id = $${params.length}`);
    } else if (isAdmin && seller_id) {
      params.push(seller_id);
      conditions.push(`seller_id = $${params.length}`);
    }

    if (low_stock_only) {
      conditions.push(`quantity_available <= low_stock_threshold`);
    }

    if (search) {
      params.push(`%${search}%`);
      const pIdx = `$${params.length}`;
      conditions.push(`(sku ILIKE ${pIdx} OR product_id::text ILIKE ${pIdx} OR variant_id::text ILIKE ${pIdx})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*)::int AS total FROM inventory ${whereClause}`;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    const dataSql = `
      SELECT 
        id,
        seller_id,
        product_id,
        variant_id,
        sku,
        quantity_available,
        quantity_reserved,
        low_stock_threshold,
        (quantity_available + quantity_reserved) AS total_physical_stock,
        version,
        is_active,
        created_at,
        updated_at
      FROM inventory
      ${whereClause}
      ORDER BY updated_at DESC, id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const dataRes = await query(dataSql, [...params, limit, offset]);

    return {
      items: dataRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get single variant inventory status
   */
  async getByVariantId(variantId) {
    const res = await query(
      `SELECT * FROM inventory WHERE variant_id = $1 AND is_active = TRUE`,
      [variantId]
    );

    if (res.rows.length === 0) {
      throw new AppError(`Inventory record for variant ID ${variantId} not found`, 404);
    }

    return res.rows[0];
  },

  /**
   * Get all variant inventory records for a product
   */
  async getByProductId(productId) {
    const res = await query(
      `SELECT * FROM inventory WHERE product_id = $1 AND is_active = TRUE ORDER BY variant_id ASC`,
      [productId]
    );
    return res.rows;
  },

  /**
   * Create or initialize an inventory record
   */
  async createInventoryItem(data, sellerId) {
    const finalSellerId = sellerId || data.seller_id;
    if (!finalSellerId) {
      throw new AppError('Seller identity is required to register an inventory item', 400);
    }

    return withTransaction(async (client) => {
      // Check for duplicate variant
      const existing = await client.query(
        'SELECT id FROM inventory WHERE variant_id = $1',
        [data.variant_id]
      );
      if (existing.rows.length > 0) {
        throw new AppError(`Inventory already exists for variant ${data.variant_id}`, 409);
      }

      const sql = `
        INSERT INTO inventory 
          (seller_id, product_id, variant_id, sku, quantity_available, quantity_reserved, low_stock_threshold)
        VALUES ($1, $2, $3, $4, $5, 0, $6)
        RETURNING *
      `;

      const res = await client.query(sql, [
        finalSellerId,
        data.product_id,
        data.variant_id,
        data.sku || null,
        data.quantity_available ?? 0,
        data.low_stock_threshold ?? 5,
      ]);

      const item = res.rows[0];

      // Record initial stock movement
      if (item.quantity_available > 0) {
        await client.query(
          `INSERT INTO inventory_movements
            (inventory_id, variant_id, movement_type, quantity, reference_type, actor_id, actor_role, previous_available, new_available, previous_reserved, new_reserved, reason)
           VALUES ($1, $2, 'INITIAL_STOCK', $3, 'INITIAL', $4, 'seller', 0, $5, 0, 0, 'Initial inventory setup')`,
          [item.id, item.variant_id, item.quantity_available, finalSellerId, item.quantity_available]
        );
      }

      logger.info({ inventoryId: item.id, variantId: item.variant_id }, 'Inventory record created');
      await inventoryPublisher.publishStockUpdated(item);

      return item;
    });
  },

  /**
   * Manually adjust stock with row locking (SELECT ... FOR UPDATE) and audit logging
   */
  async adjustStock(inventoryId, user, data) {
    return withTransaction(async (client) => {
      // 1. Lock the inventory row to prevent concurrent race conditions
      const lockRes = await client.query(
        `SELECT * FROM inventory WHERE id = $1 AND is_active = TRUE FOR UPDATE`,
        [inventoryId]
      );

      if (lockRes.rows.length === 0) {
        throw new AppError('Inventory item not found', 404);
      }

      const item = lockRes.rows[0];

      // 2. Ownership verification
      const isOwner = String(item.seller_id) === String(user.id);
      const isAdmin = user?.roles?.includes('admin');
      if (!isOwner && !isAdmin) {
        throw new AppError('Forbidden: You can only adjust inventory for your own products.', 403);
      }

      // 3. Compute new stock level
      let newAvailable = item.quantity_available;
      let quantityChanged = 0;

      if (data.new_quantity !== undefined) {
        newAvailable = data.new_quantity;
        quantityChanged = Math.abs(newAvailable - item.quantity_available);
      } else if (data.quantity_change !== undefined) {
        newAvailable = item.quantity_available + data.quantity_change;
        quantityChanged = Math.abs(data.quantity_change);
      }

      if (newAvailable < 0) {
        throw new AppError(
          `Insufficient stock: Cannot reduce available quantity below 0 (current: ${item.quantity_available})`,
          400
        );
      }

      if (quantityChanged === 0 && data.new_quantity === item.quantity_available) {
        return item; // No change needed
      }

      // 4. Update inventory row with version bump
      const updateRes = await client.query(
        `UPDATE inventory 
         SET quantity_available = $1,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [newAvailable, item.id]
      );

      const updatedItem = updateRes.rows[0];

      // 5. Append immutable movement record
      await client.query(
        `INSERT INTO inventory_movements
          (inventory_id, variant_id, movement_type, quantity, reference_type, reference_id, actor_id, actor_role, previous_available, new_available, previous_reserved, new_reserved, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          updatedItem.id,
          updatedItem.variant_id,
          data.movement_type || 'ADJUSTMENT',
          quantityChanged,
          'MANUAL_ADJUSTMENT',
          data.reference_id || null,
          user.id,
          isAdmin ? 'admin' : 'seller',
          item.quantity_available,
          newAvailable,
          item.quantity_reserved,
          item.quantity_reserved,
          data.reason || 'Manual stock level adjustment',
        ]
      );

      logger.info(
        { inventoryId: updatedItem.id, previous: item.quantity_available, current: newAvailable },
        'Inventory stock adjusted'
      );

      await inventoryPublisher.publishStockUpdated(updatedItem);

      return updatedItem;
    });
  },

  /**
   * Check whether an order already has an active reservation or confirmation
   */
  async isOrderReserved(orderId, alternateOrderId = null) {
    const ids = [orderId, alternateOrderId].filter(Boolean).map(String);
    if (ids.length === 0) return false;
    const res = await query(
      `SELECT id FROM inventory_reservations 
       WHERE order_id = ANY($1) AND status IN ('RESERVED', 'CONFIRMED')
       LIMIT 1`,
      [ids]
    );
    return res.rows.length > 0;
  },

  /**
   * Atomically reserve stock for an order (Checkout flow)
   * Prevents deadlocks by ordering variant_ids ascending
   */
  async reserveStock(orderId, items, expiresInMinutes = 15, idempotencyKey = null, alternateOrderId = null) {
    return withTransaction(async (client) => {
      // 1. Idempotency Check: if this order already has reservations under orderId or alternateOrderId, return them
      const ids = [orderId, alternateOrderId].filter(Boolean).map(String);
      const existingRes = await client.query(
        `SELECT * FROM inventory_reservations WHERE order_id = ANY($1) AND status IN ('RESERVED', 'CONFIRMED')`,
        [ids]
      );
      if (existingRes.rows.length > 0) {
        logger.info({ orderId, count: existingRes.rows.length }, 'Idempotent reserve: Order already has reservations');
        return {
          order_id: orderId,
          status: existingRes.rows[0].status,
          items: existingRes.rows,
        };
      }

      // 2. Sort items by variant_id to strictly prevent database deadlocks
      const sortedItems = [...items].sort((a, b) => Number(a.variant_id) - Number(b.variant_id));
      const variantIds = sortedItems.map((i) => i.variant_id);

      // 3. Acquire row-level locks on all target inventory items in deterministic order
      const lockedRes = await client.query(
        `SELECT * FROM inventory 
         WHERE variant_id = ANY($1) AND is_active = TRUE 
         ORDER BY variant_id ASC 
         FOR UPDATE`,
        [variantIds]
      );

      const inventoryMap = new Map();
      for (const row of lockedRes.rows) {
        inventoryMap.set(String(row.variant_id), row);
      }

      // 4. Verify all items exist and have sufficient available quantity
      for (const reqItem of sortedItems) {
        let inv = inventoryMap.get(String(reqItem.variant_id));
        if (!inv) {
          try {
            let sellerId = 'system-seller';
            let sku = `SKU-${reqItem.variant_id}`;
            let prodId = reqItem.product_id || reqItem.variant_id;

            const productUrl = process.env.PRODUCT_SERVICE_URL || 'http://product:4001/api';
            const productRes = await fetch(`${productUrl}/products/${prodId}`).catch(() => null);
            if (productRes && productRes.ok) {
              const pData = await productRes.json();
              const p = pData?.data?.product || pData?.data;
              if (p?.seller_id) sellerId = p.seller_id;
              if (p?.id) prodId = p.id;
              const matchingVar = p?.variants?.find((v) => String(v.id) === String(reqItem.variant_id));
              if (matchingVar?.sku) sku = matchingVar.sku;
            }

            const insertRes = await client.query(
              `INSERT INTO inventory 
                (seller_id, product_id, variant_id, sku, quantity_available, quantity_reserved, low_stock_threshold)
               VALUES ($1, $2, $3, $4, 100, 0, 5)
               ON CONFLICT (variant_id) DO UPDATE SET updated_at = NOW()
               RETURNING *`,
              [sellerId, prodId, reqItem.variant_id, sku]
            );
            if (insertRes.rows.length > 0) {
              inv = insertRes.rows[0];
              inventoryMap.set(String(reqItem.variant_id), inv);
              logger.info({ variantId: reqItem.variant_id, orderId }, 'Auto-provisioned inventory record during reservation');
            }
          } catch (autoErr) {
            logger.warn({ err: autoErr.message, variantId: reqItem.variant_id }, 'Auto-provision fallback failed');
          }
        }

        if (!inv) {
          await inventoryPublisher.publishReservationFailed(orderId, `Item not found`, reqItem);
          throw new AppError(`Item variant ${reqItem.variant_id} is not registered in inventory`, 404);
        }

        if (inv.quantity_available < reqItem.quantity) {
          const reason = `Insufficient stock for variant ${reqItem.variant_id} (Requested: ${reqItem.quantity}, Available: ${inv.quantity_available})`;
          await inventoryPublisher.publishReservationFailed(orderId, reason, reqItem);
          throw new AppError(reason, 400);
        }
      }

      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
      const reservedRecords = [];
      const updatedInventoryItems = [];

      // 5. Deduct quantity_available, increment quantity_reserved, record movements
      for (const reqItem of sortedItems) {
        const inv = inventoryMap.get(String(reqItem.variant_id));
        const newAvailable = inv.quantity_available - reqItem.quantity;
        const newReserved = inv.quantity_reserved + reqItem.quantity;

        const updateRes = await client.query(
          `UPDATE inventory 
           SET quantity_available = $1,
               quantity_reserved = $2,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [newAvailable, newReserved, inv.id]
        );
        if (updateRes.rows.length > 0) {
          updatedInventoryItems.push(updateRes.rows[0]);
        }

        const resResult = await client.query(
          `INSERT INTO inventory_reservations
            (order_id, variant_id, quantity, status, expires_at, idempotency_key)
           VALUES ($1, $2, $3, 'RESERVED', $4, $5)
           RETURNING *`,
          [orderId, reqItem.variant_id, reqItem.quantity, expiresAt, idempotencyKey]
        );
        reservedRecords.push(resResult.rows[0]);

        await client.query(
          `INSERT INTO inventory_movements
            (inventory_id, variant_id, movement_type, quantity, reference_type, reference_id, actor_id, actor_role, previous_available, new_available, previous_reserved, new_reserved, reason)
           VALUES ($1, $2, 'RESERVE', $3, 'ORDER', $4, 'system', 'system', $5, $6, $7, $8, $9)`,
          [
            inv.id,
            inv.variant_id,
            reqItem.quantity,
            orderId,
            inv.quantity_available,
            newAvailable,
            inv.quantity_reserved,
            newReserved,
            `Reserved for order ${orderId}`,
          ]
        );
      }

      logger.info({ orderId, itemsCount: items.length }, 'Stock successfully reserved for order');
      await inventoryPublisher.publishReservationSuccess(orderId, items);

      for (const item of updatedInventoryItems) {
        inventoryPublisher.publishStockUpdated(item).catch(() => {});
      }

      return {
        order_id: orderId,
        status: 'RESERVED',
        expires_at: expiresAt,
        items: reservedRecords,
      };
    });
  },

  /**
   * Confirm reservation into final sale deduction upon successful payment
   */
  async confirmReservation(orderId, alternateOrderId = null) {
    return withTransaction(async (client) => {
      const ids = [orderId, alternateOrderId].filter(Boolean).map(String);
      const resLock = await client.query(
        `SELECT * FROM inventory_reservations 
         WHERE order_id = ANY($1) AND status = 'RESERVED' 
         FOR UPDATE`,
        [ids]
      );

      if (resLock.rows.length === 0) {
        const alreadyConfirmed = await client.query(
          `SELECT * FROM inventory_reservations WHERE order_id = ANY($1) AND status = 'CONFIRMED'`,
          [ids]
        );
        if (alreadyConfirmed.rows.length > 0) {
          logger.info({ orderId }, 'Reservation already confirmed');
          return { order_id: orderId, status: 'CONFIRMED' };
        }
        logger.warn({ orderId }, 'No active reservations found to confirm');
        return { order_id: orderId, status: 'NOOP' };
      }

      for (const res of resLock.rows) {
        const invLock = await client.query(
          `SELECT * FROM inventory WHERE variant_id = $1 FOR UPDATE`,
          [res.variant_id]
        );

        if (invLock.rows.length > 0) {
          const inv = invLock.rows[0];
          const newReserved = Math.max(0, inv.quantity_reserved - res.quantity);

          const updateRes = await client.query(
            `UPDATE inventory 
             SET quantity_reserved = $1,
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [newReserved, inv.id]
          );

          await client.query(
            `INSERT INTO inventory_movements
              (inventory_id, variant_id, movement_type, quantity, reference_type, reference_id, actor_id, actor_role, previous_available, new_available, previous_reserved, new_reserved, reason)
             VALUES ($1, $2, 'SALE', $3, 'ORDER', $4, 'system', 'system', $5, $5, $6, $7, $8)`,
            [
              inv.id,
              inv.variant_id,
              res.quantity,
              orderId,
              inv.quantity_available,
              inv.quantity_reserved,
              newReserved,
              `Order ${orderId} confirmed and paid`,
            ]
          );

          if (updateRes.rows.length > 0) {
            inventoryPublisher.publishStockUpdated(updateRes.rows[0]).catch(() => {});
          }
        }

        await client.query(
          `UPDATE inventory_reservations SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`,
          [res.id]
        );
      }

      logger.info({ orderId }, 'Reservations confirmed into permanent sale');
      await inventoryPublisher.publishReservationConfirmed(orderId);

      return { order_id: orderId, status: 'CONFIRMED' };
    });
  },

  /**
   * Release reserved or confirmed stock back to available pool upon order cancellation/timeout
   */
  async releaseReservation(orderId, reason = 'Order cancelled', items = null, alternateOrderId = null) {
    return withTransaction(async (client) => {
      const ids = [orderId, alternateOrderId].filter(Boolean).map(String);
      const resLock = await client.query(
        `SELECT * FROM inventory_reservations 
         WHERE order_id = ANY($1) AND status IN ('RESERVED', 'CONFIRMED') 
         FOR UPDATE`,
        [ids]
      );

      const updatedInventoryItems = [];

      if (resLock.rows.length > 0) {
        for (const res of resLock.rows) {
          const invLock = await client.query(
            `SELECT * FROM inventory WHERE variant_id = $1 FOR UPDATE`,
            [res.variant_id]
          );

          if (invLock.rows.length > 0) {
            const inv = invLock.rows[0];
            const isConfirmed = res.status === 'CONFIRMED';

            // If was RESERVED: restore available stock and decrement reserved hold
            // If was CONFIRMED: restore available stock (reserved hold was already 0)
            const newAvailable = inv.quantity_available + res.quantity;
            const newReserved = isConfirmed
              ? inv.quantity_reserved
              : Math.max(0, inv.quantity_reserved - res.quantity);

            const updateRes = await client.query(
              `UPDATE inventory 
               SET quantity_available = $1,
                   quantity_reserved = $2,
                   version = version + 1,
                   updated_at = NOW()
               WHERE id = $3
               RETURNING *`,
              [newAvailable, newReserved, inv.id]
            );

            if (updateRes.rows.length > 0) {
              updatedInventoryItems.push(updateRes.rows[0]);
            }

            await client.query(
              `INSERT INTO inventory_movements
                (inventory_id, variant_id, movement_type, quantity, reference_type, reference_id, actor_id, actor_role, previous_available, new_available, previous_reserved, new_reserved, reason)
               VALUES ($1, $2, 'RELEASE', $3, 'ORDER', $4, 'system', 'system', $5, $6, $7, $8, $9)`,
              [
                inv.id,
                inv.variant_id,
                res.quantity,
                orderId,
                inv.quantity_available,
                newAvailable,
                inv.quantity_reserved,
                newReserved,
                reason || (isConfirmed ? 'Order cancelled, paid stock returned to available pool' : 'Order cancelled, hold released'),
              ]
            );
          }

          await client.query(
            `UPDATE inventory_reservations SET status = 'RELEASED', updated_at = NOW() WHERE id = $1`,
            [res.id]
          );
        }
      } else if (Array.isArray(items) && items.length > 0) {
        // Fallback: If no reservations were found in reservations table, directly restore stock using items list
        logger.info({ orderId, itemsCount: items.length }, 'Releasing stock directly from order items fallback');
        for (const it of items) {
          const variantId = it.variant_id || it.variantId;
          const qty = Number(it.quantity) || 0;
          if (!variantId || qty <= 0) continue;

          const invLock = await client.query(
            `SELECT * FROM inventory WHERE variant_id = $1 FOR UPDATE`,
            [variantId]
          );

          if (invLock.rows.length > 0) {
            const inv = invLock.rows[0];
            const newAvailable = inv.quantity_available + qty;

            const updateRes = await client.query(
              `UPDATE inventory 
               SET quantity_available = $1,
                   version = version + 1,
                   updated_at = NOW()
               WHERE id = $2
               RETURNING *`,
              [newAvailable, inv.id]
            );

            if (updateRes.rows.length > 0) {
              updatedInventoryItems.push(updateRes.rows[0]);
            }

            await client.query(
              `INSERT INTO inventory_movements
                (inventory_id, variant_id, movement_type, quantity, reference_type, reference_id, actor_id, actor_role, previous_available, new_available, previous_reserved, new_reserved, reason)
               VALUES ($1, $2, 'RELEASE', $3, 'ORDER', $4, 'system', 'system', $5, $6, $7, $7, $8)`,
              [
                inv.id,
                inv.variant_id,
                qty,
                orderId,
                inv.quantity_available,
                newAvailable,
                inv.quantity_reserved,
                reason || 'Order cancelled, fallback restock applied',
              ]
            );
          }
        }
      } else {
        logger.warn({ orderId }, 'No active reservations found to release and no items provided');
        return { order_id: orderId, status: 'NOOP' };
      }

      logger.info({ orderId, reason, count: updatedInventoryItems.length }, 'Stock successfully released back to available inventory');
      await inventoryPublisher.publishReservationReleased(orderId, reason);

      for (const item of updatedInventoryItems) {
        inventoryPublisher.publishStockUpdated(item).catch(() => {});
      }

      return { order_id: orderId, status: 'RELEASED' };
    });
  },

  /**
   * List stock movements (audit trail)
   */
  async listMovements(variantId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM inventory_movements WHERE variant_id = $1`,
      [variantId]
    );
    const total = countRes.rows[0]?.total || 0;

    const dataRes = await query(
      `SELECT * FROM inventory_movements 
       WHERE variant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [variantId, limit, offset]
    );

    return {
      movements: dataRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Delete inventory items for a product
   */
  async deleteByProductId(productId, user) {
    return withTransaction(async (client) => {
      let sql = 'DELETE FROM inventory WHERE product_id = $1';
      const params = [productId];

      if (user && user.roles && !user.roles.includes('admin') && user.id) {
        sql += ' AND seller_id = $2';
        params.push(user.id);
      }

      const res = await client.query(sql, params);
      return { success: true, count: res.rowCount };
    });
  },
};

export default inventoryService;
