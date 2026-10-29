'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import axios from 'axios';
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
  SlidersHorizontal,
  Store,
  CheckCircle2,
  Sparkles,
  Heart,
  Eye,
  Check,
} from 'lucide-react';

interface ProductItem {
  id: string | number;
  name: string;
  slug: string;
  description?: string;
  brand?: string;
  primary_image?: string;
  min_price?: number;
  max_price?: number;
  currency?: string;
  categories?: Array<{ id: number; name: string }>;
  rating?: number;
  reviewsCount?: number;
  badge?: string;
  seller_id?: string;
}

// Fallback high-quality curated showcase products
const curatedProducts: ProductItem[] = [
  {
    id: 'f1',
    name: 'AcousticPro Wireless Noise-Cancelling Headphones',
    slug: 'acousticpro-wireless-headphones',
    description: 'High-fidelity audio with active noise cancellation and 40-hour battery life.',
    brand: 'SoundCraft',
    primary_image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    min_price: 149.99,
    max_price: 199.99,
    currency: 'USD',
    categories: [{ id: 1, name: 'Electronics' }],
    rating: 4.9,
    reviewsCount: 238,
    badge: 'Bestseller',
  },
  {
    id: 'f2',
    name: 'SmartPulse Pro Waterproof Fitness Tracker',
    slug: 'smartpulse-fitness-tracker',
    description: 'Track heart rate, sleep quality, and daily fitness metrics with AMOLED display.',
    brand: 'PulseTech',
    primary_image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    min_price: 89.0,
    max_price: 109.0,
    currency: 'USD',
    categories: [{ id: 1, name: 'Wearables' }],
    rating: 4.8,
    reviewsCount: 184,
    badge: 'Popular',
  },
  {
    id: 'f3',
    name: 'ErgoComfort Minimalist Mechanical Keyboard',
    slug: 'ergocomfort-mechanical-keyboard',
    description: 'Custom hot-swappable linear switches with per-key RGB backlighting.',
    brand: 'KeyVibe',
    primary_image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    min_price: 119.5,
    max_price: 139.5,
    currency: 'USD',
    categories: [{ id: 2, name: 'Accessories' }],
    rating: 4.7,
    reviewsCount: 95,
  },
  {
    id: 'f4',
    name: 'EcoClean Stainless Insulated Thermal Bottle (1L)',
    slug: 'ecoclean-thermal-bottle',
    description: 'Double-wall vacuum insulation keeps liquids cold for 24h and hot for 12h.',
    brand: 'HydroLife',
    primary_image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80',
    min_price: 34.99,
    max_price: 34.99,
    currency: 'USD',
    categories: [{ id: 3, name: 'Lifestyle' }],
    rating: 4.9,
    reviewsCount: 312,
    badge: 'Eco Friendly',
  },
  {
    id: 'f5',
    name: 'AeroGlide Ultra-Light Carbon Fiber Running Shoes',
    slug: 'aeroglide-running-shoes',
    description: 'Propulsive carbon plate engineered for marathon pacing and everyday comfort.',
    brand: 'StrideCore',
    primary_image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    min_price: 129.99,
    max_price: 159.99,
    currency: 'USD',
    categories: [{ id: 4, name: 'Footwear' }],
    rating: 4.8,
    reviewsCount: 420,
    badge: 'Top Rated',
  },
  {
    id: 'f6',
    name: 'Lumix Aura Smart RGB Ambient Desk Lamp',
    slug: 'lumix-aura-smart-lamp',
    description: 'App-controlled tunable lighting with circadian rhythm synchronization.',
    brand: 'GlowHaus',
    primary_image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80',
    min_price: 59.99,
    max_price: 69.99,
    currency: 'USD',
    categories: [{ id: 5, name: 'Home Living' }],
    rating: 4.6,
    reviewsCount: 82,
  },
];

