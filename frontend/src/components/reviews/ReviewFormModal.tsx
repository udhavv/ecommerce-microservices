'use client';

import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { ProductReview, CreateReviewInput, UpdateReviewInput } from '@/types/review';
import reviewService from '@/services/review.service';
import StarRating from './StarRating';

interface ReviewFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (review: ProductReview) => void;
  productId: number | string;
  productName: string;
  reviewToEdit?: ProductReview | null;
}

const RATING_LABELS: Record<number, string> = {
  1: '1 Star - Poor quality / Very disappointed',
  2: '2 Stars - Below expectations / Needs work',
  3: '3 Stars - Average / Decent product',
  4: '4 Stars - Good / Really satisfied',
  5: '5 Stars - Outstanding / Highly recommended!',
};

export default function ReviewFormModal({
  isOpen,
  onClose,
  onSuccess,
  productId,
  productName,
  reviewToEdit,
}: ReviewFormModalProps) {
  const isEditing = Boolean(reviewToEdit);

  const [rating, setRating] = useState<number>(reviewToEdit?.rating || 5);
  const [title, setTitle] = useState(reviewToEdit?.title || '');
  const [comment, setComment] = useState(reviewToEdit?.comment || '');
  const [images, setImages] = useState<string[]>(
    reviewToEdit?.images?.map((i) => i.image_url) || []
  );
  const [imageInput, setImageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reviewToEdit) {
      setRating(reviewToEdit.rating);
      setTitle(reviewToEdit.title || '');
      setComment(reviewToEdit.comment || '');
      setImages(reviewToEdit.images?.map((i) => i.image_url) || []);
    } else {
      setRating(5);
      setTitle('');
      setComment('');
      setImages([]);
    }
    setError(null);
  }, [reviewToEdit, isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddImage = () => {
    const trimmed = imageInput.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed); // Quick URL syntax check
      if (images.length >= 5) {
        setError('Maximum of 5 images allowed per review.');
        return;
      }
      setImages((prev) => [...prev, trimmed]);
      setImageInput('');
      setError(null);
    } catch {
      setError('Please enter a valid image web address (URL starting with http:// or https://)');
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rating < 1 || rating > 5) {
      setError('Please select a star rating from 1 to 5.');
      return;
    }

    if (comment.trim().length < 5) {
      setError('Review comment must be at least 5 characters long.');
      return;
    }

    try {
      setLoading(true);

      let savedReview: ProductReview;
      if (isEditing && reviewToEdit) {
        const updatePayload: UpdateReviewInput = {
          rating,
          title: title.trim() || undefined,
          comment: comment.trim(),
          images,
        };
        savedReview = await reviewService.updateReview(reviewToEdit.id, updatePayload);
      } else {
        const createPayload: CreateReviewInput = {
          product_id: productId,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim(),
          images,
        };
        savedReview = await reviewService.createReview(createPayload);
      }

      onSuccess(savedReview);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isEditing ? 'Edit Your Review' : 'Write a Product Review'}
            </h3>
            <p className="text-xs text-slate-500 truncate max-w-sm" title={productName}>
              {productName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Star Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Overall Rating <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
              <StarRating
                rating={rating}
                interactive={true}
                size="xl"
                onChange={(newRating) => setRating(newRating)}
              />
              <span className="text-xs font-semibold text-slate-700">
                {RATING_LABELS[rating] || `${rating} Stars`}
              </span>
            </div>
          </div>

          {/* Review Headline / Title */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Review Title <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Best purchase this year, very comfortable!"
              maxLength={255}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-2xs"
            />
          </div>

          {/* Review Detailed Comment */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Your Review <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you like or dislike about this product? How did it fit or perform?"
              maxLength={5000}
              className="w-full rounded-xl border border-slate-200 p-3.5 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-2xs leading-relaxed"
            />
            <div className="flex justify-between text-[11px] text-slate-400 px-1">
              <span>Minimum 5 characters</span>
              <span>{comment.length} / 5000</span>
            </div>
          </div>

          {/* Photo Attachments */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Add Photos <span className="text-slate-400 font-normal">(Optional, up to 5)</span>
            </label>

            {/* Input row */}
            {images.length < 5 && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  placeholder="Paste an image URL (e.g. from Cloudinary or Imgur)..."
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddImage}
                  className="rounded-xl border border-indigo-600 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                >
                  Add Photo
                </button>
              </div>
            )}

            {/* Thumbnail Gallery */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {images.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative group h-16 w-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt={`Review photo ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition"
                      title="Remove image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving Review...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  {isEditing ? 'Update Review' : 'Submit Review'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
