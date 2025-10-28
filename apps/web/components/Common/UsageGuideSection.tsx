'use client';

import React, { useState } from 'react';

export interface GuideItem {
  title: string;
  description: string;
}

interface UsageGuideSectionProps {
  items: GuideItem[];
  title?: string;
  icon?: string;
}

/**
 * Reusable toggleable guide/tips section component
 * Displays a list of guide items with a toggle to expand/collapse
 * Default state: Collapsed
 * 
 * @param items - Array of guide items with title and description
 * @param title - (Optional) Section title. Defaults to "نصائح للاستخدام الأمثل"
 * @param icon - (Optional) FontAwesome icon class. Defaults to "fa-info-circle"
 */
export default function UsageGuideSection({ 
  items,
  title = 'نصائح للاستخدام الأمثل',
  icon = 'fa-info-circle',
}: UsageGuideSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden mt-6">
      {/* Header - Toggleable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-blue-100 transition-colors text-left"
      >
        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
          <i className={`fas ${icon} text-blue-600`}></i>
          {title}
        </h4>
        <i className={`fas fa-chevron-down text-blue-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
      </button>

      {/* Content - Expandable */}
      {isExpanded && (
        <div className="border-t border-blue-200 bg-white px-4 py-3">
          <ul className="text-blue-800 text-sm space-y-1 mr-2">
            {items.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <div>
                  {item.title && <strong>{item.title}:</strong>} {item.description}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
