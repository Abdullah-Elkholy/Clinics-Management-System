/**
 * Trash Countdown Badge Component
 * File: apps/web/components/TrashCountdownBadge.tsx
 * 
 * Reusable component showing days remaining until TTL expiry
 * Displays warning status as days decrease
 */

import React, { useMemo } from 'react';
import { formatLocalDate } from '@/utils/dateTimeUtils';

interface TrashCountdownBadgeProps {
  deletedAt: string;          // ISO 8601 timestamp of deletion
  ttlDays?: number;           // Time-to-live in days (default 30)
  showLabel?: boolean;        // Show "Days remaining" text
  compact?: boolean;          // Compact mode (smaller)
}

export const TrashCountdownBadge: React.FC<TrashCountdownBadgeProps> = ({
  deletedAt,
  ttlDays = 30,
  showLabel = true,
  compact = false,
}) => {
  const daysRemaining = useMemo(() => {
    const deleted = new Date(deletedAt);
    const expiryDate = new Date(deleted);
    expiryDate.setDate(expiryDate.getDate() + ttlDays);

    const now = new Date();
    const msRemaining = expiryDate.getTime() - now.getTime();
    const days = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    return Math.max(0, days);
  }, [deletedAt, ttlDays]);

  const isExpired = daysRemaining === 0;
  const isWarning = daysRemaining > 0 && daysRemaining <= 7;
  const isNormal = daysRemaining > 7;

  // Determine badge color based on days remaining
  let badgeClass = 'px-3 py-1 rounded-full text-sm font-medium';
  
  if (isExpired) {
    badgeClass += ' bg-red-100 text-red-800 border border-red-300';
  } else if (isWarning) {
    badgeClass += ' bg-yellow-100 text-yellow-800 border border-yellow-300';
  } else {
    badgeClass += ' bg-blue-100 text-blue-800 border border-blue-300';
  }

  if (compact) {
    badgeClass = badgeClass.replace('px-3 py-1 text-sm', 'px-2 py-0.5 text-xs');
  }

  const label = showLabel ? ' يوم متبقي' : '';
  const text = isExpired ? 'انتهت المدة' : `${daysRemaining}${label}`;

  return (
    <span className={badgeClass} title={`تنتهي في ${formatLocalDate(deletedAt)}`}>
      {text}
    </span>
  );
};

export default TrashCountdownBadge;
