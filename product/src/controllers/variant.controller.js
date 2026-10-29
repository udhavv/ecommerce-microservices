import variantService from '../services/variant.service.js';

export const listVariants = async (req, res, next) => {
  try {
    const variants = await variantService.listVariants(req.params.productId);
    return res.status(200).json({
      success: true,
      data: { variants },
    });
  } catch (error) {
    next(error);
  }
};

export const getVariant = async (req, res, next) => {
  try {
    const variant = await variantService.getVariantById(req.params.id);
    return res.status(200).json({
      success: true,
      data: { variant },
    });
  } catch (error) {
    next(error);
  }
};

export const createVariant = async (req, res, next) => {
  try {
    const variant = await variantService.createVariant(req.params.productId, req.body);
    return res.status(201).json({
      success: true,
      message: 'Variant created successfully',
      data: { variant },
    });
  } catch (error) {
    next(error);
  }
};

export const updateVariant = async (req, res, next) => {
  try {
    const variant = await variantService.updateVariant(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Variant updated successfully',
      data: { variant },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVariant = async (req, res, next) => {
  try {
    const result = await variantService.deleteVariant(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
