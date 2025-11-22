'use client';

interface CustomCountryCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  size?: 'sm' | 'md' | 'lg';
  placeholder?: string;
  showFullInfo?: boolean;
  id?: string;
  name?: string;
}

/**
 * Reusable Custom Country Code Input Component
 * Used when "OTHER" is selected in CountryCodeSelector
 * Can be displayed inline (compact) or as full info box
 */
export default function CustomCountryCodeInput({
  value,
  onChange,
  disabled = false,
  hasError = false,
  size = 'md',
  placeholder = 'مثال: +44 أو +1 أو +33 (ابدأ بـ +)',
  showFullInfo = false,
  id,
  name,
}: CustomCountryCodeInputProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-3 py-2 text-base'
  };

  // Inline compact version (for table rows)
  if (!showFullInfo) {
    return (
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="tel-country-code"
        className={`flex-1 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${sizeClasses[size]} ${
          hasError
            ? 'border-red-400 bg-red-50 focus:ring-red-500'
            : 'border-blue-300 bg-blue-50 focus:ring-blue-500'
        }`}
      />
    );
  }

  // Full info version (for modal dialogs)
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
        <i className="fas fa-keyboard text-blue-600"></i>
        <span>أدخل كود الدولة المخصص:</span>
      </div>
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="tel-country-code"
        className={`w-full border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all ${sizeClasses[size]}`}
      />
      <div className="flex gap-2 text-xs text-blue-700">
        <i className="fas fa-lightbulb flex-shrink-0 mt-0.5"></i>
        <span>الكود يجب أن يبدأ بـ <span className="font-semibold">+</span> متبوعاً بـ <span className="font-semibold">2-3 أرقام</span> لكود الدولة</span>
      </div>
    </div>
  );
}
