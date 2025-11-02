import { useState, useEffect } from 'react';
import { X, Plus, Trash2, GripVertical, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import HtmlEditor from './HtmlEditor';
import { RichTextEditor } from './RichTextEditor';

interface TemplateLineItem {
  id?: string;
  item_type?: 'product' | 'section';
  name: string;
  description: string;
  section_body?: string;
  unit: string;
  default_quantity: number;
  default_price: number;
  tax_code: string;
  sort_order: number;
}

interface TemplateModalProps {
  template: any;
  onClose: () => void;
}

export default function TemplateModal({ template, onClose }: TemplateModalProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [name, setName] = useState(template?.name || '');
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || '');
  const [termsHtml, setTermsHtml] = useState(template?.terms_html || '');
  const [isDefault, setIsDefault] = useState(template?.is_default || false);
  const [logoUrl, setLogoUrl] = useState(template?.logo_url || '');
  const [logoPosition, setLogoPosition] = useState(template?.logo_position || 'left');
  const [logoMaxWidth, setLogoMaxWidth] = useState(template?.logo_max_width || 200);
  const [customSections, setCustomSections] = useState<{title: string; content: string; order: number}[]>(template?.custom_sections || []);
  const [lineItems, setLineItems] = useState<TemplateLineItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (template?.id) {
      fetchLineItems();
    }
    fetchUserRole();
    fetchProducts();
  }, [template, currentCompany]);

  const fetchUserRole = async () => {
    if (!user || !currentCompany) return;

    const { data: roleData } = await supabase
      .from('user_company_roles')
      .select('role_id, roles(name)')
      .eq('user_id', user.id)
      .eq('company_id', currentCompany.id)
      .maybeSingle();

    if (roleData) {
      const role = (roleData.roles as any)?.name || '';
      setUserRole(role.toLowerCase());
    }
  };

  const fetchProducts = async () => {
    if (!currentCompany) return;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching products:', error);
      return;
    }

    if (data) {
      console.log('Products loaded:', data.length);
      setProducts(data);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File size must be less than 2MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setUploadError('File must be an image');
      return;
    }

    setUploadingLogo(true);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setLogoUrl(dataUrl);
        setUploadingLogo(false);
      };
      reader.onerror = () => {
        setUploadError('Failed to read file');
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploadError('Failed to upload file');
      setUploadingLogo(false);
    }
  };

  const fetchLineItems = async () => {
    const { data, error } = await supabase
      .from('template_line_items')
      .select('*')
      .eq('template_id', template.id)
      .order('sort_order');

    if (error) {
      console.error('Error fetching line items:', error);
    } else {
      setLineItems(data || []);
    }
  };

  const handleAddLineItem = (type: 'product' | 'section' = 'product') => {
    setLineItems([
      ...lineItems,
      {
        item_type: type,
        name: '',
        description: '',
        section_body: type === 'section' ? '' : undefined,
        unit: type === 'section' ? '' : 'unit',
        default_quantity: type === 'section' ? 0 : 1,
        default_price: 0,
        tax_code: '',
        sort_order: lineItems.length,
      },
    ]);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const updated = [...lineItems];
      updated[index] = {
        ...updated[index],
        name: product.name,
        description: product.description || '',
        default_price: parseFloat(product.price || 0),
      };
      setLineItems(updated);
    }
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    if (!currentCompany || !user) return;

    setSaving(true);

    try {
      let templateId = template?.id;

      if (template?.id) {
        const { error } = await supabase
          .from('quotation_templates')
          .update({
            name: name.trim(),
            body_html: bodyHtml,
            terms_html: termsHtml,
            is_default: isDefault,
            logo_url: logoUrl || null,
            logo_position: logoPosition,
            logo_max_width: logoMaxWidth,
            custom_sections: customSections,
            updated_at: new Date().toISOString(),
          })
          .eq('id', template.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('quotation_templates')
          .insert({
            company_id: currentCompany.id,
            name: name.trim(),
            body_html: bodyHtml,
            terms_html: termsHtml,
            is_default: isDefault,
            logo_url: logoUrl || null,
            logo_position: logoPosition,
            logo_max_width: logoMaxWidth,
            custom_sections: customSections,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        templateId = data.id;
      }

      if (template?.id) {
        await supabase
          .from('template_line_items')
          .delete()
          .eq('template_id', template.id);
      }

      if (lineItems.length > 0) {
        const { error } = await supabase
          .from('template_line_items')
          .insert(
            lineItems.map((item, index) => ({
              template_id: templateId,
              name: item.name,
              description: item.description,
              unit: item.unit,
              default_quantity: item.default_quantity,
              default_price: item.default_price,
              tax_code: item.tax_code,
              sort_order: index,
            }))
          );

        if (error) throw error;
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving template:', error);
      alert(`Failed to save template: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {template ? 'Edit Template' : 'New Template'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Standard Event Package"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-slate-300"
              />
              Set as default template for this company
            </label>
          </div>

          <div className="border border-slate-300 rounded-lg p-4 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Logo Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Logo Upload or URL
                </label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com/logo.png or paste data URI..."
                    />
                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm font-medium">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        disabled={uploadingLogo}
                      />
                    </label>
                  </div>
                  {uploadingLogo && (
                    <p className="text-xs text-blue-600">Uploading logo...</p>
                  )}
                  {uploadError && (
                    <p className="text-xs text-red-600">{uploadError}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    Upload an image (max 2MB) or enter an image URL. This logo will appear at the top of quotations using this template.
                  </p>
                </div>
              </div>

              {logoUrl && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Logo Preview
                  </label>
                  <div className={`flex ${logoPosition === 'center' ? 'justify-center' : logoPosition === 'right' ? 'justify-end' : 'justify-start'}`}>
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      style={{ maxWidth: `${logoMaxWidth}px` }}
                      className="border border-slate-300 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="50%" y="50%" text-anchor="middle" dy=".3em">Invalid</text></svg>';
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Position
                  </label>
                  <select
                    value={logoPosition}
                    onChange={(e) => setLogoPosition(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Max Width (px)
                  </label>
                  <input
                    type="number"
                    value={logoMaxWidth}
                    onChange={(e) => setLogoMaxWidth(parseInt(e.target.value) || 200)}
                    min="50"
                    max="500"
                    step="10"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Body / Introduction
              {(userRole === 'admin' || userRole === 'manager') ? null : (
                <span className="ml-2 text-xs text-orange-600">(Read-only: Admin/Manager access required)</span>
              )}
            </label>
            <RichTextEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              disabled={userRole !== 'admin' && userRole !== 'manager'}
              placeholder="Enter the introduction or body content..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Policies / Terms & Conditions
              {(userRole === 'admin' || userRole === 'manager') ? null : (
                <span className="ml-2 text-xs text-orange-600">(Read-only: Admin/Manager access required)</span>
              )}
            </label>
            <RichTextEditor
              value={termsHtml}
              onChange={setTermsHtml}
              disabled={userRole !== 'admin' && userRole !== 'manager'}
              placeholder="Enter terms and conditions..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-700">
                Additional Sections
                {(userRole === 'admin' || userRole === 'manager') ? null : (
                  <span className="ml-2 text-xs text-orange-600">(Read-only: Admin/Manager access required)</span>
                )}
              </label>
              {(userRole === 'admin' || userRole === 'manager') && (
                <button
                  type="button"
                  onClick={() => setCustomSections([...customSections, { title: '', content: '', order: customSections.length }])}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Section
                </button>
              )}
            </div>

            {customSections.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-600 text-sm">
                  No additional sections. Add custom sections for flexible content.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {customSections.map((section, index) => (
                  <div key={index} className="border border-slate-300 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => {
                          const updated = [...customSections];
                          updated[index].title = e.target.value;
                          setCustomSections(updated);
                        }}
                        placeholder="Section Title (e.g., Payment Schedule, Cancellation Policy)"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        disabled={userRole !== 'admin' && userRole !== 'manager'}
                      />
                      {(userRole === 'admin' || userRole === 'manager') && (
                        <button
                          type="button"
                          onClick={() => setCustomSections(customSections.filter((_, i) => i !== index))}
                          className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <RichTextEditor
                      value={section.content}
                      onChange={(content) => {
                        const updated = [...customSections];
                        updated[index].content = content;
                        setCustomSections(updated);
                      }}
                      disabled={userRole !== 'admin' && userRole !== 'manager'}
                      placeholder="Enter section content..."
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-700">
                Preset Line Items
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAddLineItem('product')}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
                <button
                  type="button"
                  onClick={() => handleAddLineItem('section')}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Section
                </button>
              </div>
            </div>

            {lineItems.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-600 text-sm">
                  No line items yet. Add preset items that will be included when using this template.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div
                    key={index}
                    className={`rounded-lg p-4 border ${item.item_type === 'section' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-3">
                        <GripVertical className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${item.item_type === 'section' ? 'bg-amber-200 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                            {item.item_type === 'section' ? 'Section' : 'Product'}
                          </span>
                        </div>

                        {item.item_type === 'product' && (
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Select from Products
                            </label>
                            {products.length > 0 ? (
                              <>
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleProductSelect(index, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                  <option value="">-- Click to select a product ({products.length} available) --</option>
                                  {products.map(product => (
                                    <option key={product.id} value={product.id}>
                                      {product.name} - ₱{product.price}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-xs text-slate-600 mt-1">
                                  Or fill in the fields below manually
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-slate-600">
                                No products available. Add products in the Products page first, or fill in the fields manually below.
                              </p>
                            )}
                          </div>
                        )}

                        <div>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleLineItemChange(index, 'name', e.target.value)}
                            placeholder={item.item_type === 'section' ? 'Section name *' : 'Item name *'}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {item.item_type === 'section' && (
                          <div>
                            <textarea
                              value={item.section_body || ''}
                              onChange={(e) => handleLineItemChange(index, 'section_body', e.target.value)}
                              placeholder="Section body (optional)"
                              rows={3}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        {item.item_type === 'product' && (
                          <>
                            <div>
                              <textarea
                                value={item.description}
                                onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                                placeholder="Description (optional)"
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <input
                                  type="text"
                                  value={item.unit}
                                  onChange={(e) => handleLineItemChange(index, 'unit', e.target.value)}
                                  placeholder="Unit"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <input
                                  type="number"
                                  value={item.default_quantity}
                                  onChange={(e) => handleLineItemChange(index, 'default_quantity', parseFloat(e.target.value) || 0)}
                                  placeholder="Quantity"
                                  step="0.01"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <input
                                  type="number"
                                  value={item.default_price}
                                  onChange={(e) => handleLineItemChange(index, 'default_price', parseFloat(e.target.value) || 0)}
                                  placeholder="Unit Price"
                                  step="0.01"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  value={item.tax_code}
                                  onChange={(e) => handleLineItemChange(index, 'tax_code', e.target.value)}
                                  placeholder="Tax Code (optional)"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
