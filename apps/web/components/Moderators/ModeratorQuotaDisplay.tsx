'use client';

import React, { useState } from 'react';
import { ModeratorQuota } from '@/types/user';
import { useModeratorQuota } from '@/hooks/useModeratorQuota';

interface ModeratorQuotaDisplayProps {
  quota?: ModeratorQuota;
  moderatorId: string;
  onEdit?: (quota: ModeratorQuota) => void;
  onEditMessages?: (quota: ModeratorQuota) => void;
  onEditQueues?: (quota: ModeratorQuota) => void;
}

/**
 * ModeratorQuotaDisplay - Shows moderator quota usage with progress indicators
 * Displays both messages and queues quota with visual warnings
 * Features: Total/Used/Remaining breakdown, collapsible section, highlighted edit button
 */
export default function ModeratorQuotaDisplay({
  quota: propQuota,
  moderatorId,
  onEdit,
  onEditMessages,
  onEditQueues,
}: ModeratorQuotaDisplayProps) {
  const [showDetails, setShowDetails] = useState(true); // Default expanded
  
  // Fetch quota from API if not provided
  const { quota: fetchedQuota, loading: quotaLoading } = useModeratorQuota(moderatorId);
  
  // Use prop quota if provided, otherwise use fetched quota
  const quota = propQuota || fetchedQuota;

  // Default quota if not provided
  const displayQuota: ModeratorQuota = quota || {
    id: `quota-${moderatorId}`,
    moderatorId,
    messagesQuota: {
      limit: -1,
      used: 0,
      percentage: 0,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: -1,
      used: 0,
      percentage: 0,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const getProgressColor = (isLow: boolean, percentage: number): string => {
    if (percentage >= 100) return 'bg-red-500';
    if (isLow) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const calculateRemaining = (limit: number, used: number): number => {
    if (limit === -1) return -1; // Unlimited
    return Math.max(0, limit - used);
  };

  const renderQuotaBreakdown = (
    title: string,
    quotaData: ModeratorQuota['messagesQuota'],
    icon: string,
    bgColor: string,
    textColor: string,
    progressColor: string,
    onEditButton?: () => void,
    buttonLabel?: string,
    buttonIcon?: string,
    buttonBgColor?: string
  ) => {
    const remaining = calculateRemaining(quotaData.limit, quotaData.used);
    const isUnlimited = quotaData.limit === -1;

    return (
      <div className={`${bgColor} rounded-lg p-4 border ${textColor} border-opacity-20`}>
        {/* Title with Edit Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className={`fas ${icon} ${textColor}`}></i>
            <h5 className={`font-semibold text-sm ${textColor}`}>{title}</h5>
          </div>
          {onEditButton && (
            <button
              onClick={onEditButton}
              className={`px-3 py-2 ${buttonBgColor || 'bg-blue-600'} hover:${buttonBgColor?.replace('bg-', 'hover:bg-')} text-white text-xs font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center gap-2`}
            >
              {buttonIcon && <i className={`fas ${buttonIcon}`}></i>}
              {buttonLabel || 'تعديل'}
            </button>
          )}
        </div>

        {/* Three-column breakdown */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Total */}
          <div className="bg-white bg-opacity-50 rounded p-2 text-center">
            <div className={`text-xs font-medium ${textColor} opacity-70 mb-1`}>
              الإجمالي
            </div>
            <div className={`text-lg font-bold ${textColor}`}>
              {isUnlimited ? 'غير محدود' : quotaData.limit.toLocaleString('ar-SA')}
            </div>
          </div>

          {/* Used */}
          <div className="bg-white bg-opacity-50 rounded p-2 text-center">
            <div className={`text-xs font-medium ${textColor} opacity-70 mb-1`}>
              المستخدم
            </div>
            <div className={`text-lg font-bold ${textColor}`}>
              {quotaData.used.toLocaleString('ar-SA')}
            </div>
          </div>

          {/* Remaining */}
          <div className="bg-white bg-opacity-50 rounded p-2 text-center">
            <div className={`text-xs font-medium ${textColor} opacity-70 mb-1`}>
              المتبقي
            </div>
            <div className={`text-lg font-bold ${textColor}`}>
              {isUnlimited ? 'غير محدود' : remaining.toLocaleString('ar-SA')}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {!isUnlimited && (
          <>
            <div className="w-full bg-white bg-opacity-30 rounded-full h-3 mb-2 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all ${progressColor}`}
                style={{ width: `${Math.min(quotaData.percentage, 100)}%` }}
              ></div>
            </div>

            {/* Usage Percentage and Warning */}
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${textColor}`}>
                استخدام: {quotaData.percentage.toFixed(1)}%
              </span>
              {quotaData.isLow && (
                <span className="flex items-center gap-1 text-xs font-semibold text-yellow-600">
                  <i className="fas fa-exclamation-triangle"></i>
                  تحذير
                </span>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header with Collapsible Toggle */}
      <div
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
      >
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <i className="fas fa-tachometer-alt text-blue-600"></i>
          إدارة الحصة
        </h4>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-600">
            {showDetails ? 'إخفاء' : 'عرض المزيد'}
          </span>
          <button
            className="text-gray-600 hover:text-gray-900 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
          >
            <i
              className={`fas fa-chevron-down transition-transform ${
                showDetails ? 'rotate-180' : ''
              }`}
            ></i>
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {showDetails && (
        <div className="p-4 grid grid-cols-2 gap-4">
          {/* Messages Quota */}
          {renderQuotaBreakdown(
            'الرسائل',
            displayQuota.messagesQuota,
            'fa-envelope',
            'bg-blue-50',
            'text-blue-900',
            'bg-blue-500',
            onEditMessages ? () => onEditMessages(displayQuota) : undefined,
            'تعديل الرسائل',
            'fa-edit',
            'bg-blue-600 hover:bg-blue-700'
          )}

          {/* Queues Quota */}
          {renderQuotaBreakdown(
            'الطوابير',
            displayQuota.queuesQuota,
            'fa-layer-group',
            'bg-purple-50',
            'text-purple-900',
            'bg-purple-500',
            onEditQueues ? () => onEditQueues(displayQuota) : undefined,
            'تعديل الطوابير',
            'fa-edit',
            'bg-purple-600 hover:bg-purple-700'
          )}
        </div>
      )}
    </div>
  );
}
