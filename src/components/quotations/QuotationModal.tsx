import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { Lead, Customer, Product } from '../../lib/database.types';

interface QuotationLine {
  id?: string;
  item_type?: 'product' | 'section';
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

interface QuotationModalProps {
  quotation?: any;
  leadData?: Lead | null;
  customerData?: Customer | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function QuotationModal({ quotation, leadData, customerData, onClose, onSuccess }: QuotationModalProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(leadData || null);
  const [customer, setCustomer] = useState<Customer | null>(customerData || null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [bodyHtml, setBodyHtml] = useState('');
  const [termsHtml, setTermsHtml] = useState('');
  const [userRole, setUserRole] = useState('');
  const [fieldsLocked, setFieldsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: 0 });

  const getDefaultExpirationDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    quotation_date: new Date().toISOString().split('T')[0],
    expiration_date: getDefaultExpirationDate(),
    vat_enabled: false,
    vat_rate: 12,
    notes: '',
    template_id: null as string | null,
    event_type_id: null as string | null,
    no_of_pax: null as number | null,
    event_date: null as string | null,
  });

  const [lines, setLines] = useState<QuotationLine[]>([
    { item_type: 'product', description: '', quantity: 1, unit_price: 0, discount: 0, subtotal: 0 },
  ]);

  useEffect(() => {
    loadData();
    if (quotation?.id) {
      loadExistingQuotation();
    } else {
      loadDefaultTemplate();
    }
  }, [currentCompany]);

  useEffect(() => {
    calculateTotals();
  }, [lines, formData.vat_enabled, formData.vat_rate]);

  const loadExistingQuotation = async () => {
    if (!quotation?.id) return;

    const { data: quotationData } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quotation.id)
      .maybeSingle();

