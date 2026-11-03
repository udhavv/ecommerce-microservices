// 'use client';

// import React, { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import {
//   X,
//   ShoppingBag,
//   Trash2,
//   Plus,
//   Minus,
//   ArrowRight,
//   ShieldCheck,
//   CreditCard,
//   Truck,
//   CheckCircle2,
//   AlertCircle,
//   Loader2,
//   Sparkles,
// } from 'lucide-react';
// import { useAppDispatch, useAppSelector } from '@/store/hooks';
// import {
//   closeCart,
//   removeFromCart,
//   updateQuantity,
//   clearCart,
//   hydrateCart,
// } from '@/store/slices/cartSlice';
// import { useAuth } from '@/hooks/use-auth';
// import orderService from '@/services/order.service';
// import paymentService from '@/services/payment.service';
// import { ShippingAddress } from '@/types/order';
// import { PaymentMethod, MockAction } from '@/types/payment';

// type CheckoutStep = 'cart' | 'checkout' | 'receipt';

// const TEST_CARDS = [
//   {
//     label: 'Success (4242)',
//     number: '4242 4242 4242 4242',
//     action: 'SUCCESS' as MockAction,
//     color: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
//     desc: 'Approved immediately',
//   },
//   {
//     label: 'Decline (0002)',
//     number: '4000 0000 0000 0002',
//     action: 'DECLINE' as MockAction,
//     color: 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100',
//     desc: 'Card declined by bank',
//   },
//   {
//     label: 'Low Funds (0999)',
//     number: '4000 0000 0000 0999',
//     action: 'INSUFFICIENT_FUNDS' as MockAction,
//     color: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
//     desc: 'Insufficient balance',
//   },
//   {
//     label: 'Expired (0004)',
//     number: '4000 0000 0000 0004',
//     action: 'EXPIRED_CARD' as MockAction,
//     color: 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100',
//     desc: 'Card has expired',
//   },
// ];

// export default function CartDrawer() {
//   const dispatch = useAppDispatch();
//   const router = useRouter();
//   const { user, isAuthenticated } = useAuth();
//   const { items, isOpen } = useAppSelector((state) => state.cart);

//   // Client hydration guard
//   const [mounted, setMounted] = useState(false);

//   const [step, setStep] = useState<CheckoutStep>('cart');
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);

//   // Track pending order for payment retry scenarios
//   const [pendingOrder, setPendingOrder] = useState<{
//     id: number;
//     orderNumber: string;
//   } | null>(null);

//   // Completed Order Receipt details
//   const [completedOrder, setCompletedOrder] = useState<{
//     orderNumber: string;
//     orderId: string | number;
//     totalAmount: number;
//     transactionId?: string;
//   } | null>(null);

//   // Shipping Address Form State
//   const [address, setAddress] = useState<ShippingAddress>({
//     street: '123 Market Boulevard, Suite 400',
//     city: 'San Francisco',
//     state: 'CA',
//     postal_code: '94105',
//     country: 'United States',
//     phone: '+1 (555) 234-5678',
//   });

//   const [customerName, setCustomerName] = useState(user?.displayName || '');
//   const [customerEmail, setCustomerEmail] = useState(user?.email || '');

//   // Payment Form State
//   const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MOCK_CARD');
//   const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
//   const [expiry, setExpiry] = useState('12/28');
//   const [cvv, setCvv] = useState('123');
//   const [mockAction, setMockAction] = useState<MockAction>('SUCCESS');

//   // Hydrate cart from localStorage on client mount
//   useEffect(() => {
//     setMounted(true);
//     dispatch(hydrateCart());
//   }, [dispatch]);

//   // Sync user info into contact form
//   useEffect(() => {
//     if (user) {
//       if (!customerName && user.displayName) setCustomerName(user.displayName);
//       if (!customerEmail && user.email) setCustomerEmail(user.email);
//     }
//   }, [user, customerName, customerEmail]);

//   // Lock body scroll when cart is open
//   useEffect(() => {
//     if (isOpen) {
//       document.body.style.overflow = 'hidden';
//     } else {
//       document.body.style.overflow = '';
//     }
//     return () => {
//       document.body.style.overflow = '';
//     };
//   }, [isOpen]);

//   // Calculations
//   const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
//   const shippingFee = subtotal >= 50 || subtotal === 0 ? 0 : 5.0;
//   const taxAmount = Math.round(subtotal * 0.08 * 100) / 100;
//   const totalAmount = Math.round((subtotal + shippingFee + taxAmount) * 100) / 100;

