import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { X, Edit2, Calendar, Mail, Phone, FileText, Users } from 'lucide-react';
import type { Lead, Customer, PipelineStage } from '../../lib/database.types';
import { QuotationModal } from '../quotations/QuotationModal';
import { getUserPermissions, type UserPermissions } from '../../lib/permissions';

interface LeadDetailViewProps {
  leadId: string;
  onClose: () => void;
  onEdit: () => void;
}

interface Quotation {
  id: string;
  quotation_number: string;
  lead_id: string;
  customer_id: string;
  event_name: string;
  event_date: string;
  event_type: string;
  event_location: string;
  expected_pax: number;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  expiration_date: string;
  created_at: string;
  created_by: string;
}

export default function LeadDetailView({ leadId, onClose, onEdit }: LeadDetailViewProps) {
  const { currentCompany, permissions } = useCompany();
  const [lead, setLead] = useState<Lead | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'quotations'>('details');
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);

  const canEdit = userPermissions?.canEdit ?? false;

  useEffect(() => {
    loadLeadData();
    loadUserPermissions();
  }, [leadId]);

  const loadUserPermissions = async () => {
    const perms = await getUserPermissions();
    setUserPermissions(perms);
  };

  const loadLeadData = async () => {
    if (!currentCompany) return;

    try {
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('company_id', currentCompany.id)
        .single();

      if (leadError) throw leadError;

      setLead(leadData);

      if (leadData.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', leadData.customer_id)
          .single();

        setCustomer(customerData);
      }

      if (leadData.stage_id) {
        const { data: stageData } = await supabase
          .from('pipeline_stages')
          .select('*')
          .eq('id', leadData.stage_id)
          .single();

        setStage(stageData);
      }

      const { data: quotationsData } = await supabase
        .from('quotations')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      setQuotations(quotationsData || []);
    } catch (error) {
      console.error('Error loading lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
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
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Lead Not Found</h3>
          <p className="text-slate-600 mb-4">The lead you're looking for could not be found.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-slate-900">
                {lead.event_name || lead.name || 'Lead Details'}
              </h2>
              {stage && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: stage.color || '#64748b' }}
                >
                  {stage.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={onEdit}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200">
            <div className="flex px-6">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Details
              </button>
              <button
                onClick={() => setActiveTab('quotations')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'quotations'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Quotations ({quotations.length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'details' && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Event Information</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-1 block">Event Name</label>
                      <p className="text-slate-900 font-medium">{lead.event_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-1 block">Event Type</label>
                      <p className="text-slate-900">{lead.event_type || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-1 block">Event Date</label>
                      <p className="text-slate-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {formatDate(lead.event_date)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-1 block">Expected PAX</label>
                      <p className="text-slate-900 flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        {lead.expected_pax || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-1 block">Projected Value</label>
                      <p className="text-slate-900 font-semibold text-lg text-emerald-600">
                        {formatCurrency(lead.event_value || 0)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 mb-1 block">Source</label>
                      <p className="text-slate-900">{lead.source || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {customer && (
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Customer Information</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm font-medium text-slate-600 mb-1 block">Name</label>
                        <p className="text-slate-900 font-medium">{customer.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-600 mb-1 block">Email</label>
                        <p className="text-slate-900 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          {customer.email || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-600 mb-1 block">Phone</label>
                        <p className="text-slate-900 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          {customer.phone || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-600 mb-1 block">Address</label>
                        <p className="text-slate-900">{customer.address || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {lead.notes && (
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Notes</h3>
                    <p className="text-slate-700 whitespace-pre-wrap">{lead.notes}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'quotations' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-slate-900">Quotations</h3>
                  {canEdit && (
                    <button
                      onClick={() => {
                        setSelectedQuotation(null);
                        setShowQuotationModal(true);
                      }}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium"
                    >
                      Create Quotation
                    </button>
                  )}
                </div>

                {quotations.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600">No quotations yet</p>
                    {canEdit && (
                      <button
                        onClick={() => {
                          setSelectedQuotation(null);
                          setShowQuotationModal(true);
                        }}
                        className="mt-4 text-slate-900 font-medium hover:underline"
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
                        className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors cursor-pointer"
                        onClick={() => setSelectedQuotation(quotation)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {quotation.quotation_number}
                            </p>
                            <p className="text-sm text-slate-600">{quotation.event_name}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(quotation.status)}`}>
                            {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">
                            Valid until {formatDate(quotation.expiration_date)}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(quotation.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showQuotationModal && (
        <QuotationModal
          quotation={null}
          leadData={lead}
          customerData={customer}
          onClose={() => {
            setShowQuotationModal(false);
            setSelectedQuotation(null);
          }}
          onSuccess={() => {
            setShowQuotationModal(false);
            setSelectedQuotation(null);
            loadLeadData();
          }}
        />
      )}
    </>
  );
}
