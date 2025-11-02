import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import type { Customer } from '../../lib/database.types';
import { Search, Plus, X, Check, AlertCircle } from 'lucide-react';

interface CustomerSelectorProps {
  selectedCustomerId: string | null;
  onSelectCustomer: (customer: Customer | null) => void;
  onCreateNew: () => void;
  showCreateNew?: boolean;
}

export function CustomerSelector({
  selectedCustomerId,
  onSelectCustomer,
  onCreateNew,
  showCreateNew = true
}: CustomerSelectorProps) {
  const { currentCompany } = useCompany();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (currentCompany) {
      loadCustomers();
    }
  }, [currentCompany]);

  useEffect(() => {
    if (selectedCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer) {
        setSelectedCustomer(customer);
      }
    }
  }, [selectedCustomerId, customers]);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(term) ||
        customer.email?.toLowerCase().includes(term) ||
        customer.phone?.includes(term) ||
        customer.company_name?.toLowerCase().includes(term)
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchTerm, customers]);

  const loadCustomers = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_archived', false)
      .order('name');

    if (data) {
      setCustomers(data);
      setFilteredCustomers(data);
    }
    setLoading(false);
  };

  const handleSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    onSelectCustomer(customer);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    setSelectedCustomer(null);
    onSelectCustomer(null);
    setSearchTerm('');
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    onCreateNew();
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Customer <span className="text-red-500">*</span>
      </label>

      {selectedCustomer ? (
        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-300 rounded-lg">
          <div className="flex-1">
            <div className="font-medium text-slate-900">{selectedCustomer.name}</div>
            {selectedCustomer.email && (
              <div className="text-sm text-slate-600">{selectedCustomer.email}</div>
            )}
            {selectedCustomer.company_name && (
              <div className="text-xs text-slate-500">{selectedCustomer.company_name}</div>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center gap-2 p-3 border border-slate-300 rounded-lg hover:border-slate-400 transition-colors text-left bg-white"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">Select or search customer...</span>
          </button>

          {isOpen && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
              <div className="p-3 border-b border-slate-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, email, or phone..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {showCreateNew && (
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors border-b border-slate-200"
                  >
                    <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center">
                      <Plus className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-slate-900">Create New Customer</div>
                      <div className="text-xs text-slate-600">Add a new customer record</div>
                    </div>
                  </button>
                )}

                {loading ? (
                  <div className="p-8 text-center text-slate-600">Loading customers...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="p-8 text-center text-slate-600">
                    {searchTerm ? 'No customers found' : 'No customers available'}
                  </div>
                ) : (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => handleSelect(customer)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-slate-700">
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900">{customer.name}</div>
                        {customer.email && (
                          <div className="text-sm text-slate-600 truncate">{customer.email}</div>
                        )}
                        {customer.phone && (
                          <div className="text-xs text-slate-500">{customer.phone}</div>
                        )}
                        {customer.company_name && (
                          <div className="text-xs text-slate-500">{customer.company_name}</div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
