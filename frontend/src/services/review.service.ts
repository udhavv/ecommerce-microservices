import axios from 'axios';
import {
  ProductReview,
  ProductRatingSummary,
  CreateReviewInput,
  UpdateReviewInput,
  ListReviewsParams,
  ProductQuestion,
  ProductAnswer,
  CreateQuestionInput,
  CreateAnswerInput,
  ReviewVoteResult,
} from '@/types/review';
import { getErrorMessage } from '@/lib/axios';

const REVIEW_BASE_URL =
  process.env.NEXT_PUBLIC_REVIEW_API_URL || 'http://localhost:4005/api';

export const reviewApiClient = axios.create({
  baseURL: REVIEW_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

export const reviewService = {
  /**
   * Get paginated reviews for a product
   */
  async getProductReviews(
    productId: number | string,
    params: ListReviewsParams = {}
  ): Promise<{ reviews: ProductReview[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      const response = await reviewApiClient.get(`/reviews/product/${productId}`, { params });
      return response.data?.data || { reviews: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Get product rating summary (average score, star distribution)
   */
  async getProductRatingSummary(productId: number | string): Promise<ProductRatingSummary> {
    try {
      const response = await reviewApiClient.get(`/reviews/product/${productId}/summary`);
      return (
        response.data?.data?.summary || {
          product_id: productId,
          total_reviews: 0,
          average_rating: 0,
          rating_1_count: 0,
          rating_2_count: 0,
          rating_3_count: 0,
          rating_4_count: 0,
          rating_5_count: 0,
          updated_at: new Date().toISOString(),
        }
      );
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Submit a new review
   */
  async createReview(data: CreateReviewInput): Promise<ProductReview> {
    try {
      const response = await reviewApiClient.post('/reviews', data);
      if (!response.data?.data?.review) {
        throw new Error(response.data?.message || 'Failed to submit review');
      }
      return response.data.data.review;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Update an existing review
   */
  async updateReview(id: number | string, data: UpdateReviewInput): Promise<ProductReview> {
    try {
      const response = await reviewApiClient.put(`/reviews/${id}`, data);
      if (!response.data?.data?.review) {
        throw new Error(response.data?.message || 'Failed to update review');
      }
      return response.data.data.review;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Delete review
   */
  async deleteReview(id: number | string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await reviewApiClient.delete(`/reviews/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Vote a review helpful or not helpful
   */
  async voteReview(
    id: number | string,
    voteType: 'HELPFUL' | 'NOT_HELPFUL'
  ): Promise<ReviewVoteResult> {
    try {
      const response = await reviewApiClient.post(`/reviews/${id}/vote`, {
        vote_type: voteType,
      });
      return response.data?.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Report an inappropriate review
   */
  async reportReview(
    id: number | string,
    reason: string,
    description?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await reviewApiClient.post(`/reviews/${id}/report`, {
        reason,
        description,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Get reviews written by currently authenticated user
   */
  async getUserReviews(
    page: number = 1,
    limit: number = 10
  ): Promise<{ reviews: ProductReview[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      const response = await reviewApiClient.get('/reviews/my-reviews', {
        params: { page, limit },
      });
      return response.data?.data || { reviews: [], pagination: { page: 1, limit, total: 0, totalPages: 1 } };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * List questions and answers for a product
   */
  async getProductQuestions(
    productId: number | string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ questions: ProductQuestion[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      const response = await reviewApiClient.get(`/questions/product/${productId}`, {
        params: { page, limit },
      });
      return response.data?.data || { questions: [], pagination: { page: 1, limit, total: 0, totalPages: 1 } };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Ask a question about a product
   */
  async createQuestion(data: CreateQuestionInput): Promise<ProductQuestion> {
    try {
      const response = await reviewApiClient.post('/questions', data);
      return response.data?.data?.question;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Submit an answer to a question
   */
  async answerQuestion(
    questionId: number | string,
    data: CreateAnswerInput
  ): Promise<ProductAnswer> {
    try {
      const response = await reviewApiClient.post(`/questions/${questionId}/answers`, data);
      return response.data?.data?.answer;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Delete a question
   */
  async deleteQuestion(id: number | string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await reviewApiClient.delete(`/questions/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  /**
   * Delete an answer
   */
  async deleteAnswer(id: number | string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await reviewApiClient.delete(`/questions/answers/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },
};

export default reviewService;
