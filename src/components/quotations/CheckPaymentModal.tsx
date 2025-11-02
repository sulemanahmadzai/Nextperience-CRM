import { useState } from 'react';
import { X, Upload, Loader2, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CheckPaymentModalProps {
  quotation: {
    id: string;
    quotation_number: string;
    total_amount: number;
    currency: string;
  };
  totalPaid: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckPaymentModal({ quotation, totalPaid, onClose, onSuccess }: CheckPaymentModalProps) {
  const [paymentStage, setPaymentStage] = useState<'downpayment' | 'balance' | 'partial'>('downpayment');
  const [downpaymentPercentage, setDownpaymentPercentage] = useState(50);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [bankName, setBankName] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositSlipUrl, setDepositSlipUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const balanceRemaining = quotation.total_amount - totalPaid;

  useState(() => {
    if (totalPaid === 0) {
      setPaymentStage('downpayment');
      setPaymentAmount(Math.round(quotation.total_amount * 0.5 * 100) / 100);
    } else {
      setPaymentStage('balance');
      setPaymentAmount(balanceRemaining);
    }
  });

  const handleStageChange = (stage: 'downpayment' | 'balance' | 'partial') => {
    setPaymentStage(stage);
    if (stage === 'downpayment') {
      setPaymentAmount(Math.round(quotation.total_amount * (downpaymentPercentage / 100) * 100) / 100);
    } else if (stage === 'balance') {
      setPaymentAmount(balanceRemaining);
    } else {
      setPaymentAmount(Math.round(balanceRemaining * 0.5 * 100) / 100);
    }
  };

  const handlePercentageChange = (percentage: number) => {
    setDownpaymentPercentage(percentage);
    if (paymentStage === 'downpayment') {
      setPaymentAmount(Math.round(quotation.total_amount * (percentage / 100) * 100) / 100);
    }
  };

  const handleSubmit = async () => {
    if (!bankName.trim() || !checkNumber.trim() || !paymentDate || paymentAmount <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    if (paymentAmount > balanceRemaining) {
      alert('Payment amount cannot exceed balance remaining');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          company_id: quotation.id,
          quotation_id: quotation.id,
          customer_id: null,
          amount: paymentAmount,
          currency: quotation.currency || 'PHP',
          payment_method: 'check',
          payment_status: 'pending',
          payment_stage: paymentStage,
          deposit_percentage: paymentStage === 'downpayment' ? downpaymentPercentage : null,
          bank_name: bankName.trim(),
          check_number: checkNumber.trim(),
          payment_date: paymentDate,
          deposit_slip_url: depositSlipUrl.trim() || null,
          notes: notes.trim() || null,
          verification_status: 'pending',
          is_locked: false,
          expected_total: quotation.total_amount,
          metadata: {
            manual_check_payment: true,
            submitted_by: user.email,
            balance_before: balanceRemaining,
            balance_after: balanceRemaining - paymentAmount,
          },
        });

      if (paymentError) throw paymentError;

      await supabase
        .from('quotations')
        .update({ status: 'pending_finance_verification' })
        .eq('id', quotation.id);

      await supabase.from('audit_logs').insert({
        company_id: quotation.id,
        user_id: user.id,
        action: 'payment_submitted',
        entity_type: 'payment',
        entity_id: quotation.id,
        description: `Check payment of ${quotation.currency} ${paymentAmount.toLocaleString()} submitted for verification`,
        metadata: {
          quotation_number: quotation.quotation_number,
          payment_stage: paymentStage,
          check_number: checkNumber,
          bank_name: bankName,
        },
      });

      alert('Check payment submitted successfully! Awaiting Finance verification.');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error submitting payment:', error);
      alert('Failed to submit payment: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Submit Check Payment</h3>
              <p className="text-sm text-gray-600">Quotation {quotation.quotation_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Amount:</span>
                <p className="font-semibold text-gray-900">
                  {quotation.currency} {quotation.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>
              {totalPaid > 0 && (
                <>
                  <div>
                    <span className="text-gray-600">Already Paid:</span>
                    <p className="font-semibold text-green-600">
                      {quotation.currency} {totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-blue-300">
                    <span className="text-gray-700 font-medium">Balance Remaining:</span>
                    <p className="text-xl font-bold text-blue-700">
                      {quotation.currency} {balanceRemaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </>
              )}
              {totalPaid === 0 && (
                <div>
                  <span className="text-gray-600">Amount Due:</span>
                  <p className="text-xl font-bold text-blue-700">
                    {quotation.currency} {quotation.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Stage <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleStageChange('downpayment')}
                className={`px-4 py-3 border-2 rounded-lg font-medium transition-colors ${
                  paymentStage === 'downpayment'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Downpayment
              </button>
              <button
                type="button"
                onClick={() => handleStageChange('balance')}
                className={`px-4 py-3 border-2 rounded-lg font-medium transition-colors ${
                  paymentStage === 'balance'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Balance
              </button>
              <button
                type="button"
                onClick={() => handleStageChange('partial')}
                className={`px-4 py-3 border-2 rounded-lg font-medium transition-colors ${
                  paymentStage === 'partial'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Partial
              </button>
            </div>
          </div>

          {paymentStage === 'downpayment' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>10%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-600">{quotation.currency}</span>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                min="0"
                max={balanceRemaining}
                step="0.01"
                className="w-full pl-16 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum: {quotation.currency} {balanceRemaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., BDO, BPI, Metrobank"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Check number"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deposit Slip Link
            </label>
            <div className="relative">
              <Upload className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="url"
                value={depositSlipUrl}
                onChange={(e) => setDepositSlipUrl(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/deposit-slip.jpg"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Upload your deposit slip to a cloud storage and paste the link here
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any additional notes or information..."
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Your check payment will be submitted for Finance Officer verification.
              The quotation status will update to "Pending Finance Verification" until approved.
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !bankName.trim() || !checkNumber.trim() || !paymentDate || paymentAmount <= 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
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
          </div>
        </div>
      </div>
    </div>
  );
}
