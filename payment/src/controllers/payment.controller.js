import paymentService from '../services/payment.service.js';

export const processPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.processPayment(req.user, req.body);
    return res.status(200).json({
      success: true,
      message: 'Payment processed and captured successfully',
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

export const refundPayment = async (req, res, next) => {
  try {
    const result = await paymentService.refundPayment(req.params.id, req.user, req.body);
    return res.status(200).json({
      success: true,
      message: 'Payment refunded successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentById = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentByOrderId = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentByOrderId(req.params.orderId, req.user);
    return res.status(200).json({
      success: true,
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

export const listPayments = async (req, res, next) => {
  try {
    const result = await paymentService.listPayments(req.query, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  processPayment,
  refundPayment,
  getPaymentById,
  getPaymentByOrderId,
  listPayments,
};
