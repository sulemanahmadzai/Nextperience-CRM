import { useState, useEffect } from 'react';
import { CreditCard, ToggleLeft, ToggleRight, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';

interface PaymentGateway {
  id?: string;
  provider: string;
  is_active: boolean;
  is_test_mode: boolean;
  config: any;
}

export default function PaymentGatewaySettings() {
  const { currentCompany } = useCompany();
  const [gateways, setGateways] = useState<PaymentGateway[]>([
    { provider: 'check', is_active: false, is_test_mode: false, config: {} },
    { provider: 'xendit', is_active: false, is_test_mode: true, config: {} },
    { provider: 'paypal', is_active: false, is_test_mode: true, config: {} },
    { provider: 'custom', is_active: false, is_test_mode: true, config: {} },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      loadGateways();
    }
  }, [currentCompany]);

  const loadGateways = async () => {
    if (!currentCompany) return;

    setLoading(true);
    const { data } = await supabase
      .from('payment_gateway_configs')
      .select('*')
      .eq('company_id', currentCompany.id);

    const defaultGateways = [
      { provider: 'check', is_active: false, is_test_mode: false, config: {} },
      { provider: 'xendit', is_active: false, is_test_mode: true, config: {} },
      { provider: 'paypal', is_active: false, is_test_mode: true, config: {} },
      { provider: 'custom', is_active: false, is_test_mode: true, config: {} },
    ];

    if (data && data.length > 0) {
      const allGateways = defaultGateways.map((gateway) => {
        const existing = data.find((d) => d.provider === gateway.provider);
        return existing || gateway;
      });
      setGateways(allGateways);
    } else {
      setGateways(defaultGateways);
    }
    setLoading(false);
  };

  const handleToggle = (provider: string, field: 'is_active' | 'is_test_mode') => {
    setGateways((prev) =>
      prev.map((g) =>
        g.provider === provider ? { ...g, [field]: !g[field] } : g
      )
    );
  };

  const handleConfigChange = (provider: string, key: string, value: string) => {
    setGateways((prev) =>
      prev.map((g) =>
        g.provider === provider
          ? { ...g, config: { ...g.config, [key]: value } }
          : g
      )
    );
  };

  const handleSave = async () => {
    if (!currentCompany) return;

    setSaving(true);
    try {
      for (const gateway of gateways) {
        if (gateway.id) {
          const { error: updateError } = await supabase
            .from('payment_gateway_configs')
            .update({
              is_active: gateway.is_active,
              is_test_mode: gateway.is_test_mode,
              config: gateway.config,
            })
            .eq('id', gateway.id);

          if (updateError) {
            console.error(`Error updating ${gateway.provider}:`, updateError);
            throw updateError;
          }
        } else {
          const { error: insertError } = await supabase.from('payment_gateway_configs').insert({
            company_id: currentCompany.id,
            provider: gateway.provider,
            is_active: gateway.is_active,
            is_test_mode: gateway.is_test_mode,
            config: gateway.config,
          });

          if (insertError) {
            console.error(`Error inserting ${gateway.provider}:`, insertError);
            throw insertError;
          }
        }
      }

      alert(`Payment gateway settings saved successfully for ${currentCompany.name}!`);
      await loadGateways();
    } catch (error: any) {
      console.error('Error saving gateways:', error);
      alert('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-600">Loading payment settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Payment Gateways</h2>
          <p className="text-sm text-slate-600 mt-1">
            Configure payment methods for accepting quotation payments
          </p>
          {currentCompany && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
              <CreditCard className="w-4 h-4" />
              <span>Business Unit: {currentCompany.name}</span>
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Test Mode vs Live Mode</p>
          <p>
            Enable <strong>Test Mode</strong> to simulate payments without real transactions.
            When ready for production, disable Test Mode to accept real payments through the configured gateway.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {gateways.map((gateway) => (
          <div
            key={gateway.provider}
            className="bg-white border border-slate-200 rounded-lg p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <CreditCard className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 capitalize">
                    {gateway.provider === 'custom' ? 'Custom API' : gateway.provider === 'check' ? 'Check Payment' : gateway.provider}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {gateway.provider === 'check' && 'Manual check payment processing with Finance verification'}
                    {gateway.provider === 'paypal' && 'PayPal payment processing'}
                    {gateway.provider === 'xendit' && 'Xendit payment gateway'}
                    {gateway.provider === 'custom' && 'Custom payment API integration'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <button
                  onClick={() => handleToggle(gateway.provider, 'is_active')}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                    gateway.is_active
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-300 bg-slate-50'
                  }`}
                >
                  <span className="text-sm font-medium text-slate-900">Active</span>
                  {gateway.is_active ? (
                    <ToggleRight className="w-6 h-6 text-green-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-400" />
                  )}
                </button>
              </div>

              {gateway.provider !== 'check' && (
                <div>
                  <button
                    onClick={() => handleToggle(gateway.provider, 'is_test_mode')}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                      gateway.is_test_mode
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    <span className="text-sm font-medium text-slate-900">Test Mode</span>
                    {gateway.is_test_mode ? (
                      <ToggleRight className="w-6 h-6 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                    )}
                  </button>
                </div>
              )}

              {gateway.provider === 'check' && (
                <div className="flex items-center justify-center p-3 rounded-lg border-2 border-slate-200 bg-slate-50">
                  <span className="text-sm text-slate-600">Manual verification required</span>
                </div>
              )}
            </div>

            {gateway.is_active && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-700 uppercase tracking-wide">
                  Configuration
                </p>

                {gateway.provider === 'check' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      <strong>Check Payment Gateway</strong> is now active. Customers can submit check payment details
                      which will require Finance Officer verification before being marked as paid.
                    </p>
                    <p className="text-sm text-amber-700 mt-2">
                      No additional configuration needed. Make sure Finance Officers have proper permissions to verify payments.
                    </p>
                  </div>
                )}

                {gateway.provider === 'paypal' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Client ID
                      </label>
                      <input
                        type="text"
                        value={gateway.config.client_id || ''}
                        onChange={(e) =>
                          handleConfigChange(gateway.provider, 'client_id', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        placeholder="PayPal Client ID"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Secret Key
                      </label>
                      <input
                        type="password"
                        value={gateway.config.secret_key || ''}
                        onChange={(e) =>
                          handleConfigChange(gateway.provider, 'secret_key', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        placeholder="PayPal Secret Key"
                      />
                    </div>
                  </>
                )}

                {gateway.provider === 'xendit' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={gateway.config.api_key || ''}
                        onChange={(e) =>
                          handleConfigChange(gateway.provider, 'api_key', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        placeholder="Xendit API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Webhook Secret
                      </label>
                      <input
                        type="password"
                        value={gateway.config.webhook_secret || ''}
                        onChange={(e) =>
                          handleConfigChange(gateway.provider, 'webhook_secret', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        placeholder="Webhook Secret"
                      />
                    </div>
                  </>
                )}

                {gateway.provider === 'custom' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        API Endpoint
                      </label>
                      <input
                        type="url"
                        value={gateway.config.api_endpoint || ''}
                        onChange={(e) =>
                          handleConfigChange(gateway.provider, 'api_endpoint', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        placeholder="https://api.example.com/payments"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={gateway.config.api_key || ''}
                        onChange={(e) =>
                          handleConfigChange(gateway.provider, 'api_key', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        placeholder="API Key or Bearer Token"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
