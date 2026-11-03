'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Flag,
  CheckCircle2,
  Image as ImageIcon,
  MessageSquare,
  HelpCircle,
  Plus,
  Filter,
  ArrowUpDown,
  Trash2,
  Edit3,
  Loader2,
  Sparkles,
  AlertCircle,
  User as UserIcon,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
  ProductReview,
  ProductRatingSummary,
  ProductQuestion,
} from '@/types/review';
import reviewService from '@/services/review.service';
import StarRating from './StarRating';
import ReviewFormModal from './ReviewFormModal';
import QuestionFormModal from './QuestionFormModal';
import AnswerFormModal from './AnswerFormModal';

interface ProductReviewsSectionProps {
  productId: number | string;
  productName: string;
}

export default function ProductReviewsSection({
  productId,
  productName,
}: ProductReviewsSectionProps) {
  const { user } = useAuth();

  // Active section tab
  const [activeTab, setActiveTab] = useState<'reviews' | 'qa'>('reviews');

  // Rating summary
  const [summary, setSummary] = useState<ProductRatingSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Reviews state
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | undefined>(undefined);
  const [sortOption, setSortOption] = useState<
    'newest' | 'highest_rating' | 'lowest_rating' | 'most_helpful'
  >('newest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withImagesOnly, setWithImagesOnly] = useState(false);

  // Questions state
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [qaPage, setQaPage] = useState(1);
  const [qaTotalPages, setQaTotalPages] = useState(1);

  // Modals state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [answeringQuestion, setAnsweringQuestion] = useState<ProductQuestion | null>(null);

  // Lightbox preview for photos
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Action status notification
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ type, text });
    setTimeout(() => setActionNotice(null), 4000);
  };

  // 1. Fetch Summary
  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const data = await reviewService.getProductRatingSummary(productId);
      setSummary(data);
    } catch {
      // Graceful fallback
    } finally {
      setLoadingSummary(false);
    }
  }, [productId]);

  // 2. Fetch Reviews
  const fetchReviews = useCallback(async () => {
    try {
      setLoadingReviews(true);
      setReviewError(null);
      const data = await reviewService.getProductReviews(productId, {
        page,
        limit: 8,
        rating: selectedStarFilter,
        sort: sortOption,
        verified_only: verifiedOnly || undefined,
        with_images: withImagesOnly || undefined,
      });
      setReviews(data.reviews || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoadingReviews(false);
    }
  }, [productId, page, selectedStarFilter, sortOption, verifiedOnly, withImagesOnly]);

  // 3. Fetch Questions
  const fetchQuestions = useCallback(async () => {
    try {
      setLoadingQuestions(true);
      const data = await reviewService.getProductQuestions(productId, qaPage, 10);
      setQuestions(data.questions || []);
      setQaTotalPages(data.pagination?.totalPages || 1);
    } catch {
      // Graceful fallback
    } finally {
      setLoadingQuestions(false);
    }
  }, [productId, qaPage]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === 'reviews') {
      fetchReviews();
    } else {
      fetchQuestions();
    }
  }, [activeTab, fetchReviews, fetchQuestions]);

  // Handle Review Voting
  const handleVote = async (reviewId: number | string, voteType: 'HELPFUL' | 'NOT_HELPFUL') => {
    if (!user) {
      showNotice('Please sign in to vote on reviews.', 'error');
      return;
    }

    try {
      const result = await reviewService.voteReview(reviewId, voteType);
      // Optimistically update review in list
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                helpful_count: result.helpful_count,
                not_helpful_count: result.not_helpful_count,
                user_vote: result.user_vote,
              }
            : r
        )
      );
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : 'Failed to record vote', 'error');
    }
  };

  // Handle Review Delete
  const handleDeleteReview = async (reviewId: number | string) => {
    if (!window.confirm('Are you sure you want to remove this review?')) return;

    try {
      await reviewService.deleteReview(reviewId);
      showNotice('Review deleted successfully');
      fetchReviews();
      fetchSummary();
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : 'Failed to delete review', 'error');
    }
  };

  // Handle Review Report
  const handleReport = async (reviewId: number | string) => {
    if (!user) {
      showNotice('Please sign in to report a review.', 'error');
      return;
    }

    const reason = window.prompt(
      'Why are you reporting this review? (e.g. SPAM, OFFENSIVE, FAKE_REVIEW, INAPPROPRIATE)',
      'SPAM'
    );
    if (!reason) return;

    try {
      await reviewService.reportReview(reviewId, reason.toUpperCase());
      showNotice('Thank you! The review was reported to moderators for evaluation.');
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : 'Failed to report review', 'error');
    }
  };

  // Calculations for star breakdown
  const totalReviewsCount = summary ? Number(summary.total_reviews) : 0;
  const avgRatingNum = summary ? Number(summary.average_rating) || 0 : 0;

  const starPercentages = [
    { star: 5, count: summary ? Number(summary.rating_5_count) : 0 },
    { star: 4, count: summary ? Number(summary.rating_4_count) : 0 },
    { star: 3, count: summary ? Number(summary.rating_3_count) : 0 },
    { star: 2, count: summary ? Number(summary.rating_2_count) : 0 },
    { star: 1, count: summary ? Number(summary.rating_1_count) : 0 },
  ].map((item) => ({
    ...item,
    percentage:
      totalReviewsCount > 0 ? Math.round((item.count / totalReviewsCount) * 100) : 0,
  }));

  const recommendedPercentage =
    totalReviewsCount > 0 && summary
      ? Math.round(
          ((Number(summary.rating_4_count) + Number(summary.rating_5_count)) /
            totalReviewsCount) *
            100
        )
      : 0;

  return (
    <div id="customer-feedback" className="mt-16 pt-12 border-t border-slate-200">
      {/* Toast Notice */}
      {actionNotice && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-2xl px-5 py-3.5 text-xs font-bold shadow-xl border animate-in slide-in-from-bottom-4 duration-300 flex items-center gap-2.5 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
              : 'bg-rose-900 text-rose-100 border-rose-700'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400" />
          )}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* Section Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Customer Feedback & Q&A
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real experiences and answers from verified buyers of {productName}
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center rounded-2xl bg-slate-100 p-1 self-start sm:self-auto border border-slate-200">
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'reviews'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Star className="h-3.5 w-3.5" />
            <span>Reviews ({totalReviewsCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('qa')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'qa'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Q&A ({questions.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: REVIEWS */}
      {activeTab === 'reviews' && (
        <div className="pt-8 space-y-10">
          {/* Summary & Rating Overview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/80 rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
            {/* Left Score Box (4 cols) */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-4 border-b lg:border-b-0 lg:border-r border-slate-200 pb-6 lg:pb-0 lg:pr-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Overall Customer Rating
                </span>
                <div className="flex items-baseline gap-3 mt-2">
                  <span className="text-5xl font-black text-slate-900 tracking-tight">
                    {avgRatingNum > 0 ? avgRatingNum.toFixed(1) : '0.0'}
                  </span>
                  <div className="space-y-1">
                    <StarRating rating={avgRatingNum} size="lg" />
                    <div className="text-xs font-semibold text-slate-500">
                      Based on {totalReviewsCount} {totalReviewsCount === 1 ? 'review' : 'reviews'}
                    </div>
                  </div>
                </div>
              </div>

              {totalReviewsCount > 0 && (
                <div className="rounded-2xl bg-white p-3.5 border border-slate-200/60 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span>{recommendedPercentage}% would recommend</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Based on 4-star and 5-star ratings from verified purchases.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    showNotice('Please sign in to write a review.', 'error');
                    return;
                  }
                  setEditingReview(null);
                  setIsReviewModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Write a Review</span>
              </button>
            </div>

            {/* Right Breakdown Bars (8 cols) */}
            <div className="lg:col-span-8 flex flex-col justify-center space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Rating Breakdown
              </span>

              {starPercentages.map(({ star, count, percentage }) => (
                <div
                  key={star}
                  onClick={() =>
                    setSelectedStarFilter(selectedStarFilter === star ? undefined : star)
                  }
                  className={`flex items-center gap-3 text-xs group cursor-pointer p-1.5 rounded-xl transition ${
                    selectedStarFilter === star
                      ? 'bg-indigo-100/70'
                      : 'hover:bg-slate-100/80'
                  }`}
                  title={`Filter by ${star} stars`}
                >
                  <span className="w-12 font-bold text-slate-700 flex items-center gap-1 shrink-0">
                    {star} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  </span>

                  {/* Progress bar container */}
                  <div className="flex-1 h-3 rounded-full bg-slate-200 overflow-hidden relative">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-500 group-hover:bg-amber-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <span className="w-14 text-right font-medium text-slate-500 shrink-0">
                    {count} ({percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Filter & Sort Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mr-1">
                <Filter className="h-3.5 w-3.5" /> Filters:
              </span>

              <button
                type="button"
                onClick={() => setSelectedStarFilter(undefined)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  selectedStarFilter === undefined
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({totalReviewsCount})
              </button>

              {[5, 4, 3, 2, 1].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setSelectedStarFilter(selectedStarFilter === s ? undefined : s)
                  }
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1 transition ${
                    selectedStarFilter === s
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{s}</span>
                  <Star className="h-3 w-3 fill-current" />
                </button>
              ))}
            </div>

            {/* Sorting & Flags */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                />
                <span>Verified Only</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={withImagesOnly}
                  onChange={(e) => setWithImagesOnly(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                />
                <span>With Photos</span>
              </label>

              <div className="flex items-center gap-1.5 text-xs">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={sortOption}
                  onChange={(e) =>
                    setSortOption(
                      e.target.value as 'newest' | 'highest_rating' | 'lowest_rating' | 'most_helpful'
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 focus:border-indigo-600 focus:outline-none"
                >
                  <option value="newest">Newest First</option>
                  <option value="highest_rating">Highest Rating</option>
                  <option value="lowest_rating">Lowest Rating</option>
                  <option value="most_helpful">Most Helpful</option>
                </select>
              </div>
            </div>
          </div>

          {/* Reviews List */}
          {loadingReviews ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading customer reviews...</p>
            </div>
          ) : reviewError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 text-xs font-medium">
              {reviewError}
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-8 space-y-3">
              <div className="rounded-full bg-indigo-50 p-4 text-indigo-600">
                <Star className="h-8 w-8 stroke-[1.5]" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No reviews yet for this filter</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Be the first customer to share your thoughts and help others make the right choice!
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    showNotice('Please sign in to write a review.', 'error');
                    return;
                  }
                  setEditingReview(null);
                  setIsReviewModalOpen(true);
                }}
                className="mt-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                Write the First Review
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {reviews.map((rev) => {
                const isAuthor = user && String(user.id) === String(rev.user_id);
                const isAdmin = user?.roles?.includes('admin');

                return (
                  <div
                    key={rev.id}
                    className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs hover:border-slate-300 transition space-y-4"
                  >
                    {/* Reviewer Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm shrink-0">
                          {rev.author_name?.[0]?.toUpperCase() || <UserIcon className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {rev.author_name || 'Customer'}
                            </span>
                            {rev.verified_purchase && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Verified Purchase
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(rev.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Author Edit / Delete Controls */}
                      {(isAuthor || isAdmin) && (
                        <div className="flex items-center gap-1">
                          {isAuthor && (
                            <button
                              onClick={() => {
                                setEditingReview(rev);
                                setIsReviewModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              title="Edit review"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteReview(rev.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete review"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Rating & Title */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <StarRating rating={rev.rating} size="sm" />
                        {rev.title && (
                          <h4 className="font-bold text-slate-900 text-sm leading-snug">
                            {rev.title}
                          </h4>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line pt-1">
                        {rev.comment}
                      </p>
                    </div>

                    {/* Photo Attachments */}
                    {rev.images && rev.images.length > 0 && (
                      <div className="flex flex-wrap gap-2.5 pt-1">
                        {rev.images.map((img) => (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => setPreviewImage(img.image_url)}
                            className="h-16 w-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:opacity-90 hover:ring-2 hover:ring-indigo-600 transition shrink-0"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.image_url}
                              alt="Review attachment"
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Footer Actions: Helpful Votes & Report */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Helpful?</span>
                        <button
                          type="button"
                          onClick={() => handleVote(rev.id, 'HELPFUL')}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition border ${
                            rev.user_vote === 'HELPFUL'
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          <span>Yes ({rev.helpful_count || 0})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVote(rev.id, 'NOT_HELPFUL')}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition border ${
                            rev.user_vote === 'NOT_HELPFUL'
                              ? 'bg-rose-50 border-rose-300 text-rose-700'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <ThumbsDown className="h-3 w-3" />
                          <span>No ({rev.not_helpful_count || 0})</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleReport(rev.id)}
                        className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[11px] transition"
                        title="Report inappropriate content"
                      >
                        <Flag className="h-3 w-3" />
                        <span>Report</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-semibold text-slate-500 px-2">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: QUESTIONS & ANSWERS */}
      {activeTab === 'qa' && (
        <div className="pt-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Have questions about {productName}?
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Get quick answers from verified sellers and fellow shoppers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  showNotice('Please sign in to ask a question.', 'error');
                  return;
                }
                setIsQuestionModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Ask a Question</span>
            </button>
          </div>

          {loadingQuestions ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <Loader2 className="h-7 w-7 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading questions...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center bg-slate-50/50 space-y-2">
              <p className="text-xs font-semibold text-slate-700">No questions asked yet.</p>
              <p className="text-xs text-slate-500">
                Don&apos;t hesitate to ask anything about sizing, material, or delivery!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                          Q
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 leading-snug">
                          {q.question}
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-400 block ml-8">
                        Asked by {q.author_name} on {new Date(q.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          showNotice('Please sign in to answer this question.', 'error');
                          return;
                        }
                        setAnsweringQuestion(q);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shrink-0"
                    >
                      Answer
                    </button>
                  </div>

                  {/* Answers list */}
                  {q.answers && q.answers.length > 0 ? (
                    <div className="ml-8 space-y-3 pt-2 border-t border-slate-100">
                      {q.answers.map((a) => (
                        <div key={a.id} className="space-y-1 rounded-2xl bg-slate-50 p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {a.author_name}
                            </span>
                            {a.is_verified_seller && (
                              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-purple-800">
                                {a.answer_type === 'ADMIN' ? 'Administrator' : 'Official Seller'}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              {new Date(a.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {a.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic ml-8">
                      No answers yet. Be the first to answer this question!
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {isReviewModalOpen && (
        <ReviewFormModal
          isOpen={isReviewModalOpen}
          productId={productId}
          productName={productName}
          reviewToEdit={editingReview}
          onClose={() => {
            setIsReviewModalOpen(false);
            setEditingReview(null);
          }}
          onSuccess={() => {
            showNotice(
              editingReview ? 'Review updated successfully!' : 'Thank you! Your review has been submitted.'
            );
            fetchReviews();
            fetchSummary();
          }}
        />
      )}

      {/* Question Modal */}
      {isQuestionModalOpen && (
        <QuestionFormModal
          isOpen={isQuestionModalOpen}
          productId={productId}
          productName={productName}
          onClose={() => setIsQuestionModalOpen(false)}
          onSuccess={() => {
            showNotice('Your question has been posted successfully!');
            fetchQuestions();
          }}
        />
      )}

      {/* Answer Modal */}
      {answeringQuestion && (
        <AnswerFormModal
          isOpen={Boolean(answeringQuestion)}
          question={answeringQuestion}
          onClose={() => setAnsweringQuestion(null)}
          onSuccess={() => {
            showNotice('Your answer has been submitted!');
            fetchQuestions();
          }}
        />
      )}

      {/* Lightbox Photo Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] rounded-3xl overflow-hidden bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-slate-900/70 p-2 text-white hover:bg-slate-900 transition"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Review full size"
              className="max-h-[85vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
