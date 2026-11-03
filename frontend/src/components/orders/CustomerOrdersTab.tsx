'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Eye,
  Ban,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import orderService from '@/services/order.service';
import paymentService from '@/services/payment.service';
import { Order, OrderStatus, PaymentStatus } from '@/types/order';

export default function CustomerOrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer changed mind');
  const [isCancelling, setIsCancelling] = useState(false);

  // Pay pending order modal state
  const [orderToPay, setOrderToPay] = useState<Order | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await orderService.listOrders({ limit: 50 });
      if (res?.data?.orders) {
        setOrders(res.data.orders);
      } else {
        setOrders([]);
      }
    } catch (err: unknown) {
      setAlert({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to retrieve orders',
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToCancel) return;

    try {
      setIsCancelling(true);
      await orderService.cancelOrder(orderToCancel.id, cancelReason);
      setAlert({
        type: 'success',
        text: `Order #${orderToCancel.order_number} was successfully cancelled and reserved stock returned to inventory.`,
      });
      setOrderToCancel(null);
      fetchOrders();
      setTimeout(() => setAlert(null), 4000);
    } catch (err: unknown) {
      setAlert({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to cancel order',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToPay) return;

    try {
      setIsPaying(true);
      setPayError(null);

      // Process Mock Payment
      const payment = await paymentService.processPayment({
        order_id: Number(orderToPay.id),
        order_number: orderToPay.order_number,
        amount: Number(orderToPay.total_amount),
        currency: orderToPay.currency || 'USD',
        payment_method: 'MOCK_CARD',
        card_number: '4242424242424242',
        mock_action: 'SUCCESS',
      });

      if (payment.status === 'FAILED') {
        throw new Error(payment.failure_reason || 'Payment was declined');
      }

      setAlert({
        type: 'success',
        text: `Payment of $${Number(orderToPay.total_amount).toFixed(2)} settled successfully for Order #${orderToPay.order_number}!`,
      });
      setOrderToPay(null);
      fetchOrders();
      setTimeout(() => setAlert(null), 4000);
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : 'Payment settlement failed');
    } finally {
      setIsPaying(false);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PROCESSING':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'SHIPPED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'DELIVERED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CANCELLED':
      case 'FAILED':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'PAID':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PENDING':
      case 'AUTHORIZED':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'REFUNDED':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'FAILED':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert */}
      {alert && (
        <div
          className={`rounded-2xl p-4 border text-xs font-semibold flex items-center gap-2.5 ${
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

      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">Order History & Tracking</h2>
          <p className="text-xs text-slate-500">
            Review past purchases, current shipping status, payment receipts, and tracking history.
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Loading your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 mb-3">
            <Package className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">You haven&apos;t placed any orders yet</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Browse our catalog, add items to your cart, and experience seamless checkout and mock payment.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const itemCount = order.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
            const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';
            const canPay = order.status === 'PENDING' && order.payment_status === 'PENDING';

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs hover:shadow-md transition duration-200"
              >
                {/* Order Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Order Number
                      </span>
                      <span className="font-mono font-bold text-slate-900">{order.order_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Date Placed
                      </span>
                      <span className="text-slate-700 font-medium">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Total Amount
                      </span>
                      <span className="font-bold text-slate-900">${Number(order.total_amount).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getPaymentStatusBadge(
                        order.payment_status
                      )}`}
                    >
                      Payment: {order.payment_status}
                    </span>
                  </div>
                </div>

                {/* Items Preview */}
                <div className="p-5">
                  <div className="space-y-3">
                    {order.items?.map((item) => (
                      <div
                        key={item.id || `${item.product_id}-${item.variant_id}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                            <ShoppingBag className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">{item.product_name}</h4>
                            <p className="text-slate-400 text-[11px]">
                              Qty: {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                              {item.variant_name && ` (${item.variant_name})`}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-800">
                          ${Number(item.line_total).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order Actions Footer */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      Shipping to:{' '}
                      <span className="font-medium text-slate-800">
                        {order.shipping_address?.city}, {order.shipping_address?.state} ({order.shipping_address?.country})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {canPay && (
                        <button
                          onClick={() => setOrderToPay(order)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-2xs transition"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>Pay Now (${Number(order.total_amount).toFixed(2)})</span>
                        </button>
                      )}

                      {canCancel && (
                        <button
                          onClick={() => setOrderToCancel(order)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span>Cancel Order</span>
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Details</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Order Details: <span className="font-mono text-indigo-600">{selectedOrder.order_number}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
              {/* Order Status & Financials */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Status</span>
                  <span className={`inline-flex items-center px-2 py-0.5 mt-0.5 rounded-full font-bold border text-[11px] ${getStatusBadge(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Payment</span>
                  <span className={`inline-flex items-center px-2 py-0.5 mt-0.5 rounded-full font-bold border text-[11px] ${getPaymentStatusBadge(selectedOrder.payment_status)}`}>
                    {selectedOrder.payment_status}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">Items Ordered</h4>
                <div className="space-y-2 border border-slate-200/80 rounded-xl p-3">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="font-semibold text-slate-900">{item.product_name}</p>
                        <p className="text-[11px] text-slate-500">
                          SKU: {item.sku} | Qty: {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                        </p>
                      </div>
                      <span className="font-bold text-slate-900">${Number(item.line_total).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Address */}
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">Shipping Information</h4>
                <div className="rounded-xl border border-slate-200/80 p-3.5 space-y-1 bg-slate-50/50">
                  <p className="font-semibold text-slate-900">{selectedOrder.customer_name}</p>
                  <p className="text-slate-600">{selectedOrder.customer_email}</p>
                  <p className="text-slate-600">{selectedOrder.shipping_address?.street}</p>
                  <p className="text-slate-600">
                    {selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state} {selectedOrder.shipping_address?.postal_code}
                  </p>
                  <p className="text-slate-600">{selectedOrder.shipping_address?.country}</p>
                  {selectedOrder.shipping_address?.phone && (
                    <p className="text-slate-500">Phone: {selectedOrder.shipping_address.phone}</p>
                  )}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="border-t border-slate-200 pt-3 space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold">${Number(selectedOrder.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping Fee</span>
                  <span className="font-semibold">${Number(selectedOrder.shipping_fee).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax Amount</span>
                  <span className="font-semibold">${Number(selectedOrder.tax_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Total Amount</span>
                  <span className="text-indigo-600">${Number(selectedOrder.total_amount).toFixed(2)} {selectedOrder.currency}</span>
                </div>
              </div>

              {/* Timeline History */}
              {selectedOrder.history && selectedOrder.history.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">Status Timeline</h4>
                  <div className="space-y-2 border-l-2 border-indigo-200 pl-3 ml-2">
                    {selectedOrder.history.map((h) => (
                      <div key={h.id} className="relative">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{h.new_status}</span>
                          <span className="text-[10px] text-slate-400">by {h.changed_by}</span>
                        </div>
                        {h.reason && <p className="text-slate-500 text-[11px] mt-0.5">{h.reason}</p>}
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {new Date(h.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CANCEL ORDER CONFIRMATION */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mx-auto">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Cancel Order #{orderToCancel.order_number}?</h3>
              <p className="text-xs text-slate-500">
                Cancelling this order will release held stock back to available inventory.
              </p>

              <form onSubmit={handleCancelSubmit} className="mt-4 text-left space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Reason for Cancellation</label>
                  <input
                    type="text"
                    required
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
                    placeholder="Enter cancellation reason..."
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOrderToCancel(null)}
                    className="w-1/2 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Keep Order
                  </button>
                  <button
                    type="submit"
                    disabled={isCancelling}
                    className="w-1/2 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition"
                  >
                    {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Cancel'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PAY PENDING ORDER */}
      {orderToPay && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Pay Order #{orderToPay.order_number}</h3>
              </div>
              <button
                onClick={() => setOrderToPay(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePaySubmit} className="p-6 space-y-4 text-xs">
              {payError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  {payError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Due:</span>
                  <span className="font-bold text-indigo-700">${Number(orderToPay.total_amount).toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Method:</span>
                  <span>Mock Card (4242 4242 4242 4242)</span>
                </div>
              </div>

              <p className="text-slate-500">
                Clicking Confirm will trigger the mock payment gateway and instantly settle your order and finalize stock allocation.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderToPay(null)}
                  className="w-1/2 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="w-1/2 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm & Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
