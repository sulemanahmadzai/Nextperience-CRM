import { useState, useEffect } from 'react';
import { X, CreditCard, DollarSign, AlertCircle, Upload, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

interface PaymentGatewayConfig {
  id: string;
  provider: string;
  is_active: boolean;
  is_test_mode: boolean;
}

interface PaymentModalProps {
  quotationId: string;
  customerId: string;
  amount: number;
  currency: string;
  quotationNumber: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({
  quotationId,
  customerId,
  amount,
  currency,
  quotationNumber,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [isTestMode, setIsTestMode] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentStage, setPaymentStage] = useState<'downpayment' | 'balance' | 'partial'>('downpayment');
  const [downpaymentPercentage, setDownpaymentPercentage] = useState(50);
  const [paymentAmount, setPaymentAmount] = useState(amount);
  const [bankName, setBankName] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositSlipUrl, setDepositSlipUrl] = useState('');

  useEffect(() => {
    loadGateways();
  }, [currentCompany]);

  const loadGateways = async () => {
    if (!currentCompany) return;

    const { data } = await supabase
      .from('payment_gateway_configs')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true);

    if (data) {
      setGateways(data);
      if (data.length > 0) {
        setSelectedGateway(data[0].provider);
        setIsTestMode(data[0].is_test_mode);
      }
    }
  };

  const handleTestPayment = async (success: boolean) => {
    if (!currentCompany || !user) return;

    setProcessing(true);
    try {
      const testTransactionId = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const paymentData = {
        company_id: currentCompany.id,
        quotation_id: quotationId,
        customer_id: customerId,
        amount,
        currency,
        payment_method: 'test',
        payment_status: success ? 'completed' : 'failed',
        transaction_id: testTransactionId,
        payment_date: new Date().toISOString(),
        verification_status: 'pending',
        metadata: {
          test_mode: true,
          simulated_result: success ? 'success' : 'failure',
          notes: paymentNotes || null,
        },
        created_by: user.id,
      };

      const { error: paymentError } = await supabase
        .from('payments')
        .insert(paymentData);

      if (paymentError) throw paymentError;

      if (success) {
        await supabase
          .from('quotations')
          .update({ status: 'paid' })
          .eq('id', quotationId);
      }

      await supabase.from('audit_logs').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        action: success ? 'test_payment_success' : 'test_payment_failed',
        entity_type: 'payment',
        entity_id: quotationId,
        details: {
          quotation_number: quotationNumber,
          amount,
          currency,
          transaction_id: testTransactionId,
        },
      });

      alert(success ? 'Test payment completed successfully!' : 'Test payment failed (simulated).');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error processing test payment:', error);
      alert('Failed to process test payment: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRealPayment = async () => {
    if (!currentCompany || !user) return;
    if (!transactionId.trim()) {
      alert('Please enter a transaction ID');
      return;
    }

    setProcessing(true);
    try {
      const paymentData = {
        company_id: currentCompany.id,
        quotation_id: quotationId,
        customer_id: customerId,
        amount,
        currency,
        payment_method: selectedGateway,
        payment_status: 'completed',
        transaction_id: transactionId.trim(),
        payment_date: new Date().toISOString(),
        verification_status: 'pending',
        metadata: {
          gateway: selectedGateway,
          notes: paymentNotes || null,
        },
        created_by: user.id,
      };

      const { error: paymentError } = await supabase
        .from('payments')
        .insert(paymentData);

      if (paymentError) throw paymentError;

      await supabase
        .from('quotations')
        .update({ status: 'paid' })
        .eq('id', quotationId);

      await supabase.from('audit_logs').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        action: 'payment_recorded',
        entity_type: 'payment',
        entity_id: quotationId,
        details: {
          quotation_number: quotationNumber,
          amount,
          currency,
          gateway: selectedGateway,
          transaction_id: transactionId.trim(),
        },
      });

      alert('Payment recorded successfully! Awaiting verification.');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (currency === 'PHP') {
      return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    }
    return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, style: 'currency', currency })}`;
  };

  const handleCheckPayment = async () => {
    if (!currentCompany || !user) return;
    if (!bankName.trim() || !checkNumber.trim() || !paymentDate || paymentAmount <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    setProcessing(true);
    try {
      const paymentData = {
        company_id: currentCompany.id,
        quotation_id: quotationId,
        customer_id: customerId,
        amount: paymentAmount,
        currency,
        payment_method: 'check',
        payment_status: 'pending',
        payment_stage: paymentStage,
        deposit_percentage: paymentStage === 'downpayment' ? downpaymentPercentage : null,
        bank_name: bankName.trim(),
        check_number: checkNumber.trim(),
        payment_date: paymentDate,
        deposit_slip_url: depositSlipUrl.trim() || null,
        notes: paymentNotes.trim() || null,
        verification_status: 'pending',
        is_locked: false,
        metadata: {
          manual_check_payment: true,
          submitted_by: user.email,
          payment_stage: paymentStage,
        },
        created_by: user.id,
      };

      const { error: paymentError } = await supabase
        .from('payments')
        .insert(paymentData);

      if (paymentError) throw paymentError;

      await supabase
        .from('quotations')
        .update({ status: 'pending_finance_verification' })
        .eq('id', quotationId);

      await supabase.from('audit_logs').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        action: 'check_payment_submitted',
        entity_type: 'payment',
        entity_id: quotationId,
        details: {
          quotation_number: quotationNumber,
          amount: paymentAmount,
          currency,
          payment_stage: paymentStage,
          check_number: checkNumber,
          bank_name: bankName,
        },
      });

      alert('Check payment submitted successfully! Awaiting Finance verification.');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error submitting check payment:', error);
      alert('Failed to submit payment: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleStageChange = (stage: 'downpayment' | 'balance' | 'partial') => {
    setPaymentStage(stage);
    if (stage === 'downpayment') {
      setPaymentAmount(Math.round(amount * (downpaymentPercentage / 100) * 100) / 100);
    } else if (stage === 'balance') {
      setPaymentAmount(amount);
    } else {
      setPaymentAmount(Math.round(amount * 0.5 * 100) / 100);
    }
  };

  const handlePercentageChange = (percentage: number) => {
    setDownpaymentPercentage(percentage);
    if (paymentStage === 'downpayment') {
      setPaymentAmount(Math.round(amount * (percentage / 100) * 100) / 100);
    }
  };

  const isCheckPayment = selectedGateway === 'check';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-slate-700" />
            <h2 className="text-xl font-semibold text-slate-900">Record Payment</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Quotation:</span>
              <span className="font-medium text-slate-900">{quotationNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Amount:</span>
              <span className="text-xl font-bold text-slate-900">{formatCurrency(amount)}</span>
            </div>
          </div>

          {gateways.length === 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">No payment gateways configured</p>
                <p>Please configure payment gateways in Settings before accepting payments.</p>
              </div>
            </div>
          )}

          {gateways.length > 0 && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Payment Gateway
                </label>
                <select
                  value={selectedGateway}
                  onChange={(e) => {
                    const gateway = gateways.find((g) => g.provider === e.target.value);
                    setSelectedGateway(e.target.value);
                    if (gateway) setIsTestMode(gateway.is_test_mode);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
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

              {isCheckPayment ? (
                <>
                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>Check Payment:</strong> Submit check payment details for Finance Officer verification.
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Payment Stage <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleStageChange('downpayment')}
                        className={`px-3 py-2 border-2 rounded-lg font-medium text-sm transition-colors ${
                          paymentStage === 'downpayment'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        Downpayment
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStageChange('balance')}
                        className={`px-3 py-2 border-2 rounded-lg font-medium text-sm transition-colors ${
                          paymentStage === 'balance'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        Balance
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStageChange('partial')}
                        className={`px-3 py-2 border-2 rounded-lg font-medium text-sm transition-colors ${
                          paymentStage === 'partial'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        Partial
                      </button>
                    </div>
                  </div>

                  {paymentStage === 'downpayment' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Downpayment Percentage: {downpaymentPercentage}%
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={downpaymentPercentage}
                        onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>10%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Payment Amount <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-600">{currency}</span>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                        min="0"
                        max={amount}
                        step="0.01"
                        className="w-full pl-16 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Maximum: {formatCurrency(amount)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Bank Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., BDO, BPI"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Check Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={checkNumber}
                        onChange={(e) => setCheckNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Check #"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Payment Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Deposit Slip Link
                    </label>
                    <div className="relative">
                      <Upload className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input
                        type="url"
                        value={depositSlipUrl}
                        onChange={(e) => setDepositSlipUrl(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://example.com/deposit-slip.jpg"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Upload your deposit slip to cloud storage and paste the link here
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Any additional notes..."
                    />
                  </div>

                  <button
                    onClick={handleCheckPayment}
                    disabled={processing || !bankName.trim() || !checkNumber.trim() || !paymentDate || paymentAmount <= 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        Submit for Verification
                      </>
                    )}
                  </button>
                </>
              ) : isTestMode ? (
                <>
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Test Mode:</strong> You can simulate a successful or failed payment for testing purposes.
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      placeholder="Add any notes about this test payment..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleTestPayment(true)}
                      disabled={processing}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      {processing ? 'Processing...' : 'Simulate Success'}
                    </button>
                    <button
                      onClick={() => handleTestPayment(false)}
                      disabled={processing}
                      className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                    >
                      {processing ? 'Processing...' : 'Simulate Failure'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Transaction ID *
                    </label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      placeholder="Enter payment transaction ID"
                      required
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                      placeholder="Add any notes about this payment..."
                    />
                  </div>

                  <button
                    onClick={handleRealPayment}
                    disabled={processing || !transactionId.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 font-medium"
                  >
                    <DollarSign className="w-5 h-5" />
                    {processing ? 'Recording Payment...' : 'Record Payment'}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            disabled={processing}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
