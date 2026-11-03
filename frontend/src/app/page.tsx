'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import productService from '@/services/product.service';
import inventoryService from '@/services/inventory.service';
import reviewService from '@/services/review.service';
import { Product } from '@/types/product';
import { useAppDispatch } from '@/store/hooks';
import { addToCart } from '@/store/slices/cartSlice';
import {
  ShoppingBag,
  ArrowRight,
  User,
  Star,
  Truck,
  ShieldCheck,
  RefreshCw,
  Headphones,
  Search,
  Store,
  Sparkles,
  Check,
  PackageX,
  PackagePlus,
  AlertTriangle,
  Boxes,
} from 'lucide-react';

export default function Home() {
  const { user, isAuthenticated, isInitialLoading } = useAuth();
  const dispatch = useAppDispatch();
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, { available: number; isLow: boolean }>>({});
  const [ratingMap, setRatingMap] = useState<Record<string, { average: number; count: number }>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});

  const isSeller = Boolean(user?.roles && user.roles.includes('seller'));

  // Fetch live products from Product microservice and their inventory
  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await productService.getProducts({ status: 'ACTIVE' });
      if (res?.data?.products) {
        const prodList = res.data.products;
        setProducts(prodList);

        // Fetch live inventory and rating summaries in parallel for products
        const stockEntries: Record<string, { available: number; isLow: boolean }> = {};
        const ratingEntries: Record<string, { average: number; count: number }> = {};

        await Promise.all(
          prodList.map(async (p) => {
            // Inventory fetch
            try {
              const invItems = await inventoryService.getByProductId(p.id);
              if (invItems && invItems.length > 0) {
                const totalAvail = invItems.reduce((acc, item) => acc + (item.quantity_available || 0), 0);
                const isLow = invItems.some(
                  (item) => item.quantity_available <= item.low_stock_threshold
                );
                stockEntries[String(p.id)] = { available: totalAvail, isLow };
              } else {
                stockEntries[String(p.id)] = { available: 15, isLow: false };
              }
            } catch {
              stockEntries[String(p.id)] = { available: 10, isLow: false };
            }

            // Rating summary fetch
            try {
              const sum = await reviewService.getProductRatingSummary(p.id);
              if (sum && Number(sum.total_reviews) > 0) {
                ratingEntries[String(p.id)] = {
                  average: Number(sum.average_rating) || 0,
                  count: Number(sum.total_reviews) || 0,
                };
              }
            } catch {
              // Graceful fallback
            }
          })
        );
        setStockMap(stockEntries);
        setRatingMap(ratingEntries);
      } else {
        setProducts([]);
      }
    } catch {
      // In case of microservice error or no products
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const variant = product.variants?.[0];
    const price =
      product.min_price !== undefined && product.min_price !== null
        ? Number(product.min_price)
        : variant?.price !== undefined
        ? Number(variant.price)
        : 0;
    const img = product.primary_image || product.images?.[0]?.image_url || '';

    dispatch(
      addToCart({
        productId: Number(product.id),
        variantId: variant ? Number(variant.id) : 1,
        sku: variant?.sku || `SKU-${product.id}`,
        name: product.name,
        variantName: variant?.variant_name || 'Standard',
        price,
        imageUrl: img,
        sellerId: product.seller_id,
        quantity: 1,
        maxStock: stockMap[String(product.id)]?.available || 99,
      })
    );

    setAddedItems((prev) => ({ ...prev, [String(product.id)]: true }));
    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [String(product.id)]: false }));
    }, 2000);
  };

  const categories = ['All', 'Electronics', 'Wearables', 'Accessories', 'Lifestyle', 'Footwear', 'Home Living'];

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      p.categories?.some((c) => c.name.toLowerCase().includes(selectedCategory.toLowerCase()));
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-screen">
      {/* Top Welcome / Logged-in Banner */}
      {!isInitialLoading && isAuthenticated && user && (
        <section className="bg-indigo-50/70 border-b border-indigo-100/80 px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-slate-800">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs shadow-xs">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <span>
                Hello, <strong className="font-semibold text-slate-900">{user.displayName}</strong>! Welcome to the marketplace.
              </span>
              {isSeller && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                  <Store className="h-3 w-3" /> Seller Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition"
              >
                <User className="h-3.5 w-3.5" />
                <span>Seller Dashboard & Profile</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Hero Banner Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 text-white shadow-md">
        <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="max-w-2xl space-y-5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-xs font-semibold tracking-wide backdrop-blur-md border border-white/20 text-indigo-100">
              <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
              <span>CloudStore Multi-Vendor E-Commerce</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Buy & Sell Authentic Products Directly
            </h1>

            <p className="text-base sm:text-lg text-indigo-100 font-normal max-w-xl">
              Open to everyone! Registered users and guests can browse products. Sellers can list products and manage their online catalog in real time.
            </p>

            {/* CTAs based on Logged-in / Guest status */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              {isAuthenticated && user ? (
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-indigo-700 shadow-lg shadow-indigo-950/15 transition-all hover:bg-indigo-50 hover:scale-[1.02]"
                >
                  <PackagePlus className="h-4 w-4" />
                  <span>{isSeller ? 'Manage My Products' : 'Add Products / Become Seller'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-indigo-700 shadow-lg shadow-indigo-950/15 transition-all hover:bg-indigo-50 hover:scale-[1.02]"
                  >
                    <span>Sign In to Sell or Buy</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/30 px-6 py-3 text-sm font-bold text-white border border-white/30 backdrop-blur-md transition-all hover:bg-indigo-500/50"
                  >
                    <span>Create Free Account</span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Quick Search Card */}
          <div className="w-full lg:max-w-md bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span>Search Marketplace</span>
            </h3>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands, or keywords..."
                className="w-full rounded-xl bg-white py-3 pl-4 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-300 shadow-sm"
              />
              <Search className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-indigo-100">
              <span>Publicly available for all registered and unregistered visitors</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-white border-b border-slate-200/80 py-5 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Free Express Delivery</p>
              <p className="text-[11px] text-slate-500">Orders above $49</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">100% Secure Checkout</p>
              <p className="text-[11px] text-slate-500">Protected with SSL</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shrink-0">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">30-Day Easy Returns</p>
              <p className="text-[11px] text-slate-500">No questions asked</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shrink-0">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">24/7 Priority Support</p>
              <p className="text-[11px] text-slate-500">Dedicated assistance</p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Catalog Section */}
      <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8 flex-1">
        {/* Section Header & Category Pills */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Storefront Catalog</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Browse Available Products
            </h2>
          </div>

          {/* Category Filter Pills & Refresh */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => loadProducts()}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
              title="Refresh Catalog"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-200">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Loading products from store...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Explicit empty state as requested: "if there are not pruducts just say there are not products" */
          <div className="text-center py-20 px-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
              <PackageX className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-800">There are no products</h3>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {searchQuery || selectedCategory !== 'All'
                ? 'No products matched your search or category filter. Try clearing filters or browsing all.'
                : 'There are currently no products available in the store. Sellers can add products through their profile.'}
            </p>
            {isAuthenticated ? (
              <Link
                href="/profile"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                <PackagePlus className="h-4 w-4" />
                <span>Go to Profile & Add Product</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                <span>Sign in to Put Up Products for Sale</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ) : (
          /* Product Cards Grid with Links to Dedicated Product Page */
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const price =
                product.min_price !== undefined && product.min_price !== null
                  ? Number(product.min_price)
                  : product.variants?.[0]?.price !== undefined
                  ? Number(product.variants[0].price)
                  : 0;
              const img =
                product.primary_image ||
                product.images?.[0]?.image_url ||
                '';

              return (
                <div
                  key={product.id}
                  className="group flex flex-col rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-xs hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Image & Clickable link to Product Page */}
                  <Link href={`/products/${product.id}`} className="block relative aspect-4/3 w-full overflow-hidden bg-slate-100">
                    {img ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={img}
                        alt={product.name}
                        className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 bg-slate-100">
                        <ShoppingBag className="h-10 w-10 text-slate-300 mb-1" />
                        <span className="text-xs font-semibold">CloudStore Product</span>
                      </div>
                    )}

                    <span className="absolute left-3 top-3 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
                      {product.brand || 'Store Item'}
                    </span>
                  </Link>

                  {/* Product Info */}
                  <div className="flex flex-1 flex-col p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-indigo-600 uppercase tracking-wider text-[11px]">
                        {product.categories?.[0]?.name || 'Catalog'}
                      </span>
                      <div className="flex items-center gap-1 text-amber-500 font-bold">
                        <Star className="h-3.5 w-3.5 fill-amber-400" />
                        <span>
                          {ratingMap[String(product.id)]
                            ? ratingMap[String(product.id)].average.toFixed(1)
                            : 'New'}
                        </span>
                        <span className="text-slate-400 font-normal">
                          ({ratingMap[String(product.id)] ? ratingMap[String(product.id)].count : 0})
                        </span>
                      </div>
                    </div>

                    <Link href={`/products/${product.id}`}>
                      <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1 group-hover:text-indigo-600 transition">
                        {product.name}
                      </h3>
                    </Link>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {product.description || 'Premium build quality with warranty and original accessories.'}
                    </p>

                    {/* Live Inventory Status from Microservice */}
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                      {(stockMap[String(product.id)]?.available ?? 10) <= 0 ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                          <AlertTriangle className="h-3 w-3" /> Out of Stock
                        </span>
                      ) : (stockMap[String(product.id)]?.isLow) ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                          <Boxes className="h-3 w-3 text-amber-600" /> Only {stockMap[String(product.id)]?.available} left!
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          <Boxes className="h-3 w-3 text-emerald-600" /> In Stock ({stockMap[String(product.id)]?.available ?? 10})
                        </span>
                      )}
                    </div>

                    {/* Pricing & Actions */}
                    <div className="pt-2 mt-auto flex items-center justify-between border-t border-slate-100">
                      <div>
                        <span className="text-xs text-slate-400">Price</span>
                        <p className="text-lg font-black text-slate-900">
                          ${price.toFixed(2)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/products/${product.id}`}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                        >
                          View
                        </Link>
                        <button
                          onClick={(e) => handleAddToCart(product, e)}
                          disabled={(stockMap[String(product.id)]?.available ?? 10) <= 0}
                          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-xs ${
                            (stockMap[String(product.id)]?.available ?? 10) <= 0
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              : addedItems[String(product.id)]
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                          }`}
                        >
                          {(stockMap[String(product.id)]?.available ?? 10) <= 0 ? (
                            <span>Sold Out</span>
                          ) : addedItems[String(product.id)] ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="h-3.5 w-3.5" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white py-8 px-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <ShoppingBag className="h-4 w-4 text-indigo-600" />
            <span>CloudStore Microservices Platform</span>
          </div>
          <p>© 2026 CloudStore E-Commerce. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
