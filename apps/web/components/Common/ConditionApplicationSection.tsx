/**
 * Unified Condition Application Section Component
 * File: apps/web/components/Common/ConditionApplicationSection.tsx
 * 
 * Reusable component for condition selection across:
 * - AddTemplateModal
 * - EditTemplateModal
 * - ManageConditionsModal
 * 
 * Features:
 * - Condition operator selection (EQUAL, GREATER, LESS, RANGE, DEFAULT)
 * - Value input with validation
 * - Optional message template selector (for ManageConditionsModal only)
 * - Consistent styling across all modals
 */

'use client';

import React from 'react';
import { ConditionSection } from './ConditionSection';
import { ValidationError } from '@/utils/validation';

interface ConditionApplicationSectionProps {
  // Condition state
  operator: 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | 'DEFAULT' | null;
  value?: number;
  minValue?: number;
  maxValue?: number;

  // Callbacks
  onOperatorChange: (operator: 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | null) => void;
  onValueChange: (value: number | undefined) => void;
  onMinValueChange: (value: number | undefined) => void;
  onMaxValueChange: (value: number | undefined) => void;
  onAddToast: (message: string, type: 'success' | 'error' | 'info') => void;

  // Template selection (optional, only for ManageConditionsModal)
  showTemplateSelector?: boolean;
  templates?: Array<{ id: string; title: string }>;
  selectedTemplate?: string;
  onTemplateChange?: (templateId: string) => void;
  templateErrors?: ValidationError;

  // Form state
  errors?: ValidationError;
  isLoading?: boolean;
  hideInfo?: boolean;
}

export function ConditionApplicationSection({
  operator,
  value,
  minValue,
  maxValue,
  onOperatorChange,
  onValueChange,
  onMinValueChange,
  onMaxValueChange,
  onAddToast,
  showTemplateSelector = false,
  templates = [],
  selectedTemplate = '',
  onTemplateChange,
  templateErrors = {},
  errors = {},
  isLoading = false,
  hideInfo = false,
}: ConditionApplicationSectionProps) {
  return (
    <>
      {/* Message Template Selection - Only shown for ManageConditionsModal */}
      {showTemplateSelector && templates.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
          <h5 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
            <i className="fas fa-envelope text-blue-600"></i>
            الرسالة الخاصة بالشرط*
          </h5>
          <select
            value={selectedTemplate}
            onChange={(e) => onTemplateChange?.(e.target.value)}
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium ${
              templateErrors.template
                ? 'border-red-500 bg-red-50 focus:ring-red-500'
                : 'border-blue-300 bg-white focus:ring-blue-500'
            }`}
          >
            <option value="">-- اختر الرسالة --</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
          {templateErrors.template && (
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              {templateErrors.template}
            </p>
          )}
        </div>
      )}

      {/* Condition Selection Section - Only shown if template is selected or no template selector shown */}
      {(!showTemplateSelector || selectedTemplate) && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-4">
          <h5 className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
            <i className="fas fa-sliders-h text-emerald-600"></i>
            تطبيق الشرط
          </h5>
          <ConditionSection
            config={{
              operator,
              value,
              minValue,
              maxValue,
            }}
            onOperatorChange={onOperatorChange}
            onValueChange={onValueChange}
            onMinValueChange={onMinValueChange}
            onMaxValueChange={onMaxValueChange}
            onAddToast={onAddToast}
            disabled={isLoading}
            errors={errors}
            hideInfo={hideInfo}
          />
        </div>
      )}
    </>
  );
}
