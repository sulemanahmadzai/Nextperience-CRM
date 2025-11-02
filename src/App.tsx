import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CompanyProvider, useCompany } from './contexts/CompanyContext';
import { GoogleAuthProvider } from './contexts/GoogleAuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { Navigation } from './components/layout/Navigation';
import { Dashboard } from './components/dashboard/Dashboard';
import { CustomersList } from './components/customers/CustomersList';
import { LeadsKanban } from './components/leads/LeadsKanban';
import LeadDetailPage from './components/leads/LeadDetailPage';
import { ActivitiesList } from './components/activities/ActivitiesList';
import { ProductsList } from './components/products/ProductsList';
import { Settings } from './components/settings/Settings';
import QuotationsPage from './components/quotations/QuotationsPage';
import QuotationDetailPage from './components/quotations/QuotationDetailPage';
import QuotationModal from './components/quotations/QuotationModal';
import CalendarView from './components/calendar/CalendarView';
import { TemplatesPage } from './components/templates/TemplatesPage';
import { PublicQuotationView } from './components/quotations/PublicQuotationView';
import { PublicProformaInvoiceView } from './components/proforma/PublicProformaInvoiceView';
import { ProfilePage } from './components/profile/ProfilePage';
import { assignCurrentUserToDefaultCompany } from './lib/assignUserToCompany';

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading: companyLoading, currentCompany, refreshCompanies } = useCompany();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'google-connected') {
        window.location.reload();
      } else if (e.data?.type === 'google-error') {
        alert(`Google authentication failed: ${e.data.error}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  console.log('[App] Render state:', {
    authLoading,
    companyLoading,
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
    hasCurrentCompany: !!currentCompany,
    currentCompanyId: currentCompany?.id,
    currentCompanyName: currentCompany?.name,
    companiesCount: 0 // We'll log this from CompanyContext
  });

  if (authLoading || companyLoading) {
    console.log('[App] Showing loading state');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    console.log('[App] No user, showing login form');
    return <LoginForm />;
  }

  const handleAssignToCompany = async () => {
    setAssigning(true);
    setAssignMessage(null);
    const result = await assignCurrentUserToDefaultCompany();
    
    if (result.success) {
      setAssignMessage(result.message || 'Success! Refreshing...');
      // Refresh companies and reload
      setTimeout(() => {
        refreshCompanies();
        window.location.reload();
      }, 1000);
    } else {
      setAssignMessage(`Error: ${result.error}`);
      setAssigning(false);
    }
  };

  if (!currentCompany) {
    console.error('[App] ===== NO COMPANY ACCESS ERROR =====');
    console.error('[App] User authenticated but no company access');
    console.error('[App] User details:', {
      id: user.id,
      email: user.email
    });

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <div className="text-slate-600 mb-4">No company access. Please contact your administrator.</div>
          <div className="space-y-3">
            <button
              onClick={handleAssignToCompany}
              disabled={assigning}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assigning ? 'Assigning...' : 'Auto-Assign to Default Company'}
            </button>
            {assignMessage && (
              <div className={`text-sm ${assignMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {assignMessage}
              </div>
            )}
            <button
              onClick={signOut}
              className="block text-slate-900 hover:text-slate-700 underline text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <div className="print:hidden">
        <Navigation currentView={currentView} onNavigate={setCurrentView} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 print:max-w-none print:p-0">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'customers' && <CustomersList />}
        {currentView === 'leads' && !selectedLeadId && (
          <LeadsKanban
            onViewLead={setSelectedLeadId}
            onViewCalendar={() => setCurrentView('calendar')}
          />
        )}
        {currentView === 'leads' && selectedLeadId && (
          <LeadDetailPage
            leadId={selectedLeadId}
            onBack={() => setSelectedLeadId(null)}
            onViewQuotation={(quotationId) => {
              setSelectedQuotationId(quotationId);
              setCurrentView('quotations');
            }}
          />
        )}
        {currentView === 'quotations' && !selectedQuotationId && (
          <QuotationsPage onViewQuotation={setSelectedQuotationId} />
        )}
        {currentView === 'quotations' && selectedQuotationId && (
          <QuotationDetailPage
            quotationId={selectedQuotationId}
            onBack={() => setSelectedQuotationId(null)}
            onEdit={(id) => setEditingQuotationId(id)}
          />
        )}
        {currentView === 'activities' && <ActivitiesList />}
        {currentView === 'products' && <ProductsList />}
        {currentView === 'templates' && <TemplatesPage />}
        {currentView === 'calendar' && (
          <CalendarView onBack={() => setCurrentView('leads')} />
        )}
        {currentView === 'profile' && <ProfilePage />}
        {currentView === 'settings' && <Settings />}
      </div>

      {editingQuotationId && (
        <QuotationModal
          quotation={{ id: editingQuotationId }}
          onClose={() => setEditingQuotationId(null)}
          onSuccess={() => {
            setEditingQuotationId(null);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const publicToken = params.get('q');

  if (path.startsWith('/invoice/')) {
    const token = path.split('/invoice/')[1];
    if (token) {
      return <PublicProformaInvoiceView token={token} />;
    }
  }

  if (publicToken) {
    return <PublicQuotationView token={publicToken} />;
  }

  return (
    <AuthProvider>
      <CompanyProvider>
        <GoogleAuthProvider>
          <AppContent />
        </GoogleAuthProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}
