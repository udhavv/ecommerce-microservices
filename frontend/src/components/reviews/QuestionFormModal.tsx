'use client';

import React, { useState, useEffect } from 'react';
import { X, HelpCircle, Loader2, Send, AlertCircle } from 'lucide-react';
import { ProductQuestion } from '@/types/review';
import reviewService from '@/services/review.service';

interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (question: ProductQuestion) => void;
  productId: number | string;
  productName: string;
}

export default function QuestionFormModal({
  isOpen,
  onClose,
  onSuccess,
  productId,
  productName,
}: QuestionFormModalProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuestion('');
      setError(null);
    }
  }, [isOpen]);

  // Handle ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim().length < 5) {
      setError('Please provide a detailed question of at least 5 characters.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await reviewService.createQuestion({
        product_id: productId,
        question: question.trim(),
      });
      onSuccess(res);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Ask a Question</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              Product: <span className="text-slate-500 font-normal">{productName}</span>
            </label>
            <textarea
              required
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Does this size fit true to measurement? What is the warranty policy?"
              className="w-full rounded-xl border border-slate-200 p-3.5 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-2xs leading-relaxed"
              maxLength={1000}
            />
            <div className="text-right text-[11px] text-slate-400">
              {question.length} / 1000
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Post Question
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
