'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Store,
  Package,
  ShoppingBag,
  Truck,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Eye,
  DollarSign,
  MapPin,
  Loader2,
} from 'lucide-react';
import orderService from '@/services/order.service';
import { Order, OrderStatus, PaymentStatus } from '@/types/order';

interface SellerOrdersTabProps {
  sellerId?: string;
}

export default function SellerOrdersTab({ sellerId }: SellerOrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Status updating state
  const [orderToUpdate, setOrderToUpdate] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<string>('PROCESSING');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSellerOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await orderService.listOrders({ as_seller: true, limit: 50 });
      if (res?.data?.orders) {
        setOrders(res.data.orders);
      } else {
        setOrders([]);
      }
    } catch (err: unknown) {
      setAlert({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to retrieve received seller orders',
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSellerOrders();
  }, [fetchSellerOrders]);

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToUpdate) return;

    try {
      setIsUpdating(true);
      await orderService.updateOrderStatus(
        orderToUpdate.id,
        newStatus,
        statusReason || `Seller updated status to ${newStatus}`,
        trackingNumber || undefined
      );

      setAlert({
        type: 'success',
        text: `Order #${orderToUpdate.order_number} status updated to ${newStatus}!`,
      });
      setOrderToUpdate(null);
      fetchSellerOrders();
      setTimeout(() => setAlert(null), 4000);
    } catch (err: unknown) {
      setAlert({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update order fulfillment status',
      });
    } finally {
      setIsUpdating(false);
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

  // Calculate total units and gross sales for this seller
  const totalReceivedOrders = orders.length;
  const totalGrossSales = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

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

      {/* Seller Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Received Orders</span>
            <Package className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalReceivedOrders}</p>
          <span className="text-[11px] text-slate-400">Total customer orders</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Gross Sales Volume</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">${totalGrossSales.toFixed(2)}</p>
          <span className="text-[11px] text-slate-400">All customer settled orders</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Fulfillment Queue</span>
            <Truck className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'PROCESSING').length}
          </p>
          <span className="text-[11px] text-slate-400">Pending packaging / dispatch</span>
        </div>
      </div>

      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">Received Customer Orders</h2>
          <p className="text-xs text-slate-500">
            Fulfill and track orders placed for products in your store catalog.
          </p>
        </div>
        <button
          onClick={fetchSellerOrders}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Loading received seller orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 mb-3">
            <Store className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No orders received yet</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            When customers purchase your listed products, they will appear here for fulfillment and status dispatch.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs hover:shadow-md transition duration-200"
            >
              {/* Order Header */}
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
                      Customer
                    </span>
                    <span className="text-slate-800 font-semibold">{order.customer_name}</span>
                    <span className="text-slate-400 text-[11px] block">{order.customer_email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Date
                    </span>
                    <span className="text-slate-700 font-medium">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(
                      order.status
                    )}`}
                  >
                    Status: {order.status}
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

              {/* Items & Shipping Details */}
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Items list */}
                  <div className="md:col-span-8 space-y-2.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Ordered Products
                    </h4>
                    {order.items?.map((item) => (
                      <div
                        key={item.id || `${item.product_id}-${item.variant_id}`}
                        className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                            <ShoppingBag className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">{item.product_name}</span>
                            <span className="text-[11px] text-slate-500">
                              SKU: {item.sku} | Qty: {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <span className="font-bold text-slate-900">
                          ${Number(item.line_total).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Destination snapshot */}
                  <div className="md:col-span-4 rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/60 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-[11px] uppercase tracking-wider mb-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>Ship To</span>
                    </div>
                    <p className="font-semibold text-slate-900">{order.customer_name}</p>
                    <p className="text-slate-600">{order.shipping_address?.street}</p>
                    <p className="text-slate-600">
                      {order.shipping_address?.city}, {order.shipping_address?.state}{' '}
                      {order.shipping_address?.postal_code}
                    </p>
                    <p className="text-slate-600">{order.shipping_address?.country}</p>
                    {order.shipping_address?.phone && (
                      <p className="text-slate-500 text-[11px]">Phone: {order.shipping_address.phone}</p>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-bold text-slate-900">
                    Order Total:{' '}
                    <span className="text-indigo-600 text-sm">${Number(order.total_amount).toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                      <button
                        onClick={() => {
                          setOrderToUpdate(order);
                          setNewStatus(
                            order.status === 'CONFIRMED' || order.status === 'PENDING'
                              ? 'PROCESSING'
                              : order.status === 'PROCESSING'
                              ? 'SHIPPED'
                              : 'DELIVERED'
                          );
                          setTrackingNumber('');
                          setStatusReason('');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-2xs transition"
                      >
                        <Truck className="h-3.5 w-3.5" />
                        <span>Update Fulfillment</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Order Summary</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      {orderToUpdate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Update Fulfillment #{orderToUpdate.order_number}
                </h3>
              </div>
              <button
                onClick={() => setOrderToUpdate(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatusSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                >
                  <option value="PROCESSING">PROCESSING (Preparing package)</option>
                  <option value="SHIPPED">SHIPPED (Handed to courier)</option>
                  <option value="DELIVERED">DELIVERED (Package delivered)</option>
                  <option value="CANCELLED">CANCELLED (Out of stock / Void)</option>
                </select>
              </div>

              {newStatus === 'SHIPPED' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Courier Tracking Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. TRK-USPS-82918239"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Fulfillment Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Dispatched via standard ground shipping"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderToUpdate(null)}
                  className="w-1/2 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-1/2 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ORDER SUMMARY MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Customer Order #{selectedOrder.order_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <p className="font-bold text-slate-900">{selectedOrder.customer_name}</p>
                <p className="text-slate-600">{selectedOrder.customer_email}</p>
                <p className="text-slate-600">{selectedOrder.shipping_address?.street}</p>
                <p className="text-slate-600">
                  {selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state}{' '}
                  {selectedOrder.shipping_address?.postal_code}
                </p>
                <p className="text-slate-600">{selectedOrder.shipping_address?.country}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                  Line Items
                </h4>
                <div className="space-y-2 border border-slate-200 rounded-xl p-3">
                  {selectedOrder.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between py-1 border-b border-slate-100 last:border-0"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{item.product_name}</p>
                        <p className="text-[11px] text-slate-500">
                          Qty: {item.quantity} × ${Number(item.unit_price).toFixed(2)} | SKU: {item.sku}
                        </p>
                      </div>
                      <span className="font-bold text-slate-900">${Number(item.line_total).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                <span>Total Amount</span>
                <span className="text-indigo-600">${Number(selectedOrder.total_amount).toFixed(2)}</span>
              </div>
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
    </div>
  );
}
