import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  productId: number;
  variantId: number;
  sku: string;
  name: string;
  variantName?: string;
  price: number;
  imageUrl?: string;
  sellerId?: string;
  quantity: number;
  maxStock?: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

const loadCartFromStorage = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('ecommerce_cart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveCartToStorage = (items: CartItem[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('ecommerce_cart', JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
};

const initialState: CartState = {
  items: [],
  isOpen: false,
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    hydrateCart: (state) => {
      state.items = loadCartFromStorage();
    },

    addToCart: (state, action: PayloadAction<CartItem>) => {
      const existing = state.items.find(
        (i) => i.productId === action.payload.productId && i.variantId === action.payload.variantId
      );

      if (!existing) {
        // Only add if item is not already present in the cart
        state.items.push(action.payload);
      }
      saveCartToStorage(state.items);
      state.isOpen = true; // Auto open cart to confirm addition
    },

    removeFromCart: (
      state,
      action: PayloadAction<{ productId: number; variantId: number }>
    ) => {
      state.items = state.items.filter(
        (i) => !(i.productId === action.payload.productId && i.variantId === action.payload.variantId)
      );
      saveCartToStorage(state.items);
    },

    updateQuantity: (
      state,
      action: PayloadAction<{ productId: number; variantId: number; quantity: number }>
    ) => {
      const item = state.items.find(
        (i) => i.productId === action.payload.productId && i.variantId === action.payload.variantId
      );
      if (item) {
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter(
            (i) => !(i.productId === action.payload.productId && i.variantId === action.payload.variantId)
          );
        } else {
          const max = item.maxStock ?? 99;
          item.quantity = Math.min(action.payload.quantity, max);
        }
      }
      saveCartToStorage(state.items);
    },

    clearCart: (state) => {
      state.items = [];
      saveCartToStorage([]);
    },

    openCart: (state) => {
      state.isOpen = true;
    },

    closeCart: (state) => {
      state.isOpen = false;
    },

    toggleCart: (state) => {
      state.isOpen = !state.isOpen;
    },
  },
});

export const {
  hydrateCart,
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  openCart,
  closeCart,
  toggleCart,
} = cartSlice.actions;

export default cartSlice.reducer;
