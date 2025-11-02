import { useState, useEffect } from 'react';
import { X, CreditCard, DollarSign, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PaymentGatewayConfig {
  id: string;
  provider: string;
  is_active: boolean;
  is_test_mode: boolean;
}

interface ProformaInvoicePaymentModalProps {
  invoiceId: string;
  invoiceNo: string;
  totalAmount: number;
  remainingAmount: number;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProformaInvoicePaymentModal({
  invoiceId,
  invoiceNo,
  totalAmount,
  remainingAmount,
  currency,
  onClose,
  onSuccess,
}: ProformaInvoicePaymentModalProps) {
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'deposit' | 'full'>('deposit');
  const [depositPercentage, setDepositPercentage] = useState(50);
  const [bankName, setBankName] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositSlipUrl, setDepositSlipUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');

  useEffect(() => {
    loadInvoiceAndGateways();
  }, [invoiceId]);

  const loadInvoiceAndGateways = async () => {
    const { data: invoiceData } = await supabase
      .from('proforma_invoices')
      .select('company_id')
      .eq('id', invoiceId)
      .single();

    if (invoiceData) {
      setCompanyId(invoiceData.company_id);

      const { data } = await supabase
        .from('payment_gateway_configs')
        .select('*')
        .eq('company_id', invoiceData.company_id)
        .eq('is_active', true);

      if (data) {
        setGateways(data);
        if (data.length > 0) {
          setSelectedGateway(data[0].provider);
        }
      }
    }
  };

  const calculatePaymentAmount = () => {
    if (paymentType === 'full') {
      return remainingAmount;
    } else {
      return (remainingAmount * depositPercentage) / 100;
    }
  };

  const paymentAmount = calculatePaymentAmount();
  const maxAmount = remainingAmount;

  const handleCheckPayment = async () => {
    if (!bankName.trim() || !checkNumber.trim() || !paymentDate || paymentAmount <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    if (paymentAmount > remainingAmount) {
      alert('Payment amount cannot exceed remaining amount');
      return;
    }

    setSubmitting(true);
    try {
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          company_id: companyId,
          quotation_id: null,
          proforma_invoice_id: invoiceId,
          customer_id: null,
          amount: paymentAmount,
          currency: currency || 'PHP',
          payment_method: 'check',
          payment_status: 'pending',
          payment_stage: paymentType,
          deposit_percentage: paymentType === 'deposit' ? depositPercentage : null,
          bank_name: bankName.trim(),
          check_number: checkNumber.trim(),
          payment_date: paymentDate,
          deposit_slip_url: depositSlipUrl.trim() || null,
          notes: notes.trim() || null,
          verification_status: 'pending',
          is_locked: false,
          expected_total: totalAmount,
          metadata: {
            manual_check_payment: true,
            proforma_invoice_no: invoiceNo,
            balance_before: remainingAmount,
            balance_after: remainingAmount - paymentAmount,
          },
        });

      if (paymentError) {
        console.error('Payment error:', paymentError);
        throw paymentError;
      }

      alert('Check payment submitted successfully! It will be reviewed by the finance team.');
      onSuccess();
    } catch (error: any) {
      console.error('Error submitting payment:', error);
      alert(error.message || 'Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleXenditPayment = async () => {
    if (paymentAmount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    if (paymentAmount > remainingAmount) {
      alert('Payment amount cannot exceed remaining amount');
      return;
    }

    setSubmitting(true);
    try {
      const { data: gatewayData } = await supabase
        .from('payment_gateway_configs')
        .select('config, id')
        .eq('company_id', companyId)
        .eq('provider', selectedGateway)
        .eq('is_active', true)
        .maybeSingle();

      const apiKey = gatewayData?.config?.api_key;
      if (!apiKey) {
        alert('Payment gateway not properly configured. Please contact support.');
        return;
      }

      const externalId = `PAY-${invoiceNo}-${Date.now()}`;
      const currentUrl = window.location.href;
      const baseUrl = currentUrl.split('?')[0];

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/xendit-create-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: paymentAmount,
          currency: currency || 'PHP',
          description: `Payment for Proforma Invoice ${invoiceNo}`,
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
        throw new Error(errorMessage);
      }

      if (!invoiceData.invoice_url) {
        console.error('No invoice URL in response:', invoiceData);
        throw new Error('Payment invoice created but no redirect URL received');
      }

      const isFullPaymentNow = paymentType === 'full' || Math.abs(paymentAmount - remainingAmount) < 0.01;
      const isDepositPayment = paymentType === 'deposit';

      await supabase.from('payments').insert({
        company_id: companyId,
        quotation_id: null,
        proforma_invoice_id: invoiceId,
        customer_id: null,
        amount: paymentAmount,
        currency: currency || 'PHP',
        payment_method: selectedGateway,
        payment_status: 'pending',
        transaction_id: invoiceData.id,
        payment_date: new Date().toISOString(),
        verification_status: 'pending',
        payment_type: isFullPaymentNow ? 'full' : isDepositPayment ? 'deposit' : 'partial',
        is_deposit: isDepositPayment,
        deposit_percentage: isDepositPayment ? depositPercentage : null,
        expected_total: totalAmount,
        metadata: {
          xendit_invoice_id: invoiceData.id,
          xendit_invoice_url: invoiceData.invoice_url,
          external_id: externalId,
          public_payment: true,
          proforma_invoice_no: invoiceNo,
          is_full_payment: isFullPaymentNow,
          remaining_before: remainingAmount,
          remaining_after: remainingAmount - paymentAmount,
        },
      });

      window.location.href = invoiceData.invoice_url;
    } catch (error: any) {
      console.error('Error creating payment:', error);
      alert('Failed to create payment: ' + error.message);
      setSubmitting(false);
    }
  };

  const isCheckPaymentSelected = selectedGateway === 'check';

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Make Payment</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm text-slate-600 mb-1">Invoice</div>
              <div className="text-lg font-semibold text-slate-900">{invoiceNo}</div>
              <div className="text-sm text-slate-600 mt-2">
                Total Amount: <span className="font-medium text-slate-900">₱{totalAmount.toLocaleString()}</span>
              </div>
              <div className="text-sm text-slate-600">
                Remaining: <span className="font-medium text-slate-900">₱{remainingAmount.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">Payment Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentType('deposit')}
                  className={`p-4 border-2 rounded-lg font-medium transition-all ${
                    paymentType === 'deposit'
                      ? 'border-green-600 bg-green-50 text-green-900'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('full')}
                  className={`p-4 border-2 rounded-lg font-medium transition-all ${
                    paymentType === 'full'
                      ? 'border-green-600 bg-green-50 text-green-900'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Full Payment
                </button>
              </div>
            </div>

            {paymentType === 'deposit' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Deposit Percentage: {depositPercentage}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={depositPercentage}
                  onChange={(e) => setDepositPercentage(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>10%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Payment Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₱</span>
                <input
                  type="number"
                  value={paymentAmount.toFixed(2)}
                  readOnly
                  className="w-full pl-8 pr-4 py-3 text-lg font-semibold border border-slate-300 rounded-lg bg-slate-50"
                />
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Maximum: ₱{maxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {gateways.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Payment Gateway</label>
                <div className="space-y-3">
                  {gateways.map((gateway) => {
                    const gatewayLabels: Record<string, string> = {
                      xendit: 'Xendit (Cards, E-Wallets, Bank Transfer)',
                      paymongo: 'PayMongo (GCash, Cards)',
                      paypal: 'PayPal',
                      check: 'Check Payment',
                    };

                    return (
                      <div
                        key={gateway.id}
                        onClick={() => setSelectedGateway(gateway.provider)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedGateway === gateway.provider
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-900">
                              {gatewayLabels[gateway.provider] || gateway.provider}
                            </div>
                            {gateway.is_test_mode && (
                              <span className="text-xs text-orange-600 font-medium">Test Mode</span>
                            )}
                          </div>
                          <CreditCard className="w-5 h-5 text-slate-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">No payment gateways configured</p>
                  <p>Please contact your administrator to set up payment methods.</p>
                </div>
              </div>
            )}

            {isCheckPaymentSelected && (
              <div className="space-y-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Check Payment:</strong> Fill in your check details below. Your payment will be verified by our Finance team.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g., BDO, BPI"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Check Number *
                    </label>
                    <input
                      type="text"
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value)}
                      placeholder="Check #"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Payment Date *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Deposit Slip Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={depositSlipUrl}
                    onChange={(e) => setDepositSlipUrl(e.target.value)}
                    placeholder="https://example.com/deposit-slip.jpg"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Upload your deposit slip to cloud storage and paste the link here
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional notes..."
                  />
                </div>

                <button
                  onClick={handleCheckPayment}
                  disabled={submitting || !bankName.trim() || !checkNumber.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Check Payment
                    </>
                  )}
                </button>
              </div>
            )}

            {selectedGateway && !isCheckPaymentSelected && (
              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleXenditPayment}
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Continue to Payment
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
