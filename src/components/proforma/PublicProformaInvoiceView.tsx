import { useState, useEffect, useRef } from 'react';
import { Download, DollarSign, CheckCircle, Printer, X, CreditCard } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { supabase } from '../../lib/supabase';
import ProformaInvoicePaymentModal from './ProformaInvoicePaymentModal';

interface ProformaInvoice {
  id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string;
  status: string;
  primary_color: string;
  accent_color: string;
  logo_url: string | null;

  bill_from_company_name: string;
  bill_from_tin: string | null;
  bill_from_address: string | null;
  bill_from_email: string | null;
  bill_from_phone: string | null;

  bill_to_company_name: string;
  bill_to_contact_person: string | null;
  bill_to_email: string | null;
  bill_to_phone: string | null;
  bill_to_address: string | null;

  event_venue: string | null;
  event_type: string | null;
  event_guests: number | null;
  event_date: string | null;
  prepared_by: string | null;

  payment_methods: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_swift_code: string | null;
  payment_notes: string | null;

  terms_conditions: string | null;
  footer_text: string | null;

  subtotal: number;
  tax_percentage: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  payment_date: string;
  provider_ref: string | null;
  paid_at: string | null;
}

export function PublicProformaInvoiceView({ token }: { token: string }) {
  const [invoice, setInvoice] = useState<ProformaInvoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInvoice();
    checkPaymentStatus();
  }, [token]);

  const checkPaymentStatus = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');

    if (paymentStatus === 'success') {
      alert('Payment successful! Your payment has been received and is being processed.');
      window.history.replaceState({}, document.title, window.location.pathname + '?token=' + token);
    } else if (paymentStatus === 'failed') {
      alert('Payment was not completed. Please try again or contact support if you need assistance.');
      window.history.replaceState({}, document.title, window.location.pathname + '?token=' + token);
    }
  };

  const loadInvoice = async () => {
    setLoading(true);

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('proforma_invoices')
      .select('*')
      .eq('payment_link_token', token)
      .single();

    if (invoiceError || !invoiceData) {
      setError('Invoice not found or link has expired');
      setLoading(false);
      return;
    }

    setInvoice(invoiceData);

    const { data: linesData } = await supabase
      .from('proforma_invoice_line_items')
      .select('*')
      .eq('proforma_invoice_id', invoiceData.id)
      .order('order');

    if (linesData) {
      setLineItems(linesData);
    }

    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('proforma_invoice_id', invoiceData.id)
      .in('payment_status', ['paid', 'completed']);

    if (paymentsData) {
      setPayments(paymentsData);
    }

    setLoading(false);
  };

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;

    const options = {
      margin: 10,
      filename: `${invoice?.invoice_no || 'invoice'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(options).from(contentRef.current).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount: number) => {
    const symbol = invoice?.currency === 'PHP' ? '₱' : '$';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-sm">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Invoice Not Found</h2>
          <p className="text-slate-600">{error || 'The invoice link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 no-print">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Proforma Invoice</h1>
            <p className="text-sm text-slate-600">{invoice.invoice_no}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>

            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>

            {(invoice.status === 'pending' || invoice.status === 'finalized') && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CreditCard className="w-4 h-4" />
                Pay Now
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div ref={contentRef} className="print-content bg-white rounded-lg shadow-sm border border-slate-200 p-12">
          <div className="mb-8 flex justify-between items-start" style={{ borderBottom: `4px solid ${invoice.primary_color}`, paddingBottom: '24px' }}>
            <div>
              {invoice.logo_url && (
                <img src={invoice.logo_url} alt="Logo" className="h-16 mb-4" />
              )}
              <h1 className="text-3xl font-bold" style={{ color: invoice.primary_color }}>
                PROFORMA INVOICE
              </h1>
              <p className="text-lg font-semibold text-slate-900 mt-2">{invoice.invoice_no}</p>
            </div>

            <div className="text-right">
              <div className="text-sm text-slate-600 space-y-1">
                <div>
                  <span className="font-medium">Invoice Date:</span> {new Date(invoice.invoice_date).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium">Due Date:</span> {new Date(invoice.due_date).toLocaleDateString()}
                </div>
                <div className="mt-2">
                  <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                    invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                    invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                    invoice.status === 'finalized' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </span>
                </div>
                {payments.length > 0 && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-xs font-semibold text-green-900 mb-2">Payments Received</div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Total Paid:</span>
                        <span className="font-semibold text-green-700">
                          ₱{payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Remaining:</span>
                        <span className="font-semibold text-orange-700">
                          ₱{(invoice.total_amount - payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">Bill From</h2>
              <div className="text-slate-900 space-y-1">
                <p className="font-semibold text-lg">{invoice.bill_from_company_name}</p>
                {invoice.bill_from_tin && <p className="text-sm">TIN: {invoice.bill_from_tin}</p>}
                {invoice.bill_from_address && <p className="text-sm">{invoice.bill_from_address}</p>}
                {invoice.bill_from_email && <p className="text-sm">{invoice.bill_from_email}</p>}
                {invoice.bill_from_phone && <p className="text-sm">{invoice.bill_from_phone}</p>}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">Bill To</h2>
              <div className="text-slate-900 space-y-1">
                <p className="font-semibold text-lg">{invoice.bill_to_company_name}</p>
                {invoice.bill_to_contact_person && <p className="text-sm">{invoice.bill_to_contact_person}</p>}
                {invoice.bill_to_email && <p className="text-sm">{invoice.bill_to_email}</p>}
                {invoice.bill_to_phone && <p className="text-sm">{invoice.bill_to_phone}</p>}
                {invoice.bill_to_address && <p className="text-sm">{invoice.bill_to_address}</p>}
              </div>
            </div>
          </div>

          {(invoice.event_venue || invoice.event_type || invoice.event_date) && (
            <div className="mb-8 p-4 bg-slate-50 rounded-lg">
              <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">Event Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {invoice.event_venue && (
                  <div>
                    <span className="text-slate-600">Venue:</span>{' '}
                    <span className="text-slate-900 font-medium">{invoice.event_venue}</span>
                  </div>
                )}
                {invoice.event_type && (
                  <div>
                    <span className="text-slate-600">Type:</span>{' '}
                    <span className="text-slate-900 font-medium">{invoice.event_type}</span>
                  </div>
                )}
                {invoice.event_guests && (
                  <div>
                    <span className="text-slate-600">Guests:</span>{' '}
                    <span className="text-slate-900 font-medium">{invoice.event_guests}</span>
                  </div>
                )}
                {invoice.event_date && (
                  <div>
                    <span className="text-slate-600">Date:</span>{' '}
                    <span className="text-slate-900 font-medium">{new Date(invoice.event_date).toLocaleDateString()}</span>
                  </div>
                )}
                {invoice.prepared_by && (
                  <div className="col-span-2">
                    <span className="text-slate-600">Prepared By:</span>{' '}
                    <span className="text-slate-900 font-medium">{invoice.prepared_by}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: invoice.primary_color, color: 'white' }}>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3 text-slate-900">{item.description}</td>
                    <td className="px-4 py-3 text-right text-slate-900">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 ml-auto max-w-xs space-y-2">
              <div className="flex justify-between text-slate-900">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.tax_percentage > 0 && (
                <div className="flex justify-between text-slate-900">
                  <span>Tax ({invoice.tax_percentage}%):</span>
                  <span className="font-medium">{formatCurrency(invoice.tax_amount)}</span>
                </div>
              )}
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-slate-900">
                  <span>Discount:</span>
                  <span className="font-medium">-{formatCurrency(invoice.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold pt-3 border-t-2" style={{ borderColor: invoice.accent_color, color: invoice.accent_color }}>
                <span>Total:</span>
                <span>{formatCurrency(invoice.total_amount)}</span>
              </div>
            </div>
          </div>

          {payments.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Payment History</h2>
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="p-4 rounded-lg border bg-green-50 border-green-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-lg text-slate-900">
                        ₱{parseFloat(payment.amount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Paid
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
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

          {invoice.payment_methods && (
            <div className="mb-8 p-6 bg-slate-50 rounded-lg">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Payment Details</h2>

              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Payment Methods Accepted:</h3>
                <div className="text-sm text-slate-600 whitespace-pre-line">{invoice.payment_methods}</div>
              </div>

              {(invoice.bank_account_name || invoice.bank_name) && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Bank Details:</h3>
                  <div className="text-sm text-slate-900 space-y-1">
                    {invoice.bank_account_name && <p>Account Name: <span className="font-medium">{invoice.bank_account_name}</span></p>}
                    {invoice.bank_name && <p>Bank Name: <span className="font-medium">{invoice.bank_name}</span></p>}
                    {invoice.bank_account_number && <p>Account Number: <span className="font-medium">{invoice.bank_account_number}</span></p>}
                    {invoice.bank_swift_code && <p>SWIFT Code: <span className="font-medium">{invoice.bank_swift_code}</span></p>}
                  </div>
                </div>
              )}

              {invoice.payment_notes && (
                <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-400 text-sm text-blue-900">
                  {invoice.payment_notes}
                </div>
              )}
            </div>
          )}

          {invoice.terms_conditions && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Terms & Conditions</h2>
              <div className="text-sm text-slate-600 whitespace-pre-line">{invoice.terms_conditions}</div>
            </div>
          )}

          {invoice.footer_text && (
            <div className="mt-12 pt-6 border-t border-slate-200 text-center">
              <p className="text-sm text-slate-600">{invoice.footer_text}</p>
              <p className="text-xs text-slate-400 mt-2">This is a system-generated proforma invoice.</p>
            </div>
          )}
        </div>
      </div>

      {showPaymentModal && invoice && (
        <ProformaInvoicePaymentModal
          invoiceId={invoice.id}
          invoiceNo={invoice.invoice_no}
          totalAmount={invoice.total_amount}
          remainingAmount={invoice.total_amount - payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)}
          currency={invoice.currency}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            loadInvoice();
          }}
        />
      )}
    </div>
  );
}
