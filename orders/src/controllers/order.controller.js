import orderService from '../services/order.service.js';

export const createOrder = async (req, res, next) => {
  try {
    console.log('this is the user in createOrder', req.user, req.body);
    const order = await orderService.createOrder(req.user, req.body);
    return res.status(201).json({
      success: true,
      message: 'Order created and stock reserved successfully',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderByNumber = async (req, res, next) => {
  try {
    const order = await orderService.getOrderByNumber(req.params.orderNumber, req.user);
    return res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

export const listOrders = async (req, res, next) => {
  try {
    const result = await orderService.listOrders(req.query, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const payOrder = async (req, res, next) => {
  try {
    const order = await orderService.payOrder(req.params.id, req.user, req.body);
    return res.status(200).json({
      success: true,
      message: 'Order payment settled and reservation confirmed',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.user, req.body?.reason);
    return res.status(200).json({
      success: true,
      message: 'Order cancelled and stock released back to inventory',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await orderService.updateOrderStatus(req.params.id, req.user, req.body);
    return res.status(200).json({
      success: true,
      message: `Order status updated to ${order.status}`,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createOrder,
  getOrderById,
  getOrderByNumber,
  listOrders,
  payOrder,
  cancelOrder,
  updateOrderStatus,
};
