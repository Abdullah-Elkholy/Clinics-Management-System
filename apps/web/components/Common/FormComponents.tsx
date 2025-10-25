/**
 * FormSection Component
 * 
 * Reusable form section with responsive layout
 */

import React from 'react';

interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  className = '',
}: FormSectionProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      {(title || description) && (
        <div className="mb-6 pb-6 border-b border-gray-200">
          {title && <h3 className="text-lg font-bold text-gray-800">{title}</h3>}
          {description && <p className="text-gray-600 text-sm mt-1">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * FormField Component
 * 
 * Reusable form field wrapper with label and error handling
 */

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  required = false,
  error,
  hint,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <label className="block text-sm font-medium text-gray-800 mb-2">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
          <i className="fas fa-info-circle"></i>
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * TextInput Component
 * 
 * Reusable text input field
 */

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number';
  disabled?: boolean;
  error?: boolean;
  icon?: string;
  className?: string;
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  error = false,
  icon,
  className = '',
}: TextInputProps) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <i className={`fas ${icon}`}></i>
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full px-4 py-2.5 rounded-lg border-2 transition-all duration-200
          text-gray-800 placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${icon ? 'pr-10' : ''}
          ${error
            ? 'border-red-500 focus:border-red-600'
            : 'border-gray-300 focus:border-blue-500'
          }
          ${className}
        `}
      />
    </div>
  );
}

/**
 * SelectField Component
 * 
 * Reusable select dropdown
 */

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  error = false,
  className = '',
}: SelectFieldProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`
        w-full px-4 py-2.5 rounded-lg border-2 transition-all duration-200
        text-gray-800 bg-white
        focus:outline-none focus:ring-2 focus:ring-blue-500
        disabled:bg-gray-100 disabled:cursor-not-allowed
        ${error
          ? 'border-red-500 focus:border-red-600'
          : 'border-gray-300 focus:border-blue-500'
        }
        ${className}
      `}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option
          key={opt.value}
          value={opt.value}
          disabled={opt.disabled}
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/**
 * TextArea Component
 * 
 * Reusable textarea field
 */

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
  error = false,
  className = '',
}: TextAreaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={`
        w-full px-4 py-2.5 rounded-lg border-2 transition-all duration-200
        text-gray-800 placeholder-gray-400 resize-vertical
        focus:outline-none focus:ring-2 focus:ring-blue-500
        disabled:bg-gray-100 disabled:cursor-not-allowed
        ${error
          ? 'border-red-500 focus:border-red-600'
          : 'border-gray-300 focus:border-blue-500'
        }
        ${className}
      `}
    />
  );
}
