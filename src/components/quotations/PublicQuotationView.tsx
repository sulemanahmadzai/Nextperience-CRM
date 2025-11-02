import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, X, MessageSquare, Loader2, Printer, Download, Pencil, Type, CreditCard, ShieldCheck, XCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';

interface QuotationLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

interface QuotationData {
  id: string;
  company_id: string;
  quotation_number: string;
  company_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  quotation_date: string;
  valid_until: string;
  subtotal: number;
  vat_enabled: boolean;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  currency: string;
  body_html: string;
  terms_html: string;
  status: string;
  event_type_name?: string;
  no_of_pax?: number;
  event_date?: string;
  template_logo_url?: string;
  template_logo_position?: string;
  template_logo_max_width?: number;
  template_custom_sections?: any[];
  lines: QuotationLine[];
  customer_response?: {
    response_type: string;
    customer_name: string;
    rejection_reason?: string;
    responded_at: string;
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function PublicQuotationView({ token }: { token: string }) {
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [signature, setSignature] = useState('');
  const [signatureMode, setSignatureMode] = useState<'type' | 'draw'>('type');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [depositPercentage, setDepositPercentage] = useState<number>(50);
  const [isFullPayment, setIsFullPayment] = useState<boolean>(false);
  const [totalPaid, setTotalPaid] = useState<number>(0);
  const [remainingBalance, setRemainingBalance] = useState<number>(0);
  const [bankName, setBankName] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositSlipUrl, setDepositSlipUrl] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadQuotation();

    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');

    if (paymentStatus === 'success') {
      setTimeout(() => {
        window.history.replaceState({}, '', window.location.pathname + window.location.search.split('?')[0]);
        loadQuotation();
      }, 2000);
    }
  }, [token]);

  const loadQuotation = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: linkData, error: linkError } = await supabase
        .from('quotation_public_links')
        .select(`
          id,
          quotation_id,
          expires_at,
          is_active,
          quotations (
            id,
            company_id,
            quotation_no,
            quotation_date,
            expiration_date,
            subtotal,
            vat_enabled,
            vat_rate,
            vat_amount,
            total_amount,
            currency,
            body_html,
            terms_html,
            status,
            event_type_id,
            no_of_pax,
            event_date,
            template_id,
            companies (name),
            customers (name, email, phone),
            event_types (name),
            quotation_templates (logo_url, logo_position, logo_max_width, custom_sections)
          )
        `)
        .eq('token', token)
        .maybeSingle();

      if (linkError) throw linkError;
      if (!linkData) {
        setError('Quotation link not found');
        return;
      }

      if (!linkData.is_active) {
        setError('This quotation link has been deactivated');
        return;
      }

      if (new Date(linkData.expires_at) < new Date()) {
        setError('This quotation link has expired');
        return;
      }

      const { data: responseData } = await supabase
        .from('quotation_customer_responses')
        .select('*')
        .eq('quotation_id', linkData.quotation_id)
        .order('responded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: linesData } = await supabase
        .from('quotation_lines')
        .select('*')
        .eq('quotation_id', linkData.quotation_id)
        .order('order');

      const q = linkData.quotations as any;

      setQuotation({
        id: q.id,
        company_id: q.company_id,
        quotation_number: q.quotation_no,
        company_name: q.companies?.name || '',
        customer_name: q.customers?.name || '',
        customer_email: q.customers?.email || '',
        customer_phone: q.customers?.phone || '',
        quotation_date: q.quotation_date,
        valid_until: q.expiration_date,
        subtotal: parseFloat(q.subtotal || 0),
        vat_enabled: q.vat_enabled || false,
        vat_rate: parseFloat(q.vat_rate || 0),
        vat_amount: parseFloat(q.vat_amount || 0),
        total_amount: parseFloat(q.total_amount || 0),
        currency: q.currency || 'PHP',
        event_type_name: q.event_types?.name,
        no_of_pax: q.no_of_pax,
        event_date: q.event_date,
        template_logo_url: q.quotation_templates?.logo_url,
        template_logo_position: q.quotation_templates?.logo_position,
        template_logo_max_width: q.quotation_templates?.logo_max_width,
        template_custom_sections: q.quotation_templates?.custom_sections,
        body_html: q.body_html || '',
        terms_html: q.terms_html || '',
        status: q.status,
        lines: linesData || [],
        customer_response: responseData ? {
          response_type: responseData.response_type,
          customer_name: responseData.customer_name,
          rejection_reason: responseData.rejection_reason,
          responded_at: responseData.responded_at,
        } : undefined,
      });

      if (q.customers?.name) {
        setCustomerName(q.customers.name);
      }

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('quotation_id', q.id)
        .order('created_at', { ascending: false });

      if (paymentsData) {
        const paidPayments = paymentsData.filter(
          (p) => p.payment_status === 'paid' && p.verification_status !== 'rejected'
        );
        setPayments(paidPayments);

        const paidTotal = paidPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        setTotalPaid(paidTotal);

        const totalAmount = parseFloat(q.total_amount || 0);
        const remaining = Math.max(0, totalAmount - paidTotal);
        setRemainingBalance(remaining);

        setPaymentAmount(remaining > 0 ? Math.round(remaining * 0.5 * 100) / 100 : 0);
      }

      const { data: gatewaysData } = await supabase
        .from('payment_gateway_configs')
        .select('*')
        .eq('company_id', q.company_id)
        .eq('is_active', true)
        .order('provider');

      if (gatewaysData && gatewaysData.length > 0) {
        console.log('Loaded gateways:', gatewaysData.map(g => g.provider));
        setGateways(gatewaysData);
        const checkGateway = gatewaysData.find(g => g.provider === 'check');
        setSelectedGateway(checkGateway ? 'check' : gatewaysData[0].provider);
      }
    } catch (err: any) {
      console.error('Error loading quotation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature('');
  };

  const handleApprove = async () => {
    if (!customerName.trim() || !signature.trim()) {
      alert('Please provide your name and signature');
      return;
    }

    try {
      setSubmitting(true);

      const { data: linkData } = await supabase
        .from('quotation_public_links')
        .select('id, quotation_id')
        .eq('token', token)
        .single();

      if (!linkData) throw new Error('Link not found');

      const { error } = await supabase
        .from('quotation_customer_responses')
        .insert({
          quotation_id: linkData.quotation_id,
          public_link_id: linkData.id,
          response_type: 'approved',
          customer_name: customerName.trim(),
          customer_signature: signature,
        });

      if (error) throw error;

      setShowApproveModal(false);
      await loadQuotation();
      alert('Thank you! Your approval has been recorded.');
    } catch (err: any) {
      console.error('Error approving:', err);
      alert('Failed to submit approval: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!customerName.trim() || !rejectionReason.trim()) {
      alert('Please provide your name and reason for rejection');
      return;
    }

    try {
      setSubmitting(true);

      const { data: linkData } = await supabase
        .from('quotation_public_links')
        .select('id, quotation_id')
        .eq('token', token)
        .single();

      if (!linkData) throw new Error('Link not found');

      const { error } = await supabase
        .from('quotation_customer_responses')
        .insert({
          quotation_id: linkData.quotation_id,
          public_link_id: linkData.id,
          response_type: 'rejected',
          customer_name: customerName.trim(),
          rejection_reason: rejectionReason.trim(),
        });

      if (error) throw error;

      setShowRejectModal(false);
      await loadQuotation();
      alert('Your feedback has been recorded. We will contact you soon.');
    } catch (err: any) {
      console.error('Error rejecting:', err);
      alert('Failed to submit rejection: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = async (simulateSuccess: boolean) => {
    if (!quotation) return;

    if (paymentAmount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    if (paymentAmount > remainingBalance) {
      alert('Payment amount cannot exceed remaining balance');
      return;
    }

    setProcessingPayment(true);
    try {
      const selectedGatewayConfig = gateways.find((g) => g.provider === selectedGateway);
      if (!selectedGatewayConfig) {
        alert('Please select a payment gateway');
        return;
      }

      const testTransactionId = `TEST-PUBLIC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newTotalPaid = totalPaid + paymentAmount;
      const isFullPaymentNow = Math.abs(newTotalPaid - quotation.total_amount) < 0.01;
      const isDepositPayment = !isFullPayment && totalPaid === 0;

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          company_id: selectedGatewayConfig.company_id,
          quotation_id: quotation.id,
          customer_id: null,
          amount: paymentAmount,
          currency: quotation.currency || 'PHP',
          payment_method: selectedGatewayConfig.is_test_mode ? 'test' : selectedGateway,
          payment_status: simulateSuccess ? 'completed' : 'failed',
          transaction_id: testTransactionId,
          payment_date: new Date().toISOString(),
          verification_status: 'pending',
          payment_type: isFullPayment ? 'full' : isDepositPayment ? 'deposit' : 'partial',
          is_deposit: isDepositPayment,
          deposit_percentage: isDepositPayment ? depositPercentage : null,
          expected_total: quotation.total_amount,
          metadata: {
            test_mode: selectedGatewayConfig.is_test_mode,
            simulated_result: simulateSuccess ? 'success' : 'failure',
            public_payment: true,
            customer_name: quotation.customer_name,
            is_full_payment: isFullPayment,
            remaining_before: remainingBalance,
            remaining_after: remainingBalance - paymentAmount,
          },
        });

      if (paymentError) throw paymentError;

      if (simulateSuccess) {
        const newStatus = isFullPaymentNow ? 'fully_paid' : 'deposit_paid';
        await supabase
          .from('quotations')
          .update({ status: newStatus })
          .eq('id', quotation.id);
      }

      const paymentType = isFullPayment ? 'Full payment' : isDepositPayment ? 'Deposit' : 'Partial payment';
      alert(simulateSuccess ? `${paymentType} completed successfully!` : 'Payment failed (simulated).');
      setShowPaymentModal(false);
      await loadQuotation();
    } catch (error: any) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment: ' + error.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCheckPayment = async () => {
    if (!quotation) return;

    if (!bankName.trim() || !checkNumber.trim() || !paymentDate || paymentAmount <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    if (paymentAmount > remainingBalance) {
      alert('Payment amount cannot exceed remaining balance');
      return;
    }

    setProcessingPayment(true);
    try {
      const selectedGatewayConfig = gateways.find((g) => g.provider === 'check');
      if (!selectedGatewayConfig) {
        alert('Check payment gateway not configured');
        return;
      }

      const newTotalPaid = totalPaid + paymentAmount;
      const isFullPaymentNow = Math.abs(newTotalPaid - quotation.total_amount) < 0.01;
      const isDepositPayment = !isFullPayment && totalPaid === 0;
      const paymentStage = isFullPayment ? 'balance' : isDepositPayment ? 'downpayment' : 'partial';

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          company_id: selectedGatewayConfig.company_id,
          quotation_id: quotation.id,
          customer_id: null,
          amount: paymentAmount,
          currency: quotation.currency || 'PHP',
          payment_method: 'check',
          payment_status: 'pending',
          payment_stage: paymentStage,
          deposit_percentage: isDepositPayment ? depositPercentage : null,
          bank_name: bankName.trim(),
          check_number: checkNumber.trim(),
          payment_date: paymentDate,
          deposit_slip_url: depositSlipUrl.trim() || null,
          notes: paymentNotes.trim() || null,
          verification_status: 'pending',
          is_locked: false,
          expected_total: quotation.total_amount,
          metadata: {
            manual_check_payment: true,
            public_payment: true,
            customer_name: quotation.customer_name,
            is_full_payment: isFullPayment,
            remaining_before: remainingBalance,
            remaining_after: remainingBalance - paymentAmount,
            payment_stage: paymentStage,
          },
        });

      if (paymentError) throw paymentError;

      await supabase
        .from('quotations')
        .update({ status: 'pending_finance_verification' })
        .eq('id', quotation.id);

      const paymentType = isFullPayment ? 'Full payment' : isDepositPayment ? 'Deposit' : 'Partial payment';
      alert(`${paymentType} submitted successfully! Your payment will be verified by our Finance team.`);
      setShowPaymentModal(false);
      setBankName('');
      setCheckNumber('');
      setDepositSlipUrl('');
      setPaymentNotes('');
      await loadQuotation();
    } catch (error: any) {
      console.error('Error submitting check payment:', error);
      alert('Failed to submit payment: ' + error.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleLivePayment = async () => {
    if (!quotation) return;

    if (selectedGateway?.toLowerCase() === 'check') {
      alert('Please use the Check Payment form for check payments.');
      return;
    }

    if (paymentAmount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    if (paymentAmount > remainingBalance) {
      alert('Payment amount cannot exceed remaining balance');
      return;
    }

    setProcessingPayment(true);
    try {
      const selectedGatewayConfig = gateways.find((g) => g.provider === selectedGateway);
      if (!selectedGatewayConfig) {
        alert('Please select a payment gateway');
        return;
      }

      const { data: gatewayData } = await supabase
        .from('payment_gateway_configs')
        .select('config')
        .eq('id', selectedGatewayConfig.id)
        .maybeSingle();

      const apiKey = gatewayData?.config?.api_key;
      if (!apiKey) {
        alert('Payment gateway not properly configured. Please add your Xendit API key in Settings.');
        return;
      }

      const externalId = `PAY-${quotation.quotation_number}-${Date.now()}`;
      const currentUrl = window.location.href;
      const baseUrl = currentUrl.split('?')[0];

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/xendit-create-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: paymentAmount,
          currency: quotation.currency || 'PHP',
          description: `Payment for Quotation ${quotation.quotation_number}`,
          externalId: externalId,
          successRedirectUrl: `${baseUrl}?payment=success`,
          failureRedirectUrl: `${baseUrl}?payment=failed`,
          apiKey: apiKey,
        }),
      });

      const invoiceData = await response.json();

      if (!response.ok) {
        console.error('Xendit API error:', invoiceData);
        const errorMessage = invoiceData.error || invoiceData.message || 'Failed to create payment invoice';
        const detailsMessage = invoiceData.details ? ` - ${JSON.stringify(invoiceData.details)}` : '';
        throw new Error(errorMessage + detailsMessage);
      }

      if (!invoiceData.invoice_url) {
        console.error('No invoice URL in response:', invoiceData);
        throw new Error('Payment invoice created but no redirect URL received');
      }

      const newTotalPaid = totalPaid + paymentAmount;
      const isFullPaymentNow = Math.abs(newTotalPaid - quotation.total_amount) < 0.01;
      const isDepositPayment = !isFullPayment && totalPaid === 0;

      await supabase.from('payments').insert({
        company_id: selectedGatewayConfig.company_id,
        quotation_id: quotation.id,
        customer_id: null,
        amount: paymentAmount,
        currency: quotation.currency || 'PHP',
        payment_method: selectedGateway,
        payment_status: 'pending',
        transaction_id: invoiceData.id,
        payment_date: new Date().toISOString(),
        verification_status: 'pending',
        payment_type: isFullPayment ? 'full' : isDepositPayment ? 'deposit' : 'partial',
        is_deposit: isDepositPayment,
        deposit_percentage: isDepositPayment ? depositPercentage : null,
        expected_total: quotation.total_amount,
        metadata: {
          xendit_invoice_id: invoiceData.id,
          xendit_invoice_url: invoiceData.invoice_url,
          external_id: externalId,
          public_payment: true,
          customer_name: quotation.customer_name,
          is_full_payment: isFullPayment,
          remaining_before: remainingBalance,
          remaining_after: remainingBalance - paymentAmount,
        },
      });

      window.location.href = invoiceData.invoice_url;
    } catch (error: any) {
      console.error('Error creating payment:', error);
      alert('Failed to create payment: ' + error.message);
      setProcessingPayment(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = document.querySelector('.quotation-content');
    if (!element) return;

    const opt = {
      margin: 1,
      filename: `Quotation-${quotation?.quotation_number || 'document'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading quotation...</p>
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Quotation</h2>
          <p className="text-gray-600">{error || 'Quotation not found'}</p>
        </div>
      </div>
    );
  }

  const hasResponded = !!quotation.customer_response;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-gray-900">
                  ₱{quotation.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-gray-500 mt-1">Total Amount</div>
              </div>

              {hasResponded ? (
                <div className={`p-4 rounded-lg mb-4 ${
                  quotation.customer_response?.response_type === 'approved'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {quotation.customer_response?.response_type === 'approved' ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-semibold ${
                      quotation.customer_response?.response_type === 'approved'
                        ? 'text-green-900'
                        : 'text-red-900'
                    }`}>
                      {quotation.customer_response?.response_type === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    By: {quotation.customer_response?.customer_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(quotation.customer_response?.responded_at || '').toLocaleString()}
                  </div>
                  {quotation.customer_response?.rejection_reason && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">Reason:</div>
                      <div className="text-sm text-gray-700">{quotation.customer_response.rejection_reason}</div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 mb-3 transition-colors"
                  >
                    <Check className="w-5 h-5" />
                    Accept & Sign
                  </button>

                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <X className="w-5 h-5" />
                    Reject
                  </button>
                </>
              )}

              {remainingBalance <= 0 && totalPaid > 0 && (
                <div className="mt-4 p-4 bg-green-50 border-2 border-green-500 rounded-lg">
                  <div className="flex items-center justify-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-lg font-bold text-green-700">Fully Paid</span>
                  </div>
                </div>
              )}

              {remainingBalance > 0 && (
                <div className="mt-4">
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                    {totalPaid > 0 ? (
                      <>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-600">Total Amount:</span>
                          <span className="font-semibold">₱{quotation.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-600">Paid:</span>
                          <span className="font-semibold text-green-600">₱{totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-red-300">
                          <span className="text-gray-700 font-medium">Balance Due:</span>
                          <span className="font-bold text-red-700">₱{remainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-gray-700 font-medium">Amount Due:</span>
                        <span className="font-bold text-red-700">₱{quotation.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                  {gateways.length > 0 && quotation.customer_response?.response_type === 'approved' && (
                    <button
                      onClick={() => {
                        setIsFullPayment(false);
                        setPaymentAmount(Math.round(remainingBalance * (depositPercentage / 100) * 100) / 100);
                        setShowPaymentModal(true);
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <CreditCard className="w-5 h-5" />
                      {totalPaid > 0 ? 'Pay Remaining Balance' : 'Make Payment'}
                    </button>
                  )}
                </div>
              )}

              {payments.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-semibold text-gray-700 mb-3">Payments</div>
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="p-3 rounded-lg border bg-green-50 border-green-200 text-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">
                            ₱{parseFloat(payment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            Paid
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>Via {payment.payment_method || 'Xendit'}</div>
                          {payment.provider_ref && (
                            <div className="flex items-center gap-1">
                              <span>Ref: {payment.provider_ref}</span>
                            </div>
                          )}
                          {payment.paid_at && (
                            <div>{new Date(payment.paid_at).toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200 print:hidden">
                <div className="text-sm font-semibold text-gray-700 mb-3">Actions</div>
                <div className="space-y-2">
                  <button
                    onClick={handlePrint}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Save as PDF
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-700 mb-3">Quotation Details</div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Number:</span>
                    <div className="font-medium">{quotation.quotation_number}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Date:</span>
                    <div className="font-medium">
                      {new Date(quotation.quotation_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Valid Until:</span>
                    <div className="font-medium">
                      {new Date(quotation.valid_until).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Company:</span>
                    <div className="font-medium">{quotation.company_name}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-700 mb-3">Your Contact</div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div>{quotation.customer_name}</div>
                  <div>{quotation.customer_email}</div>
                  <div>{quotation.customer_phone}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-lg p-8 quotation-content">
              {quotation.template_logo_url && (
                <div className={`mb-6 flex ${quotation.template_logo_position === 'center' ? 'justify-center' : quotation.template_logo_position === 'right' ? 'justify-end' : 'justify-start'}`}>
                  <img
                    src={quotation.template_logo_url}
                    alt="Company logo"
                    style={{ maxWidth: `${quotation.template_logo_max_width || 200}px` }}
                  />
                </div>
              )}

              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">QUOTATION</h1>
                <p className="text-gray-600">{quotation.company_name}</p>
              </div>

              {(quotation.event_type_name || quotation.no_of_pax || quotation.event_date) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Event Details</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {quotation.event_type_name && (
                      <div>
                        <span className="text-gray-600">Event Type:</span>
                        <p className="font-medium text-gray-900">{quotation.event_type_name}</p>
                      </div>
                    )}
                    {quotation.no_of_pax && (
                      <div>
                        <span className="text-gray-600">No. of Pax:</span>
                        <p className="font-medium text-gray-900">{quotation.no_of_pax}</p>
                      </div>
                    )}
                    {quotation.event_date && (
                      <div>
                        <span className="text-gray-600">Event Date:</span>
                        <p className="font-medium text-gray-900">{formatDate(quotation.event_date)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {quotation.body_html && (
                <div className="mb-8 prose prose-slate max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: quotation.body_html }} />
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b-2 border-gray-300">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 border-b-2 border-gray-300">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 border-b-2 border-gray-300">
                        Unit Price
                      </th>
                      {quotation.lines.some((l) => l.discount > 0) && (
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 border-b-2 border-gray-300">
                          Discount
                        </th>
                      )}
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 border-b-2 border-gray-300">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.lines.map((line) => (
                      <tr key={line.id} className="border-b border-gray-200">
                        <td className="px-4 py-3 text-sm text-gray-700">{line.description}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {line.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          ₱{parseFloat(String(line.unit_price)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        {quotation.lines.some((l) => l.discount > 0) && (
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {line.discount > 0 ? `${line.discount}%` : '-'}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          ₱{parseFloat(String(line.subtotal)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
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
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium text-gray-900">
                        ₱{quotation.subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {quotation.vat_enabled && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">VAT ({quotation.vat_rate}%):</span>
                        <span className="font-medium text-gray-900">
                          ₱{quotation.vat_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-3 border-t-2 border-gray-300">
                      <span className="font-semibold text-gray-900">Total:</span>
                      <span className="text-xl font-bold text-gray-900">
                        ₱{quotation.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {!quotation.vat_enabled && (
                      <p className="text-xs text-gray-500 text-right">Exclusive of VAT</p>
                    )}
                  </div>
                </div>
              </div>

              {quotation.terms_html && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Terms & Conditions</h3>
                  <div className="prose prose-slate max-w-none text-sm">
                    <div dangerouslySetInnerHTML={{ __html: quotation.terms_html }} />
                  </div>
                </div>
              )}

              {quotation.template_custom_sections && quotation.template_custom_sections.length > 0 && (
                <div className="mb-8 space-y-6">
                  {quotation.template_custom_sections.map((section: any, index: number) => (
                    <div key={index}>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{section.title}</h3>
                      <div className="prose prose-slate max-w-none text-sm">
                        <div dangerouslySetInnerHTML={{ __html: section.content }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-gray-200 text-xs text-gray-500 text-center">
                <p>
                  This quotation is valid for the period specified above and subject to our standard
                  terms and conditions.
                </p>
              </div>

              {!hasResponded && (
                <div className="mt-8 pt-8 border-t border-gray-200 flex items-center justify-center gap-4 print:hidden">
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white py-3 px-8 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Check className="w-5 h-5" />
                    Accept & Sign
                  </button>

                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="bg-red-500 hover:bg-red-600 text-white py-3 px-8 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                  >
                    <X className="w-5 h-5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Accept Quotation</h3>
              <button
                onClick={() => setShowApproveModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Signature</label>

                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => {
                      setSignatureMode('type');
                      setSignature('');
                      clearCanvas();
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                      signatureMode === 'type'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Type className="w-4 h-4" />
                    Type
                  </button>
                  <button
                    onClick={() => {
                      setSignatureMode('draw');
                      setSignature('');
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                      signatureMode === 'draw'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Pencil className="w-4 h-4" />
                    Draw
                  </button>
                </div>

                {signatureMode === 'type' ? (
                  <>
                    <input
                      type="text"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-2xl"
                      placeholder="Type your signature"
                      style={{ fontFamily: 'cursive' }}
                    />
                    <p className="text-xs text-gray-500 mt-1">Type your name as your digital signature</p>
                  </>
                ) : (
                  <div>
                    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                      <canvas
                        ref={canvasRef}
                        width={450}
                        height={200}
                        className="w-full cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                    </div>
                    <button
                      onClick={clearCanvas}
                      className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Clear Signature
                    </button>
                    <p className="text-xs text-gray-500 mt-1">Draw your signature above</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
                By signing, you confirm acceptance of this ₱{quotation.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} quotation.
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting || !customerName.trim() || !signature.trim()}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Accept & Sign
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Reject Quotation</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Rejection</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Please let us know why you're rejecting this quotation..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={submitting || !customerName.trim() || !rejectionReason.trim()}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full my-8">
            <div className="sticky top-0 bg-white rounded-t-lg border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">Make Payment</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-4 pb-6">
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Quotation:</span>
                <span className="font-medium text-gray-900">{quotation.quotation_number}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Amount:</span>
                <span className="font-semibold text-gray-900">
                  ₱{quotation.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {totalPaid > 0 && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Already Paid:</span>
                    <span className="font-semibold text-green-600">
                      ₱{totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-300">
                    <span className="text-sm text-gray-700 font-medium">Remaining:</span>
                    <span className="text-lg font-bold text-blue-600">
                      ₱{remainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}
            </div>

            {gateways.length > 0 && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Type
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFullPayment(false);
                        setPaymentAmount(Math.round(remainingBalance * (depositPercentage / 100) * 100) / 100);
                      }}
                      className={`px-4 py-2 border-2 rounded-lg font-medium transition-colors ${
                        !isFullPayment
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFullPayment(true);
                        setPaymentAmount(remainingBalance);
                      }}
                      className={`px-4 py-2 border-2 rounded-lg font-medium transition-colors ${
                        isFullPayment
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Full Payment
                    </button>
                  </div>
                </div>

                {!isFullPayment && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deposit Percentage: {depositPercentage}%
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={depositPercentage}
                      onChange={(e) => {
                        const percent = parseInt(e.target.value);
                        setDepositPercentage(percent);
                        setPaymentAmount(Math.round(remainingBalance * (percent / 100) * 100) / 100);
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>10%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-600">₱</span>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      min="0"
                      max={remainingBalance}
                      step="0.01"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum: ₱{remainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Gateway
                  </label>
                  <select
                    value={selectedGateway}
                    onChange={(e) => setSelectedGateway(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {gateways.map((gateway) => (
                      <option key={gateway.id} value={gateway.provider}>
                        {gateway.provider === 'check' ? 'Check Payment' :
                         gateway.provider.charAt(0).toUpperCase() + gateway.provider.slice(1)}
                        {gateway.is_test_mode && gateway.provider !== 'check' && ' (Test Mode)'}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedGateway?.toLowerCase() === 'check' ? (
                  <>
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>Check Payment:</strong> Fill in your check details below. Your payment will be verified by our Finance team.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bank Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="e.g., BDO, BPI"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Check Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={checkNumber}
                          onChange={(e) => setCheckNumber(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Check #"
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Deposit Slip Link (Optional)
                      </label>
                      <input
                        type="url"
                        value={depositSlipUrl}
                        onChange={(e) => setDepositSlipUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="https://example.com/deposit-slip.jpg"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload your deposit slip to cloud storage and paste the link here
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Any additional notes..."
                      />
                    </div>

                    <button
                      onClick={handleCheckPayment}
                      disabled={processingPayment || !bankName.trim() || !checkNumber.trim() || !paymentDate || paymentAmount <= 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      {processingPayment ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5" />
                          Submit Check Payment
                        </>
                      )}
                    </button>
                  </>
                ) : gateways.find((g) => g.provider === selectedGateway)?.is_test_mode ? (
                  <>
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Test Mode:</strong> You can simulate a successful or failed payment for testing purposes.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handlePayment(true)}
                        disabled={processingPayment || paymentAmount <= 0}
                        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                      >
                        {processingPayment ? 'Processing...' : 'Simulate Success'}
                      </button>
                      <button
                        onClick={() => handlePayment(false)}
                        disabled={processingPayment}
                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                      >
                        {processingPayment ? 'Processing...' : 'Simulate Failure'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        You will be redirected to {selectedGateway} to complete your payment securely.
                      </p>
                    </div>

                    <button
                      onClick={handleLivePayment}
                      disabled={processingPayment || paymentAmount <= 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      <CreditCard className="w-5 h-5" />
                      {processingPayment ? 'Processing...' : 'Proceed to Payment'}
                    </button>
                  </>
                )}
              </>
            )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 20px;
          }
          .bg-gray-50 {
            background: white;
          }
        }
      `}</style>
    </div>
  );
}
