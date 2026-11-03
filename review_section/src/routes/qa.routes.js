import { Router } from 'express';
import * as qaController from '../controllers/qa.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import {
  createQuestionSchema,
  createAnswerSchema,
  listProductQuestionsQuerySchema,
} from '../validators/qa.validators.js';

const router = Router();

router.use(authenticate);

// Public Q&A Browsing
router.get(
  '/product/:productId',
  validate(listProductQuestionsQuerySchema, 'query'),
  qaController.listProductQuestions
);

// Protected Customer Question & Answer Submission
router.post(
  '/',
  requireAuth,
  validate(createQuestionSchema),
  qaController.createQuestion
);

router.post(
  '/:id/answers',
  requireAuth,
  validate(createAnswerSchema),
  qaController.answerQuestion
);

router.delete(
  '/:id',
  requireAuth,
  qaController.deleteQuestion
);

router.delete(
  '/answers/:id',
  requireAuth,
  qaController.deleteAnswer
);

export default router;
