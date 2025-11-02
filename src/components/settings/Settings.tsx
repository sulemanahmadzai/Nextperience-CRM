import { useState } from 'react';
import { RoleManager } from './RoleManager';
import { UniversalUserManager } from './UniversalUserManager';
import { PipelineSettings } from './PipelineSettings';
import { EventTypeSettings } from './EventTypeSettings';
import BusinessUnitsManagement from './BusinessUnitsManagement';
import PaymentGatewaySettings from './PaymentGatewaySettings';
import ManageUserAccessModal from './ManageUserAccessModal';
import { Shield, Users, GitBranch, Calendar, Building2, CreditCard } from 'lucide-react';

export function Settings() {
  const [activeTab, setActiveTab] = useState<'roles' | 'users' | 'pipeline' | 'events' | 'business-units' | 'payments'>('business-units');
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string } | null>(null);

  const handleManageAccess = (companyId: string, companyName: string) => {
    setSelectedCompany({ id: companyId, name: companyName });
  };

  return (
    <div className="p-6">
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span className="font-medium">Roles & Permissions</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="font-medium">User Management</span>
        </button>

        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'pipeline'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span className="font-medium">Pipeline</span>
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'events'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span className="font-medium">Event Types</span>
        </button>

        <button
          onClick={() => setActiveTab('business-units')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'business-units'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span className="font-medium">Business Units</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'payments'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span className="font-medium">Payment Gateways</span>
        </button>
      </div>

      {activeTab === 'roles' && <RoleManager />}
      {activeTab === 'users' && <UniversalUserManager />}
      {activeTab === 'pipeline' && <PipelineSettings />}
      {activeTab === 'events' && <EventTypeSettings />}
      {activeTab === 'business-units' && (
        <BusinessUnitsManagement onManageAccess={handleManageAccess} />
      )}
      {activeTab === 'payments' && <PaymentGatewaySettings />}

      {selectedCompany && (
        <ManageUserAccessModal
          companyId={selectedCompany.id}
          companyName={selectedCompany.name}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </div>
  );
}
