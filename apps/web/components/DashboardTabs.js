import React from 'react'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'

/**
 * Tabs component for organizing Dashboard, Ongoing, and Failed views
 * Based on prototype design with active state indicators
 */
export default function DashboardTabs({ activeTab, onTabChange, counts = {} }) {
  const i18n = useI18n()

  const tabs = [
    {
      id: 'dashboard',
      label: i18n.t('tabs.dashboard', 'لوحة التحكم'),
      icon: 'fa-th-large',
      ariaLabel: i18n.t('tabs.dashboard_aria', 'عرض لوحة التحكم'),
    },
    {
      id: 'ongoing',
      label: i18n.t('tabs.ongoing', 'الجاري'),
      icon: 'fa-spinner',
      count: counts.ongoing || 0,
      ariaLabel: i18n.t('tabs.ongoing_aria', 'عرض المهام الجارية'),
    },
    {
      id: 'failed',
      label: i18n.t('tabs.failed', 'الفاشل'),
      icon: 'fa-exclamation-triangle',
      count: counts.failed || 0,
      ariaLabel: i18n.t('tabs.failed_aria', 'عرض المهام الفاشلة'),
    },
  ]

  return (
    <div className="border-b border-gray-200 mb-6" role="tablist" aria-label={i18n.t('tabs.main_navigation', 'التنقل الرئيسي')}>
      <div className="flex space-x-4 space-x-reverse">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            id={`${tab.id}-tab`}
            aria-label={tab.ariaLabel}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative px-6 py-3 font-medium text-sm transition-all duration-200
              border-b-2 flex items-center space-x-2 space-x-reverse
              ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }
            `}
          >
            <Icon name={tab.icon} className={activeTab === tab.id ? 'text-blue-600' : 'text-gray-500'} />
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`
                  ml-2 px-2 py-0.5 rounded-full text-xs font-bold
                  ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-700'
                  }
                `}
                aria-label={i18n.t('tabs.count_label', '{count} عنصر', { count: tab.count })}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
