/**
 * QueueStatsCard Component
 * 
 * Responsive card for displaying queue statistics and info
 * Shows doctor name, patient count, time info, and status
 */

import React from 'react';
import { Badge } from '../Common/ResponsiveUI';

interface QueueStats {
  totalPatients: number;
  currentPosition: number;
  estimatedTime: number; // in minutes
  status: 'active' | 'paused' | 'completed';
  failedCount?: number;
  completedCount?: number;
}

interface QueueStatsCardProps {
  doctorName: string;
  stats: QueueStats;
  onClick?: () => void;
  isSelected?: boolean;
}

const statusConfig = {
  active: {
    label: 'نشط',
    color: 'green' as const,
    icon: 'fa-play-circle',
  },
  paused: {
    label: 'موقوف',
    color: 'yellow' as const,
    icon: 'fa-pause-circle',
  },
  completed: {
    label: 'مكتمل',
    color: 'blue' as const,
    icon: 'fa-check-circle',
  },
};

export function QueueStatsCard({
  doctorName,
  stats,
  onClick,
  isSelected = false,
}: QueueStatsCardProps) {
  const config = statusConfig[stats.status];

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-lg border-2 transition-all duration-300 ease-out
        p-4 cursor-pointer group
        ${isSelected
          ? 'border-blue-600 shadow-lg bg-blue-50'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-800 text-lg truncate">{doctorName}</h3>
          <p className="text-xs text-gray-500">دكتور</p>
        </div>
        <Badge
          label={config.label}
          icon={config.icon}
          color={config.color}
          size="sm"
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Total Patients */}
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-600">إجمالي المرضى</p>
          <p className="text-xl font-bold text-gray-800">{stats.totalPatients}</p>
        </div>

        {/* Current Position */}
        <div className="bg-blue-50 rounded-lg p-2">
          <p className="text-xs text-blue-600">الموضع الحالي</p>
          <p className="text-xl font-bold text-blue-700">{stats.currentPosition}</p>
        </div>

        {/* Estimated Time */}
        <div className="bg-green-50 rounded-lg p-2">
          <p className="text-xs text-green-600">الوقت المقدر لكل كشف</p>
          <p className="text-xl font-bold text-green-700">{stats.estimatedTime}د</p>
        </div>

        {/* Failed/Completed */}
        {(stats.failedCount !== undefined || stats.completedCount !== undefined) && (
          <div className={`
            rounded-lg p-2
            ${stats.failedCount ? 'bg-red-50' : 'bg-green-50'}
          `}
          >
            <p className={`text-xs ${stats.failedCount ? 'text-red-600' : 'text-green-600'}`}>
              {stats.failedCount ? 'فشل' : 'مكتمل'}
            </p>
            <p className={`text-xl font-bold ${stats.failedCount ? 'text-red-700' : 'text-green-700'}`}>
              {stats.failedCount ?? stats.completedCount ?? 0}
            </p>
          </div>
        )}
      </div>

      {/* Remaining Patients */}
      <div className="text-xs text-gray-600 flex items-center gap-1">
        <i className="fas fa-info-circle"></i>
        <span>
          {stats.totalPatients - stats.currentPosition} مريض متبقي
        </span>
      </div>
    </div>
  );
}
