import imageService from '../services/image.service.js';

export const listImages = async (req, res, next) => {
  try {
    const variantId = req.query.variant_id ? Number(req.query.variant_id) : null;
    const images = await imageService.listImages(req.params.productId, variantId);
    return res.status(200).json({
      success: true,
      data: { images },
    });
  } catch (error) {
    next(error);
  }
};

export const createImage = async (req, res, next) => {
  try {
    const image = await imageService.createImage(req.params.productId, req.body);
    return res.status(201).json({
      success: true,
      message: 'Product image added successfully',
      data: { image },
    });
  } catch (error) {
    next(error);
  }
};

export const updateImage = async (req, res, next) => {
  try {
    const image = await imageService.updateImage(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Product image updated successfully',
      data: { image },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteImage = async (req, res, next) => {
  try {
    const result = await imageService.deleteImage(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
