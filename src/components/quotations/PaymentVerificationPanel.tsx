import { useState, useEffect } from 'react';
import { Check, X, Eye, FileText, ExternalLink, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  payment_stage: string;
  bank_name: string;
  check_number: string;
  payment_date: string;
  deposit_slip_url: string;
  notes: string;
  verification_status: string;
  verification_notes: string;
  verified_by: string;
  verified_at: string;
  rejection_reason: string;
  is_locked: boolean;
  created_at: string;
  metadata: any;
}

interface PaymentVerificationPanelProps {
  quotationId: string;
  onPaymentVerified: () => void;
}

export function PaymentVerificationPanel({ quotationId, onPaymentVerified }: PaymentVerificationPanelProps) {
  const { userRole, hasAllAccess } = useCompany();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [verificationAction, setVerificationAction] = useState<'verify' | 'reject' | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const role = userRole?.roles as any;
  const roleName = role?.name?.toLowerCase();
  const permissions = role?.permissions || {};
  const canVerifyPayments = hasAllAccess ||
    roleName === 'admin' ||
    roleName === 'finance officer' ||
    permissions?.payments?.update === true;

  useEffect(() => {
    loadPayments();
  }, [quotationId]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('quotation_id', quotationId)
        .eq('payment_method', 'check')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedPayment) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          verification_status: 'verified',
          payment_status: 'paid',
          verification_notes: verificationNotes.trim(),
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          is_locked: true,
        })
        .eq('id', selectedPayment.id);

      if (paymentError) throw paymentError;

      const { data: allPayments } = await supabase
        .from('payments')
        .select('amount, verification_status')
        .eq('quotation_id', quotationId);

      const totalVerifiedPaid = allPayments
        ?.filter((p) => p.verification_status === 'verified')
        .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;

      const { data: quotation } = await supabase
        .from('quotations')
        .select('total_amount')
        .eq('id', quotationId)
        .single();

      const balanceRemaining = (quotation?.total_amount || 0) - totalVerifiedPaid;
      const newStatus = balanceRemaining <= 0.01 ? 'fully_paid' : 'deposit_paid';

      await supabase
        .from('quotations')
        .update({ status: newStatus })
        .eq('id', quotationId);

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'payment_verified',
        entity_type: 'payment',
        entity_id: selectedPayment.id,
        description: `Check payment of ${selectedPayment.currency} ${selectedPayment.amount.toLocaleString()} verified`,
        metadata: {
          payment_id: selectedPayment.id,
          check_number: selectedPayment.check_number,
          bank_name: selectedPayment.bank_name,
          verification_notes: verificationNotes.trim(),
        },
      });

      alert('Payment verified successfully!');
      setSelectedPayment(null);
      setVerificationAction(null);
      setVerificationNotes('');
      await loadPayments();
      onPaymentVerified();
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      alert('Failed to verify payment: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment || !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          verification_status: 'rejected',
          payment_status: 'failed',
          rejection_reason: rejectionReason.trim(),
          verification_notes: verificationNotes.trim(),
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', selectedPayment.id);

      if (paymentError) throw paymentError;

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'payment_rejected',
        entity_type: 'payment',
        entity_id: selectedPayment.id,
        description: `Check payment of ${selectedPayment.currency} ${selectedPayment.amount.toLocaleString()} rejected`,
        metadata: {
          payment_id: selectedPayment.id,
          check_number: selectedPayment.check_number,
          bank_name: selectedPayment.bank_name,
          rejection_reason: rejectionReason.trim(),
        },
      });

      alert('Payment rejected successfully!');
      setSelectedPayment(null);
      setVerificationAction(null);
      setVerificationNotes('');
      setRejectionReason('');
      await loadPayments();
      onPaymentVerified();
    } catch (error: any) {
      console.error('Error rejecting payment:', error);
      alert('Failed to reject payment: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (payment: Payment) => {
    if (payment.verification_status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          Verified
        </span>
      );
    } else if (payment.verification_status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
          <Clock className="w-3 h-3" />
          Pending Verification
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600">Loading payments...</div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>No check payments submitted yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Check Payments</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          {payments.filter((p) => p.verification_status === 'pending').length} pending verification
        </div>
      </div>

      {!canVerifyPayments && payments.some((p) => p.verification_status === 'pending') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> You need Admin or Finance Officer role to verify payments. Please contact your administrator.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className={`border rounded-lg p-4 ${
              payment.verification_status === 'pending'
                ? 'border-amber-200 bg-amber-50'
                : payment.verification_status === 'verified'
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">
                    {payment.currency} {parseFloat(payment.amount.toString()).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                  {getStatusBadge(payment)}
                </div>
                <p className="text-sm text-gray-600 capitalize">{payment.payment_stage} Payment</p>
              </div>
              {payment.verification_status === 'pending' && !payment.is_locked && canVerifyPayments && (
                <button
                  onClick={() => {
                    setSelectedPayment(payment);
                    setVerificationAction('verify');
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  Review
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Bank:</span>
                <p className="font-medium text-gray-900">{payment.bank_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Check #:</span>
                <p className="font-medium text-gray-900">{payment.check_number}</p>
              </div>
              <div>
                <span className="text-gray-600">Payment Date:</span>
                <p className="font-medium text-gray-900">
                  {new Date(payment.payment_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Submitted:</span>
                <p className="font-medium text-gray-900">
                  {new Date(payment.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {payment.deposit_slip_url && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <a
                  href={payment.deposit_slip_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Deposit Slip
                </a>
              </div>
            )}

            {payment.notes && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <span className="text-xs text-gray-600">Notes:</span>
                <p className="text-sm text-gray-700 mt-1">{payment.notes}</p>
              </div>
            )}

            {payment.verification_status === 'verified' && payment.verification_notes && (
              <div className="mt-3 pt-3 border-t border-green-300">
                <span className="text-xs text-green-700 font-medium">Verification Notes:</span>
                <p className="text-sm text-green-800 mt-1">{payment.verification_notes}</p>
              </div>
            )}

            {payment.verification_status === 'rejected' && payment.rejection_reason && (
              <div className="mt-3 pt-3 border-t border-red-300">
                <span className="text-xs text-red-700 font-medium">Rejection Reason:</span>
                <p className="text-sm text-red-800 mt-1">{payment.rejection_reason}</p>
              </div>
            )}

            {payment.is_locked && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>Payment locked - verified and cannot be modified</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedPayment && verificationAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {verificationAction === 'verify' ? 'Verify Payment' : 'Reject Payment'}
              </h3>
              <button
                onClick={() => {
                  setSelectedPayment(null);
                  setVerificationAction(null);
                  setVerificationNotes('');
                  setRejectionReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold">
                    {selectedPayment.currency} {parseFloat(selectedPayment.amount.toString()).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bank:</span>
                  <span className="font-semibold">{selectedPayment.bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Check Number:</span>
                  <span className="font-semibold">{selectedPayment.check_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Date:</span>
                  <span className="font-semibold">
                    {new Date(selectedPayment.payment_date).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {verificationAction === 'verify' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Verification Notes (Optional)
                    </label>
                    <textarea
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Add any notes about this verification..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedPayment(null);
                        setVerificationAction(null);
                        setVerificationNotes('');
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setVerificationAction('reject')}
                      className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                      disabled={submitting}
                    >
                      Reject
                    </button>
                    <button
                      onClick={handleVerify}
                      disabled={submitting}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? 'Verifying...' : (
                        <>
                          <Check className="w-4 h-4" />
                          Verify
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rejection Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Please explain why this payment is being rejected..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Any additional notes..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setVerificationAction('verify')}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      disabled={submitting}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={submitting || !rejectionReason.trim()}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? 'Rejecting...' : (
                        <>
                          <XCircle className="w-4 h-4" />
                          Confirm Rejection
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
