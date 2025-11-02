import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import type { Product } from '../../lib/database.types';
import { Plus, Package } from 'lucide-react';
import ProductModal from './ProductModal';

export function ProductsList() {
  const { currentCompany, permissions } = useCompany();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (currentCompany) {
      loadProducts();
    }
  }, [currentCompany]);

  const loadProducts = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const formatPrice = (price: number, currency: string) => {
    const formattedPrice = parseFloat(String(price)).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (currency === 'PHP') {
      return `₱ ${formattedPrice}`;
    } else if (currency === 'USD') {
      return `$ ${formattedPrice}`;
    } else if (currency === 'EUR') {
      return `€ ${formattedPrice}`;
    }
    return `${formattedPrice} ${currency}`;
  };

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setShowModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
  };

  const handleSaveProduct = () => {
    loadProducts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-600">Loading products...</div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          {permissions?.products.create && (
            <button
              onClick={handleAddProduct}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => permissions?.products.update && handleEditProduct(product)}
              className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Package className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{product.name}</h3>
                  {product.sku && (
                    <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                  )}
                </div>
              </div>

              {product.description && (
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{product.description}</p>
              )}

              <div className="text-lg font-bold text-slate-900">
                {formatPrice(product.price, product.currency)}
              </div>
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-600">No products yet.</p>
          </div>
        )}
      </div>

      {showModal && (
        <ProductModal
          product={selectedProduct}
          onClose={handleCloseModal}
          onSave={handleSaveProduct}
        />
      )}
    </>
  );
}
