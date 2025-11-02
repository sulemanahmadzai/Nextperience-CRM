import { useState } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Building2, ChevronDown, Check } from 'lucide-react';

export function CompanySwitcher() {
  const { currentCompany, companies, switchCompany } = useCompany();
  const [isOpen, setIsOpen] = useState(false);

  if (!currentCompany) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => companies.length > 1 ? setIsOpen(!isOpen) : null}
        className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Building2 className="w-5 h-5 text-slate-600" />
        <span className="font-medium text-slate-900">{currentCompany.name}</span>
        {companies.length > 1 && (
          <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && companies.length > 1 && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-20">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => {
                  switchCompany(company.id);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-slate-600" />
                  <span className="text-slate-900">{company.name}</span>
                </div>
                {company.id === currentCompany.id && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
