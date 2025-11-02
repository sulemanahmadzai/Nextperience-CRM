import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Edit2, FileDown, Mail, CheckCircle, FileText, Printer, Link2, Copy, Check, DollarSign, AlertTriangle, Plus, Lock } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { Quotation, QuotationLine, Customer } from '../../lib/database.types';
import SignatureModal from './SignatureModal';
import EmailComposerModal from './EmailComposerModal';
import PaymentVerificationModal from './PaymentVerificationModal';
import { PaymentVerificationPanel } from './PaymentVerificationPanel';
import EventOrderModal from '../event-orders/EventOrderModal';
import EventOrderView from '../event-orders/EventOrderView';
import { getUserPermissions, canDeleteQuotation, checkQuotationLockStatus, logAuditAction, type UserPermissions } from '../../lib/permissions';
import { ProformaInvoiceModal } from '../proforma/ProformaInvoiceModal';
import { ProformaInvoiceView } from '../proforma/ProformaInvoiceView';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_id: string;
  payment_date: string;
  payment_status: string;
  verification_status: string | null;
  verification_notes: string | null;
  verified_at: string | null;
  proof_of_payment_url: string | null;
  deposit_slip_url: string | null;
  is_rejected: boolean;
  is_locked: boolean;
  metadata: any;
  quotation_id: string;
}

interface QuotationDetailPageProps {
  quotationId: string;
  onBack: () => void;
  onEdit?: (quotationId: string) => void;
}

