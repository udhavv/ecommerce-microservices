'use client';

import React, { useState } from 'react';
import { InventoryItem, StockAdjustmentInput } from '@/types/inventory';
import inventoryService from '@/services/inventory.service';
import {
  X,
  Boxes,
  PlusCircle,
  MinusCircle,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: InventoryItem) => void;
  item: InventoryItem;
  productName?: string;
}

export default function StockAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  item,
  productName,
}: StockAdjustmentModalProps) {
  const [mode, setMode] = useState<'ADD' | 'SUBTRACT' | 'SET'>('ADD');
  const [amount, setAmount] = useState<string>('10');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const parsedAmount = parseInt(amount, 10);
  const validAmount = isNaN(parsedAmount) || parsedAmount < 0 ? 0 : parsedAmount;

  let projectedStock = item.quantity_available;
  if (mode === 'ADD') {
    projectedStock = item.quantity_available + validAmount;
  } else if (mode === 'SUBTRACT') {
    projectedStock = Math.max(0, item.quantity_available - validAmount);
  } else if (mode === 'SET') {
    projectedStock = validAmount;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError('Please provide a valid non-negative number.');
      return;
    }

    if (mode === 'SUBTRACT' && validAmount > item.quantity_available) {
      setError(`Cannot subtract ${validAmount} units. Maximum available to remove is ${item.quantity_available}.`);
      return;
    }

    try {
      setLoading(true);

      let payload: StockAdjustmentInput;

      if (mode === 'ADD') {
        payload = {
          quantity_change: validAmount,
          movement_type: 'STOCK_IN',
          reason: reason.trim() || 'Restocked inventory',
        };
      } else if (mode === 'SUBTRACT') {
        payload = {
          quantity_change: -validAmount,
          movement_type: 'STOCK_OUT',
          reason: reason.trim() || 'Inventory write-off / removal',
        };
      } else {
        payload = {
          new_quantity: validAmount,
          movement_type: 'ADJUSTMENT',
          reason: reason.trim() || 'Manual stock count synchronization',
        };
      }

      const updated = await inventoryService.adjustStock(item.id, payload);
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to adjust stock. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Adjust Stock Level</h3>
              <p className="text-xs text-slate-500 truncate max-w-xs">
                {productName || `Variant SKU: ${item.sku || item.variant_id}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Stock Metrics Banner */}
        <div className="grid grid-cols-3 gap-3 my-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Available</span>
            <span className="text-lg font-black text-slate-900">{item.quantity_available}</span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Reserved</span>
            <span className="text-lg font-black text-indigo-600">{item.quantity_reserved}</span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Threshold</span>
            <span className="text-lg font-black text-amber-600">{item.low_stock_threshold}</span>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode Switcher */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Adjustment Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode('ADD')}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold border transition ${
                  mode === 'ADD'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <PlusCircle className="h-3.5 w-3.5 text-emerald-600" />
                <span>Restock (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('SUBTRACT')}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold border transition ${
                  mode === 'SUBTRACT'
                    ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <MinusCircle className="h-3.5 w-3.5 text-rose-600" />
                <span>Remove (-)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('SET')}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold border transition ${
                  mode === 'SET'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
                <span>Set Exact (=)</span>
              </button>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {mode === 'ADD' ? 'Units to Add' : mode === 'SUBTRACT' ? 'Units to Remove' : 'Target Stock Count'}
            </label>
            <input
              type="number"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* Projected Stock Preview */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs">
            <span className="font-semibold text-slate-600">Projected Available Stock:</span>
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <span className="line-through text-slate-400">{item.quantity_available}</span>
              <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
              <span className="text-base text-indigo-700">{projectedStock} units</span>
            </div>
          </div>

          {/* Reason / Reference Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Reason / Reference Note (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Received new shipment from supplier"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirm Stock Update</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
