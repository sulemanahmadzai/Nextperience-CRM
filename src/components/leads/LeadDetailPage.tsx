import { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Calendar, Mail, Phone, Users, MapPin, DollarSign, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import type { Lead, Customer, PipelineStage } from '../../lib/database.types';
import ActivitiesTimeline from './ActivitiesTimeline';
import QuotationsList from './QuotationsList';

interface LeadDetailPageProps {
  leadId: string;
  onBack: () => void;
  onEdit?: () => void;
  onViewQuotation?: (quotationId: string) => void;
}

export default function LeadDetailPage({ leadId, onBack, onEdit, onViewQuotation }: LeadDetailPageProps) {
  const { currentCompany } = useCompany();
  const [lead, setLead] = useState<Lead | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'activities' | 'quotations'>('details');

  useEffect(() => {
    loadLeadData();
  }, [leadId]);

  const loadLeadData = async () => {
    setLoading(true);

    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();

    if (leadError) {
      console.error('Error loading lead:', leadError);
      setLoading(false);
      return;
    }

    if (!leadData) {
      setLoading(false);
      return;
    }

    setLead(leadData);

    if (leadData.customer_id) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', leadData.customer_id)
        .maybeSingle();

      setCustomer(customerData);
    }

    if (leadData.stage_id) {
      const { data: stageData } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('id', leadData.stage_id)
        .maybeSingle();

      setStage(stageData);
    }

    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-slate-600">Loading lead...</div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Lead not found</p>
          <button
            onClick={onBack}
            className="text-slate-900 hover:text-slate-700 underline"
          >
            Back to Leads
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Pipeline
        </button>

        {onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Edit2 className="w-4 h-4" />
            Edit Lead
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{lead.event_name}</h1>
              {stage && (
                <span
                  className="inline-flex px-3 py-1 rounded-full text-sm font-medium"
                  style={{ backgroundColor: `${stage.color}20`, color: stage.color }}
                >
                  {stage.name}
                </span>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(lead.expected_value || 0)}</div>
              <div className="text-sm text-slate-600">Expected Value</div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200">
          <div className="flex gap-8 px-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'details'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('activities')}
              className={`py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'activities'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Activities
            </button>
            <button
              onClick={() => setActiveTab('quotations')}
              className={`py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'quotations'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Quotations
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600">Customer</p>
                      <p className="font-medium text-slate-900">{customer?.name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600">Email</p>
                      <p className="font-medium text-slate-900">{customer?.email || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600">Phone</p>
                      <p className="font-medium text-slate-900">{customer?.phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Event Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600">Event Date</p>
                      <p className="font-medium text-slate-900">{formatDate(lead.event_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600">Event Type</p>
                      <p className="font-medium text-slate-900">{lead.event_type || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600">Location</p>
                      <p className="font-medium text-slate-900">{lead.event_location || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600">Expected PAX</p>
                      <p className="font-medium text-slate-900">{lead.expected_pax || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {lead.notes && (
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Notes</h3>
                  <p className="text-slate-600 whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'activities' && (
            <ActivitiesTimeline leadId={leadId} />
          )}

          {activeTab === 'quotations' && (
            <QuotationsList leadId={leadId} onViewQuotation={onViewQuotation} />
          )}
        </div>
      </div>
    </div>
  );
}
