import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../config/db.js', () => ({
  query: mockQuery,
  withTransaction: jest.fn(async (cb) => cb({ query: mockQuery })),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const { qaService } = await import('../../services/qa.service.js');
const { AppError } = await import('../../middleware/errorHandler.js');

const makeQuestionRow = (overrides = {}) => ({
  id: 1,
  product_id: 10,
  user_id: 'user-111',
  author_name: 'Alice',
  question: 'Is this compatible with USB-C?',
  status: 'PUBLISHED',
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  ...overrides,
});

const makeAnswerRow = (overrides = {}) => ({
  id: 1,
  question_id: 1,
  user_id: 'user-222',
  author_name: 'Bob',
  answer: 'Yes, it comes with a USB-C charging cable.',
  answer_type: 'CUSTOMER',
  is_verified_seller: false,
  status: 'PUBLISHED',
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  ...overrides,
});

describe('QA Service Unit Tests', () => {
  const user = { id: 'user-111', displayName: 'Alice', roles: ['user'] };
  const adminUser = { id: 'admin-999', displayName: 'Admin User', roles: ['admin'] };
  const sellerUser = { id: 'seller-777', displayName: 'TechStore', roles: ['seller'] };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createQuestion', () => {
    it('creates and returns a new product question', async () => {
      const q = makeQuestionRow({ id: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [q] });

      const result = await qaService.createQuestion(
        { product_id: 10, question: 'Is this compatible with USB-C?' },
        user
      );

      expect(result.id).toBe(1);
      expect(result.question).toBe('Is this compatible with USB-C?');
    });
  });

  describe('listProductQuestions', () => {
    it('returns paginated questions with nested answers', async () => {
      const q = makeQuestionRow({ id: 1 });
      // 1. Count query
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
      // 2. Data query
      mockQuery.mockResolvedValueOnce({ rows: [q] });

      const result = await qaService.listProductQuestions(10, 1, 10);
      expect(result.pagination.total).toBe(1);
      expect(result.questions).toHaveLength(1);
    });
  });

  describe('answerQuestion', () => {
    it('answers question as regular customer', async () => {
      const q = makeQuestionRow({ id: 1 });
      const a = makeAnswerRow({ id: 5, answer_type: 'CUSTOMER' });

      // 1. Question lookup
      mockQuery.mockResolvedValueOnce({ rows: [q] });
      // 2. Insert answer
      mockQuery.mockResolvedValueOnce({ rows: [a] });

      const result = await qaService.answerQuestion(1, { answer: 'Yes, it is!' }, user);
      expect(result.id).toBe(5);
      expect(result.answer_type).toBe('CUSTOMER');
    });

    it('identifies seller answers and sets is_verified_seller', async () => {
      const q = makeQuestionRow({ id: 1, product_id: 10 });
      const a = makeAnswerRow({ id: 6, answer_type: 'SELLER', is_verified_seller: true });

      // 1. Question lookup
      mockQuery.mockResolvedValueOnce({ rows: [q] });
      // 2. Product ownership check (product belongs to sellerUser)
      mockQuery.mockResolvedValueOnce({ rows: [{ seller_id: sellerUser.id }] });
      // 3. Insert answer
      mockQuery.mockResolvedValueOnce({ rows: [a] });

      const result = await qaService.answerQuestion(1, { answer: 'Official answer: yes.' }, sellerUser);
      expect(result.answer_type).toBe('SELLER');
      expect(result.is_verified_seller).toBe(true);
    });

    it('identifies admin answers and sets answer_type ADMIN', async () => {
      const q = makeQuestionRow({ id: 1 });
      const a = makeAnswerRow({ id: 7, answer_type: 'ADMIN', is_verified_seller: true });

      // 1. Question lookup
      mockQuery.mockResolvedValueOnce({ rows: [q] });
      // 2. Insert answer
      mockQuery.mockResolvedValueOnce({ rows: [a] });

      const result = await qaService.answerQuestion(1, { answer: 'Admin verified response.' }, adminUser);
      expect(result.answer_type).toBe('ADMIN');
      expect(result.is_verified_seller).toBe(true);
    });

    it('throws 404 AppError if question does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        qaService.answerQuestion(999, { answer: 'Test' }, user)
      ).rejects.toThrow(AppError);
    });
  });

  describe('deleteQuestion', () => {
    it('soft deletes question when requested by author', async () => {
      const q = makeQuestionRow({ id: 1, user_id: user.id });
      // 1. Question exists
      mockQuery.mockResolvedValueOnce({ rows: [q] });
      // 2. Update deleted_at
      mockQuery.mockResolvedValueOnce({});

      const result = await qaService.deleteQuestion(1, user);
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');
    });

    it('throws 403 Forbidden if non-author attempts to delete question', async () => {
      const q = makeQuestionRow({ id: 1, user_id: user.id });
      mockQuery.mockResolvedValueOnce({ rows: [q] });

      await expect(qaService.deleteQuestion(1, sellerUser)).rejects.toThrow('Forbidden');
    });

    it('throws 404 if question not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(qaService.deleteQuestion(999, user)).rejects.toThrow(AppError);
    });
  });

  describe('deleteAnswer', () => {
    it('soft deletes answer when requested by author', async () => {
      const a = makeAnswerRow({ id: 1, user_id: user.id });
      mockQuery.mockResolvedValueOnce({ rows: [a] });
      mockQuery.mockResolvedValueOnce({});

      const result = await qaService.deleteAnswer(1, user);
      expect(result.success).toBe(true);
    });

    it('throws 403 Forbidden if non-author attempts to delete answer', async () => {
      const a = makeAnswerRow({ id: 1, user_id: user.id });
      mockQuery.mockResolvedValueOnce({ rows: [a] });

      await expect(qaService.deleteAnswer(1, sellerUser)).rejects.toThrow('Forbidden');
    });
  });
});
