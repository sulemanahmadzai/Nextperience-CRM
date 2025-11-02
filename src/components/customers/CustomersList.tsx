import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import type { Customer } from '../../lib/database.types';
import { Plus, Search, Mail, Phone, Building, Calendar } from 'lucide-react';
import { CustomerModal } from './CustomerModal';

export function CustomersList() {
  const { currentCompany, permissions } = useCompany();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (currentCompany) {
      loadCustomers();
    }
  }, [currentCompany]);

  const loadCustomers = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (data) {
      setCustomers(data);
    }
    setLoading(false);
  };

  const filteredCustomers = customers.filter(customer => {
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.company_name?.toLowerCase().includes(query)
    );
  });

  const handleCreateCustomer = () => {
    setSelectedCustomer(null);
    setIsModalOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleModalClose = (shouldRefresh?: boolean) => {
    setIsModalOpen(false);
    setSelectedCustomer(null);
    if (shouldRefresh) {
      loadCustomers();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-600">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        {permissions?.customers.create && (
          <button
            onClick={handleCreateCustomer}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        )}
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customers by name, email, or phone..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => (
          <div
            key={customer.id}
            onClick={() => handleEditCustomer(customer)}
            className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-slate-900">{customer.name}</h3>
              {customer.tags.length > 0 && (
                <div className="flex gap-1">
                  {customer.tags.slice(0, 2).map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {customer.company_name && (
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                <Building className="w-4 h-4" />
                <span>{customer.company_name}</span>
              </div>
            )}

            {customer.email && (
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                <Mail className="w-4 h-4" />
                <span className="truncate">{customer.email}</span>
              </div>
            )}

            {customer.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                <Phone className="w-4 h-4" />
                <span>{customer.phone}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-200">
              <Calendar className="w-3 h-3" />
              <span>Added {new Date(customer.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-600">
            {searchQuery ? 'No customers found matching your search.' : 'No customers yet.'}
          </p>
        </div>
      )}

      {isModalOpen && (
        <CustomerModal
          customer={selectedCustomer}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
