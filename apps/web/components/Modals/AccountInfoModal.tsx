'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, ValidationError } from '@/utils/validation';
import Modal from './Modal';
import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUser } from '@/services/api/authApiClient';
import logger from '@/utils/logger';
import type { User } from '@/types';

export default function AccountInfoModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const { user: currentUser } = useAuth();
  const [freshUserData, setFreshUserData] = useState<User | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);

  const isOpen = openModals.has('accountInfo');
  const modalData = getModalData('accountInfo');
  
  // Use modal data if available, fallback to fresh user data or current user from auth context
  const userToEdit = modalData?.user || freshUserData || currentUser;
  
  // Fetch fresh user data when modal opens or when editAccount modal closes
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const data = await getCurrentUser();
        setFreshUserData(data);
      } catch (err) {
        // If fresh data fetch fails, fall back to currentUser from auth
        if (process.env.NODE_ENV === 'development') {
          logger.error('Failed to fetch fresh user data:', err);
        }
        setFreshUserData(null);
      }
    };
    
    if (isOpen) {
      // Always refetch when modal opens to ensure fresh data
      fetchUserData();
    }
  }, [isOpen]);
  
  // Also refetch when editAccount modal closes (listen for modal state changes)
  useEffect(() => {
    const checkForEdit = () => {
      const editAccountWasOpen = sessionStorage.getItem('editAccountWasOpen');
      if (editAccountWasOpen === 'true') {
        // EditAccount modal was open - refetch user data
        const fetchUserData = async () => {
          try {
            const data = await getCurrentUser();
            setFreshUserData(data);
          } catch (err) {
            if (process.env.NODE_ENV === 'development') {
              logger.error('Failed to fetch fresh user data after edit:', err);
            }
          }
        };
        fetchUserData();
        sessionStorage.removeItem('editAccountWasOpen');
      }
    };
    
    // Listen for custom event from EditAccountModal
    const handleUserDataUpdate = () => {
      if (isOpen) {
        const fetchUserData = async () => {
          try {
            const data = await getCurrentUser();
            setFreshUserData(data);
          } catch (err) {
            if (process.env.NODE_ENV === 'development') {
              logger.error('Failed to fetch fresh user data after edit:', err);
            }
          }
        };
        fetchUserData();
      }
    };
    
    window.addEventListener('userDataUpdated', handleUserDataUpdate);
    
    // Check immediately
    checkForEdit();
    
    // Also listen for storage events (in case editAccount closes while accountInfo is open)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'editAccountWasOpen' && e.newValue === 'true' && isOpen) {
        checkForEdit();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also poll for changes (since storage events don't fire in same window)
    const interval = setInterval(() => {
      if (isOpen) {
        checkForEdit();
      }
    }, 500);
    
    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [isOpen]);
  
  // Initialize form with user data on modal open
  useEffect(() => {
    if (isOpen && userToEdit) {
      setFirstName(userToEdit.firstName || '');
      setLastName(userToEdit.lastName || '');
      setUsername(userToEdit.username || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      
    }
  }, [isOpen, userToEdit]);

  const validateFields = () => {
    const newErrors: ValidationError = {};
    
    const firstNameError = validateName(firstName, 'الاسم الأول');
    if (firstNameError) newErrors.firstName = firstNameError;
    
    // lastName is optional - only validate if provided
    if (lastName && lastName.trim()) {
      const lastNameError = validateName(lastName, 'الاسم الأخير');
      if (lastNameError) newErrors.lastName = lastNameError;
    }
    
    const usernameError = validateName(username, 'اسم المستخدم');
    if (usernameError) newErrors.username = usernameError;
    
    // If changing password, validate password fields
    if (newPassword || currentPassword) {
      if (!currentPassword) {
        newErrors.currentPassword = 'كلمة المرور الحالية مطلوبة';
      }
      if (!newPassword) {
        newErrors.newPassword = 'كلمة المرور الجديدة مطلوبة';
      }
      if (!confirmPassword) {
        newErrors.confirmPassword = 'تأكيد كلمة المرور مطلوب';
      }
      if (newPassword && confirmPassword && newPassword !== confirmPassword) {
        newErrors.passwordMatch = 'كلمات المرور الجديدة غير متطابقة';
      }
    }
    
    return newErrors;
  };

  const handleFieldChange = (field: string, value: string) => {
    if (field === 'firstName') setFirstName(value);
    if (field === 'lastName') setLastName(value);
    if (field === 'username') setUsername(value);
    if (field === 'currentPassword') setCurrentPassword(value);
    if (field === 'newPassword') setNewPassword(value);
    if (field === 'confirmPassword') setConfirmPassword(value);
    
    // Clear error if exists
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleFieldBlur = () => {
    const newErrors = validateFields();
    setErrors(newErrors);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const newErrors = validateFields();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      addToast('يرجى تصحيح الأخطاء قبل الحفظ', 'error');
      return;
    }

    try {
      setIsLoading(true);
      
      // Simulate API call
      setTimeout(() => {
        addToast('تم تحديث معلومات الحساب بنجاح', 'success');
        setFirstName('');
        setLastName('');
        setUsername('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setErrors({});
        
        closeModal('accountInfo');
        setIsLoading(false);
      }, 500);
    } catch (err) {
      addToast('حدث خطأ أثناء تحديث البيانات', 'error');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('accountInfo');
        setFirstName('');
        setLastName('');
        setUsername('');
        setErrors({});
      }}
      title="تعديل معلومات الحساب"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="accountInfo-firstName" className="block text-sm font-medium text-gray-700 mb-2">الاسم الأول *</label>
            <input
              id="accountInfo-firstName"
              name="firstName"
              type="text"
              value={firstName ?? ''}
              onChange={(e) => handleFieldChange('firstName', e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="أدخل الاسم الأول"
              disabled={isLoading}
              autoComplete="given-name"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                errors.firstName
                  ? 'border-red-500 bg-red-50 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.firstName && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.firstName}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="accountInfo-lastName" className="block text-sm font-medium text-gray-700 mb-2">الاسم الأخير</label>
            <input
              id="accountInfo-lastName"
              name="lastName"
              type="text"
              value={lastName ?? ''}
              onChange={(e) => handleFieldChange('lastName', e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="أدخل الاسم الأخير"
              disabled={isLoading}
              autoComplete="family-name"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                errors.lastName
                  ? 'border-red-500 bg-red-50 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.lastName && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.lastName}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="accountInfo-username" className="block text-sm font-medium text-gray-700 mb-2">اسم المستخدم *</label>
          <input
            id="accountInfo-username"
            name="username"
            type="text"
            value={username ?? ''}
            onChange={(e) => handleFieldChange('username', e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="أدخل اسم المستخدم"
            disabled={isLoading}
            autoComplete="username"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
              errors.username
                ? 'border-red-500 bg-red-50 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {errors.username && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              {errors.username}
            </p>
          )}
        </div>

        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900"
            disabled={isLoading}
          >
            <span>تغيير كلمة المرور</span>
            <i className={`fas fa-chevron-${showPassword ? 'up' : 'down'}`}></i>
          </button>

          {showPassword && (
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="accountInfo-currentPassword" className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور الحالية</label>
                <input
                  id="accountInfo-currentPassword"
                  name="currentPassword"
                  type="password"
                  value={currentPassword ?? ''}
                  onChange={(e) => handleFieldChange('currentPassword', e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="أدخل كلمة المرور الحالية"
                  disabled={isLoading}
                  autoComplete="current-password"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                    errors.currentPassword
                      ? 'border-red-500 bg-red-50 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {errors.currentPassword && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <i className="fas fa-exclamation-circle"></i>
                    {errors.currentPassword}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="accountInfo-newPassword" className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور الجديدة</label>
                <input
                  id="accountInfo-newPassword"
                  name="newPassword"
                  type="password"
                  value={newPassword ?? ''}
                  onChange={(e) => handleFieldChange('newPassword', e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="أدخل كلمة المرور الجديدة"
                  disabled={isLoading}
                  autoComplete="new-password"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                    errors.newPassword
                      ? 'border-red-500 bg-red-50 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {errors.newPassword && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <i className="fas fa-exclamation-circle"></i>
                    {errors.newPassword}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="accountInfo-confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">إعادة كتابة كلمة المرور الجديدة</label>
                <input
                  id="accountInfo-confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword ?? ''}
                  onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="أعد كتابة كلمة المرور الجديدة"
                  disabled={isLoading}
                  autoComplete="new-password"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                    errors.confirmPassword || errors.passwordMatch
                      ? 'border-red-500 bg-red-50 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {(errors.confirmPassword || errors.passwordMatch) && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <i className="fas fa-exclamation-circle"></i>
                    {errors.confirmPassword || errors.passwordMatch}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
          <button
            type="button"
            onClick={() => {
              closeModal('accountInfo');
              setFirstName('');
              setLastName('');
              setUsername('');
              setErrors({});
            }}
            disabled={isLoading}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
