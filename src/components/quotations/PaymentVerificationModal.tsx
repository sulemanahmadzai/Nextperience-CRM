import { useState } from 'react';
import { X, CheckCircle, XCircle, FileText, Upload, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

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
}

interface PaymentVerificationModalProps {
  payment: Payment;
  quotationNumber: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentVerificationModal({
  payment,
  quotationNumber,
  onClose,
  onSuccess,
}: PaymentVerificationModalProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState<'verified' | 'rejected'>('verified');
  const [notes, setNotes] = useState(payment.verification_notes || '');
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState(payment.proof_of_payment_url || '');
  const [depositSlipUrl, setDepositSlipUrl] = useState(payment.deposit_slip_url || '');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadingDepositSlip, setUploadingDepositSlip] = useState(false);
  const [depositSlipFile, setDepositSlipFile] = useState<File | null>(null);

  const formatCurrency = (value: number, currency: string) => {
    if (currency === 'PHP') {
      return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    }
    return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, style: 'currency', currency })}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOfflinePayment = () => {
    const method = payment.payment_method?.toLowerCase();
    return method === 'bank_transfer' || method === 'check' || method === 'cash' || method === 'offline';
  };

  const isCheckPayment = () => {
    const method = payment.payment_method?.toLowerCase();
    return method === 'check';
  };

  const isOnlineGateway = () => {
    const method = payment.payment_method?.toLowerCase();
    return method === 'paypal' || method === 'xendit' || method === 'api' || method === 'stripe' || method === 'paymongo';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setUploadedFile(file);
    }
  };

  const handleUploadProof = async () => {
    if (!uploadedFile || !currentCompany) return;

    setUploading(true);
    try {
      const fileExt = uploadedFile.name.split('.').pop();
      const fileName = `${currentCompany.id}/${payment.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, uploadedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('payments')
        .update({ proof_of_payment_url: publicUrl })
        .eq('id', payment.id);

      if (updateError) throw updateError;

      setProofUrl(publicUrl);
      setUploadedFile(null);
      alert('Proof of payment uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading proof:', error);
      alert('Failed to upload proof: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadDepositSlip = async () => {
    if (!depositSlipFile || !currentCompany) return;

    setUploadingDepositSlip(true);
    try {
      const fileExt = depositSlipFile.name.split('.').pop();
      const fileName = `${currentCompany.id}/deposit-slips/${payment.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, depositSlipFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('payments')
        .update({ deposit_slip_url: publicUrl })
        .eq('id', payment.id);

      if (updateError) throw updateError;

      if (currentCompany && user) {
        await supabase.from('audit_logs').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          action: 'upload_deposit_slip',
          entity_type: 'payment',
          entity_id: payment.id,
          metadata: { filename: depositSlipFile.name },
        });
      }

      setDepositSlipUrl(publicUrl);
      setDepositSlipFile(null);
      alert('Deposit slip uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading deposit slip:', error);
      alert('Failed to upload deposit slip: ' + error.message);
    } finally {
      setUploadingDepositSlip(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentCompany || !user) return;

    if (isCheckPayment() && !depositSlipUrl && verificationStatus === 'verified') {
      alert('Please upload deposit slip before verifying check payments');
      return;
    }

    if (verificationStatus === 'rejected' && !notes.trim()) {
      alert('Please provide a reason for rejecting the payment');
      return;
    }

    setProcessing(true);
    try {
      if (verificationStatus === 'verified') {
        const { error } = await supabase.rpc('verify_payment', {
          payment_id_param: payment.id,
          notes_param: notes.trim() || null,
          verified_by_param: user.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('reject_payment', {
          payment_id_param: payment.id,
          reason_param: notes.trim(),
          rejected_by_param: user.id,
        });
        if (error) throw error;
      }

      if (currentCompany && user) {
        await supabase.from('audit_logs').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          action: verificationStatus === 'verified' ? 'verify_payment' : 'reject_payment',
          entity_type: 'payment',
          entity_id: payment.id,
          metadata: {
            verification_status: verificationStatus,
            notes: notes.trim() || null,
            quotation_id: payment.quotation_id,
          },
        });
      }

      alert(`Payment ${verificationStatus === 'verified' ? 'verified' : 'rejected'} successfully!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      alert('Failed to verify payment: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-slate-700" />
            <h2 className="text-xl font-semibold text-slate-900">Verify Payment</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 p-4 bg-slate-50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Quotation:</span>
              <span className="font-medium text-slate-900">{quotationNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Amount:</span>
              <span className="text-lg font-bold text-slate-900">
                {formatCurrency(payment.amount, payment.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Payment Method:</span>
              <span className="font-medium text-slate-900 capitalize">{payment.payment_method}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Transaction ID:</span>
              <span className="font-medium text-slate-900 font-mono text-xs">
                {payment.transaction_id}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Payment Date:</span>
              <span className="font-medium text-slate-900">{formatDate(payment.payment_date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                payment.payment_status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : payment.payment_status === 'failed'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {payment.payment_status}
              </span>
            </div>
            {payment.metadata?.test_mode && (
              <div className="pt-2 border-t border-slate-200">
                <span className="inline-flex px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  Test Payment
                </span>
              </div>
            )}
          </div>

          {isCheckPayment() && (
            <div className="mb-6 p-4 border border-amber-200 bg-amber-50 rounded-lg">
              <h3 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Deposit Slip (Check Payment)
              </h3>

              {depositSlipUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span>Deposit slip uploaded</span>
                  </div>
                  <a
                    href={depositSlipUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Deposit Slip
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-amber-800">
                    Manager or Sales Rep must upload deposit slip for check payments before Admin/Finance can verify.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 10 * 1024 * 1024) {
                            alert('File size must be less than 10MB');
                            return;
                          }
                          setDepositSlipFile(file);
                        }
                      }}
                      className="flex-1 text-sm text-slate-600 file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200"
                    />
                    {depositSlipFile && (
                      <button
                        onClick={handleUploadDepositSlip}
                        disabled={uploadingDepositSlip}
                        className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                      >
                        {uploadingDepositSlip ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Upload
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {depositSlipFile && (
                    <p className="text-xs text-slate-600">
                      Selected: {depositSlipFile.name}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {isOnlineGateway() && (
            <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Gateway Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-blue-600">Gateway:</span>
                  <span className="ml-2 font-medium text-blue-900 capitalize">{payment.payment_method}</span>
                </div>
                <div>
                  <span className="text-blue-600">Transaction ID:</span>
                  <span className="ml-2 font-mono text-xs text-blue-900">{payment.transaction_id}</span>
                </div>
                <p className="text-xs text-blue-700 mt-2 italic">
                  Transaction ID auto-filled from payment gateway. No upload required.
                </p>
              </div>
            </div>
          )}

          {payment.verification_status && (
            <div className={`mb-6 p-4 rounded-lg border ${
              payment.verification_status === 'verified'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-sm font-medium mb-1">
                {payment.verification_status === 'verified' ? 'Previously Verified' : 'Previously Rejected'}
              </p>
              {payment.verification_notes && (
                <p className="text-sm text-slate-600">{payment.verification_notes}</p>
              )}
              {payment.verified_at && (
                <p className="text-xs text-slate-500 mt-2">{formatDate(payment.verified_at)}</p>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Verification Decision *
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVerificationStatus('verified')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg transition-colors ${
                  verificationStatus === 'verified'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <CheckCircle className="w-5 h-5" />
                Verify
              </button>
              <button
                type="button"
                onClick={() => setVerificationStatus('rejected')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg transition-colors ${
                  verificationStatus === 'rejected'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <XCircle className="w-5 h-5" />
                Reject
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes {verificationStatus === 'rejected' && '*'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder={
                verificationStatus === 'verified'
                  ? 'Add verification notes (optional)...'
                  : 'Explain why this payment is being rejected...'
              }
              required={verificationStatus === 'rejected'}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={processing || (verificationStatus === 'rejected' && !notes.trim())}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium disabled:opacity-50 ${
              verificationStatus === 'verified'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {verificationStatus === 'verified' ? (
              <>
                <CheckCircle className="w-5 h-5" />
                {processing ? 'Verifying...' : 'Verify Payment'}
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5" />
                {processing ? 'Rejecting...' : 'Reject Payment'}
              </>
            )}
          </button>
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
