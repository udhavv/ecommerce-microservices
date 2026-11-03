import productService from '../services/product.service.js';
import { uploadImageBuffer } from '../config/cloudinary.js';
import { AppError } from '../middleware/errorHandler.js';

export const uploadProductImage = async (req, res, next) => {
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

export const listProducts = async (req, res, next) => {
  try {
    const result = await productService.listProducts(req.query);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getProduct = async (req, res, next) => {
  try {
    const product = await productService.getProductByIdOrSlug(req.params.idOrSlug);
    return res.status(200).json({
      success: true,
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.user.id, req.body);
    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.user, req.body);
    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const result = await productService.deleteProduct(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
