'use client';

import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Loader2, Send, AlertCircle, ShieldCheck } from 'lucide-react';
import { ProductAnswer, ProductQuestion } from '@/types/review';
import reviewService from '@/services/review.service';
import { useAuth } from '@/hooks/use-auth';

interface AnswerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (answer: ProductAnswer) => void;
  question: ProductQuestion | null;
}

export default function AnswerFormModal({
  isOpen,
  onClose,
  onSuccess,
  question,
}: AnswerFormModalProps) {
  const { user } = useAuth();
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAnswer('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !question) return null;

  const isSeller = user?.roles?.includes('seller');
  const isAdmin = user?.roles?.includes('admin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim().length < 2) {
      setError('Please provide an answer of at least 2 characters.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await reviewService.answerQuestion(question.id, {
        answer: answer.trim(),
      });
      onSuccess(res);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post answer');
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
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Answer Question</h3>
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

          {/* Question preview box */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Question</span>
            <p className="text-xs font-semibold text-slate-800 leading-relaxed">
              &quot;{question.question}&quot;
            </p>
          </div>

          {(isSeller || isAdmin) && (
            <div className="flex items-center gap-1.5 rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 border border-purple-200">
              <ShieldCheck className="h-4 w-4" />
              <span>Posting as Verified {isAdmin ? 'Administrator' : 'Seller'}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              Your Answer <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Provide clear, accurate details to help the customer..."
              className="w-full rounded-xl border border-slate-200 p-3.5 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-2xs leading-relaxed"
              maxLength={2000}
            />
            <div className="text-right text-[11px] text-slate-400">
              {answer.length} / 2000
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
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Submit Answer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