//   // Prevent SSR hydration mismatch
//   if (!mounted || !isOpen) return null;

//   const handleSelectPresetCard = (preset: (typeof TEST_CARDS)[0]) => {
//     setCardNumber(preset.number);
//     setMockAction(preset.action);
//     setPaymentMethod('MOCK_CARD');
//   };

//   const handleStartCheckout = () => {
//     if (!isAuthenticated) {
//       dispatch(closeCart());
//       router.push('/login');
//       return;
//     }
//     setErrorMessage(null);
//     setStep('checkout');
//   };

//   const handleProcessOrderAndPayment = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (items.length === 0) return;

//     setIsSubmitting(true);
//     setErrorMessage(null);

//     try {
//       // 1. Create or reuse existing pending order (to prevent double reservation on retry)
//       let currentOrder = pendingOrder;
//       if (!currentOrder) {
//         const orderPayload = {
//           items: items.map((i) => ({
//             product_id: i.productId,
//             variant_id: i.variantId,
//             quantity: i.quantity,
//           })),
//           shipping_address: address,
//           customer_name: customerName || user?.displayName || 'Customer',
//           customer_email: customerEmail || user?.email || 'customer@example.com',
//         };

//         const createdOrder = await orderService.createOrder(orderPayload);
//         currentOrder = {
//           id: Number(createdOrder.id),
//           orderNumber: createdOrder.order_number,
//         };
//         setPendingOrder(currentOrder);
//       }

//       // 2. Process Mock Payment
//       const paymentPayload = {
//         order_id: currentOrder.id,
//         order_number: currentOrder.orderNumber,
//         amount: totalAmount,
//         currency: 'USD',
//         payment_method: paymentMethod,
//         card_number: cardNumber.replace(/\s+/g, ''),
//         expiry,
//         cvv,
//         mock_action: mockAction,
//       };

//       const paymentResult = await paymentService.processPayment(paymentPayload);

//       if (paymentResult.status === 'FAILED') {
//         throw new Error(
//           paymentResult.failure_reason ||
//             'Payment was declined by mock gateway. Choose the Success card preset and retry.'
//         );
//       }

//       // 3. Clear cart & transition to receipt
//       dispatch(clearCart());
//       setPendingOrder(null);
//       setCompletedOrder({
//         orderNumber: currentOrder.orderNumber,
//         orderId: currentOrder.id,
//         totalAmount,
//         transactionId: paymentResult.gateway_transaction_id || undefined,
//       });
//       setStep('receipt');
//     } catch (err: unknown) {
//       const msg = err instanceof Error ? err.message : 'Checkout failed';
//       setErrorMessage(msg);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 overflow-hidden">
//       {/* Backdrop */}
//       <div
//         className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
//         onClick={() => dispatch(closeCart())}
//       />

//       <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
//         <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
//           {/* Header */}
//           <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
//             <div className="flex items-center gap-2">
//               <ShoppingBag className="h-5 w-5 text-indigo-600" />
//               <h2 className="text-lg font-bold text-slate-900">
//                 {step === 'cart' && `Shopping Cart (${items.length})`}
//                 {step === 'checkout' && 'Checkout & Mock Payment'}
//                 {step === 'receipt' && 'Order Confirmed!'}
//               </h2>
//             </div>
//             <button
//               onClick={() => dispatch(closeCart())}
//               className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
//               aria-label="Close cart"
//             >
//               <X className="h-5 w-5" />
//             </button>
//           </div>

//           {/* STEP 1: CART ITEMS */}
//           {step === 'cart' && (
//             <>
//               <div className="flex-1 overflow-y-auto p-6 space-y-4">
//                 {items.length === 0 ? (
//                   <div className="flex flex-col items-center justify-center h-full text-center py-12">
//                     <div className="h-16 w-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-4">
//                       <ShoppingBag className="h-8 w-8" />
//                     </div>
//                     <h3 className="text-base font-semibold text-slate-800">Your cart is empty</h3>
//                     <p className="mt-1 text-sm text-slate-500 max-w-xs">
//                       Explore our active marketplace catalog and add items to your cart.
//                     </p>
//                     <button
//                       onClick={() => dispatch(closeCart())}
//                       className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
//                     >
//                       Start Shopping
//                     </button>
//                   </div>
//                 ) : (
//                   items.map((item) => (
//                     <div
//                       key={`${item.productId}-${item.variantId}`}
//                       className="flex gap-4 p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition"
//                     >
//                       {item.imageUrl ? (
//                         <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
//                           {/* eslint-disable-next-line @next/next/no-img-element */}
//                           <img
//                             src={item.imageUrl}
//                             alt={item.name}
//                             className="h-full w-full object-cover"
//                           />
//                         </div>
//                       ) : (
//                         <div className="h-20 w-20 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
//                           <ShoppingBag className="h-6 w-6" />
//                         </div>
//                       )}

