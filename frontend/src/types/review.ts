export interface ReviewImage {
  id: number | string;
  image_url: string;
  alt_text?: string | null;
  sort_order: number;
}

export interface ProductReview {
  id: number | string;
  product_id: number | string;
  variant_id?: number | string | null;
  user_id: string;
  author_name?: string;
  customer_name?: string;
  order_id?: number | string | null;
  rating: number; // 1 to 5
  title?: string | null;
  comment: string;
  verified_purchase: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  updated_at: string;
  images?: ReviewImage[];
  user_vote?: 'HELPFUL' | 'NOT_HELPFUL' | null;
}

export interface ProductRatingSummary {
  product_id: number | string;
  total_reviews: number;
  average_rating: number | string;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
  updated_at: string;
}

export interface CreateReviewInput {
  product_id: number | string;
  variant_id?: number | string | null;
  rating: number;
  title?: string;
  comment: string;
  images?: string[];
  order_id?: number | string | null;
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  comment?: string;
  images?: string[];
}

export interface ListReviewsParams {
  page?: number;
  limit?: number;
  rating?: number;
  sort?: 'newest' | 'oldest' | 'highest_rating' | 'lowest_rating' | 'most_helpful';
  verified_only?: boolean;
  with_images?: boolean;
}

export interface ProductAnswer {
  id: number | string;
  question_id: number | string;
  user_id: string;
  author_name: string;
  answer: string;
  answer_type: 'CUSTOMER' | 'SELLER' | 'ADMIN';
  is_verified_seller: boolean;
  status: 'PUBLISHED' | 'HIDDEN' | 'REJECTED';
  created_at: string;
}

export interface ProductQuestion {
  id: number | string;
  product_id: number | string;
  user_id: string;
  author_name: string;
  question: string;
  status: 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN';
  created_at: string;
  answers: ProductAnswer[];
}

export interface CreateQuestionInput {
  product_id: number | string;
  question: string;
}

export interface CreateAnswerInput {
  answer: string;
}

export interface ReviewVoteResult {
  review_id: number | string;
  user_vote: 'HELPFUL' | 'NOT_HELPFUL' | null;
  helpful_count: number;
  not_helpful_count: number;
}
