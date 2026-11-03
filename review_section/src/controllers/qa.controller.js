import qaService from '../services/qa.service.js';

export const createQuestion = async (req, res, next) => {
  try {
    const question = await qaService.createQuestion(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: 'Question posted successfully',
      data: { question },
    });
  } catch (error) {
    next(error);
  }
};

export const listProductQuestions = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const result = await qaService.listProductQuestions(req.params.productId, page, limit);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const answerQuestion = async (req, res, next) => {
  try {
    const answer = await qaService.answerQuestion(req.params.id, req.body, req.user);
    return res.status(201).json({
      success: true,
      message: 'Answer submitted successfully',
      data: { answer },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestion = async (req, res, next) => {
  try {
    const result = await qaService.deleteQuestion(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteAnswer = async (req, res, next) => {
  try {
    const result = await qaService.deleteAnswer(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export default {
  createQuestion,
  listProductQuestions,
  answerQuestion,
  deleteQuestion,
  deleteAnswer,
};