//                       <div className="flex flex-1 flex-col justify-between">
//                         <div>
//                           <div className="flex justify-between items-start gap-2">
//                             <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">
//                               {item.name}
//                             </h4>
//                             <button
//                               onClick={() =>
//                                 dispatch(
//                                   removeFromCart({
//                                     productId: item.productId,
//                                     variantId: item.variantId,
//                                   })
//                                 )
//                               }
//                               className="text-slate-400 hover:text-red-500 transition"
//                               title="Remove item"
//                             >
//                               <Trash2 className="h-4 w-4" />
//                             </button>
//                           </div>
//                           {item.variantName && (
//                             <p className="text-xs text-slate-500 mt-0.5">
//                               Variant: <span className="font-medium">{item.variantName}</span>
//                             </p>
//                           )}
//                           <p className="text-xs text-slate-400">SKU: {item.sku}</p>
//                         </div>

//                         <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
//                           <span className="text-sm font-bold text-slate-900">
//                             ${(item.price * item.quantity).toFixed(2)}
//                             {item.quantity > 1 && (
//                               <span className="text-xs font-normal text-slate-500 ml-1">
//                                 (${item.price.toFixed(2)} ea)
//                               </span>
//                             )}
//                           </span>

//                           <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg bg-slate-50 p-0.5">
//                             <button
//                               onClick={() =>
//                                 dispatch(
//                                   updateQuantity({
//                                     productId: item.productId,
//                                     variantId: item.variantId,
//                                     quantity: item.quantity - 1,
//                                   })
//                                 )
//                               }
//                               className="h-6 w-6 rounded flex items-center justify-center bg-white text-slate-600 hover:bg-slate-200 transition shadow-2xs"
//                             >
//                               <Minus className="h-3 w-3" />
//                             </button>
//                             <span className="w-7 text-center text-xs font-bold text-slate-800">
//                               {item.quantity}
//                             </span>
//                             <button
//                               onClick={() =>
//                                 dispatch(
//                                   updateQuantity({
//                                     productId: item.productId,
//                                     variantId: item.variantId,
//                                     quantity: item.quantity + 1,
//                                   })
//                                 )
//                               }
//                               className="h-6 w-6 rounded flex items-center justify-center bg-white text-slate-600 hover:bg-slate-200 transition shadow-2xs"
//                             >
//                               <Plus className="h-3 w-3" />
//                             </button>
//                           </div>
//                         </div>
//                       </div>
//                     </div>
//                   ))
//                 )}
//               </div>

//               {items.length > 0 && (
//                 <div className="border-t border-slate-200/80 bg-slate-50/70 p-6 space-y-4">
//                   <div className="space-y-1.5 text-xs text-slate-600">
//                     <div className="flex justify-between">
//                       <span>Subtotal</span>
//                       <span className="font-semibold text-slate-800">${subtotal.toFixed(2)}</span>
//                     </div>
//                     <div className="flex justify-between">
//                       <span className="flex items-center gap-1">
//                         Shipping
//                         {subtotal >= 50 && (
//                           <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
//                             FREE
//                           </span>
//                         )}
//                       </span>
//                       <span className="font-semibold text-slate-800">
//                         {shippingFee === 0 ? '$0.00' : `$${shippingFee.toFixed(2)}`}
//                       </span>
//                     </div>
//                     <div className="flex justify-between">
//                       <span>Estimated Tax (8%)</span>
//                       <span className="font-semibold text-slate-800">${taxAmount.toFixed(2)}</span>
//                     </div>
//                     <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
//                       <span>Total</span>
//                       <span>${totalAmount.toFixed(2)}</span>
//                     </div>
//                   </div>

//                   <button
//                     onClick={handleStartCheckout}
//                     className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition"
//                   >
//                     <span>Proceed to Checkout</span>
//                     <ArrowRight className="h-4 w-4" />
//                   </button>
//                 </div>
//               )}
//             </>
//           )}

