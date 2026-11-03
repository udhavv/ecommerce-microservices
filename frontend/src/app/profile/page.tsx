'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/auth/protected-route';
import { useAuth } from '@/hooks/use-auth';
import productService from '@/services/product.service';
import inventoryService from '@/services/inventory.service';
import CustomerOrdersTab from '@/components/orders/CustomerOrdersTab';
import SellerOrdersTab from '@/components/orders/SellerOrdersTab';
import { Product } from '@/types/product';
import { InventoryItem } from '@/types/inventory';
import ProductFormModal from '@/components/products/ProductFormModal';
import DeleteConfirmModal from '@/components/products/DeleteConfirmModal';
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal';
import {
  User as UserIcon,
  Shield,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Fingerprint,
  Mail,
  Sparkles,
  Store,
  ArrowRight,
  PackagePlus,
  Package,
  PackageX,
  ExternalLink,
  Edit3,
  Trash2,
  Plus,
  Eye,
  Tag,
  Building,
  Boxes,
  SlidersHorizontal,
  AlertCircle,
  Receipt,
  ShoppingCart,
  Truck,
} from 'lucide-react';

function ProfileContent() {
  const { user, logout, refreshSession, becomeSeller } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<
    'profile' | 'products' | 'inventory' | 'orders' | 'seller-orders'
  >(
    tabParam === 'orders'
      ? 'orders'
      : tabParam === 'seller-orders'
      ? 'seller-orders'
      : tabParam === 'inventory'
      ? 'inventory'
      : tabParam === 'profile'
      ? 'profile'
      : 'products'
  );

  useEffect(() => {
    if (tabParam === 'orders') setActiveTab('orders');
    if (tabParam === 'seller-orders') setActiveTab('seller-orders');
  }, [tabParam]);
  const [refreshing, setRefreshing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Seller Products State
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Inventory State
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<{
    item: InventoryItem;
    productName?: string;
  } | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isSeller = Boolean(user?.roles && user.roles.includes('seller'));
  const isAdmin = Boolean(user?.roles && user.roles.includes('admin'));

  // Load seller's products
  const fetchSellerProducts = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoadingProducts(true);
      const res = await productService.getProducts({ seller_id: user.id });
      if (res?.data?.products) {
        setSellerProducts(res.data.products);
      } else {
        setSellerProducts([]);
      }
    } catch {
      setSellerProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [user]);

  // Load inventory items
  const fetchInventory = useCallback(async () => {
    try {
      setLoadingInventory(true);
      const res = await inventoryService.getInventory({ limit: 100 });
      if (res?.data?.items) {
        setInventoryItems(res.data.items);
      } else {
        setInventoryItems([]);
      }
    } catch {
      setInventoryItems([]);
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchSellerProducts();
      fetchInventory();
    }
  }, [user?.id, fetchSellerProducts, fetchInventory]);

  if (!user) return null;

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      setStatusMessage(null);
      await refreshSession();
      setStatusMessage({ type: 'success', text: 'Session token refreshed successfully!' });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to refresh session.' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleBecomeSeller = async () => {
    try {
      setUpgrading(true);
      setStatusMessage(null);
      await becomeSeller();
      setStatusMessage({
        type: 'success',
        text: 'Congratulations! Your account has been upgraded to Seller. You can now list and manage products!',
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upgrade to seller.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setUpgrading(false);
    }
  };

  const handleAddOrEditSuccess = (savedProduct: Product) => {
    setStatusMessage({
      type: 'success',
      text: productToEdit ? `Product '${savedProduct.name}' updated successfully!` : `Product '${savedProduct.name}' listed for sale!`,
    });
    setProductToEdit(null);
    setIsAddModalOpen(false);
    fetchSellerProducts();
    fetchInventory();
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    try {
      setDeleteLoading(true);
      await productService.deleteProduct(productToDelete.id);
      setStatusMessage({
        type: 'success',
        text: `Product '${productToDelete.name}' deleted successfully.`,
      });
      setProductToDelete(null);
      fetchSellerProducts();
      fetchInventory();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete product',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 bg-slate-50 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Profile & Marketplace Dashboard</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {activeTab === 'products'
              ? 'Seller Management'
              : activeTab === 'seller-orders'
              ? 'Received Customer Orders'
              : activeTab === 'orders'
              ? 'My Orders & Purchases'
              : activeTab === 'inventory'
              ? 'Inventory & Stock Control'
              : 'User Profile'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your credentials, store listings, and seller privileges
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === 'inventory') {
                fetchInventory();
              } else if (activeTab === 'products') {
                fetchSellerProducts();
              } else {
                handleManualRefresh();
              }
            }}
            disabled={refreshing || loadingProducts || loadingInventory}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-indigo-600 ${
                refreshing || loadingProducts || loadingInventory ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Dynamic Status Alert */}
      {statusMessage && (
        <div
          className={`rounded-2xl p-4 border text-sm font-semibold flex items-center gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Segment Navigation Switcher */}
      <div className="flex flex-wrap border-b border-slate-200">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition -mb-px ${
            activeTab === 'orders'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-2xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>My Orders</span>
        </button>

        {(isSeller || isAdmin) && (
          <button
            onClick={() => setActiveTab('seller-orders')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition -mb-px ${
              activeTab === 'seller-orders'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-2xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="h-4 w-4" />
            <span>Received Orders (Seller)</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition -mb-px ${
            activeTab === 'products'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-2xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Store className="h-4 w-4" />
          <span>Seller Hub & My Products</span>
          <span className="ml-1.5 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-extrabold text-indigo-700">
            {sellerProducts.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('inventory');
            fetchInventory();
          }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition -mb-px ${
            activeTab === 'inventory'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-2xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className="h-4 w-4" />
          <span>Inventory & Stock</span>
          <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-700">
            {inventoryItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition -mb-px ${
            activeTab === 'profile'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-2xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserIcon className="h-4 w-4" />
          <span>Account Overview</span>
        </button>
      </div>

      {/* SEGMENT 0: MY ORDERS (Customer Placed Orders) */}
      {activeTab === 'orders' && <CustomerOrdersTab />}

      {/* SEGMENT 0.5: RECEIVED ORDERS (Seller Orders) */}
      {activeTab === 'seller-orders' && <SellerOrdersTab sellerId={user?.id} />}

      {/* SEGMENT 1: SELLER HUB & MY PRODUCTS */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Seller Activation Banner if not yet a seller */}
          {!isSeller && !isAdmin && (
            <div className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">Become a Verified Seller</h3>
                </div>
                <p className="text-xs text-slate-600 max-w-xl">
                  You are currently a Standard User. Activate Seller mode to list your items, define prices, and sell directly to customers in the marketplace.
                </p>
              </div>
              <button
                onClick={handleBecomeSeller}
                disabled={upgrading}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition shrink-0"
              >
                {upgrading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <PackagePlus className="h-4 w-4" />
                    <span>Activate Seller Account</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Seller Hub Header & Add Product Action */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600" />
                <h2 className="text-xl font-extrabold text-slate-900">My Listed Products</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                View, edit, manage, and add products you have put up for sale in the marketplace.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchSellerProducts()}
                disabled={loadingProducts}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                title="Refresh product list"
              >
                <RefreshCw className={`h-4 w-4 ${loadingProducts ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
              <button
                onClick={() => {
                  if (!isSeller && !isAdmin) {
                    handleBecomeSeller().then(() => setIsAddModalOpen(true));
                  } else {
                    setIsAddModalOpen(true);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* Products List Display */}
          {loadingProducts ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-slate-200">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-500">Loading your store listings...</p>
            </div>
          ) : sellerProducts.length === 0 ? (
            /* Explicit empty state: "there are not products" */
            <div className="text-center py-16 px-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white shadow-xs">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
                <PackageX className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-800">There are no products</h3>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                You have not put up any products for sale yet. Click the button below to add your first product to the store catalog.
              </p>
              <button
                onClick={() => {
                  if (!isSeller && !isAdmin) {
                    handleBecomeSeller().then(() => setIsAddModalOpen(true));
                  } else {
                    setIsAddModalOpen(true);
                  }
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                <PackagePlus className="h-4 w-4" />
                <span>Add Product</span>
              </button>
            </div>
          ) : (
            /* Grid of Seller Products */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sellerProducts.map((p) => {
                const price =
                  p.min_price !== undefined
                    ? Number(p.min_price)
                    : p.variants?.[0]?.price !== undefined
                    ? Number(p.variants[0].price)
                    : 0;
                const img =
                  p.primary_image ||
                  p.images?.[0]?.image_url ||
                  '';
                const itemInv = inventoryItems.find(
                  (inv) => String(inv.product_id) === String(p.id)
                );

                return (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md hover:border-slate-300"
                  >
                    <div>
                      {/* Product Image & Status */}
                      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 mb-4 flex items-center justify-center">
                        {img ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={img}
                            alt={p.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <Package className="h-8 w-8 text-slate-300 mb-1" />
                            <span className="text-[10px] font-semibold">Store Listing</span>
                          </div>
                        )}
                        <span
                          className={`absolute top-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase shadow-xs ${
                            p.status === 'ACTIVE'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-500 text-white'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>

                      {/* Brand & Category */}
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 mb-1.5">
                        {p.brand && <span>{p.brand}</span>}
                        {p.brand && p.categories?.length ? <span>•</span> : null}
                        {p.categories?.[0]?.name && (
                          <span className="text-indigo-600">{p.categories[0].name}</span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-extrabold text-slate-900 line-clamp-1 mb-2">
                        {p.name}
                      </h3>

                      {/* Description preview */}
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                        {p.description || 'No description provided.'}
                      </p>

                      {/* Price & Stock info */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-lg font-black text-slate-900">
                          ${price.toFixed(2)}
                        </div>
                        {itemInv && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                              itemInv.quantity_available > itemInv.low_stock_threshold
                                ? 'bg-emerald-100 text-emerald-800'
                                : itemInv.quantity_available > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {itemInv.quantity_available > itemInv.low_stock_threshold
                              ? `${itemInv.quantity_available} in stock`
                              : itemInv.quantity_available > 0
                              ? `Low: ${itemInv.quantity_available} left`
                              : 'Out of stock'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {/* View Dedicated Product Page */}
                      <Link
                        href={`/products/${p.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Page</span>
                      </Link>

                      <div className="flex items-center gap-1.5">
                        {/* Adjust Stock Button */}
                        {itemInv && (
                          <button
                            onClick={() => setSelectedStockItem({ item: itemInv, productName: p.name })}
                            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition"
                            title="Adjust Stock"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Edit Button */}
                        <button
                          onClick={() => setProductToEdit(p)}
                          className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
                          title="Edit Product"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setProductToDelete(p)}
                          className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition"
                          title="Delete Product"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SEGMENT 2: INVENTORY & STOCK CONTROL */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Inventory Overview Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-indigo-600" />
                <h2 className="text-xl font-extrabold text-slate-900">Live Inventory Management</h2>
              </div>
              <p className="text-xs text-slate-500">
                Monitor real-time stock levels, reserved customer checkout quantities, and adjust supplies.
              </p>
            </div>

            <button
              onClick={() => fetchInventory()}
              disabled={loadingInventory}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 ${loadingInventory ? 'animate-spin' : ''}`} />
              <span>Sync Stock</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Items / SKUs</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{inventoryItems.length}</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Units Available</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {inventoryItems.reduce((acc, i) => acc + (i.quantity_available || 0), 0)}
              </span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Reserved Checkout</span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                {inventoryItems.reduce((acc, i) => acc + (i.quantity_reserved || 0), 0)}
              </span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Low Stock Alerts</span>
              <span className="text-2xl font-black text-rose-600 mt-1 block">
                {inventoryItems.filter((i) => i.quantity_available <= i.low_stock_threshold).length}
              </span>
            </div>
          </div>

          {/* Inventory Table */}
          {loadingInventory ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-slate-200">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-500">Fetching inventory ledger...</p>
            </div>
          ) : inventoryItems.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
                <Boxes className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-800">No Inventory Records</h3>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                When you list products in the store, inventory records are automatically provisioned and tracked here.
              </p>
              <button
                onClick={() => {
                  setActiveTab('products');
                  setIsAddModalOpen(true);
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                <PackagePlus className="h-4 w-4" />
                <span>List a Product</span>
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Product / SKU</th>
                      <th className="px-6 py-4 text-center">Available Stock</th>
                      <th className="px-6 py-4 text-center">Reserved</th>
                      <th className="px-6 py-4 text-center">Low Stock Alert</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventoryItems.map((item) => {
                      const matchedProduct = sellerProducts.find(
                        (p) => String(p.id) === String(item.product_id)
                      );
                      const isLowStock = item.quantity_available <= item.low_stock_threshold;
                      const isOutOfStock = item.quantity_available <= 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                                {matchedProduct?.primary_image || matchedProduct?.images?.[0]?.image_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={matchedProduct.primary_image || matchedProduct.images?.[0]?.image_url}
                                    alt="Product"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Boxes className="h-5 w-5 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-extrabold text-slate-900 block truncate max-w-xs">
                                  {matchedProduct?.name || `Product #${item.product_id}`}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  SKU: {item.sku || 'N/A'} • Var #{item.variant_id}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-center">
                            <span className="font-extrabold text-sm text-slate-900">
                              {item.quantity_available}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-center">
                            <span className="font-semibold text-slate-600">
                              {item.quantity_reserved}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-center">
                            <span className="font-semibold text-slate-500">
                              ≤ {item.low_stock_threshold} units
                            </span>
                          </td>

                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                                isOutOfStock
                                  ? 'bg-rose-100 text-rose-800'
                                  : isLowStock
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'Healthy'}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() =>
                                setSelectedStockItem({
                                  item,
                                  productName: matchedProduct?.name,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition"
                            >
                              <SlidersHorizontal className="h-3 w-3" />
                              <span>Adjust</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SEGMENT 3: ACCOUNT OVERVIEW */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Main Profile Card */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
            {/* Colorful Gradient Header */}
            <div className="h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative" />

            <div className="px-6 sm:px-8 pb-8 pt-0 relative">
              {/* Avatar & Status Row */}
              <div className="-mt-14 mb-6 flex items-end justify-between">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                  <span className="text-3xl font-extrabold">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isSeller && (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <Store className="h-3 w-3" /> Seller
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold border ${
                      user.status === 'active'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        user.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    Status: {user.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">
                  {user.displayName}
                </h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span>{user.email}</span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* User ID */}
                <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                    <Fingerprint className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">User ID</p>
                    <p className="mt-1 text-xs font-mono font-medium text-slate-900 truncate">
                      {user.id}
                    </p>
                  </div>
                </div>

                {/* Email Verification */}
                <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                    {user.emailVerifiedAt ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email Verification</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {user.emailVerifiedAt
                        ? `Verified (${new Date(user.emailVerifiedAt).toLocaleDateString()})`
                        : 'Pending Verification'}
                    </p>
                  </div>
                </div>

                {/* Roles */}
                <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 shrink-0">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Roles</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {user.roles && user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <span
                            key={role}
                            className="rounded-lg bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200"
                          >
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">Standard User</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Created At */}
                <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shrink-0">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Member Since</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seller Status Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900">Seller Program</h3>
                </div>
                <p className="text-sm text-slate-500">
                  {isSeller
                    ? 'Your account has full Seller privileges. You can list, price, update, and manage your product catalog.'
                    : 'Want to sell on CloudStore? Upgrade your account to become an authorized Seller.'}
                </p>
              </div>

              <div>
                {isSeller ? (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Seller Privileges Active</span>
                  </div>
                ) : (
                  <button
                    onClick={handleBecomeSeller}
                    disabled={upgrading || user.status !== 'active'}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50"
                  >
                    {upgrading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <PackagePlus className="h-4 w-4" />
                        <span>Become a Seller</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <ProductFormModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleAddOrEditSuccess}
        />
      )}

      {/* Edit Product Modal */}
      {productToEdit && (
        <ProductFormModal
          isOpen={!!productToEdit}
          onClose={() => setProductToEdit(null)}
          onSuccess={handleAddOrEditSuccess}
          productToEdit={productToEdit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <DeleteConfirmModal
          isOpen={!!productToDelete}
          productName={productToDelete.name}
          onClose={() => setProductToDelete(null)}
          onConfirm={handleDeleteConfirm}
          loading={deleteLoading}
        />
      )}

      {/* Stock Adjustment Modal */}
      {selectedStockItem && (
        <StockAdjustmentModal
          isOpen={!!selectedStockItem}
          item={selectedStockItem.item}
          productName={selectedStockItem.productName}
          onClose={() => setSelectedStockItem(null)}
          onSuccess={(updated) => {
            setInventoryItems((prev) =>
              prev.map((i) => (i.id === updated.id ? updated : i))
            );
            setSelectedStockItem(null);
            setStatusMessage({
              type: 'success',
              text: `Stock for SKU '${updated.sku || 'item'}' adjusted to ${updated.quantity_available} units.`,
            });
            setTimeout(() => setStatusMessage(null), 4000);
          }}
        />
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="py-20 text-center text-xs font-semibold text-slate-500">Loading profile dashboard...</div>}>
        <ProfileContent />
      </Suspense>
    </ProtectedRoute>
  );
}
