import { useState, useEffect } from 'react';
import { FileText, Eye, Search, Plus, AlertCircle, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';

interface ProformaInvoice {
  id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string;
  status: 'pending' | 'paid' | 'cancelled' | 'overdue';
  bill_to_company_name: string;
  bill_to_contact_person: string;
  total_amount: number;
  currency: string;
  quotation_id: string | null;
  created_at: string;
  quotation?: { quotation_no: string };
}

interface ProformaInvoicesPageProps {
  onViewInvoice?: (invoiceId: string) => void;
  onConvertFromQuotation?: (quotationId: string) => void;
}

export function ProformaInvoicesPage({ onViewInvoice, onConvertFromQuotation }: ProformaInvoicesPageProps) {
  const { currentCompany, companies, permissions, switchCompany } = useCompany();
  const [invoices, setInvoices] = useState<ProformaInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const canCreate = permissions?.quotations?.create ?? false;
  const canRead = permissions?.quotations?.read ?? false;

  useEffect(() => {
    if (currentCompany && permissions) {
      loadInvoices();
    }
  }, [currentCompany, permissions]);

  const loadInvoices = async () => {
    if (!currentCompany || !canRead) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('proforma_invoices')
      .select(`
        *,
        quotation:quotations(quotation_no)
      `)
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading proforma invoices:', error);
      setLoading(false);
      return;
    }

    setInvoices(data || []);
    setLoading(false);
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.bill_to_company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.bill_to_contact_person || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === 'PHP' ? '₱' : currency === 'USD' ? '$' : currency;
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!canRead) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-slate-600">You don't have permission to view proforma invoices.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proforma Invoices</h1>
          <p className="text-sm text-slate-600 mt-1">Manage client invoices and billing</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by invoice number, client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            {companies.length > 1 && (
              <select
                value={currentCompany?.id || ''}
                onChange={(e) => {
                  if (e.target.value && switchCompany) {
                    switchCompany(e.target.value);
                  }
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
            <p className="text-slate-600 mt-4">Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No invoices found</h3>
            <p className="text-slate-600 mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Convert a quotation to create your first proforma invoice'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Invoice No.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Invoice Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Quotation
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-slate-400 mr-2" />
                        <span className="font-medium text-slate-900">{invoice.invoice_no}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900">{invoice.bill_to_company_name}</div>
                      {invoice.bill_to_contact_person && (
                        <div className="text-sm text-slate-500">{invoice.bill_to_contact_person}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {formatCurrency(invoice.total_amount, invoice.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {invoice.quotation?.quotation_no || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => onViewInvoice?.(invoice.id)}
                        className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