//           {/* STEP 2: CHECKOUT & MOCK PAYMENT */}
//           {step === 'checkout' && (
//             <form onSubmit={handleProcessOrderAndPayment} className="flex-1 flex flex-col overflow-hidden">
//               <div className="flex-1 overflow-y-auto p-6 space-y-5">
//                 {errorMessage && (
//                   <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-2.5 text-xs text-rose-800">
//                     <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
//                     <div>
//                       <p className="font-bold">Payment Error</p>
//                       <p>{errorMessage}</p>
//                     </div>
//                   </div>
//                 )}

//                 {/* Contact info */}
//                 <div>
//                   <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
//                     Customer Information
//                   </h3>
//                   <div className="grid grid-cols-2 gap-3">
//                     <div>
//                       <label className="block text-[11px] font-medium text-slate-600">Full Name</label>
//                       <input
//                         type="text"
//                         required
//                         value={customerName}
//                         onChange={(e) => setCustomerName(e.target.value)}
//                         className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
//                       />
//                     </div>
//                     <div>
//                       <label className="block text-[11px] font-medium text-slate-600">Email Address</label>
//                       <input
//                         type="email"
//                         required
//                         value={customerEmail}
//                         onChange={(e) => setCustomerEmail(e.target.value)}
//                         className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
//                       />
//                     </div>
//                   </div>
//                 </div>

//                 {/* Shipping Address */}
//                 <div>
//                   <div className="flex items-center gap-1.5 mb-2">
//                     <Truck className="h-4 w-4 text-indigo-600" />
//                     <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
//                       Shipping Address
//                     </h3>
//                   </div>
//                   <div className="space-y-2">
//                     <div>
//                       <label className="block text-[11px] font-medium text-slate-600">Street Address</label>
//                       <input
//                         type="text"
//                         required
//                         value={address.street}
//                         onChange={(e) => setAddress({ ...address, street: e.target.value })}
//                         className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
//                       />
//                     </div>
//                     <div className="grid grid-cols-2 gap-2">
//                       <div>
//                         <label className="block text-[11px] font-medium text-slate-600">City</label>
//                         <input
//                           type="text"
//                           required
//                           value={address.city}
//                           onChange={(e) => setAddress({ ...address, city: e.target.value })}
//                           className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
//                         />
//                       </div>
//                       <div>
//                         <label className="block text-[11px] font-medium text-slate-600">State / Region</label>
//                         <input
//                           type="text"
//                           required
//                           value={address.state}
//                           onChange={(e) => setAddress({ ...address, state: e.target.value })}
//                           className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
//                         />
//                       </div>
//                     </div>
//                     <div className="grid grid-cols-2 gap-2">
//                       <div>
//                         <label className="block text-[11px] font-medium text-slate-600">Postal Code</label>
//                         <input
//                           type="text"
//                           required
//                           value={address.postal_code}
//                           onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
//                           className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
//                         />
//                       </div>
//                       <div>
//                         <label className="block text-[11px] font-medium text-slate-600">Phone</label>
//                         <input
//                           type="text"
//                           value={address.phone || ''}
//                           onChange={(e) => setAddress({ ...address, phone: e.target.value })}
//                           className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
//                         />
//                       </div>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Mock Payment Gateway Panel */}
//                 <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
//                   <div className="flex items-center justify-between mb-3">
//                     <div className="flex items-center gap-1.5">
//                       <CreditCard className="h-4 w-4 text-indigo-600" />
//                       <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
//                         Mock Payment Gateway
//                       </h3>
//                     </div>
//                     <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
//                       <Sparkles className="h-3 w-3" /> Sandbox
//                     </span>
//                   </div>

//                   {/* Test Cards Quick Selector */}
//                   <div className="mb-3">
//                     <p className="text-[11px] font-semibold text-slate-700 mb-1.5">
//                       Select Test Scenario Preset:
//                     </p>
//                     <div className="grid grid-cols-2 gap-1.5">
//                       {TEST_CARDS.map((preset) => (
//                         <button
//                           key={preset.action}
//                           type="button"
//                           onClick={() => handleSelectPresetCard(preset)}
//                           className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
//                             mockAction === preset.action
//                               ? 'ring-2 ring-indigo-600 font-bold ' + preset.color
//                               : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
//                           }`}
//                         >
//                           <div className="font-semibold">{preset.label}</div>
//                           <div className="text-[10px] opacity-75">{preset.desc}</div>
//                         </button>
//                       ))}
//                     </div>
//                   </div>

