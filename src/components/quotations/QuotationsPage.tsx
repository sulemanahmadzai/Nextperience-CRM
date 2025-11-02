import { useState, useEffect } from 'react';
import { FileText, Eye, Search, Filter, Plus, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { Quotation } from '../../lib/database.types';
import { QuotationModal } from './QuotationModal';

interface QuotationWithDetails extends Quotation {
  customer?: { name: string; email: string };
  lead?: { event_name: string };
  creator?: { email: string };
  pendingPayments?: number;
  totalPaid?: number;
  paymentStatus?: 'pending' | 'deposit' | 'paid';
}

interface QuotationsPageProps {
  onViewQuotation?: (quotationId: string) => void;
}

export default function QuotationsPage({ onViewQuotation }: QuotationsPageProps) {
  const { currentCompany, permissions } = useCompany();
  const [quotations, setQuotations] = useState<QuotationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [showQuotationModal, setShowQuotationModal] = useState(false);

  const canCreate = permissions?.quotations?.create ?? false;
  const canRead = permissions?.quotations?.read ?? false;

  useEffect(() => {
    if (currentCompany && permissions) {
      loadQuotations();
    }
  }, [currentCompany, permissions]);

  const loadQuotations = async () => {
    if (!currentCompany || !canRead) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('quotations')
      .select(`
        *,
        customer:customers(name, email),
        lead:leads(event_name),
        creator:users!quotations_created_by_fkey(email)
      `)
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading quotations:', error);
      setLoading(false);
      return;
    }

    const quotationsWithPayments = data || [];

    const isAdmin = permissions?.role?.name === 'Admin';
    const isFinance = permissions?.role?.name === 'Finance Officer';
    const canVerify = isAdmin || isFinance;

    if (quotationsWithPayments.length > 0) {
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('quotation_id, verification_status, is_locked, payment_status, amount')
        .in('quotation_id', quotationsWithPayments.map(q => q.id));

      if (paymentsData) {
        const pendingByQuotation = paymentsData.reduce((acc, payment) => {
          if (canVerify && !payment.is_locked && payment.verification_status !== 'verified' && payment.payment_status === 'paid') {
            acc[payment.quotation_id] = (acc[payment.quotation_id] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const paidByQuotation = paymentsData.reduce((acc, payment) => {
          if (payment.payment_status === 'paid' && payment.verification_status !== 'rejected') {
            acc[payment.quotation_id] = (acc[payment.quotation_id] || 0) + parseFloat(payment.amount);
          }
          return acc;
        }, {} as Record<string, number>);

        quotationsWithPayments.forEach(q => {
          q.pendingPayments = pendingByQuotation[q.id] || 0;
          q.totalPaid = paidByQuotation[q.id] || 0;

          const totalAmount = parseFloat(q.total_amount);
          if (q.totalPaid >= totalAmount - 0.01) {
            q.paymentStatus = 'paid';
          } else if (q.totalPaid > 0) {
            q.paymentStatus = 'deposit';
          } else {
            q.paymentStatus = 'pending';
          }
        });
      }
    }

    setQuotations(quotationsWithPayments);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-slate-100 text-slate-700';
      case 'sent':
        return 'bg-blue-100 text-blue-700';
      case 'accepted':
        return 'bg-emerald-100 text-emerald-700';
      case 'declined':
        return 'bg-red-100 text-red-700';
      case 'paid':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const uniqueCustomers = Array.from(new Set(quotations.map(q => q.customer?.name).filter(Boolean)));
  const uniqueEvents = Array.from(new Set(quotations.map(q => q.lead?.event_name).filter(Boolean)));
  const uniqueCreators = Array.from(new Set(quotations.map(q => q.creator?.email).filter(Boolean)));

  const filteredQuotations = quotations.filter((quotation) => {
    if (statusFilter !== 'all' && quotation.status !== statusFilter) {
      return false;
    }

    if (customerFilter !== 'all' && quotation.customer?.name !== customerFilter) {
      return false;
    }

    if (eventFilter !== 'all' && quotation.lead?.event_name !== eventFilter) {
      return false;
    }

    if (creatorFilter !== 'all' && quotation.creator?.email !== creatorFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const quotationNo = quotation.quotation_no.toLowerCase();
      const customerName = quotation.customer?.name?.toLowerCase() || '';
      const eventName = quotation.lead?.event_name?.toLowerCase() || '';

      return (
        quotationNo.includes(query) ||
        customerName.includes(query) ||
        eventName.includes(query)
      );
    }

    return true;
  });

  const stats = {
    total: quotations.length,
    draft: quotations.filter((q) => q.status === 'draft').length,
    sent: quotations.filter((q) => q.status === 'sent').length,
    accepted: quotations.filter((q) => q.status === 'accepted').length,
    totalValue: quotations
      .filter((q) => q.status === 'accepted' || q.status === 'paid')
      .reduce((sum, q) => sum + q.total_amount, 0),
  };

  if (!permissions || loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-slate-600">Loading quotations...</div>
        </div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-slate-600">You do not have permission to view quotations</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Quotations</h1>
            <p className="text-slate-600">Manage and track all your quotations</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowQuotationModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Quotation
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-sm text-slate-600 mb-1">Total Quotations</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 mb-1">Sent</p>
            <p className="text-2xl font-bold text-blue-700">{stats.sent}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-sm text-emerald-600 mb-1">Accepted</p>
            <p className="text-2xl font-bold text-emerald-700">{stats.accepted}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 mb-1">Total Value</p>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by quotation number, customer, or event..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
                <Filter className="w-5 h-5 text-slate-400 flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="finalized">Finalized</option>
                </select>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-sm"
                >
                  <option value="all">All Customers</option>
                  {uniqueCustomers.map((customer) => (
                    <option key={customer} value={customer!}>{customer}</option>
                  ))}
                </select>
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-sm"
                >
                  <option value="all">All Events</option>
                  {uniqueEvents.map((event) => (
                    <option key={event} value={event!}>{event}</option>
                  ))}
                </select>
                <select
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-sm"
                >
                  <option value="all">All Creators</option>
                  {uniqueCreators.map((creator) => (
                    <option key={creator} value={creator!}>{creator}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {filteredQuotations.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">
                {searchQuery || statusFilter !== 'all'
                  ? 'No quotations found matching your filters'
                  : 'No quotations yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Quotation #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredQuotations.map((quotation) => (
                    <tr key={quotation.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-900">{quotation.quotation_no}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900">{quotation.customer?.name}</p>
                          <p className="text-sm text-slate-500">{quotation.customer?.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-900">{quotation.lead?.event_name || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatDate(quotation.quotation_date)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium w-fit ${
                              quotation.status === 'draft'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {quotation.status === 'draft' ? 'Draft' : 'Finalized'}
                          </span>
                          {quotation.paymentStatus === 'paid' && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 w-fit">
                              Paid
                            </span>
                          )}
                          {quotation.paymentStatus === 'deposit' && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 w-fit">
                              Deposit Made
                            </span>
                          )}
                          {quotation.paymentStatus === 'pending' && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 w-fit">
                              Pending Payment
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(quotation.total_amount)}
                          </span>
                          {quotation.totalPaid && quotation.totalPaid > 0 && (
                            <div className="text-xs text-slate-500 mt-1">
                              Paid {formatCurrency(quotation.totalPaid)} / {formatCurrency(quotation.total_amount)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => onViewQuotation?.(quotation.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
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

      {showQuotationModal && (
        <QuotationModal
          quotation={null}
          onClose={() => setShowQuotationModal(false)}
          onSuccess={() => {
            setShowQuotationModal(false);
            loadQuotations();
          }}
        />
      )}
    </>
  );
}
