import inventoryService from '../services/inventory.service.js';
import idempotencyService from '../services/idempotency.service.js';

export const listInventory = async (req, res, next) => {
  try {
    const result = await inventoryService.listInventory(req.query, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getByVariantId = async (req, res, next) => {
  try {
    const item = await inventoryService.getByVariantId(req.params.variantId);
    return res.status(200).json({
      success: true,
      data: { item },
    });
  } catch (error) {
    next(error);
  }
};

export const getByProductId = async (req, res, next) => {
  try {
    const items = await inventoryService.getByProductId(req.params.productId);
    return res.status(200).json({
      success: true,
      data: { items },
    });
  } catch (error) {
    next(error);
  }
};

export const createInventoryItem = async (req, res, next) => {
  try {
    const item = await inventoryService.createInventoryItem(req.body, req.user.id);
    return res.status(201).json({
      success: true,
      message: 'Inventory record created successfully',
      data: { item },
    });
  } catch (error) {
    next(error);
  }
};

export const adjustStock = async (req, res, next) => {
  try {
    const item = await inventoryService.adjustStock(req.params.id, req.user, req.body);
    return res.status(200).json({
      success: true,
      message: 'Stock adjusted successfully',
      data: { item },
    });
  } catch (error) {
    next(error);
  }
};

export const reserveStock = async (req, res, next) => {
  try {
    const { order_id, items, expires_in_minutes, idempotency_key } = req.body;

    // Idempotency check
    if (idempotency_key) {
      const existing = await idempotencyService.getRecord(idempotency_key);
      if (existing) {
        return res.status(existing.response_status || 200).json(existing.response_body);
      }
    }

    const reservation = await inventoryService.reserveStock(
      order_id,
      items,
      expires_in_minutes,
      idempotency_key
    );

    const responsePayload = {
      success: true,
      message: 'Stock reserved successfully',
      data: { reservation },
    };

    if (idempotency_key) {
      const hash = idempotencyService.hashPayload(req.body);
      await idempotencyService.saveRecord(idempotency_key, hash, 200, responsePayload);
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

export const confirmReservation = async (req, res, next) => {
  try {
    const { order_id, order_number } = req.body;
    const result = await inventoryService.confirmReservation(order_id, order_number);
    return res.status(200).json({
      success: true,
      message: 'Reservation confirmed to permanent sale',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const releaseReservation = async (req, res, next) => {
  try {
    const { order_id, order_number, reason, items } = req.body;
    const result = await inventoryService.releaseReservation(order_id, reason, items, order_number);
    return res.status(200).json({
      success: true,
      message: 'Reservation released back to available inventory',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listMovements = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await inventoryService.listMovements(req.params.variantId, page, limit);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteByProductId = async (req, res, next) => {
  try {
    const result = await inventoryService.deleteByProductId(req.params.productId, req.user);
    return res.status(200).json({
      success: true,
      message: 'Inventory records for product deleted successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  listInventory,
  getByVariantId,
  getByProductId,
  createInventoryItem,
  adjustStock,
  reserveStock,
  confirmReservation,
  releaseReservation,
  listMovements,
  deleteByProductId,
};