//                   {/* Card Details Inputs */}
//                   <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
//                     <div>
//                       <label className="block text-[11px] font-medium text-slate-600">Card Number</label>
//                       <input
//                         type="text"
//                         value={cardNumber}
//                         onChange={(e) => setCardNumber(e.target.value)}
//                         className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1 text-xs font-mono tracking-wider focus:border-indigo-500 focus:outline-none"
//                       />
//                     </div>
//                     <div className="grid grid-cols-2 gap-2">
//                       <div>
//                         <label className="block text-[11px] font-medium text-slate-600">Expiry (MM/YY)</label>
//                         <input
//                           type="text"
//                           value={expiry}
//                           onChange={(e) => setExpiry(e.target.value)}
//                           className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1 text-xs font-mono focus:border-indigo-500 focus:outline-none"
//                         />
//                       </div>
//                       <div>
//                         <label className="block text-[11px] font-medium text-slate-600">CVV / CVC</label>
//                         <input
//                           type="password"
//                           value={cvv}
//                           maxLength={4}
//                           onChange={(e) => setCvv(e.target.value)}
//                           className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1 text-xs font-mono focus:border-indigo-500 focus:outline-none"
//                         />
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* Footer */}
//               <div className="border-t border-slate-200 bg-white p-4 space-y-2">
//                 <div className="flex justify-between text-sm font-bold text-slate-900">
//                   <span>Total Due</span>
//                   <span className="text-indigo-600">${totalAmount.toFixed(2)}</span>
//                 </div>

//                 <div className="flex gap-2">
//                   <button
//                     type="button"
//                     onClick={() => setStep('cart')}
//                     className="w-1/3 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
//                   >
//                     Back to Cart
//                   </button>
//                   <button
//                     type="submit"
//                     disabled={isSubmitting}
//                     className="w-2/3 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition"
//                   >
//                     {isSubmitting ? (
//                       <>
//                         <Loader2 className="h-4 w-4 animate-spin" />
//                         <span>Processing Payment...</span>
//                       </>
//                     ) : (
//                       <>
//                         <ShieldCheck className="h-4 w-4" />
//                         <span>Pay ${totalAmount.toFixed(2)}</span>
//                       </>
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </form>
//           )}

//           {/* STEP 3: ORDER CONFIRMATION RECEIPT */}
//           {step === 'receipt' && completedOrder && (
//             <div className="flex-1 flex flex-col p-6 items-center justify-center text-center">
//               <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-sm shadow-emerald-200">
//                 <CheckCircle2 className="h-8 w-8" />
//               </div>

//               <h3 className="text-lg font-bold text-slate-900">Order Placed Successfully!</h3>
//               <p className="mt-1 text-xs text-slate-500">
//                 Thank you for your purchase. Your payment was verified and order is now confirmed.
//               </p>

//               <div className="w-full my-6 p-4 rounded-xl border border-slate-200 bg-slate-50/80 text-left space-y-2 text-xs">
//                 <div className="flex justify-between">
//                   <span className="text-slate-500">Order Number</span>
//                   <span className="font-mono font-bold text-indigo-600">
//                     {completedOrder.orderNumber}
//                   </span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-slate-500">Payment Status</span>
//                   <span className="font-bold text-emerald-600">PAID</span>
//                 </div>
//                 {completedOrder.transactionId && (
//                   <div className="flex justify-between">
//                     <span className="text-slate-500">Transaction ID</span>
//                     <span className="font-mono text-[11px] text-slate-700">
//                       {completedOrder.transactionId}
//                     </span>
//                   </div>
//                 )}
//                 <div className="flex justify-between">
//                   <span className="text-slate-500">Amount Settled</span>
//                   <span className="font-bold text-slate-900">
//                     ${completedOrder.totalAmount.toFixed(2)} USD
//                   </span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-slate-500">Estimated Delivery</span>
//                   <span className="font-medium text-slate-800">2-3 Business Days</span>
//                 </div>
//               </div>

//               <div className="w-full space-y-2">
//                 <button
//                   onClick={() => {
//                     dispatch(closeCart());
//                     setStep('cart');
//                     router.push('/profile?tab=orders');
//                   }}
//                   className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
//                 >
//                   View in My Orders
//                 </button>
//                 <button
//                   onClick={() => {
//                     dispatch(closeCart());
//                     setStep('cart');
//                   }}
//                   className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
//                 >
//                   Continue Shopping
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }






