    if (quotationData) {
      setFormData({
        quotation_date: quotationData.quotation_date,
        expiration_date: quotationData.expiration_date || getDefaultExpirationDate(),
        vat_enabled: quotationData.vat_enabled || false,
        vat_rate: quotationData.vat_rate || 12,
        notes: quotationData.notes || '',
        template_id: quotationData.template_id || null,
        event_type_id: quotationData.event_type_id || null,
        no_of_pax: quotationData.no_of_pax || null,
        event_date: quotationData.event_date || null,
      });
      setBodyHtml(quotationData.body_html || '');
      setTermsHtml(quotationData.terms_html || '');
      setSelectedTemplateId(quotationData.template_id || '');

      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', quotationData.customer_id)
        .maybeSingle();

      if (customerData) {
        setCustomer(customerData);
      }

      if (quotationData.lead_id) {
        const { data: leadData } = await supabase
          .from('leads')
          .select('*')
          .eq('id', quotationData.lead_id)
          .maybeSingle();

        if (leadData) {
          setLead(leadData);
        }
      }

      const { data: linesData } = await supabase
        .from('quotation_lines')
        .select('*')
        .eq('quotation_id', quotation.id)
        .order('order');

      if (linesData && linesData.length > 0) {
        setLines(linesData.map(line => ({
          id: line.id,
          item_type: 'product' as 'product' | 'section',
          product_id: line.product_id || undefined,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount: line.discount,
          subtotal: line.subtotal,
        })));
      }
    }
  };

  const loadData = async () => {
    if (!currentCompany) return;

    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true)
      .order('name');

    if (productsData) {
      setProducts(productsData);
    }

    if (!customerData) {
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('name');

      if (customersData) {
        setCustomers(customersData);
      }
    }

    if (!leadData) {
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (leadsData) {
        setLeads(leadsData);
      }
    }

    const { data: templatesData } = await supabase
      .from('quotation_templates')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('archived', false)
      .order('name');

    if (templatesData) {
      setTemplates(templatesData);
    }

    const { data: eventTypesData } = await supabase
      .from('event_types')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true)
      .order('name');

    if (eventTypesData) {
      setEventTypes(eventTypesData);
    }

    if (user) {
      const { data: roleData } = await supabase
        .from('user_company_roles')
        .select('role_id, roles(name)')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (roleData) {
        const role = (roleData.roles as any)?.name || '';
        setUserRole(role);
        setFieldsLocked(role !== 'admin' && role !== 'manager' && !quotation?.id);
      }
    }
  };

  const loadDefaultTemplate = async () => {
    if (!currentCompany) return;

    const { data: defaultTemplate } = await supabase
      .from('quotation_templates')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_default', true)
      .eq('archived', false)
      .maybeSingle();

    if (defaultTemplate) {
      await applyTemplate(defaultTemplate.id);
    }
  };

  const applyTemplate = async (templateId: string) => {
    const { data: template } = await supabase
      .from('quotation_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();

    if (!template) return;

    setSelectedTemplate(template);
    setBodyHtml(template.body_html || '');
    setTermsHtml(template.terms_html || '');
    setSelectedTemplateId(templateId);
    setFormData(prev => ({ ...prev, template_id: templateId }));

    const { data: lineItems } = await supabase
      .from('template_line_items')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order');

    if (lineItems && lineItems.length > 0) {
      setLines(lineItems.map(item => ({
        description: item.name + (item.description ? `\n${item.description}` : ''),
        quantity: item.default_quantity,
        unit_price: item.default_price,
        discount: 0,
        subtotal: item.default_quantity * item.default_price,
      })));
    }
  };

  const calculateLineSubtotal = (line: QuotationLine) => {
    if (line.item_type === 'section') return 0;
    const subtotal = line.quantity * line.unit_price;
    const discountAmount = (subtotal * line.discount) / 100;
    return subtotal - discountAmount;
  };

  const calculateTotals = () => {
    return lines.reduce((acc, line) => acc + calculateLineSubtotal(line), 0);
  };

  const getSubtotal = () => calculateTotals();
  const getVATAmount = () => (formData.vat_enabled ? (getSubtotal() * formData.vat_rate) / 100 : 0);
  const getTotal = () => getSubtotal() + getVATAmount();

  const handleLineChange = (index: number, field: keyof QuotationLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = {
      ...newLines[index],
      [field]: value,
    };

    if (field === 'product_id' && value) {
      const product = products.find((p) => p.id === value);
      if (product) {
        newLines[index].description = product.name;
        newLines[index].unit_price = product.price || 0;
      }
    }

    newLines[index].subtotal = calculateLineSubtotal(newLines[index]);
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { item_type: 'product', description: '', quantity: 1, unit_price: 0, discount: 0, subtotal: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleCreateProduct = async () => {
    if (!currentCompany || !newProduct.name) {
      setMessage({ type: 'error', text: 'Please enter a product name' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          company_id: currentCompany.id,
          name: newProduct.name,
          description: newProduct.description,
          price: newProduct.price,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setProducts([...products, data]);
      setNewProduct({ name: '', description: '', price: 0 });
      setShowNewProductForm(false);
      setMessage({ type: 'success', text: 'Product created successfully' });

      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to create product' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !user || !customer) return;

    if (lines.some((line) => !line.description)) {
      setMessage({ type: 'error', text: 'Please fill in all line items' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const expirationDate = formData.expiration_date
        ? formData.expiration_date
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const isEditing = quotation?.id;
      let quotationId = quotation?.id;

      if (isEditing) {
        const { error: quotationError } = await supabase
          .from('quotations')
          .update({
            lead_id: lead?.id || null,
            customer_id: customer.id,
            quotation_date: formData.quotation_date,
            expiration_date: expirationDate,
            subtotal: getSubtotal(),
            vat_enabled: formData.vat_enabled,
            vat_rate: formData.vat_rate,
            vat_amount: getVATAmount(),
            total_amount: getTotal(),
            notes: formData.notes,
            body_html: bodyHtml,
            terms_html: termsHtml,
            template_id: formData.template_id,
            event_type_id: formData.event_type_id,
            no_of_pax: formData.no_of_pax,
            event_date: formData.event_date,
          })
          .eq('id', quotationId);

        if (quotationError) throw quotationError;

        await supabase
          .from('quotation_lines')
          .delete()
          .eq('quotation_id', quotationId);
      } else {
        const { data: quotation, error: quotationError } = await supabase
          .from('quotations')
          .insert({
            company_id: currentCompany.id,
            lead_id: lead?.id || null,
            customer_id: customer.id,
            salesperson_id: user.id,
            quotation_date: formData.quotation_date,
            expiration_date: expirationDate,
            status: 'draft',
            subtotal: getSubtotal(),
            vat_enabled: formData.vat_enabled,
            vat_rate: formData.vat_rate,
            vat_amount: getVATAmount(),
            total_amount: getTotal(),
            notes: formData.notes,
            body_html: bodyHtml,
            terms_html: termsHtml,
            template_id: formData.template_id,
            event_type_id: formData.event_type_id,
            no_of_pax: formData.no_of_pax,
            event_date: formData.event_date,
            created_by: user.id,
          })
          .select()
          .single();

        if (quotationError) throw quotationError;
        quotationId = quotation.id;
      }

      const lineItems = lines.map((line, index) => ({
        quotation_id: quotationId,
        product_id: line.product_id || null,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount: line.discount,
        subtotal: calculateLineSubtotal(line),
        order: index,
      }));

      const { error: linesError } = await supabase.from('quotation_lines').insert(lineItems);

      if (linesError) throw linesError;

      await supabase.from('audit_logs').insert({
        company_id: currentCompany.id,
        user_id: user.id,
        action: isEditing ? 'update' : 'create',
        entity_type: 'quotation',
        entity_id: quotationId,
      });

      setMessage({ type: 'success', text: `Quotation ${isEditing ? 'updated' : 'created'} successfully` });
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || `Failed to ${quotation?.id ? 'update' : 'create'} quotation` });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">{quotation?.id ? 'Edit Quotation' : 'New Quotation'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-slate-900 mb-3">Event Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Event Type
                </label>
                <select
                  value={formData.event_type_id || ''}
                  onChange={(e) => setFormData({ ...formData, event_type_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select event type...</option>
                  {eventTypes.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  No. of Pax
                </label>
                <input
                  type="number"
                  value={formData.no_of_pax || ''}
                  onChange={(e) => setFormData({ ...formData, no_of_pax: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Number of guests"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Event Date
                </label>
                <input
                  type="date"
                  value={formData.event_date || ''}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value || null })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-3">Customer Information</h3>
              {customer ? (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-600">Name:</span>
                    <p className="font-medium text-slate-900">{customer.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Email:</span>
                    <p className="text-slate-900">{customer.email || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Phone:</span>
                    <p className="text-slate-900">{customer.phone || 'N/A'}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Select Customer *
                  </label>
                  <select
                    value={customer?.id || ''}
                    onChange={(e) => {
                      const selectedCustomer = customers.find(c => c.id === e.target.value);
                      setCustomer(selectedCustomer || null);
                      const customerLeads = leads.filter(l => l.customer_id === e.target.value);
                      if (customerLeads.length === 1) {
                        setLead(customerLeads[0]);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                    required
                  >
                    <option value="">Choose a customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {customer && (
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="text-slate-600">Email: <span className="text-slate-900">{customer.email || 'N/A'}</span></div>
                      <div className="text-slate-600">Phone: <span className="text-slate-900">{customer.phone || 'N/A'}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {!leadData && customer && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Select Lead (Optional)
                  </label>
                  <select
                    value={lead?.id || ''}
                    onChange={(e) => {
                      const selectedLead = leads.find(l => l.id === e.target.value);
                      setLead(selectedLead || null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="">No lead (Direct quotation)</option>
                    {leads
                      .filter(l => l.customer_id === customer.id)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.event_name} - {new Date(l.event_date).toLocaleDateString()}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quotation Date
                </label>
                <input
                  type="date"
                  value={formData.quotation_date}
                  onChange={(e) => setFormData({ ...formData, quotation_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
                <p className="text-xs text-slate-500 mt-1">Defaults to 7 days if not set</p>
              </div>
            </div>
          </div>

          {!quotation?.id && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Choose Template (Optional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  if (e.target.value) {
                    applyTemplate(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No template - Start from scratch</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedTemplate?.logo_url && (
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="block text-sm font-medium text-slate-700 mb-2">Template Logo</label>
              <div className={`flex ${selectedTemplate.logo_position === 'center' ? 'justify-center' : selectedTemplate.logo_position === 'right' ? 'justify-end' : 'justify-start'}`}>
                <img
                  src={selectedTemplate.logo_url}
                  alt="Template logo"
                  style={{ maxWidth: `${selectedTemplate.logo_max_width || 200}px` }}
                  className="border border-slate-300 rounded"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                This logo will appear on the quotation PDF and email view.
              </p>
            </div>
          )}

          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Body / Introduction (HTML)
              </label>
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder="Enter introduction or body content. You can use HTML: <p>, <strong>, <ul>, <img src='url'>, <a href='url'>..."
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                disabled={fieldsLocked}
              />
              {fieldsLocked && (
                <p className="text-xs text-amber-600 mt-1">Only admins and managers can edit this field</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Terms & Conditions (HTML)
              </label>
              <textarea
                value={termsHtml}
                onChange={(e) => setTermsHtml(e.target.value)}
                placeholder="Enter terms and conditions. Supports HTML formatting."
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                disabled={fieldsLocked}
              />
              {fieldsLocked && (
                <p className="text-xs text-amber-600 mt-1">Only admins and managers can edit this field</p>
              )}
            </div>

            {selectedTemplate?.custom_sections && selectedTemplate.custom_sections.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Additional Sections from Template
                </label>
                <div className="space-y-3">
                  {selectedTemplate.custom_sections.map((section: any, index: number) => (
                    <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <h4 className="font-medium text-slate-900 mb-2">{section.title}</h4>
                      <div
                        className="prose prose-sm max-w-none text-slate-700"
                        dangerouslySetInnerHTML={{ __html: section.content }}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  These sections are from the selected template and will appear on the quotation.
                </p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Line Items</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLines([...lines, { item_type: 'section', description: '', quantity: 0, unit_price: 0, discount: 0, subtotal: 0 }]);
                  }}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Section
                </button>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900"
                >
                  <Plus className="w-4 h-4" />
                  Add Line
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border border-slate-200 rounded-lg">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-700">
                      Product
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-700">
                      Description
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 w-24">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 w-32">
                      Unit Price
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 w-24">
                      Discount %
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 w-32">
                      Subtotal
                    </th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    if (line.item_type === 'section') {
                      return (
                        <tr key={index} className="border-t border-slate-200 bg-slate-50">
                          <td colSpan={6} className="px-3 py-2">
                            <textarea
                              value={line.description}
                              onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[100px] font-mono"
                              placeholder="Enter section content (e.g., inclusions, notes, schedule...)"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeLine(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                    <tr key={index} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <div className="space-y-2">
                          <select
                            value={line.product_id || ''}
                            onChange={(e) => {
                              if (e.target.value === '__add_new__') {
                                setShowNewProductForm(true);
                              } else {
                                handleLineChange(index, 'product_id', e.target.value);
                              }
                            }}
                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                          >
                            <option value="">Select Product</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                            <option value="__add_new__" className="text-blue-600 font-medium">
                              + Add New Product
                            </option>
                          </select>

                          {showNewProductForm && (
                            <div className="absolute z-10 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-4 w-80">
                              <h4 className="font-semibold text-slate-900 mb-3">Create New Product</h4>
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Product Name *
                                  </label>
                                  <input
                                    type="text"
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                                    placeholder="Enter product name"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Description
                                  </label>
                                  <input
                                    type="text"
                                    value={newProduct.description}
                                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                                    placeholder="Enter description"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Price
                                  </label>
                                  <input
                                    type="number"
                                    value={newProduct.price}
                                    onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={handleCreateProduct}
                                    className="flex-1 px-3 py-1.5 bg-slate-900 text-white text-sm rounded hover:bg-slate-800"
                                  >
                                    Create
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowNewProductForm(false);
                                      setNewProduct({ name: '', description: '', price: 0 });
                                    }}
                                    className="flex-1 px-3 py-1.5 bg-slate-200 text-slate-700 text-sm rounded hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) =>
                            handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                          min="0"
                          step="0.01"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={line.unit_price}
                          onChange={(e) =>
                            handleLineChange(index, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                          min="0"
                          step="0.01"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={line.discount}
                          onChange={(e) =>
                            handleLineChange(index, 'discount', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-slate-900">
                        {formatCurrency(calculateLineSubtotal(line))}
                      </td>
                      <td className="px-3 py-2">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-80 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-medium text-slate-900">{formatCurrency(getSubtotal())}</span>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.vat_enabled}
                    onChange={(e) => setFormData({ ...formData, vat_enabled: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  VAT ({formData.vat_rate}%)
                </label>
                {formData.vat_enabled && (
                  <span className="text-sm font-medium text-slate-900">
                    {formatCurrency(getVATAmount())}
                  </span>
                )}
              </div>

              <div className="flex justify-between pt-3 border-t border-slate-200">
                <span className="font-semibold text-slate-900">Total:</span>
                <span className="text-xl font-bold text-slate-900">
                  {formatCurrency(getTotal())}
                </span>
              </div>

              {!formData.vat_enabled && (
                <p className="text-sm text-amber-600 font-medium text-right">Total is exclusive of VAT</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="Add any additional notes or terms..."
            />
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { QuotationModal };
