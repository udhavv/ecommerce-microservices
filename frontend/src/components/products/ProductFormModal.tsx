'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Product, CreateProductInput, UpdateProductInput, Category } from '@/types/product';
import productService from '@/services/product.service';
import {
  X,
  PackagePlus,
  Edit3,
  DollarSign,
  Tag,
  Building,
  FileText,
  AlertCircle,
  CheckCircle2,
  UploadCloud,
  FileImage,
  RefreshCw,
} from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: Product) => void;
  productToEdit?: Product | null;
}

export default function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  productToEdit,
}: ProductFormModalProps) {
  const isEditing = !!productToEdit;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(productToEdit?.name || '');
  const [brand, setBrand] = useState(productToEdit?.brand || '');
  const [price, setPrice] = useState<string>(
    productToEdit?.min_price !== undefined
      ? String(productToEdit.min_price)
      : productToEdit?.variants?.[0]?.price !== undefined
      ? String(productToEdit.variants[0].price)
      : ''
  );
  const [status, setStatus] = useState<'ACTIVE' | 'DRAFT'>(
    productToEdit?.status === 'ARCHIVED' ? 'DRAFT' : productToEdit?.status || 'ACTIVE'
  );
  const [description, setDescription] = useState(productToEdit?.description || '');
  const [categoryId, setCategoryId] = useState<number | ''>(
    productToEdit?.categories?.[0]?.id ? productToEdit.categories[0].id : ''
  );
  const [initialStock, setInitialStock] = useState<string>('25');
  const [lowStockThreshold, setLowStockThreshold] = useState<string>('5');
  const [categories, setCategories] = useState<Category[]>([]);

  // Image Upload States (Cloudinary)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>(
    productToEdit?.primary_image || productToEdit?.images?.[0]?.image_url || ''
  );
  const [isDragging, setIsDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch categories once on mount
  useEffect(() => {
    let mounted = true;
    productService
      .getCategories()
      .then((cats) => {
        if (mounted && Array.isArray(cats)) {
          setCategories(cats);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (filePreview && filePreview.startsWith('blob:')) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  if (!isOpen) return null;

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, WEBP, GIF, or AVIF).');
      return;
    }

    // Check file size limit (8MB)
    if (file.size > 8 * 1024 * 1024) {
      setError('The image file size must be less than 8MB.');
      return;
    }

    setError(null);
    setSelectedFile(file);
    const localUrl = URL.createObjectURL(file);
    setFilePreview(localUrl);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation: All product details are required and non-nullable
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    if (!brand.trim()) {
      setError('Brand is required.');
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('A valid positive price is required.');
      return;
    }

    if (categoryId === '' || Number(categoryId) <= 0) {
      setError('Please select a product category. Category is required.');
      return;
    }

    if (!description.trim()) {
      setError('Product description is required.');
      return;
    }

    // Image requirement: must have a newly selected file or existing image URL if editing
    if (!selectedFile && !filePreview) {
      setError('Product image is required. Please upload an image file.');
      return;
    }

    try {
      setLoading(true);

      let finalImageUrl = filePreview;
      let finalPublicId: string | undefined = undefined;

      // If the seller selected a new image file, upload it to Cloudinary
      if (selectedFile) {
        setUploadProgressText('Uploading image to Cloudinary storage...');
        const uploadResult = await productService.uploadImage(selectedFile);
        finalImageUrl = uploadResult.image_url;
        finalPublicId = uploadResult.public_id;
      }

      setUploadProgressText('Saving product details in store database...');

      const categoryIds = [Number(categoryId)];

      if (isEditing && productToEdit) {
        const payload: UpdateProductInput = {
          name: name.trim(),
          brand: brand.trim(),
          price: parsedPrice,
          image_url: finalImageUrl,
          public_id: finalPublicId,
          status,
          description: description.trim(),
          category_ids: categoryIds,
        };

        const updated = await productService.updateProduct(productToEdit.id, payload);
        onSuccess(updated);
      } else {
        const payload: CreateProductInput = {
          name: name.trim(),
          brand: brand.trim(),
          price: parsedPrice,
          image_url: finalImageUrl,
          public_id: finalPublicId,
          status,
          description: description.trim(),
          category_ids: categoryIds,
          initial_stock: Math.max(0, parseInt(initialStock, 10) || 10),
          low_stock_threshold: Math.max(0, parseInt(lowStockThreshold, 10) || 5),
        };

        const created = await productService.createProduct(payload);
        onSuccess(created);
      }

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
      setUploadProgressText(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-slate-50 to-indigo-50/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              {isEditing ? <Edit3 className="h-5 w-5" /> : <PackagePlus className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                {isEditing ? 'Edit Product' : 'Add Product to Store'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? 'Update product details, pricing, and upload replacement image'
                  : 'All product details and image upload are required'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Wireless Noise-Cancelling Headphones"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            {/* Brand */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-slate-400" />
                Brand / Manufacturer <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Sony, Apple, Nike"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                Price (USD) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="49.99"
                  className="w-full rounded-xl border border-slate-200 pl-8 pr-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">-- Select Category (Required) --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Listing Status <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'DRAFT')}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="ACTIVE">ACTIVE (Published in Store)</option>
                <option value="DRAFT">DRAFT (Hidden / Work in Progress)</option>
              </select>
            </div>

            {/* Inventory Stock Levels (Only for new products) */}
            {!isEditing && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Initial Available Stock <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Low-Stock Alert Threshold <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </>
            )}

            {/* Cloudinary Image Upload Section */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileImage className="h-3.5 w-3.5 text-slate-400" />
                  Product Image (Cloudinary Storage) <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">Max size: 8MB (JPEG, PNG, WEBP)</span>
              </label>

              {/* Hidden Native File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {/* Upload Dropzone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                    : filePreview
                    ? 'border-indigo-200 bg-indigo-50/20 hover:border-indigo-400'
                    : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'
                }`}
              >
                {filePreview ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <div className="h-20 w-20 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-300 shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={filePreview}
                        alt="Product preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="text-left text-xs space-y-1">
                      <p className="font-bold text-slate-800">
                        {selectedFile ? selectedFile.name : 'Current Product Image'}
                      </p>
                      <p className="text-slate-500">
                        {selectedFile
                          ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready for Cloudinary upload`
                          : 'Stored on Cloudinary'}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                      >
                        Choose another image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 space-y-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 mb-1">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">
                      Click to browse or drag & drop product image here
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Images are automatically uploaded to Cloudinary on submission
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Product Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide detailed specifications, features, and warranty details..."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
            {uploadProgressText ? (
              <span className="text-xs font-semibold text-indigo-600 flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                {uploadProgressText}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">All fields marked with * are required</span>
            )}

            <div className="flex items-center gap-3 self-end">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : isEditing ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Save Changes</span>
                  </>
                ) : (
                  <>
                    <PackagePlus className="h-4 w-4" />
                    <span>Upload & Put Up for Sale</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