'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Truck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  closeCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  hydrateCart,
} from '@/store/slices/cartSlice';
import { useAuth } from '@/hooks/use-auth';
import orderService from '@/services/order.service';
import paymentService from '@/services/payment.service';
import { ShippingAddress } from '@/types/order';
import { PaymentMethod, MockAction } from '@/types/payment';

type CheckoutStep = 'cart' | 'checkout' | 'receipt';

const TEST_CARDS = [
  {
    label: 'Success (4242)',
    number: '4242 4242 4242 4242',
    action: 'SUCCESS' as MockAction,
    color: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    desc: 'Approved immediately',
  },
  {
    label: 'Decline (0002)',
    number: '4000 0000 0000 0002',
    action: 'DECLINE' as MockAction,
    color: 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100',
    desc: 'Card declined by bank',
  },
  {
    label: 'Low Funds (0999)',
    number: '4000 0000 0000 0999',
    action: 'INSUFFICIENT_FUNDS' as MockAction,
    color: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
    desc: 'Insufficient balance',
  },
  {
    label: 'Expired (0004)',
    number: '4000 0000 0000 0004',
    action: 'EXPIRED_CARD' as MockAction,
    color: 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100',
    desc: 'Card has expired',
  },
];

const EMPTY_ADDRESS: ShippingAddress = {
  street: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'nepal',
  phone: '',
};

