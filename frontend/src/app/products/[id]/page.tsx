'use client';

import React, { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import productService from '@/services/product.service';
import inventoryService from '@/services/inventory.service';
import { Product } from '@/types/product';
import { InventoryItem } from '@/types/inventory';
import ProductFormModal from '@/components/products/ProductFormModal';
import DeleteConfirmModal from '@/components/products/DeleteConfirmModal';
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal';
import ProductReviewsSection from '@/components/reviews/ProductReviewsSection';
import reviewService from '@/services/review.service';
import { ProductRatingSummary } from '@/types/review';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addToCart, openCart } from '@/store/slices/cartSlice';
import {
  ArrowLeft,
  ShoppingBag,
  Store,
  ShieldCheck,
  Truck,
  RefreshCw,
  Tag,
  Building,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Calendar,
  Check,
  Boxes,
  SlidersHorizontal,
  Star,
} from 'lucide-react';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

function ProductDetailContent({ params }: ProductPageProps) {
  const router = useRouter();
  // Unwrap the params promise provided by Next.js
  const { id } = use(params);

  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const { items } = useAppSelector((state) => state.cart);

  const [product, setProduct] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<InventoryItem | null>(null);
  const [summary, setSummary] = useState<ProductRatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [addedToCart, setAddedToCart] = useState(false);

  // Modals for CRUD & Stock
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    const loadProductData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await productService.getProduct(id);

        if (!isMounted) return;
        setProduct(data);

        const img = data.primary_image || data.images?.[0]?.image_url || '';
        setActiveImage(img);

        // Fetch live inventory for this product
        try {
          const invList = await inventoryService.getByProductId(data.id);
          if (isMounted && invList && invList.length > 0) {
            setInventory(invList[0]);
          }
        } catch {
          // Inventory service offline or not initialized for this item
        }

        // Fetch live rating summary for this product
        try {
          const sumData = await reviewService.getProductRatingSummary(data.id);
          if (isMounted && sumData) {
            setSummary(sumData);
          }
        } catch {
          // Review service offline or not initialized for this item
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Product could not be found.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProductData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const isOwner = user && product && String(user.id) === String(product.seller_id);
  const isAdmin = user?.roles?.includes('admin');
  const canManage = isOwner || isAdmin;

  const handleEditSuccess = async (updated: Product) => {
    try {
      const freshProduct = await productService.getProduct(id);
      setProduct(freshProduct);

      const img =
        freshProduct.primary_image ||
        freshProduct.images?.[0]?.image_url ||
        activeImage;
      setActiveImage(img);

      setActionMessage({
        type: 'success',
        text: 'Product updated successfully!',
      });
      setTimeout(() => setActionMessage(null), 3500);
    } catch {
      setProduct(updated);
      setActionMessage({
        type: 'success',
        text: 'Product updated, but refreshing the product details failed.',
      });
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!product) return;
    try {
      setDeleteLoading(true);
      await productService.deleteProduct(product.id);
      setIsDeleteOpen(false);
      router.push('/profile');
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete product',
      });
      setIsDeleteOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const currentVariantId = product?.variants?.[0]?.id ? Number(product.variants[0].id) : 1;
  const isAlreadyInCart = Boolean(
    product &&
      items.some(
        (i) => i.productId === Number(product.id) && i.variantId === currentVariantId
      )
  );

  const handleAddToCart = () => {
    if (!product) return;
    const variant = product.variants?.[0];
    const variantId = variant ? Number(variant.id) : 1;
    const productId = Number(product.id);

    // If item is already present in the cart, do not add or increment
    const existingItem = items.find(
      (i) => i.productId === productId && i.variantId === variantId
    );

    if (existingItem) {
      setActionMessage({
        type: 'success',
        text: 'This item is already in your shopping cart.',
      });
      setTimeout(() => setActionMessage(null), 3000);
      return;
    }

    const price =
      product.min_price !== undefined && product.min_price !== null
        ? Number(product.min_price)
        : variant?.price !== undefined
        ? Number(variant.price)
        : 0;
    const img = product.primary_image || product.images?.[0]?.image_url || '';

    dispatch(
      addToCart({
        productId,
        variantId,
        sku: variant?.sku || `SKU-${product.id}`,
        name: product.name,
        variantName: variant?.variant_name || 'Standard',
        price,
        imageUrl: img,
        sellerId: product.seller_id,
        quantity: 1,
        maxStock: inventory?.quantity_available || 99,
      })
    );

    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2200);
  };

  const handleBuyNow = () => {
    if (!product) return;
    const variant = product.variants?.[0];
    const variantId = variant ? Number(variant.id) : 1;
    const productId = Number(product.id);

    const existingItem = items.find(
      (i) => i.productId === productId && i.variantId === variantId
    );

    // Only add to cart if not already present
    if (!existingItem) {
      const price =
        product.min_price !== undefined && product.min_price !== null
          ? Number(product.min_price)
          : variant?.price !== undefined
          ? Number(variant.price)
          : 0;
      const img = product.primary_image || product.images?.[0]?.image_url || '';

      dispatch(
        addToCart({
          productId,
          variantId,
          sku: variant?.sku || `SKU-${product.id}`,
          name: product.name,
          variantName: variant?.variant_name || 'Standard',
          price,
          imageUrl: img,
          sellerId: product.seller_id,
          quantity: 1,
          maxStock: inventory?.quantity_available || 99,
        })
      );
    }

    dispatch(openCart());
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mb-4" />
        <p className="text-sm font-semibold text-slate-600">Loading product information...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="h-16 w-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-sm">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Product Not Available</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          {error || 'The requested product is unavailable, archived, or does not exist in the marketplace.'}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Store Catalog</span>
        </Link>
      </div>
    );
  }

  const priceValue =
    product.min_price !== undefined && product.min_price !== null
      ? Number(product.min_price)
      : product.variants?.[0]?.price !== undefined
      ? Number(product.variants[0].price)
      : 0;

  return (
    <div className="bg-slate-50 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumbs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/" className="hover:text-indigo-600 transition flex items-center gap-1">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Store</span>
            </Link>
            <span>/</span>
            <span className="text-slate-400">Products</span>
            <span>/</span>
            <span className="text-slate-900 truncate max-w-[200px] sm:max-w-xs">{product.name}</span>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Browse</span>
          </Link>
        </div>

        {/* Action notification */}
        {actionMessage && (
          <div
            className={`rounded-2xl p-4 border text-sm font-semibold flex items-center gap-2.5 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Seller / Admin Management Toolbar */}
        {canManage && (
          <div className="rounded-3xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/80 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xs">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                    {isAdmin ? 'Admin Listing Management' : 'Seller Listing Management'}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      product.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {product.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  You have full CRUD authorization to update pricing, description, or remove this listing.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setIsEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Product</span>
              </button>
              {inventory && (
                <button
                  onClick={() => setIsStockOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-700 shadow-2xs hover:bg-emerald-50 transition"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Adjust Stock</span>
                </button>
              )}
              <button
                onClick={() => setIsDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-600 shadow-2xs hover:bg-rose-50 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Product Showcase Card */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-10">
            {/* Left Column: Image Gallery */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="relative aspect-square w-full rounded-3xl bg-slate-100 overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center">
                {activeImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={activeImage}
                    alt={product.name}
                    className="h-full w-full object-cover object-center transition-all duration-300"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                    <ShoppingBag className="h-16 w-16 text-slate-300 mb-2" />
                    <span className="text-sm font-semibold">No Image Provided</span>
                  </div>
                )}
                <div className="absolute top-4 left-4 flex gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-extrabold shadow-sm ${
                      product.status === 'ACTIVE'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {product.status === 'ACTIVE' ? 'In Stock / Active' : 'Draft Listing'}
                  </span>
                </div>
              </div>

              {/* Thumbnails */}
              {product.images && product.images.length > 1 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {product.images.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveImage(img.image_url)}
                      className={`relative h-18 w-18 shrink-0 rounded-2xl overflow-hidden border-2 transition ${
                        activeImage === img.image_url
                          ? 'border-indigo-600 shadow-md ring-2 ring-indigo-200'
                          : 'border-slate-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */ }
                      <img
                        src={img.image_url}
                        alt="Thumbnail"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Product Details & Actions */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                {/* Brand & Category badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {product.brand && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      <Building className="h-3 w-3 text-slate-500" />
                      {product.brand}
                    </span>
                  )}
                  {product.categories && product.categories.length > 0 ? (
                    product.categories.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-100"
                      >
                        <Tag className="h-3 w-3 text-indigo-500" />
                        {c.name}
                      </span>
                    ))
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-100">
                      General Catalog
                    </span>
                  )}
                </div>

                {/* Product Name */}
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                  {product.name}
                </h1>

                {/* Live Star Rating Snippet */}
                <div className="flex items-center gap-3 pt-1">
                  <a
                    href="#customer-feedback"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition group"
                  >
                    <div className="flex items-center gap-1 text-amber-500 font-extrabold">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span>
                        {summary && Number(summary.total_reviews) > 0
                          ? Number(summary.average_rating).toFixed(1)
                          : 'New'}
                      </span>
                    </div>
                    <span className="text-slate-400 group-hover:text-indigo-600 transition">
                      ({summary ? summary.total_reviews : 0}{' '}
                      {summary?.total_reviews === 1 ? 'review' : 'reviews'})
                    </span>
                    <span className="text-indigo-600 font-bold ml-1 text-[11px] underline">
                      See all reviews
                    </span>
                  </a>
                </div>

                {/* Price Display */}
                <div className="flex items-baseline gap-3 pt-2">
                  <span className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                    ${priceValue.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    {product.currency || 'USD'} Taxes Included
                  </span>
                </div>

                {/* Description */}
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    About this item
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                    {product.description ||
                      'Crafted with premium materials and engineered for superior durability and everyday performance. Includes standard warranty and verified seller guarantee.'}
                  </p>
                </div>

                {/* Seller attribution */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <Store className="h-4 w-4 text-indigo-600" />
                    <span>
                      Sold by <strong className="font-semibold text-slate-900">Verified Marketplace Seller</strong>
                    </span>
                  </div>
                  <span className="text-slate-400 flex items-center gap-1 font-mono text-[11px]">
                    <Calendar className="h-3 w-3" />
                    {new Date(product.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Live Inventory Status (Visible only to the seller / admin) */}
                {canManage && (
                  inventory ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Boxes className="h-4 w-4 text-indigo-600" />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Inventory Status</span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                            inventory.quantity_available > inventory.low_stock_threshold
                              ? 'bg-emerald-100 text-emerald-800'
                              : inventory.quantity_available > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inventory.quantity_available > inventory.low_stock_threshold
                            ? `In Stock (${inventory.quantity_available} units)`
                            : inventory.quantity_available > 0
                            ? `Low Stock: Only ${inventory.quantity_available} left!`
                            : 'Out of Stock'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-1 text-xs">
                        <div className="rounded-xl bg-white p-2 border border-slate-100 shadow-2xs">
                          <span className="text-[10px] text-slate-400 block font-medium">Available</span>
                          <span className="font-extrabold text-slate-900 text-sm">{inventory.quantity_available}</span>
                        </div>
                        <div className="rounded-xl bg-white p-2 border border-slate-100 shadow-2xs">
                          <span className="text-[10px] text-slate-400 block font-medium">Reserved</span>
                          <span className="font-extrabold text-slate-900 text-sm">{inventory.quantity_reserved}</span>
                        </div>
                        <div className="rounded-xl bg-white p-2 border border-slate-100 shadow-2xs">
                          <span className="text-[10px] text-slate-400 block font-medium">SKU</span>
                          <span className="font-mono text-[11px] text-slate-600 truncate block">{inventory.sku || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      <Boxes className="h-4 w-4 text-slate-400" />
                      <span>Inventory tracking ready</span>
                    </div>
                  )
                )}

                {/* Purchase Button */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={Boolean(inventory && inventory.quantity_available <= 0)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
                  >
                    {inventory && inventory.quantity_available <= 0 ? (
                      <span>Currently Out of Stock</span>
                    ) : addedToCart ? (
                      <>
                        <Check className="h-5 w-5" />
                        <span>Added to Cart!</span>
                      </>
                    ) : isAlreadyInCart ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                        <span>Already in Cart</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-5 w-5" />
                        <span>Add to Cart</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleBuyNow}
                    disabled={Boolean(inventory && inventory.quantity_available <= 0)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
                  >
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <span>Buy Now</span>
                  </button>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
                <div className="flex flex-col items-center gap-1.5 p-2">
                  <Truck className="h-5 w-5 text-indigo-600" />
                  <span className="font-semibold text-slate-700">Free Express</span>
                  <span className="text-[10px] text-slate-400">On all orders $50+</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-600" />
                  <span className="font-semibold text-slate-700">Buyer Protection</span>
                  <span className="text-[10px] text-slate-400">100% money back</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2">
                  <RefreshCw className="h-5 w-5 text-indigo-600" />
                  <span className="font-semibold text-slate-700">30-Day Returns</span>
                  <span className="text-[10px] text-slate-400">Hassle-free guarantee</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reviews & Feedback Section */}
        <ProductReviewsSection productId={product.id} productName={product.name} />
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <ProductFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSuccess={handleEditSuccess}
          productToEdit={product}
        />
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && (
        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          productName={product.name}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          loading={deleteLoading}
        />
      )}

      {/* Stock Adjustment Modal */}
      {isStockOpen && inventory && (
        <StockAdjustmentModal
          isOpen={isStockOpen}
          item={inventory}
          productName={product.name}
          onClose={() => setIsStockOpen(false)}
          onSuccess={(updated) => {
            setInventory(updated);
            setActionMessage({ type: 'success', text: 'Inventory updated successfully!' });
            setTimeout(() => setActionMessage(null), 3500);
          }}
        />
      )}
    </div>
  );
}

export default function ProductDetailPage(props: ProductPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex flex-col items-center justify-center bg-slate-50 p-6">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mb-4" />
          <p className="text-sm font-semibold text-slate-600">Loading product information...</p>
        </div>
      }
    >
      <ProductDetailContent {...props} />
    </Suspense>
  );
}
