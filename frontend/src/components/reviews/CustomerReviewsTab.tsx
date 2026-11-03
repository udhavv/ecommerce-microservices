'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Star,
  Edit3,
  Trash2,
  ExternalLink,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { ProductReview } from '@/types/review';
import reviewService from '@/services/review.service';
import StarRating from './StarRating';
import ReviewFormModal from './ReviewFormModal';

export default function CustomerReviewsTab() {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reviewService.getUserReviews(page, 10);
      setReviews(data.reviews || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load your reviews');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleDelete = async (id: number | string) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    try {
      await reviewService.deleteReview(id);
      setAlert({ type: 'success', text: 'Review deleted successfully' });
      fetchReviews();
      setTimeout(() => setAlert(null), 3500);
    } catch (err: unknown) {
      setAlert({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete review',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert toast */}
      {alert && (
        <div
          className={`rounded-2xl p-4 border text-xs font-bold flex items-center gap-2.5 ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {alert.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span>{alert.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">My Reviews & Ratings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage feedback you have shared with other shoppers across the marketplace
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading your reviews...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-xs text-rose-800">
          {error}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Star className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No reviews submitted yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            When you purchase items and share your experience, your reviews will appear here.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
          >
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs hover:border-slate-300 transition space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StarRating rating={rev.rating} size="sm" />
                    {rev.verified_purchase && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  {rev.title && (
                    <h4 className="font-bold text-sm text-slate-900 leading-snug">
                      {rev.title}
                    </h4>
                  )}
                  <span className="text-[11px] text-slate-400 block">
                    Reviewed on {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/products/${rev.product_id}#customer-feedback`}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <span>View Product</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <button
                    onClick={() => setEditingReview(rev)}
                    className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition"
                    title="Edit review"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rev.id)}
                    className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Delete review"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {rev.comment}
              </p>

              {rev.images && rev.images.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {rev.images.map((img) => (
                    <div
                      key={img.id}
                      className="h-14 w-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.image_url}
                        alt="Attached photo"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-400 flex items-center justify-between">
                <span>
                  Found helpful by {rev.helpful_count || 0}{' '}
                  {rev.helpful_count === 1 ? 'customer' : 'customers'}
                </span>
                <span className="capitalize font-medium text-slate-500">
                  Status: {rev.status.toLowerCase()}
                </span>
              </div>
            </div>
          ))}

          {/* Pagination */}
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

      {/* Edit Modal */}
      {editingReview && (
        <ReviewFormModal
          isOpen={Boolean(editingReview)}
          productId={editingReview.product_id}
          productName="Product Review"
          reviewToEdit={editingReview}
          onClose={() => setEditingReview(null)}
          onSuccess={() => {
            setAlert({ type: 'success', text: 'Review updated successfully' });
            fetchReviews();
            setTimeout(() => setAlert(null), 3500);
          }}
        />
      )}
    </div>
  );
}