export default function CartDrawer() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { items, isOpen } = useAppSelector((state) => state.cart);

  // Client hydration guard
  const [mounted, setMounted] = useState(false);

  const [step, setStep] = useState<CheckoutStep>('cart');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track pending order for payment retry scenarios
  const [pendingOrder, setPendingOrder] = useState<{
    id: number;
    orderNumber: string;
  } | null>(null);

  // Completed Order Receipt details
  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: string;
    orderId: string | number;
    totalAmount: number;
    transactionId?: string;
  } | null>(null);

  // Shipping Address Form State — empty values, placeholders only
  const [address, setAddress] = useState<ShippingAddress>({ ...EMPTY_ADDRESS });

  const [customerName, setCustomerName] = useState(user?.displayName || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');

  // Payment Form State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MOCK_CARD');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('123');
  const [mockAction, setMockAction] = useState<MockAction>('SUCCESS');

  // Hydrate cart from localStorage on client mount
  useEffect(() => {
    setMounted(true);
    dispatch(hydrateCart());
  }, [dispatch]);

  // Sync user info into contact form (only when empty)
  useEffect(() => {
    if (user) {
      if (!customerName && user.displayName) setCustomerName(user.displayName);
      if (!customerEmail && user.email) setCustomerEmail(user.email);
    }
  }, [user, customerName, customerEmail]);

  // Reset checkout form state whenever the drawer closes or reopens
  useEffect(() => {
    if (!isOpen) {
      setStep('cart');
      setErrorMessage(null);
      setPendingOrder(null);
      setCompletedOrder(null);
      setAddress({ ...EMPTY_ADDRESS });
      setCustomerName(user?.displayName || '');
      setCustomerEmail(user?.email || '');
      setCardNumber('4242 4242 4242 4242');
      setExpiry('12/28');
      setCvv('123');
      setMockAction('SUCCESS');
      setPaymentMethod('MOCK_CARD');
    }
  }, [isOpen, user]);

  // Lock body scroll when cart is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = subtotal >= 50 || subtotal === 0 ? 0 : 5.0;
  const taxAmount = Math.round(subtotal * 0.08 * 100) / 100;
  const totalAmount = Math.round((subtotal + shippingFee + taxAmount) * 100) / 100;

  // Prevent SSR hydration mismatch
  if (!mounted || !isOpen) return null;

  const handleSelectPresetCard = (preset: (typeof TEST_CARDS)[0]) => {
    setCardNumber(preset.number);
    setMockAction(preset.action);
    setPaymentMethod('MOCK_CARD');
  };

  const handleStartCheckout = () => {
    if (!isAuthenticated) {
      dispatch(closeCart());
      router.push('/login');
      return;
    }
    setErrorMessage(null);
    setStep('checkout');
  };

  const handleProcessOrderAndPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Create or reuse existing pending order (to prevent double reservation on retry)
      let currentOrder = pendingOrder;
      if (!currentOrder) {
        const orderPayload = {
          items: items.map((i) => ({
            product_id: i.productId,
            variant_id: i.variantId,
            quantity: i.quantity,
          })),
          shipping_address: address,
          customer_name: customerName || user?.displayName || 'Customer',
          customer_email: customerEmail || user?.email || 'customer@example.com',
        };

        const createdOrder = await orderService.createOrder(orderPayload);
        currentOrder = {
          id: Number(createdOrder.id),
          orderNumber: createdOrder.order_number,
        };
        setPendingOrder(currentOrder);
      }

      // 2. Process Mock Payment
      const paymentPayload = {
        order_id: currentOrder.id,
        order_number: currentOrder.orderNumber,
        amount: totalAmount,
        currency: 'USD',
        payment_method: paymentMethod,
        card_number: cardNumber.replace(/\s+/g, ''),
        expiry,
        cvv,
        mock_action: mockAction,
      };

      const paymentResult = await paymentService.processPayment(paymentPayload);

      if (paymentResult.status === 'FAILED') {
        throw new Error(
          paymentResult.failure_reason ||
            'Payment was declined by mock gateway. Choose the Success card preset and retry.'
        );
      }

      // 3. Clear cart & address details, transition to receipt
      dispatch(clearCart());
      setPendingOrder(null);
      setAddress({ ...EMPTY_ADDRESS });
      setCustomerName('');
      setCustomerEmail('');
      setCardNumber('4242 4242 4242 4242');
      setExpiry('12/28');
      setCvv('123');
      setCompletedOrder({
        orderNumber: currentOrder.orderNumber,
        orderId: currentOrder.id,
        totalAmount,
        transactionId: paymentResult.gateway_transaction_id || undefined,
      });
      setStep('receipt');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => dispatch(closeCart())}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">
                {step === 'cart' && `Shopping Cart (${items.length})`}
                {step === 'checkout' && 'Checkout & Mock Payment'}
                {step === 'receipt' && 'Order Confirmed!'}
              </h2>
            </div>
            <button
              onClick={() => dispatch(closeCart())}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              aria-label="Close cart"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* STEP 1: CART ITEMS */}
          {step === 'cart' && (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="h-16 w-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-4">
                      <ShoppingBag className="h-8 w-8" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800">Your cart is empty</h3>
                    <p className="mt-1 text-sm text-slate-500 max-w-xs">
                      Explore our active marketplace catalog and add items to your cart.
                    </p>
                    <button
                      onClick={() => dispatch(closeCart())}
                      className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                    >
                      Start Shopping
                    </button>
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={`${item.productId}-${item.variantId}`}
                      className="flex gap-4 p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition"
                    >
                      {item.imageUrl ? (
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-20 w-20 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                          <ShoppingBag className="h-6 w-6" />
                        </div>
                      )}

                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">
                              {item.name}
                            </h4>
                            <button
                              onClick={() =>
                                dispatch(
                                  removeFromCart({
                                    productId: item.productId,
                                    variantId: item.variantId,
                                  })
                                )
                              }
                              className="text-slate-400 hover:text-red-500 transition"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          {item.variantName && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              Variant: <span className="font-medium">{item.variantName}</span>
                            </p>
                          )}
                          <p className="text-xs text-slate-400">SKU: {item.sku}</p>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                          <span className="text-sm font-bold text-slate-900">
                            ${(item.price * item.quantity).toFixed(2)}
                            {item.quantity > 1 && (
                              <span className="text-xs font-normal text-slate-500 ml-1">
                                (${item.price.toFixed(2)} ea)
                              </span>
                            )}
                          </span>

                          <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg bg-slate-50 p-0.5">
                            <button
                              onClick={() =>
                                dispatch(
                                  updateQuantity({
                                    productId: item.productId,
                                    variantId: item.variantId,
                                    quantity: item.quantity - 1,
                                  })
                                )
                              }
                              className="h-6 w-6 rounded flex items-center justify-center bg-white text-slate-600 hover:bg-slate-200 transition shadow-2xs"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-7 text-center text-xs font-bold text-slate-800">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                dispatch(
                                  updateQuantity({
                                    productId: item.productId,
                                    variantId: item.variantId,
                                    quantity: item.quantity + 1,
                                  })
                                )
                              }
                              className="h-6 w-6 rounded flex items-center justify-center bg-white text-slate-600 hover:bg-slate-200 transition shadow-2xs"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {items.length > 0 && (
                <div className="border-t border-slate-200/80 bg-slate-50/70 p-6 space-y-4">
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold text-slate-800">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        Shipping
                        {subtotal >= 50 && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                            FREE
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {shippingFee === 0 ? '$0.00' : `$${shippingFee.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Estimated Tax (8%)</span>
                      <span className="font-semibold text-slate-800">${taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                      <span>Total</span>
                      <span>${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleStartCheckout}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* STEP 2: CHECKOUT & MOCK PAYMENT */}
          {step === 'checkout' && (
            <form onSubmit={handleProcessOrderAndPayment} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {errorMessage && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-2.5 text-xs text-rose-800">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Payment Error</p>
                      <p>{errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* Contact info */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600">Full Name</label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="John Doe"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600">Email Address</label>
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Truck className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Shipping Address
                    </h3>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600">Street Address</label>
                      <input
                        type="text"
                        required
                        value={address.street}
                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                        placeholder="123 Market Boulevard, Suite 400"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600">City</label>
                        <input
                          type="text"
                          required
                          value={address.city}
                          onChange={(e) => setAddress({ ...address, city: e.target.value })}
                          placeholder="San Francisco"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600">State / Region</label>
                        <input
                          type="text"
                          required
                          value={address.state}
                          onChange={(e) => setAddress({ ...address, state: e.target.value })}
                          placeholder="CA"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600">Postal Code</label>
                        <input
                          type="text"
                          required
                          value={address.postal_code}
                          onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
                          placeholder="94105"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600">Phone</label>
                        <input
                          type="text"
                          value={address.phone || ''}
                          onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                          placeholder="+1 (555) 234-5678"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mock Payment Gateway Panel */}
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-indigo-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                        Mock Payment Gateway
                      </h3>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      <Sparkles className="h-3 w-3" /> Sandbox
                    </span>
                  </div>

                  {/* Test Cards Quick Selector */}
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold text-slate-700 mb-1.5">
                      Select Test Scenario Preset:
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {TEST_CARDS.map((preset) => (
                        <button
                          key={preset.action}
                          type="button"
                          onClick={() => handleSelectPresetCard(preset)}
                          className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                            mockAction === preset.action
                              ? 'ring-2 ring-indigo-600 font-bold ' + preset.color
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-semibold">{preset.label}</div>
                          <div className="text-[10px] opacity-75">{preset.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card Details Inputs */}
                  <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600">Card Number</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4242 4242 4242 4242"
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1 text-xs font-mono tracking-wider focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600">Expiry (MM/YY)</label>
                        <input
                          type="text"
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                          placeholder="12/28"
                          className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600">CVV / CVC</label>
                        <input
                          type="password"
                          value={cvv}
                          maxLength={4}
                          onChange={(e) => setCvv(e.target.value)}
                          placeholder="123"
                          className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 bg-white p-4 space-y-2">
                <div className="flex justify-between text-sm font-bold text-slate-900">
                  <span>Total Due</span>
                  <span className="text-indigo-600">${totalAmount.toFixed(2)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('cart')}
                    className="w-1/3 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Back to Cart
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-2/3 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing Payment...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Pay ${totalAmount.toFixed(2)}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: ORDER CONFIRMATION RECEIPT */}
          {step === 'receipt' && completedOrder && (
            <div className="flex-1 flex flex-col p-6 items-center justify-center text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-sm shadow-emerald-200">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <h3 className="text-lg font-bold text-slate-900">Order Placed Successfully!</h3>
              <p className="mt-1 text-xs text-slate-500">
                Thank you for your purchase. Your payment was verified and order is now confirmed.
              </p>

              <div className="w-full my-6 p-4 rounded-xl border border-slate-200 bg-slate-50/80 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order Number</span>
                  <span className="font-mono font-bold text-indigo-600">
                    {completedOrder.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Status</span>
                  <span className="font-bold text-emerald-600">PAID</span>
                </div>
                {completedOrder.transactionId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transaction ID</span>
                    <span className="font-mono text-[11px] text-slate-700">
                      {completedOrder.transactionId}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Settled</span>
                  <span className="font-bold text-slate-900">
                    ${completedOrder.totalAmount.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated Delivery</span>
                  <span className="font-medium text-slate-800">2-3 Business Days</span>
                </div>
              </div>

              <div className="w-full space-y-2">
                <button
                  onClick={() => {
                    dispatch(closeCart());
                    setStep('cart');
                    router.push('/profile?tab=orders');
                  }}
                  className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                >
                  View in My Orders
                </button>
                <button
                  onClick={() => {
                    dispatch(closeCart());
                    setStep('cart');
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}