import categoryService from '../services/category.service.js';

export const listCategories = async (req, res, next) => {
  try {
    const is_active = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;
    const tree = req.query.tree === 'true';

    const categories = await categoryService.listCategories({ is_active, tree });
    return res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

export const getCategory = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryByIdOrSlug(req.params.idOrSlug);
    return res.status(200).json({
      success: true,
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.body);
    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const result = await categoryService.deleteCategory(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
