import imageService from '../services/image.service.js';
import { uploadImageBuffer } from '../config/cloudinary.js';
import { AppError } from '../middleware/errorHandler.js';

export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      throw new AppError('Please select an image file to upload.', 400);
    }
    const result = await uploadImageBuffer(req.file.buffer, 'ecommerce/products');
    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully to Cloudinary',
      data: {
        image_url: result.secure_url,
        public_id: result.public_id,
      },
    });
  } catch (error) {
    next(error);
  }
};

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
