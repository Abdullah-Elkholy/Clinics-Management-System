/**
 * ConditionSection Component
 * 
 * Unified condition selection component for templates and conditions
 * Handles operator selection and value inputs with validation
 * 
 * File: apps/web/components/Common/ConditionSection.tsx
 */

'use client';

import React from 'react';
import UsageGuideSection from './UsageGuideSection';

export interface ConditionSectionConfig {
  operator: 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | 'DEFAULT' | null;
  value?: number;
  minValue?: number;
  maxValue?: number;
}

interface ConditionSectionProps {
  config: ConditionSectionConfig;
  onOperatorChange: (operator: 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | null) => void;
  onValueChange: (value: number | undefined) => void;
  onMinValueChange: (value: number | undefined) => void;
  onMaxValueChange: (value: number | undefined) => void;
  onAddToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onSelectedConditionChange?: (operatorType: string | null) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
  hideInfo?: boolean;
}

export function ConditionSection({
  config,
  onOperatorChange,
  onValueChange,
  onMinValueChange,
  onMaxValueChange,
  onAddToast,
  onSelectedConditionChange,
  disabled = false,
  errors = {},
  hideInfo = false,
}: ConditionSectionProps) {
  const operatorOptions = [
    { value: 'EQUAL', label: 'يساوي' },
    { value: 'GREATER', label: 'أكبر من' },
    { value: 'LESS', label: 'أقل من' },
    { value: 'RANGE', label: 'نطاق' },
  ];

  const handleOperatorChange = (newOperator: string) => {
    const op = (newOperator || null) as 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | null;
    onOperatorChange(op);
    // Notify parent of the condition type that was selected
    if (onSelectedConditionChange) {
      onSelectedConditionChange(newOperator || null);
    }
    // Reset values when operator changes
    onValueChange(undefined);
    onMinValueChange(undefined);
    onMaxValueChange(undefined);
  };

  const handleConditionValueChange = (newVal: number | undefined) => {
    if (newVal === undefined) {
      onValueChange(undefined);
      return;
    }
    
    // Validate: must be > 0
    if (newVal > 0) {
      onValueChange(newVal);
    } else {
      // Show error but don't set invalid value
      onAddToast('يجب أن تكون القيمة أكبر من صفر (≥1)', 'error');
    }
  };

  const handleMinValueChange = (newVal: number | undefined) => {
    if (newVal === undefined) {
      onMinValueChange(undefined);
      return;
    }
    
    // Validate: must be > 0
    if (newVal > 0) {
      onMinValueChange(newVal);
    } else {
      onAddToast('الحد الأدنى يجب أن يكون أكبر من صفر (≥1)', 'error');
    }
  };

  const handleMaxValueChange = (newVal: number | undefined) => {
    if (newVal === undefined) {
      onMaxValueChange(undefined);
      return;
    }
    
    // Validate: must be > 0
    if (newVal > 0) {
      onMaxValueChange(newVal);
    } else {
      onAddToast('الحد الأقصى يجب أن يكون أكبر من صفر (≥1)', 'error');
    }
  };

  return (
    <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div>
        {/* Operator Choice and Value Inputs - Same Row */}
        <div className="mb-3">
          {/* For RANGE: Operator and both values in 3-column grid */}
          {config.operator === 'RANGE' ? (
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  نوع الشرط
                </label>
                <select
                  value={config.operator || ''}
                  onChange={(e) => handleOperatorChange(e.target.value)}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">-- بدون شرط --</option>
                  <option value="DEFAULT">-- قالب افتراضي --</option>
                  {operatorOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  الحد الأدنى (≥1) *
                </label>
                <input
                  type="number"
                  value={config.minValue || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    handleMinValueChange(isNaN(val) ? undefined : val);
                  }}
                  placeholder="1"
                  disabled={disabled}
                  min="1"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent text-sm ${
                    errors.minValue
                      ? 'border-red-500 bg-red-50 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {errors.minValue && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <i className="fas fa-exclamation-circle"></i>
                    {errors.minValue}
                  </p>
                )}
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  الحد الأقصى (≥1) *
                </label>
                <input
                  type="number"
                  value={config.maxValue || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    handleMaxValueChange(isNaN(val) ? undefined : val);
                  }}
                  placeholder="100"
                  disabled={disabled}
                  min="1"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent text-sm ${
                    errors.maxValue
                      ? 'border-red-500 bg-red-50 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {errors.maxValue && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <i className="fas fa-exclamation-circle"></i>
                    {errors.maxValue}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* For non-RANGE: Operator and Value Side by Side */
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  نوع الشرط
                </label>
                <select
                  value={config.operator || ''}
                  onChange={(e) => handleOperatorChange(e.target.value)}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">-- بدون شرط --</option>
                  <option value="DEFAULT">-- قالب افتراضي --</option>
                  {operatorOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value Input - Only for non-DEFAULT operators */}
              {config.operator && config.operator !== 'DEFAULT' && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    القيمة (≥1) *
                  </label>
                  <input
                    type="number"
                    value={config.value || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      handleConditionValueChange(isNaN(val) ? undefined : val);
                    }}
                    placeholder="أدخل القيمة"
                    disabled={disabled}
                    min="1"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent text-sm ${
                      errors.value
                        ? 'border-red-500 bg-red-50 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                  />
                  {errors.value && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <i className="fas fa-exclamation-circle"></i>
                      {errors.value}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Range validation error - displayed below RANGE inputs */}
          {config.operator === 'RANGE' && errors.range && (
            <div className="mb-3 p-2 bg-red-50 border border-red-300 rounded text-xs text-red-600 flex items-center gap-2">
              <i className="fas fa-exclamation-circle flex-shrink-0"></i>
              {errors.range}
            </div>
          )}

          {/* No Condition Message */}
          {!config.operator ? (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                <i className="fas fa-circle-minus"></i>
                بدون شرط
              </p>
              <p className="text-xs text-amber-700 mt-1">
                لم يتم تحديد شرط. هذا القالب لن يتم استخدامه في الإرسال حتى يتم تغيير هذا الشرط
              </p>
            </div>
          ) : null}

          {/* DEFAULT Operator Message */}
          {config.operator === 'DEFAULT' && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                <i className="fas fa-check-circle"></i>
                قالب افتراضي
              </p>
              <p className="text-xs text-green-700 mt-1">
                سيتم استخدام هذا القالب عندما لا تنطبق أي شروط أخرى
              </p>
            </div>
          )}
        </div>
      </div>

      {!hideInfo && (
        <UsageGuideSection
          items={[
            {
              title: 'بدون شرط',
              description: 'سيصبح هذا بدون شرط محدد ولن يتم استخدامه في الإرسال لحين تغيير هذا الشرط',
            },
            {
                title: 'قالب افتراضي',
                description: 'يشترط إرسال الرسائل وجود قالب افتراضي, يسمح بوجود قالب افتراضي واحد فقط ويتم استخدامه عندما لا تنطبق أي شروط أخرى',
            },
            {
              title: '',
              description: 'جميع القيم يجب أن تكون أكبر من صفر (≥1)',
            },
          ]}
        />
      )}
    </div>
  );
}