export default function Home() {
  const { user, isAuthenticated, isInitialLoading } = useAuth();
  const [products, setProducts] = useState<ProductItem[]>(curatedProducts);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});

  // Fetch live products from Product microservice
  useEffect(() => {
    const fetchLiveProducts = async () => {
      try {
        const productUrl =
          process.env.NEXT_PUBLIC_PRODUCT_API_URL || 'http://localhost:4001/api/products';
        const res = await axios.get(productUrl, { timeout: 3000 });
        if (res.data?.success && Array.isArray(res.data?.data?.products) && res.data.data.products.length > 0) {
          const liveList = res.data.data.products.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            description: p.description,
            brand: p.brand,
            primary_image: p.primary_image || curatedProducts[0].primary_image,
            min_price: Number(p.min_price) || 49.99,
            max_price: Number(p.max_price) || 49.99,
            currency: p.currency || 'USD',
            categories: p.categories || [{ name: 'Catalog' }],
            rating: 4.9,
            reviewsCount: 14,
            badge: 'New Arrival',
            seller_id: p.seller_id,
          }));
          setProducts(liveList);
        }
      } catch {
        // Product microservice offline or empty; fallback curated items remain active
      }
    };

    fetchLiveProducts();
  }, []);

  const handleAddToCart = (id: string | number) => {
    setAddedItems((prev) => ({ ...prev, [String(id)]: true }));
    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [String(id)]: false }));
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
    <div className="flex-1 bg-slate-50 flex flex-col">
      {/* Top Welcome / Logged-in Banner (Like Amazon, Shopify) */}
      {!isInitialLoading && isAuthenticated && user && (
        <section className="bg-indigo-50/70 border-b border-indigo-100/80 px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-slate-800">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs shadow-xs">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <span>
                Hello, <strong className="font-semibold text-slate-900">{user.displayName}</strong>! Welcome to your shopping portal.
              </span>
              {user.roles?.includes('seller') && (
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
                <span>Go to My Profile</span>
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
              <span>Autumn Tech & Lifestyle Sale — Up to 40% Off</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Discover Next-Gen Gear & Daily Essentials
            </h1>

            <p className="text-base sm:text-lg text-indigo-100 font-normal max-w-xl">
              Explore thousands of verified products from top creators and independent sellers.
              Fast delivery, secure payments, and hassle-free returns.
            </p>

            {/* CTAs based on Logged-in / Guest status */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              {isAuthenticated && user ? (
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-indigo-700 shadow-lg shadow-indigo-950/15 transition-all hover:bg-indigo-50 hover:scale-[1.02]"
                >
                  <User className="h-4 w-4" />
                  <span>View Account & Profile</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-indigo-700 shadow-lg shadow-indigo-950/15 transition-all hover:bg-indigo-50 hover:scale-[1.02]"
                  >
                    <span>Sign In to Shop</span>
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

          {/* Quick Search & Promo Highlight */}
          <div className="w-full lg:max-w-md bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span>Search Storefront</span>
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
              <span>Popular: Headphones, Smartwatches, Keyboards</span>
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
      <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Section Header & Category Pills */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Trending Catalog</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Featured Products & Deals
            </h2>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
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

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="group flex flex-col rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-xs hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1 transition-all duration-300"
            >
              {/* Image & Badges */}
              <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-100">
                <img
                  src={product.primary_image || curatedProducts[0].primary_image}
                  alt={product.name}
                  className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />

                {product.badge && (
                  <span className="absolute left-3 top-3 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
                    {product.badge}
                  </span>
                )}

                <button
                  aria-label="Wishlist"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-md text-slate-600 shadow-xs hover:bg-white hover:text-rose-500 transition"
                >
                  <Heart className="h-4 w-4" />
                </button>
              </div>

              {/* Product Info */}
              <div className="flex flex-1 flex-col p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-indigo-600 uppercase tracking-wider text-[11px]">
                    {product.brand || 'CloudStore'}
                  </span>
                  <div className="flex items-center gap-1 text-amber-500 font-bold">
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    <span>{product.rating || 4.8}</span>
                    <span className="text-slate-400 font-normal">({product.reviewsCount || 42})</span>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1 group-hover:text-indigo-600 transition">
                  {product.name}
                </h3>

                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {product.description || 'Premium build quality with warranty and original accessories.'}
                </p>

                {/* Pricing & Add to Cart */}
                <div className="pt-2 mt-auto flex items-center justify-between border-t border-slate-100">
                  <div>
                    <span className="text-xs text-slate-400">Price</span>
                    <p className="text-lg font-black text-slate-900">
                      ${Number(product.min_price || 49.99).toFixed(2)}
                    </p>
                  </div>

                  <button
                    onClick={() => handleAddToCart(product.id)}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs ${
                      addedItems[String(product.id)]
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 hover:shadow-md'
                    }`}
                  >
                    {addedItems[String(product.id)] ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>Add to Cart</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer Banner */}
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
