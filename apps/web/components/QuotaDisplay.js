import React from 'react'
import { useMyQuota } from '../lib/hooks'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

/**
 * QuotaDisplay Component
 * Shows current user's quota with warnings when low
 * Compact design for header placement
 */
export default function QuotaDisplay() {
  const { data: quota, isLoading } = useMyQuota()

  if (isLoading || !quota) return null

  // Don't show for users with unlimited quota (admins)
  if (quota.hasUnlimitedQuota) return null

  const messagesPercentage = quota.messagesQuota > 0 
    ? (quota.remainingMessages / quota.messagesQuota) * 100 
    : 0

  const queuesPercentage = quota.queuesQuota > 0
    ? (quota.remainingQueues / quota.queuesQuota) * 100
    : 0

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2 shadow-sm">
      <div className="flex items-center space-x-6 space-x-reverse">
        {/* Messages Quota */}
        <div className="flex items-center space-x-2 space-x-reverse">
          <div className="text-right">
            <div className="flex items-center space-x-1 space-x-reverse">
              <span className="text-xs text-white/80">الرسائل</span>
              {quota.isMessagesQuotaLow && (
                <ExclamationTriangleIcon className="h-3 w-3 text-yellow-300" />
              )}
            </div>
            <div className={`text-sm font-bold ${
              quota.isMessagesQuotaLow ? 'text-yellow-300' : 'text-white'
            }`}>
              {quota.remainingMessages} / {quota.messagesQuota}
            </div>
          </div>
          <div className="w-12 bg-white/20 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all ${
                messagesPercentage < 10 ? 'bg-red-400' :
                messagesPercentage < 30 ? 'bg-yellow-400' :
                'bg-green-400'
              }`}
              style={{ width: `${messagesPercentage}%` }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-white/20" />

        {/* Queues Quota */}
        <div className="flex items-center space-x-2 space-x-reverse">
          <div className="text-right">
            <div className="flex items-center space-x-1 space-x-reverse">
              <span className="text-xs text-white/80">الطوابير</span>
              {quota.isQueuesQuotaLow && (
                <ExclamationTriangleIcon className="h-3 w-3 text-yellow-300" />
              )}
            </div>
            <div className={`text-sm font-bold ${
              quota.isQueuesQuotaLow ? 'text-yellow-300' : 'text-white'
            }`}>
              {quota.remainingQueues} / {quota.queuesQuota}
            </div>
          </div>
          <div className="w-12 bg-white/20 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all ${
                queuesPercentage < 10 ? 'bg-red-400' :
                queuesPercentage < 30 ? 'bg-yellow-400' :
                'bg-green-400'
              }`}
              style={{ width: `${queuesPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
