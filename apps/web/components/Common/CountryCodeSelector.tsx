'use client';

import { COUNTRY_CODES } from '@/constants';

interface CountryCodeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  showOptgroups?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Reusable Country Code Selector Component
 * Handles standard country codes and custom "OTHER" option
 * Used across UploadModal, EditPatientModal, AddPatientModal
 */
export default function CountryCodeSelector({
  value,
  onChange,
  disabled = false,
  hasError = false,
  showOptgroups = true,
  size = 'md'
}: CountryCodeSelectorProps) {
  // Vertical padding and font-size by control size (horizontal padding handled separately for RTL)
  const sizeClasses = {
    sm: 'py-1.5 text-xs',
    md: 'py-2.5 text-sm',
    lg: 'py-3 text-base'
  } as const;

  // Extra right padding to reserve space for the chevron placed on the right (RTL)
  const paddingRightBySize = {
    sm: 'pr-7',
    md: 'pr-9',
    lg: 'pr-10'
  } as const;

  return (
    <div className="relative flex-shrink-0 group">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        dir="rtl"
        className={`${sizeClasses[size]} ${paddingRightBySize[size]} pl-2 text-right border-2 rounded-lg font-medium transition-all appearance-none focus:outline-none focus:ring-2 focus:ring-offset-0 cursor-pointer max-h-60 overflow-y-auto ${
          hasError
            ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-500'
            : value === 'OTHER'
            ? 'border-blue-400 bg-blue-50 text-blue-900 focus:ring-blue-500'
            : 'border-gray-300 bg-white hover:border-blue-400 text-gray-700 focus:ring-blue-500 focus:border-blue-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{ maxHeight: '15rem', overflowY: 'auto' }}
      >
        {showOptgroups ? (
          <>
            <optgroup label="الدول الشهيرة" className="bg-white">
              {COUNTRY_CODES.map((cc) => (
                <option key={cc.code} value={cc.code} className="py-1">
                  {cc.countryName} {cc.code}
                </option>
              ))}
            </optgroup>
            <optgroup label="خيارات أخرى" className="bg-white">
              <option value="OTHER" className="py-1">🔧 دخول يدوي</option>
            </optgroup>
          </>
        ) : (
          <>
            {COUNTRY_CODES.map((cc) => (
              <option key={cc.code} value={cc.code} className="py-1">
                {cc.code}
              </option>
            ))}
            <option value="OTHER" className="py-1">🔧 دخول يدوي</option>
          </>
        )}
      </select>
      <i className={`fas fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-all ${
        hasError
          ? 'text-red-500'
          : value === 'OTHER'
          ? 'text-blue-500'
          : 'text-gray-500 group-hover:text-blue-400'
      } ${size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'}`}></i>
    </div>
  );
}
