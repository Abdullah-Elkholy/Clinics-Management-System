'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';

interface DataStateWrapperProps<T> {
    /** Loading state flag */
    isLoading: boolean;
    /** Error object (if any) */
    error?: Error | string | null;
    /** The data to check */
    data: T | null | undefined;
    /** Custom empty check function */
    isEmpty?: (data: T) => boolean;
    /** Content to render when data is ready */
    children: ReactNode;
    /** Custom skeleton/loading UI */
    skeleton?: ReactNode;
    /** Custom empty state UI */
    emptyState?: ReactNode;
    /** Custom error state UI */
    errorState?: ReactNode;
    /** Minimum height to prevent layout collapse */
    minHeight?: string;
    /** Callback for retry action (shown in error state) */
    onRetry?: () => void;
    /** Whether to use fade-in animation */
    fadeIn?: boolean;
    /** Minimum loading time (ms) to prevent flash */
    minLoadingTime?: number;
}

/**
 * DataStateWrapper Component
 * 
 * Unified handler for Loading, Empty, and Error states.
 * Wraps data-driven UI sections to ensure consistent UX.
 * 
 * Priority order:
 * 1. Loading → Show skeleton/spinner
 * 2. Error → Show error state with retry
 * 3. Empty → Show empty state
 * 4. Content → Render children with fade-in
 * 
 * @example
 * <DataStateWrapper
 *   isLoading={isLoading}
 *   error={error}
 *   data={patients}
 *   isEmpty={(data) => data.length === 0}
 *   onRetry={refetch}
 *   emptyState={<EmptyState title="لا يوجد مرضى" />}
 * >
 *   <PatientsList patients={patients} />
 * </DataStateWrapper>
 */
export function DataStateWrapper<T>({
    isLoading,
    error,
    data,
    isEmpty,
    children,
    skeleton,
    emptyState,
    errorState,
    minHeight = 'min-h-[200px]',
    onRetry,
    fadeIn = true,
    minLoadingTime = 0,
}: DataStateWrapperProps<T>) {
    const [showLoading, setShowLoading] = useState(isLoading);
    const [hasMinTimeElapsed, setHasMinTimeElapsed] = useState(minLoadingTime === 0);

    // Handle minimum loading time to prevent flash
    useEffect(() => {
        if (isLoading && minLoadingTime > 0) {
            setShowLoading(true);
            setHasMinTimeElapsed(false);
            const timer = setTimeout(() => {
                setHasMinTimeElapsed(true);
            }, minLoadingTime);
            return () => clearTimeout(timer);
        } else if (!isLoading) {
            if (hasMinTimeElapsed || minLoadingTime === 0) {
                setShowLoading(false);
            }
        }
    }, [isLoading, minLoadingTime, hasMinTimeElapsed]);

    // Update showLoading when hasMinTimeElapsed changes
    useEffect(() => {
        if (hasMinTimeElapsed && !isLoading) {
            setShowLoading(false);
        }
    }, [hasMinTimeElapsed, isLoading]);

    // Determine if data is empty
    const isDataEmpty = (): boolean => {
        if (data === null || data === undefined) return true;
        if (isEmpty) return isEmpty(data);
        if (Array.isArray(data)) return data.length === 0;
        if (typeof data === 'object') return Object.keys(data).length === 0;
        return false;
    };

    // Default skeleton
    const defaultSkeleton = (
        <LoadingSpinner size="lg" label="جارٍ التحميل..." />
    );

    // Default error state
    const defaultErrorState = (
        <ErrorState
            title="حدث خطأ"
            message={typeof error === 'string' ? error : error?.message || 'تعذر تحميل البيانات'}
            onRetry={onRetry}
        />
    );

    // Default empty state
    const defaultEmptyState = (
        <EmptyState
            title="لا توجد بيانات"
            description="لم يتم العثور على أي بيانات لعرضها."
        />
    );

    // Container styles
    const containerClass = `${minHeight} transition-opacity duration-300`;

    // 1. Loading state
    if (showLoading) {
        return (
            <div className={`${containerClass} flex items-center justify-center`}>
                {skeleton || defaultSkeleton}
            </div>
        );
    }

    // 2. Error state
    if (error) {
        return (
            <div className={`${containerClass} flex items-center justify-center`}>
                {errorState || defaultErrorState}
            </div>
        );
    }

    // 3. Empty state
    if (isDataEmpty()) {
        return (
            <div className={`${containerClass} flex items-center justify-center`}>
                {emptyState || defaultEmptyState}
            </div>
        );
    }

    // 4. Content with optional fade-in
    if (fadeIn) {
        return (
            <div className={`${containerClass} animate-fadeIn`}>
                {children}
            </div>
        );
    }

    return <>{children}</>;
}

export default DataStateWrapper;
