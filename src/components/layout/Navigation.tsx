import { useState, useRef, useEffect } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { CompanySwitcher } from './CompanySwitcher';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Activity,
  Package,
  Settings,
  LogOut,
  Mail,
  FileText,
  FileType,
  Calendar,
  ChevronDown,
  User,
  Building2,
  Check
} from 'lucide-react';

interface NavigationProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Navigation({ currentView, onNavigate }: NavigationProps) {
  const { permissions, currentCompany, companies, switchCompany } = useCompany();
  const { signOut, user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { id: 'customers', label: 'Customers', icon: Users, show: permissions?.customers.read },
    { id: 'leads', label: 'Leads', icon: TrendingUp, show: permissions?.leads.read },
    { id: 'quotations', label: 'Quotations', icon: FileText, show: permissions?.quotations?.read },
    { id: 'templates', label: 'Templates', icon: FileType, show: permissions?.quotations?.read },
    { id: 'products', label: 'Products', icon: Package, show: permissions?.products.read },
  ];

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4 lg:gap-8 overflow-x-auto">
            <CompanySwitcher />

            <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
              {navItems.filter(item => item.show).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                      currentView === item.id
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium text-sm lg:text-base">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Mail className="w-4 h-4 text-slate-500" />
              <span className="text-sm hidden md:inline">{user?.email}</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs text-slate-500">Signed in as</p>
                  <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
                </div>

                {companies.length > 1 && currentCompany && (
                  <div className="border-b border-slate-100 py-1">
                    <div className="px-3 py-2">
                      <p className="text-xs text-slate-500 mb-2">Business Unit</p>
                    </div>
                    {companies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => {
                          switchCompany(company.id);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-600" />
                          <span className={company.id === currentCompany.id ? 'text-slate-900 font-medium' : 'text-slate-700'}>
                            {company.name}
                          </span>
                        </div>
                        {company.id === currentCompany.id && (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowDropdown(false);
                    onNavigate('profile');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>

                {permissions?.settings.read && (
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onNavigate('settings');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                )}

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
          {navItems.filter(item => item.show).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  currentView === item.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
