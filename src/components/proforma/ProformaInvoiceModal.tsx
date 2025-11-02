import { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface ProformaInvoiceModalProps {
  quotationId?: string;
  onClose: () => void;
  onSuccess: (invoiceId: string) => void;
}

export function ProformaInvoiceModal({ quotationId, onClose, onSuccess }: ProformaInvoiceModalProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    primary_color: '#1e293b',
    accent_color: '#0f172a',

    bill_from_company_name: currentCompany?.name || '',
    bill_from_tin: '',
    bill_from_address: '',
    bill_from_email: '',
    bill_from_phone: '',

    bill_to_company_name: '',
    bill_to_contact_person: '',
    bill_to_email: '',
    bill_to_phone: '',
    bill_to_address: '',

    event_venue: '',
    event_type: '',
    event_guests: '',
    event_date: '',
    prepared_by: user?.email || '',

    payment_methods: `- Credit / Debit Card
- GCash / PayMaya
- Bank Deposit / Online Transfer
- Company Check`,
    bank_account_name: '',
    bank_name: '',
    bank_account_number: '',
    bank_swift_code: '',
    payment_notes: '50% Down Payment due upon confirmation. Balance due before event date.',

    terms_conditions: `- Prices valid until due date.
- Booking confirmed only upon payment.
- Cancellations within 7 days are non-refundable.
- Official Receipt will be issued upon full payment.`,
    footer_text: `Thank you for choosing ${currentCompany?.name || 'us'}! For billing inquiries, contact us.`,

    tax_percentage: 0,
    discount_amount: 0,
    currency: 'PHP'
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, line_total: 0 }
  ]);

  useEffect(() => {
    if (quotationId) {
      loadQuotationData();
    }
  }, [quotationId]);

  const loadQuotationData = async () => {
    if (!quotationId) return;

    const { data: quotation } = await supabase
      .from('quotations')
      .select('*, customer:customers(*), lead:leads(*)')
      .eq('id', quotationId)
      .single();

    if (!quotation) return;

    const { data: lines } = await supabase
      .from('quotation_lines')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('order');

    if (quotation.customer) {
      setFormData(prev => ({
        ...prev,
        bill_to_company_name: quotation.customer.company_name || quotation.customer.name,
        bill_to_contact_person: quotation.customer.name,
        bill_to_email: quotation.customer.email || '',
        bill_to_phone: quotation.customer.phone || '',
        bill_to_address: quotation.customer.address || ''
      }));
    }

    if (quotation.lead) {
      setFormData(prev => ({
        ...prev,
        event_venue: quotation.lead.venue || '',
        event_type: quotation.lead.event_type || '',
        event_guests: quotation.lead.expected_pax?.toString() || '',
        event_date: quotation.lead.event_date || ''
      }));
    }

    if (lines && lines.length > 0) {
      setLineItems(lines.map(line => ({
        description: line.description,
        quantity: parseFloat(line.quantity),
        unit_price: parseFloat(line.unit_price),
        line_total: parseFloat(line.line_total)
      })));
    }
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const tax_amount = (subtotal * formData.tax_percentage) / 100;
    const total_amount = subtotal + tax_amount - formData.discount_amount;
    return { subtotal, tax_amount, total_amount };
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].line_total = newItems[index].quantity * newItems[index].unit_price;
    }

    setLineItems(newItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0, line_total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !user) return;

    setLoading(true);
    setError('');

    try {
      const { data: invoiceNo } = await supabase.rpc('generate_proforma_invoice_no', {
        p_company_id: currentCompany.id
      });

      const { subtotal, tax_amount, total_amount } = calculateTotals();

      const { data: invoice, error: invoiceError } = await supabase
        .from('proforma_invoices')
        .insert({
          company_id: currentCompany.id,
          quotation_id: quotationId || null,
          invoice_no: invoiceNo,
          ...formData,
          event_guests: formData.event_guests ? parseInt(formData.event_guests) : null,
          subtotal,
          tax_amount,
          total_amount,
          created_by: user.id
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const lineItemsData = lineItems.map((item, index) => ({
        proforma_invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        order: index
      }));

      const { error: linesError } = await supabase
        .from('proforma_invoice_line_items')
        .insert(lineItemsData);

      if (linesError) throw linesError;

      onSuccess(invoice.id);
    } catch (err: any) {
      console.error('Error creating invoice:', err);
      setError(err.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, tax_amount, total_amount } = calculateTotals();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {quotationId ? 'Convert to Proforma Invoice' : 'New Proforma Invoice'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Invoice Date *
              </label>
              <input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Due Date *
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Currency
              </label>
              <input
                type="text"
                value="PHP (₱)"
                disabled
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Primary Color
              </label>
              <input
                type="color"
                value={formData.primary_color}
                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                className="w-full h-10 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Accent Color
              </label>
              <input
                type="color"
                value={formData.accent_color}
                onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                className="w-full h-10 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Bill From (Your Company)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Company Name *"
                value={formData.bill_from_company_name}
                onChange={(e) => setFormData({ ...formData, bill_from_company_name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                required
              />
              <input
                type="text"
                placeholder="TIN"
                value={formData.bill_from_tin}
                onChange={(e) => setFormData({ ...formData, bill_from_tin: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.bill_from_email}
                onChange={(e) => setFormData({ ...formData, bill_from_email: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={formData.bill_from_phone}
                onChange={(e) => setFormData({ ...formData, bill_from_phone: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <textarea
                placeholder="Business Address"
                value={formData.bill_from_address}
                onChange={(e) => setFormData({ ...formData, bill_from_address: e.target.value })}
                className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                rows={2}
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Bill To (Client)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Client / Company Name *"
                value={formData.bill_to_company_name}
                onChange={(e) => setFormData({ ...formData, bill_to_company_name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                required
              />
              <input
                type="text"
                placeholder="Contact Person"
                value={formData.bill_to_contact_person}
                onChange={(e) => setFormData({ ...formData, bill_to_contact_person: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.bill_to_email}
                onChange={(e) => setFormData({ ...formData, bill_to_email: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={formData.bill_to_phone}
                onChange={(e) => setFormData({ ...formData, bill_to_phone: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <textarea
                placeholder="Address"
                value={formData.bill_to_address}
                onChange={(e) => setFormData({ ...formData, bill_to_address: e.target.value })}
                className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                rows={2}
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Event Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Venue"
                value={formData.event_venue}
                onChange={(e) => setFormData({ ...formData, event_venue: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="text"
                placeholder="Type of Event"
                value={formData.event_type}
                onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="number"
                placeholder="Number of Guests"
                value={formData.event_guests}
                onChange={(e) => setFormData({ ...formData, event_guests: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="date"
                placeholder="Event Date"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Line Items</h3>
              <button
                type="button"
                onClick={addLineItem}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={item.unit_price}
                    onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-28 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                  />
                  <div className="w-32 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-right">
                    {item.line_total.toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    disabled={lineItems.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-medium">{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Tax:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.tax_percentage}
                    onChange={(e) => setFormData({ ...formData, tax_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 text-right border border-slate-300 rounded"
                    step="0.01"
                  />
                  <span>% = {tax_amount.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Discount:</span>
                <input
                  type="number"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })}
                  className="w-24 px-2 py-1 text-right border border-slate-300 rounded"
                  step="0.01"
                />
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formData.currency === 'PHP' ? '₱' : '$'}{total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment Methods Accepted
                </label>
                <textarea
                  value={formData.payment_methods}
                  onChange={(e) => setFormData({ ...formData, payment_methods: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                  rows={3}
                />
              </div>
              <input
                type="text"
                placeholder="Account Name"
                value={formData.bank_account_name}
                onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="text"
                placeholder="Bank Name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="text"
                placeholder="Account Number"
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="text"
                placeholder="SWIFT Code (optional)"
                value={formData.bank_swift_code}
                onChange={(e) => setFormData({ ...formData, bank_swift_code: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment Notes
                </label>
                <textarea
                  value={formData.payment_notes}
                  onChange={(e) => setFormData({ ...formData, payment_notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Terms & Conditions</h3>
            <textarea
              value={formData.terms_conditions}
              onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              rows={4}
            />
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Footer Text</h3>
            <textarea
              value={formData.footer_text}
              onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? (
                <>Creating...</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Create Invoice
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