export default function QuotationDetailPage({ quotationId, onBack, onEdit }: QuotationDetailPageProps) {
  const { currentCompany, hasAllAccess, userRole } = useCompany();
  const { user } = useAuth();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [lines, setLines] = useState<QuotationLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showPaymentVerification, setShowPaymentVerification] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'quotation' | 'event-order' | 'proforma-invoice'>('quotation');
  const [eventOrders, setEventOrders] = useState<any[]>([]);
  const [selectedEventOrder, setSelectedEventOrder] = useState<any>(null);
  const [showEventOrderModal, setShowEventOrderModal] = useState(false);
  const [editingEventOrder, setEditingEventOrder] = useState<any>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showProformaModal, setShowProformaModal] = useState(false);
  const [proformaInvoices, setProformaInvoices] = useState<any[]>([]);
  const [selectedProformaInvoice, setSelectedProformaInvoice] = useState<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadQuotation();
    loadEventOrders();
    loadProformaInvoices();
    loadPermissions();
  }, [quotationId]);

  const loadPermissions = async () => {
    const perms = await getUserPermissions();
    setUserPermissions(perms);

    const deletePermission = await canDeleteQuotation(quotationId);
    setCanDelete(deletePermission);

    const lockStatus = await checkQuotationLockStatus(quotationId);
    setIsLocked(lockStatus.isLocked);
  };

  const loadQuotation = async () => {
    setLoading(true);

    const { data: quotationData, error: quotationError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .maybeSingle();

    if (quotationError) {
      console.error('Error loading quotation:', quotationError);
      setLoading(false);
      return;
    }

    if (!quotationData) {
      setLoading(false);
      return;
    }

    setQuotation(quotationData);

    const { data: linesData } = await supabase
      .from('quotation_lines')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('order');

    if (linesData) {
      setLines(linesData);
    }

    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .eq('id', quotationData.customer_id)
      .maybeSingle();

    setCustomer(customerData);

    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('created_at', { ascending: false });

    if (paymentsData) {
      setPayments(paymentsData);
    }

    setLoading(false);
  };

  const loadEventOrders = async () => {
    const { data } = await supabase
      .from('event_orders')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('created_at', { ascending: false });

    if (data) {
      setEventOrders(data);
      if (data.length > 0 && !selectedEventOrder) {
        setSelectedEventOrder(data[0]);
      }
    }
  };

  const loadProformaInvoices = async () => {
    const { data } = await supabase
      .from('proforma_invoices')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('created_at', { ascending: false });

    if (data) {
      setProformaInvoices(data);
      if (data.length > 0 && !selectedProformaInvoice) {
        setSelectedProformaInvoice(data[0]);
      }
    }
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

  const handlePrint = () => {
    window.print();
  };

  const handleSaveAsPDF = async () => {
    if (!contentRef.current || !quotation) return;

    const opt = {
      margin: 10,
      filename: `Quotation_${quotation.quotation_no}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(contentRef.current).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleFinalize = async () => {
    if (!quotation) return;
    if (!confirm('Finalize this quotation? This will mark it as ready and prevent further edits.')) {
      return;
    }
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('quotations')
        .update({ status: 'finalized' })
        .eq('id', quotation.id);

      if (error) {
        console.error('Error finalizing quotation:', error);
        alert('Failed to finalize quotation: ' + error.message);
        return;
      }

      await logAuditAction('quotations', quotation.id, 'finalized',
        { status: 'draft' },
        { status: 'finalized' }
      );

      await loadQuotation();
      alert('Quotation finalized successfully!');
    } catch (error) {
      console.error('Error finalizing quotation:', error);
      alert('Failed to finalize quotation. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAccept = async () => {
    if (!quotation) return;
    setUpdating(true);
    try {
      await supabase
        .from('quotations')
        .update({ status: 'accepted' })
        .eq('id', quotation.id);

      if (currentCompany && user) {
        await supabase.from('audit_logs').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          action: 'accept',
          entity_type: 'quotation',
          entity_id: quotation.id,
        });
      }

      await loadQuotation();
      alert('Quotation accepted! You can now sign it.');
    } catch (error: any) {
      alert(error.message || 'Failed to accept quotation');
    } finally {
      setUpdating(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!quotation || !user) return;

    setUpdating(true);
    try {
      const { data: existingLink } = await supabase
        .from('quotation_public_links')
        .select('token')
        .eq('quotation_id', quotation.id)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      let token: string;

      if (existingLink) {
        token = existingLink.token;
      } else {
        const { data: newLink, error } = await supabase
          .from('quotation_public_links')
          .insert({
            quotation_id: quotation.id,
            created_by: user.id,
          })
          .select('token')
          .single();

        if (error) throw error;
        token = newLink.token;
      }

      const link = `${window.location.origin}?q=${token}`;
      setPublicLink(link);
      setShowLinkModal(true);
    } catch (error: any) {
      console.error('Error generating link:', error);
      alert('Failed to generate public link: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCopyLink = () => {
    if (publicLink) {
      navigator.clipboard.writeText(publicLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-slate-600">Loading quotation...</div>
        </div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Quotation not found</p>
          <button
            onClick={onBack}
            className="text-slate-900 hover:text-slate-700 underline"
          >
            Back to Quotations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Quotations
        </button>

        <div className="flex items-center gap-2">
          {quotation.status === 'draft' && (
            <>
              {onEdit && userPermissions?.canEdit && (
                <button
                  onClick={() => onEdit(quotationId)}
                  className="flex items-center gap-2 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}
              {userPermissions?.canEdit && (
                <button
                  onClick={handleFinalize}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {updating ? 'Finalizing...' : 'Finalize'}
                </button>
              )}
            </>
          )}
          {quotation.status === 'sent' && !quotation.signed_at && (
            <>
              <button
                onClick={handleAccept}
                disabled={updating}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {updating ? 'Accepting...' : 'Accept'}
              </button>
              <button
                onClick={() => setShowSignatureModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                <FileText className="w-4 h-4" />
                Sign
              </button>
            </>
          )}
          {quotation.status === 'accepted' && !quotation.signed_at && (
            <button
              onClick={() => setShowSignatureModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <FileText className="w-4 h-4" />
              Sign
            </button>
          )}
          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Mail className="w-4 h-4" />
            Send
          </button>
          <button
            onClick={handleGenerateLink}
            disabled={updating}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            <Link2 className="w-4 h-4" />
            {updating ? 'Generating...' : 'Send Link'}
          </button>
          <button
            onClick={handleSaveAsPDF}
            className="flex items-center gap-2 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <FileDown className="w-4 h-4" />
            Save as PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="mb-6 border-b border-slate-200 print:hidden">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('quotation')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'quotation'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Quotation
          </button>
          <button
            onClick={() => setActiveTab('event-order')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'event-order'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Event Orders
          </button>
          <button
            onClick={() => setActiveTab('proforma-invoice')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'proforma-invoice'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Proforma Invoice
          </button>
        </div>
      </div>

      {activeTab === 'quotation' && (
      <div ref={contentRef} className="bg-white rounded-lg border border-slate-200 p-8">
        <div className="mb-8 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Quotation {quotation.quotation_no}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                quotation.status
              )}`}
            >
              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </span>
          </div>
        </div>

        {payments.filter(p => p.payment_method === 'check').length > 0 && (
          <div className="mb-8 print:hidden">
            <PaymentVerificationPanel
              quotationId={quotationId}
              onPaymentVerified={loadQuotation}
            />
          </div>
        )}

        <div className="mb-8">
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">FROM</h3>
              <p className="text-slate-900 font-medium">{currentCompany?.name}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">TO</h3>
              <p className="text-slate-900 font-medium">{customer?.name}</p>
              <p className="text-slate-600 text-sm">{customer?.email}</p>
              {customer?.phone && <p className="text-slate-600 text-sm">{customer.phone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-600">Quotation Date</p>
              <p className="font-medium text-slate-900">{formatDate(quotation.quotation_date)}</p>
            </div>
            <div>
              <p className="text-slate-600">Valid Until</p>
              <p className="font-medium text-slate-900">{formatDate(quotation.expiration_date)}</p>
            </div>
            {quotation.lead_id && (
              <div>
                <p className="text-slate-600">Related Lead</p>
                <p className="font-medium text-slate-900">Lead #{quotation.lead_id.substring(0, 8)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="text-left py-3 text-sm font-semibold text-slate-900">Description</th>
                <th className="text-right py-3 text-sm font-semibold text-slate-900">Qty</th>
                <th className="text-right py-3 text-sm font-semibold text-slate-900">Unit Price</th>
                <th className="text-right py-3 text-sm font-semibold text-slate-900">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b border-slate-200">
                  <td className="py-3">
                    <p className="font-medium text-slate-900">{line.description}</p>
                    {line.notes && <p className="text-sm text-slate-600 mt-1">{line.notes}</p>}
                  </td>
                  <td className="text-right py-3 text-slate-900">{line.quantity}</td>
                  <td className="text-right py-3 text-slate-900">{formatCurrency(line.unit_price)}</td>
                  <td className="text-right py-3 text-slate-900">{formatCurrency(line.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between py-2 text-slate-600">
              <span>Subtotal:</span>
              <span>{formatCurrency(quotation.subtotal)}</span>
            </div>
            {quotation.discount_amount > 0 && (
              <div className="flex justify-between py-2 text-slate-600">
                <span>Discount:</span>
                <span>-{formatCurrency(quotation.discount_amount)}</span>
              </div>
            )}
            {quotation.tax_amount > 0 && (
              <div className="flex justify-between py-2 text-slate-600">
                <span>Tax:</span>
                <span>{formatCurrency(quotation.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between py-3 border-t-2 border-slate-900 font-bold text-slate-900 text-lg">
              <span>Total:</span>
              <span>{formatCurrency(quotation.total_amount)}</span>
            </div>
          </div>
        </div>

        {quotation.notes && (
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Notes</h3>
            <p className="text-slate-600 whitespace-pre-wrap">{quotation.notes}</p>
          </div>
        )}

        {quotation.terms && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Terms & Conditions</h3>
            <p className="text-slate-600 whitespace-pre-wrap">{quotation.terms}</p>
          </div>
        )}

        {quotation.signed_at && quotation.signed_by && (
          <div className="mt-8 pt-6 border-t-2 border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Accepted & Signed</h3>
            <div className="flex items-start gap-6">
              {quotation.signature_image && (
                <div className="border border-slate-200 rounded p-2 bg-white">
                  <img
                    src={quotation.signature_image}
                    alt="Signature"
                    className="h-20 w-auto"
                  />
                </div>
              )}
              <div className="text-sm text-slate-700">
                <p>
                  <span className="font-medium">Signed by:</span> {quotation.signed_by}
                </p>
                <p>
                  <span className="font-medium">Date:</span> {formatDate(quotation.signed_at)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {activeTab === 'event-order' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-800">Event Orders</h2>
            <button
              onClick={() => {
                setEditingEventOrder(null);
                setShowEventOrderModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-5 w-5" />
              Generate from Quotation
            </button>
          </div>

          {eventOrders.length === 0 ? (
            <div className="bg-slate-50 rounded-lg p-8 text-center">
              <p className="text-slate-600 mb-4">No event orders yet for this quotation</p>
              <button
                onClick={() => {
                  setEditingEventOrder(null);
                  setShowEventOrderModal(true);
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Create your first event order
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4 mb-4">
                {eventOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => setSelectedEventOrder(order)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedEventOrder?.id === order.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {order.order_number}
                  </button>
                ))}
              </div>

              {selectedEventOrder && (
                <EventOrderView
                  eventOrderId={selectedEventOrder.id}
                  onEdit={() => {
                    setEditingEventOrder(selectedEventOrder);
                    setShowEventOrderModal(true);
                  }}
                  canEdit={true}
                />
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'proforma-invoice' && (
        <div className="space-y-4">
          {selectedProformaInvoice ? (
            <ProformaInvoiceView
              invoiceId={selectedProformaInvoice.id}
              onBack={() => setSelectedProformaInvoice(null)}
              onEdit={() => {
                alert('Edit functionality for proforma invoices is coming soon. For now, please create a new invoice.');
              }}
            />
          ) : proformaInvoices.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-8">
              <div className="text-center">
                <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">Proforma Invoice</h2>
                <p className="text-slate-600 mb-6">Convert this quotation into a proforma invoice for client billing</p>
                <button
                  onClick={() => setShowProformaModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-5 h-5" />
                  Convert to Proforma Invoice
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-800">Proforma Invoices</h2>
                <button
                  onClick={() => setShowProformaModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-5 h-5" />
                  Create Another
                </button>
              </div>

              <div className="space-y-3">
                {proformaInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    onClick={() => setSelectedProformaInvoice(invoice)}
                    className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{invoice.invoice_no}</p>
                      <p className="text-sm text-slate-600">
                        {new Date(invoice.invoice_date).toLocaleDateString()} • {invoice.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {invoice.currency === 'PHP' ? '₱' : '$'}
                        {parseFloat(invoice.total_amount).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showSignatureModal && quotation && (
        <SignatureModal
          quotation={quotation}
          onClose={() => {
            setShowSignatureModal(false);
            loadQuotation();
          }}
        />
      )}

      {showSendModal && customer && quotation && (
        <EmailComposerModal
          quotationId={quotation.id}
          customerEmail={customer.email || ''}
          customerName={customer.name}
          quotationNumber={quotation.quotation_no}
          onClose={() => setShowSendModal(false)}
          onSuccess={() => {
            setShowSendModal(false);
            loadQuotation();
          }}
        />
      )}

      {showPaymentVerification && selectedPayment && (
        <PaymentVerificationModal
          payment={selectedPayment}
          quotationNumber={quotation.quotation_no}
          onClose={() => {
            setShowPaymentVerification(false);
            setSelectedPayment(null);
          }}
          onSuccess={loadQuotation}
        />
      )}

      {showLinkModal && publicLink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Public Quotation Link</h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Share this link with your customer. They can view, approve, or reject the quotation directly from this link.
              </p>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={publicLink}
                    readOnly
                    className="flex-1 bg-white px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
                  >
                    {linkCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <div className="text-blue-600 mt-0.5">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Link Details:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>Valid for 30 days</li>
                      <li>Customer can approve or reject</li>
                      <li>Digital signature supported</li>
                      <li>You'll be notified of their response</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleCopyLink();
                    window.open(publicLink, '_blank');
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-semibold"
                >
                  Copy & Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEventOrderModal && (
        <EventOrderModal
          eventOrder={editingEventOrder}
          quotationId={quotationId}
          onClose={() => {
            setShowEventOrderModal(false);
            setEditingEventOrder(null);
          }}
          onSuccess={() => {
            setShowEventOrderModal(false);
            setEditingEventOrder(null);
            loadEventOrders();
          }}
        />
      )}

      {showProformaModal && (
        <ProformaInvoiceModal
          quotationId={quotationId}
          onClose={() => setShowProformaModal(false)}
          onSuccess={(invoiceId) => {
            setShowProformaModal(false);
            loadProformaInvoices();
            setActiveTab('proforma-invoice');
          }}
        />
      )}
    </div>
  );
}
