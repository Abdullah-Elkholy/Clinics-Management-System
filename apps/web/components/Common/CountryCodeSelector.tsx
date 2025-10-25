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
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-3 py-2 text-base'
  };

  return (
    <div className="relative flex-shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${sizeClasses[size]} border rounded-lg font-medium transition-all appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          hasError
            ? 'border-red-400 bg-red-50'
            : value === 'OTHER'
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
      >
        {showOptgroups ? (
          <>
            <optgroup label="الدول الشهيرة">
              {COUNTRY_CODES.map((cc) => (
                <option key={cc.code} value={cc.code}>
                  {cc.flag} {cc.countryName} ({cc.code})
                </option>
              ))}
            </optgroup>
            <optgroup label="خيارات أخرى">
              <option value="OTHER">🌍 دخول يدوي (Other/Custom)</option>
            </optgroup>
          </>
        ) : (
          <>
            {COUNTRY_CODES.map((cc) => (
              <option key={cc.code} value={cc.code}>
                {cc.flag} {cc.code}
              </option>
            ))}
            <option value="OTHER">🌍 دخول يدوي</option>
          </>
        )}
      </select>
      <i className="fas fa-chevron-down absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
    </div>
  );
}
