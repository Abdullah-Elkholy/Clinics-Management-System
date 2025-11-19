'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/roles';

export default function WelcomeScreen() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  // Authentication guard - ensure user has token and valid role
  useEffect(() => {
    // Check for token
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    // If no token or not authenticated, redirect to login
    if (!token || !isAuthenticated || !user) {
      router.replace('/');
      return;
    }

    // Ensure user has a valid role
    if (!user.role || !Object.values(UserRole).includes(user.role)) {
      router.replace('/');
      return;
    }
  }, [isAuthenticated, user, router]);

  // Show loading while checking authentication
  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 text-center h-full flex items-center justify-center">
      <div className="max-w-md">
        <div className="bg-blue-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-clinic-medical text-blue-600 text-4xl"></i>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">مرحباً بك في نظام إدارة العيادات</h2>
        <p className="text-gray-600 mb-6">اختر من القائمة الجانبية للبدء في إدارة الطوابير والرسائل</p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <i className="fas fa-info-circle ml-2"></i>
          <span>يمكنك اختيار طابور من القائمة لعرض تفاصيله وإدارة المرضى</span>
        </div>
      </div>
    </div>
  );
}
