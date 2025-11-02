import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Eye, Send, Download, Mail, FileText, Printer, FileDown, CreditCard, ShieldCheck, Lock, Unlock, XCircle, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { Quotation, QuotationLine, Customer } from '../../lib/database.types';
import SignatureModal from './SignatureModal';
import EmailComposerModal from './EmailComposerModal';
import PaymentModal from './PaymentModal';
import PaymentVerificationModal from './PaymentVerificationModal';
import { useGoogleAuth } from '../../contexts/GoogleAuthContext';

interface QuotationViewProps {
  quotation: Quotation;
  onClose: () => void;
}

export default function QuotationView({ quotation, onClose }: QuotationViewProps) {
  const { currentCompany, permissions } = useCompany();
  const { user } = useAuth();
  const [lines, setLines] = useState<QuotationLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [eventTypeName, setEventTypeName] = useState<string | null>(null);
  const [template, setTemplate] = useState<any>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgedName, setAcknowledgedName] = useState('');
  const [emailMessages, setEmailMessages] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [showEmailReplies, setShowEmailReplies] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { isConnected } = useGoogleAuth();

  const canUpdate = permissions?.quotations?.update ?? false;
  const isAdmin = permissions?.role?.name === 'Admin';
  const isFinance = permissions?.role?.name === 'Finance Officer';
  const canVerifyPayments = isAdmin || isFinance || (permissions?.payments?.update ?? false);

  useEffect(() => {
    if (permissions) {
      loadDetails();
      loadEmailMessages();
    }
  }, [permissions]);

  const loadDetails = async () => {
    if (!permissions?.quotations?.read) {
      setLoading(false);
      return;
    }

    const { data: linesData } = await supabase
      .from('quotation_lines')
      .select('*')
      .eq('quotation_id', quotation.id)
      .order('order');

    if (linesData) {
      setLines(linesData);
    }

    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .eq('id', quotation.customer_id)
      .maybeSingle();

    setCustomer(customerData);

    if (quotation.event_type_id) {
      const { data: eventTypeData } = await supabase
        .from('event_types')
        .select('name')
        .eq('id', quotation.event_type_id)
        .maybeSingle();
      if (eventTypeData) {
        setEventTypeName(eventTypeData.name);
      }
    }

    if (quotation.template_id) {
      const { data: templateData } = await supabase
        .from('quotation_templates')
        .select('logo_url, logo_position, logo_max_width, custom_sections')
        .eq('id', quotation.template_id)
        .maybeSingle();
      if (templateData) {
        setTemplate(templateData);
      }
    }

    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('quotation_id', quotation.id)
      .order('created_at', { ascending: false });

    if (paymentsData) {
      setPayments(paymentsData);
    }

    setLoading(false);
  };

  const loadEmailMessages = async () => {
    if (!permissions?.quotations?.read) return;
    
    setLoadingEmails(true);
    try {
      const { data } = await supabase
        .from('email_messages')
        .select('*')
        .eq('quotation_id', quotation.id)
        .order('sent_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (data) {
        setEmailMessages(data);
      }
    } catch (error) {
      console.error('Error loading email messages:', error);
    } finally {
      setLoadingEmails(false);
    }
  };

  const fetchGmailReplies = async () => {
    if (!isConnected || !user) {
      alert('Please connect your Google account to fetch email replies');
      return;
    }

    setLoadingEmails(true);
    try {
      // Get Gmail message IDs from our stored emails
      const sentEmails = emailMessages.filter(e => e.direction === 'outbound' && e.gmail_message_id);
      
      if (sentEmails.length === 0) {
        alert('No sent emails found with Gmail message IDs');
        setLoadingEmails(false);
        return;
      }

      // Get access token
      const { data: tokenData } = await supabase
        .from('google_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!tokenData) throw new Error('No Google token found');

      let accessToken = tokenData.access_token;
      const expiresAt = new Date(tokenData.expires_at);

      if (expiresAt <= new Date()) {
        // Refresh token would be handled by GoogleAuthContext
        alert('Please refresh your Google connection');
        setLoadingEmails(false);
        return;
      }

      // For each sent email, check for replies using Gmail API
      const replies: any[] = [];
      
      for (const sentEmail of sentEmails) {
        try {
          // Search for replies to this email thread
          const searchQuery = `inreplyto:${sentEmail.gmail_message_id} OR references:${sentEmail.gmail_message_id}`;
          const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.messages && data.messages.length > 0) {
              // Fetch full message details
              for (const msg of data.messages.slice(0, 5)) { // Limit to 5 most recent
                const msgResponse = await fetch(
                  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                    },
                  }
                );

                if (msgResponse.ok) {
                  const msgData = await msgResponse.json();
                  const headers = msgData.payload.headers;
                  const from = headers.find((h: any) => h.name === 'From')?.value || '';
                  const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
                  const date = headers.find((h: any) => h.name === 'Date')?.value || '';
                  
                  // Extract body
                  let body = '';
                  if (msgData.payload.body?.data) {
                    body = atob(msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                  } else if (msgData.payload.parts) {
                    for (const part of msgData.payload.parts) {
                      if (part.mimeType === 'text/plain' && part.body?.data) {
                        body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                        break;
                      }
                    }
                  }

                  // Check if we already have this reply
                  const existingReply = emailMessages.find(
                    e => e.gmail_message_id === msg.id || (e.from_address === from && e.subject === subject)
                  );

                  if (!existingReply && body) {
                    // Store the reply
                    await supabase.from('email_messages').insert({
                      company_id: currentCompany?.id,
                      quotation_id: quotation.id,
                      direction: 'inbound',
                      from_address: from,
                      to_addresses: [user.email || ''],
                      subject: subject,
                      body: body.substring(0, 5000), // Limit body length
                      entity_type: 'quotation',
                      entity_id: quotation.id,
                      gmail_message_id: msg.id,
                      status: 'sent',
                      sent_at: date,
                      recipient_email: user.email || '',
                    } as any);

                    replies.push({
                      from,
                      subject,
                      body,
                      date,
                      gmail_message_id: msg.id,
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching replies for email:', sentEmail.id, error);
        }
      }

      if (replies.length > 0) {
        alert(`Found ${replies.length} new reply(ies)`);
        await loadEmailMessages();
      } else {
        alert('No new replies found');
      }
    } catch (error: any) {
      console.error('Error fetching Gmail replies:', error);
      alert('Failed to fetch email replies: ' + error.message);
    } finally {
      setLoadingEmails(false);
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

  const getVerificationStatus = () => {
    if (payments.length === 0) return null;

    const completedPayments = payments.filter(p => p.payment_status === 'completed');
    if (completedPayments.length === 0) return null;

    const unverifiedCount = completedPayments.filter(p => !p.is_locked && p.verification_status !== 'verified').length;
    const verifiedCount = completedPayments.filter(p => p.verification_status === 'verified').length;
    const rejectedCount = completedPayments.filter(p => p.verification_status === 'rejected' || p.is_rejected).length;

    if (unverifiedCount > 0) {
      return { status: 'pending', count: unverifiedCount, label: 'Pending Verification' };
    } else if (rejectedCount > 0) {
      return { status: 'rejected', count: rejectedCount, label: 'Payment Rejected' };
    } else if (verifiedCount > 0) {
      return { status: 'verified', count: verifiedCount, label: 'Payment Verified' };
    }

    return null;
  };

  const handleReopenPayment = async () => {
    if (!reopenReason.trim() || !selectedPayment || !user) return;

    setReopening(true);
    try {
      const { error } = await supabase.rpc('reopen_payment', {
        payment_id_param: selectedPayment.id,
        reason_param: reopenReason.trim(),
        reopened_by_param: user.id,
      });

      if (error) throw error;

      alert('Payment reopened successfully!');
      setShowReopenModal(false);
      setReopenReason('');
      setSelectedPayment(null);
      await loadDetails();
    } catch (error: any) {
      console.error('Error reopening payment:', error);
      alert('Failed to reopen payment: ' + error.message);
    } finally {
      setReopening(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveAsPDF = async () => {
    if (!contentRef.current) return;

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

  const handleAccept = async () => {
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

      alert('Quotation accepted! Please acknowledge the terms before signing.');
      window.location.reload();
    } catch (error: any) {
      alert(error.message || 'Failed to accept quotation');
    } finally {
      setUpdating(false);
    }
  };

  const handleAcknowledgeAndSign = async () => {
    if (!acknowledged) {
      alert('Please check the acknowledgment box to continue.');
      return;
    }

    if (!acknowledgedName.trim()) {
      alert('Please enter your full name.');
      return;
    }

    setUpdating(true);
    try {
      await supabase
        .from('quotations')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: acknowledgedName.trim(),
        })
        .eq('id', quotation.id);

      if (currentCompany && user) {
        await supabase.from('audit_logs').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          action: 'acknowledge',
          entity_type: 'quotation',
          entity_id: quotation.id,
        });
      }

      setShowSignatureModal(true);
    } catch (error: any) {
      alert('Failed to save acknowledgment: ' + error.message);
    } finally {
      setUpdating(false);
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

  if (!permissions || loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <p className="text-slate-600">Loading quotation...</p>
        </div>
      </div>
    );
  }

  if (!permissions.quotations?.read) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <p className="text-slate-600 mb-4">You do not have permission to view quotations</p>
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
        <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 print:hidden">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900">
                Quotation {quotation.quotation_no}
              </h2>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  quotation.status
                )}`}
              >
                {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
              </span>
              {(() => {
                const verificationStatus = getVerificationStatus();
                if (!verificationStatus) return null;

                const colors = {
                  pending: 'bg-amber-100 text-amber-700 border-amber-200',
                  verified: 'bg-blue-100 text-blue-700 border-blue-200',
                  rejected: 'bg-red-100 text-red-700 border-red-200'
                };

                return (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${colors[verificationStatus.status]}`}>
                    {verificationStatus.status === 'pending' && <AlertCircle className="w-3.5 h-3.5" />}
                    {verificationStatus.status === 'verified' && <CheckCircle className="w-3.5 h-3.5" />}
                    {verificationStatus.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                    {verificationStatus.label}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              {quotation.status === 'draft' && canUpdate && (
                <button
                  onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Mail className="w-4 h-4" />
                  Send
                </button>
              )}
              {quotation.status === 'sent' && quotation.status !== 'accepted' && quotation.status !== 'signed' && canUpdate && (
                <button
                  onClick={handleAccept}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {updating ? 'Accepting...' : 'Accept'}
                </button>
              )}
              {(quotation.status === 'accepted' || quotation.status === 'sent') && !quotation.signed_at && canUpdate && (
                <button
                  onClick={() => {
                    if (quotation.acknowledged) {
                      setShowSignatureModal(true);
                    } else if (acknowledged && acknowledgedName.trim()) {
                      handleAcknowledgeAndSign();
                    } else {
                      alert('Please scroll down and complete the acknowledgment section before signing.');
                    }
                  }}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  {updating ? 'Processing...' : 'Sign'}
                </button>
              )}
              {quotation.status === 'accepted' && quotation.status !== 'paid' && canUpdate && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                >
                  <CreditCard className="w-4 h-4" />
                  Record Payment
                </button>
              )}
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
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 print:p-0">
            <div ref={contentRef} className="max-w-4xl mx-auto bg-white">
              {template?.logo_url && (
                <div className={`mb-6 flex ${template.logo_position === 'center' ? 'justify-center' : template.logo_position === 'right' ? 'justify-end' : 'justify-start'}`}>
                  <img
                    src={template.logo_url}
                    alt="Company logo"
                    style={{ maxWidth: `${template.logo_max_width || 200}px` }}
                  />
                </div>
              )}

              <div className="mb-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">QUOTATION</h1>
                    <p className="text-slate-600">{currentCompany?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{quotation.quotation_no}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Date: {formatDate(quotation.quotation_date)}
                    </p>
                    {quotation.expiration_date && (
                      <p className="text-sm text-slate-600">
                        Valid Until: {formatDate(quotation.expiration_date)}
                      </p>
                    )}
                  </div>
                </div>

                {(quotation.event_type_id || quotation.no_of_pax || quotation.event_date) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Event Details</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {eventTypeName && (
                        <div>
                          <span className="text-slate-600">Event Type:</span>
                          <p className="font-medium text-slate-900">{eventTypeName}</p>
                        </div>
                      )}
                      {quotation.no_of_pax && (
                        <div>
                          <span className="text-slate-600">No. of Pax:</span>
                          <p className="font-medium text-slate-900">{quotation.no_of_pax}</p>
                        </div>
                      )}
                      {quotation.event_date && (
                        <div>
                          <span className="text-slate-600">Event Date:</span>
                          <p className="font-medium text-slate-900">{formatDate(quotation.event_date)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Bill To:</h3>
                    <div className="text-sm text-slate-700">
                      <p className="font-medium">{customer?.name}</p>
                      {customer?.email && <p>{customer.email}</p>}
                      {customer?.phone && <p>{customer.phone}</p>}
                      {customer?.address && <p className="mt-1">{customer.address}</p>}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Quotation Details:</h3>
                    <div className="text-sm text-slate-700 space-y-1">
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span className="font-medium capitalize">{quotation.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment Terms:</span>
                        <span>Due upon acceptance</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {quotation.body_html && (
                <div className="mb-8 prose prose-slate max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: quotation.body_html }} />
                </div>
              )}

              <div className="mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 border-b-2 border-slate-300">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900 border-b-2 border-slate-300">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900 border-b-2 border-slate-300">
                        Unit Price
                      </th>
                      {lines.some((l) => l.discount > 0) && (
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900 border-b-2 border-slate-300">
                          Discount
                        </th>
                      )}
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900 border-b-2 border-slate-300">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-b border-slate-200">
                        <td className="px-4 py-3 text-sm text-slate-700">{line.description}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-700">
                          {line.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-slate-700">
                          {formatCurrency(line.unit_price)}
                        </td>
                        {lines.some((l) => l.discount > 0) && (
                          <td className="px-4 py-3 text-sm text-right text-slate-700">
                            {line.discount > 0 ? `${line.discount}%` : '-'}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">
                          {formatCurrency(line.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mb-8">
                <div className="w-80">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Subtotal:</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(quotation.subtotal)}
                      </span>
                    </div>
                    {quotation.vat_enabled && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">VAT ({quotation.vat_rate}%):</span>
                        <span className="font-medium text-slate-900">
                          {formatCurrency(quotation.vat_amount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-3 border-t-2 border-slate-300">
                      <span className="font-semibold text-slate-900">Total:</span>
                      <span className="text-xl font-bold text-slate-900">
                        {formatCurrency(quotation.total_amount)}
                      </span>
                    </div>
                    {!quotation.vat_enabled && (
                      <p className="text-xs text-slate-500 text-right">Exclusive of VAT</p>
                    )}
                  </div>
                </div>
              </div>

              {quotation.terms_html && (
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Terms & Conditions:</h3>
                  <div className="text-sm prose prose-slate max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: quotation.terms_html }} />
                  </div>
                </div>
              )}

              {template?.custom_sections && template.custom_sections.length > 0 && (
                <div className="mb-8 space-y-6">
                  {template.custom_sections.map((section: any, index: number) => (
                    <div key={index}>
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">{section.title}:</h3>
                      <div className="text-sm prose prose-slate max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: section.content }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {quotation.notes && (
                <div className="mb-8 p-4 bg-slate-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Notes:</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{quotation.notes}</p>
                </div>
              )}

              {quotation.status === 'accepted' && !quotation.signed_at && (
                <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Acknowledgment Required</h3>
                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">
                        {quotation.acknowledgment_text || 'I hereby acknowledge that I have read, understand, and agree to the terms of this document relating to my group booking in'} <strong>{currentCompany?.name}</strong>
                      </span>
                    </label>
                    {acknowledged && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Your Full Name *
                        </label>
                        <input
                          type="text"
                          value={acknowledgedName}
                          onChange={(e) => setAcknowledgedName(e.target.value)}
                          placeholder="Enter your full name"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {quotation.acknowledged && quotation.acknowledged_at && (
                <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Acknowledged</h3>
                  <div className="text-sm text-slate-700">
                    <p>
                      <span className="font-medium">Acknowledged by:</span> {quotation.acknowledged_by}
                    </p>
                    <p>
                      <span className="font-medium">Date:</span> {formatDate(quotation.acknowledged_at)}
                    </p>
                  </div>
                </div>
              )}

              {payments.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Payment History</h3>
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className={`p-4 rounded-lg border ${
                          payment.payment_status === 'completed'
                            ? 'bg-green-50 border-green-200'
                            : payment.payment_status === 'failed'
                            ? 'bg-red-50 border-red-200'
                            : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CreditCard className="w-4 h-4 text-slate-600" />
                            <span className="font-medium text-slate-900">
                              {formatCurrency(payment.amount)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              payment.payment_status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : payment.payment_status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {payment.payment_status}
                            </span>
                            {payment.verification_status && (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                payment.verification_status === 'verified'
                                  ? 'bg-blue-100 text-blue-700'
                                  : payment.verification_status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {payment.verification_status === 'verified' ? 'Verified' : payment.verification_status === 'rejected' ? 'Rejected' : 'Pending Verification'}
                              </span>
                            )}
                            {payment.is_locked && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                <Lock className="w-3 h-3" />
                                Locked
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {canVerifyPayments && payment.payment_status === 'completed' && !payment.is_locked && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setShowVerificationModal(true);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Verify
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setShowVerificationModal(true);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Reject
                                </button>
                              </>
                            )}
                            {isAdmin && payment.is_locked && (
                              <button
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setShowReopenModal(true);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 rounded"
                              >
                                <Unlock className="w-3 h-3" />
                                Reopen
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                          <p><span className="font-medium">Method:</span> {payment.payment_method}</p>
                          <p><span className="font-medium">Transaction ID:</span> {payment.transaction_id}</p>
                          <p><span className="font-medium">Date:</span> {formatDate(payment.payment_date)}</p>
                          {payment.verification_notes && (
                            <p className="mt-2 pt-2 border-t border-slate-200">
                              <span className="font-medium">Notes:</span> {payment.verification_notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {quotation.signed_at && quotation.signed_by && (
                <div className="border-t-2 border-slate-200 pt-6">
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

              {emailMessages.length > 0 && (
                <div className="mb-8 border-t-2 border-slate-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Email Communication</h3>
                    {isConnected && (
                      <button
                        onClick={fetchGmailReplies}
                        disabled={loadingEmails}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingEmails ? 'animate-spin' : ''}`} />
                        Check for Replies
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {emailMessages.map((email) => (
                      <div
                        key={email.id}
                        className={`p-4 rounded-lg border ${
                          email.direction === 'outbound'
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-green-50 border-green-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Mail className={`w-4 h-4 ${
                              email.direction === 'outbound' ? 'text-blue-600' : 'text-green-600'
                            }`} />
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              email.direction === 'outbound'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {email.direction === 'outbound' ? 'Sent' : 'Received'}
                            </span>
                            {email.direction === 'outbound' && (
                              <span className="text-xs text-slate-600">
                                To: {Array.isArray(email.to_addresses) ? email.to_addresses.join(', ') : email.recipient_email}
                              </span>
                            )}
                            {email.direction === 'inbound' && (
                              <span className="text-xs text-slate-600">
                                From: {email.from_address}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {email.sent_at ? formatDate(email.sent_at) : formatDate(email.created_at)}
                          </span>
                        </div>
                        <h4 className="font-medium text-slate-900 mb-1">{email.subject}</h4>
                        <p className="text-sm text-slate-700 line-clamp-3 whitespace-pre-wrap">
                          {email.body || 'No content'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-500 text-center">
                <p>
                  This quotation is valid for the period specified above and subject to our standard
                  terms and conditions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSignatureModal && (
        <SignatureModal
          quotation={quotation}
          onClose={() => {
            setShowSignatureModal(false);
            onClose();
          }}
        />
      )}

      {showSendModal && customer && (
        <EmailComposerModal
          quotationId={quotation.id}
          customerEmail={customer.email || ''}
          customerName={customer.name}
          quotationNumber={quotation.quotation_no}
          onClose={() => setShowSendModal(false)}
          onSuccess={() => {
            setShowSendModal(false);
            window.location.reload();
          }}
        />
      )}

      {showPaymentModal && customer && (
        <PaymentModal
          quotationId={quotation.id}
          customerId={quotation.customer_id}
          amount={quotation.total_amount}
          currency={quotation.currency || 'PHP'}
          quotationNumber={quotation.quotation_no}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            loadDetails();
          }}
        />
      )}

      {showVerificationModal && selectedPayment && (
        <PaymentVerificationModal
          payment={selectedPayment}
          quotationNumber={quotation.quotation_no}
          onClose={() => {
            setShowVerificationModal(false);
            setSelectedPayment(null);
          }}
          onSuccess={() => {
            setShowVerificationModal(false);
            setSelectedPayment(null);
            loadDetails();
          }}
        />
      )}

      {showReopenModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Unlock className="w-6 h-6" />
                Reopen Payment
              </h3>
              <button
                onClick={() => {
                  setShowReopenModal(false);
                  setSelectedPayment(null);
                  setReopenReason('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                <p className="text-sm text-amber-800 mb-2">
                  <strong>Warning:</strong> This action will unlock the payment and reset its verification status.
                </p>
                <div className="text-xs text-amber-700 space-y-1">
                  <p><strong>Amount:</strong> {formatCurrency(selectedPayment.amount)}</p>
                  <p><strong>Current Status:</strong> {selectedPayment.verification_status}</p>
                  <p><strong>Transaction ID:</strong> {selectedPayment.transaction_id}</p>
                </div>
              </div>

              <label className="block text-sm font-medium text-slate-700 mb-2">
                Reason for Reopening *
              </label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Explain why this payment needs to be reopened..."
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReopenModal(false);
                  setSelectedPayment(null);
                  setReopenReason('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                disabled={reopening}
              >
                Cancel
              </button>
              <button
                onClick={handleReopenPayment}
                disabled={reopening || !reopenReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium"
              >
                {reopening ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Reopening...
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    Reopen Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
