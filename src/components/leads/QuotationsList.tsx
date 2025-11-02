import { useState, useEffect } from 'react';
import { Plus, FileText, Eye, Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Quotation } from '../../lib/database.types';
import { useCompany } from '../../contexts/CompanyContext';
import { supabase } from '../../lib/supabase';
import QuotationModal from '../quotations/QuotationModal';

interface QuotationsListProps {
  leadId: string;
  onViewQuotation?: (quotationId: string) => void;
}

export default function QuotationsList({ leadId, onViewQuotation }: QuotationsListProps) {
  const { permissions } = useCompany();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuotationModal, setShowQuotationModal] = useState(false);

  const canCreate = permissions?.quotations?.create || false;

  useEffect(() => {
    loadQuotations();
  }, [leadId]);

  const loadQuotations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('quotations')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (data) {
      setQuotations(data);
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="w-4 h-4 text-slate-400" />;
      case 'sent':
        return <Send className="w-4 h-4 text-blue-500" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'declined':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
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

  const handleViewQuotation = (quotation: Quotation) => {
    onViewQuotation?.(quotation.id);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Quotations</h3>
          {canCreate && (
            <button
              onClick={() => setShowQuotationModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Quotation
            </button>
          )}
        </div>

        {quotations.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 mb-4">No quotations yet</p>
            {canCreate && (
              <button
                onClick={() => setShowQuotationModal(true)}
                className="text-sm text-slate-900 hover:underline"
              >
                Create your first quotation
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {quotations.map((quotation) => (
              <div
                key={quotation.id}
                className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-slate-900">{quotation.quotation_no}</h4>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(
                          quotation.status
                        )}`}
                      >
                        {getStatusIcon(quotation.status)}
                        {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600">Date:</span>
                        <p className="font-medium text-slate-900">
                          {formatDate(quotation.quotation_date)}
                        </p>
                      </div>
                      {quotation.expiration_date && (
                        <div>
                          <span className="text-slate-600">Expires:</span>
                          <p className="font-medium text-slate-900">
                            {formatDate(quotation.expiration_date)}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-600">Total:</span>
                        <p className="font-semibold text-slate-900 text-base">
                          {formatCurrency(quotation.total_amount)}
                        </p>
                      </div>
                    </div>
                    {quotation.vat_enabled && (
                      <p className="text-xs text-slate-500 mt-2">
                        Includes {quotation.vat_rate}% VAT
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleViewQuotation(quotation)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showQuotationModal && (
        <QuotationModal
          leadId={leadId}
          onClose={() => {
            setShowQuotationModal(false);
            loadQuotations();
          }}
        />
      )}
    </>
  );
}
