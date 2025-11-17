'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, validateUsername, ValidationError } from '@/utils/validation';
import { useUserManagement } from '@/hooks/useUserManagement';
import { UserRole } from '@/types/roles';
import logger from '@/utils/logger';
import Modal from './Modal';

interface AddUserModalProps {
  onUserAdded?: () => void;
  role?: UserRole | null;
  moderatorId?: string | null;
  onClose?: () => void;
}

export default function AddUserModal({ onUserAdded, role = null, moderatorId = null, onClose }: AddUserModalProps) {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const [, actions] = useUserManagement();
  
  // Get role and moderatorId from modal context data (takes precedence) or fallback to props
  const modalData = getModalData('addUser');
  const contextRole = modalData?.role || role;
  const contextModeratorId = modalData?.moderatorId || moderatorId;
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);

  const isOpen = openModals.has('addUser');
  
  // Sync currentRole with contextRole whenever it changes
  useEffect(() => {
    setCurrentRole(contextRole);
  }, [contextRole]);

  // Clear moderatorId validation error when a moderatorId becomes available
  useEffect(() => {
    if (contextModeratorId && errors.moderatorId) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.moderatorId;
        return newErrors;
      });
    }
  }, [contextModeratorId, errors.moderatorId]);

  // Generate random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    setConfirmPassword(pass);
    setTouched(true);
    
    // Clear password validation errors
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.password;
      delete newErrors.confirmPassword;
      return newErrors;
    });
  };

  const validateFields = () => {
    const newErrors: ValidationError = {};
    
    const firstNameError = validateName(firstName, 'الاسم الأول');
    if (firstNameError) newErrors.firstName = firstNameError;

    // lastName is now optional
    if (lastName && lastName.trim()) {
      const lastNameError = validateName(lastName, 'الاسم الأخير');
      if (lastNameError) newErrors.lastName = lastNameError;
    }
    
    const usernameError = validateUsername(username);
    if (usernameError) newErrors.username = usernameError;

    if (!password || password.trim().length === 0) {
      newErrors.password = 'كلمة المرور مطلوبة';
    } else if (password.length < 6) {
      newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'كلمات المرور غير متطابقة';
    }

    // Enforce: User role requires moderatorId (use contextModeratorId - canonical source)
    if (currentRole === UserRole.User && !contextModeratorId) {
      newErrors.moderatorId = 'يجب تعيين مشرف للمستخدم';
    }
    
    return newErrors;
  };

  const handleFieldChange = (field: string, value: string) => {
    if (field === 'firstName') setFirstName(value);
    if (field === 'lastName') setLastName(value);
    if (field === 'username') setUsername(value);
    if (field === 'password') setPassword(value);
    if (field === 'confirmPassword') setConfirmPassword(value);
    setTouched(true);
    
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
    setTouched(true);
    const newErrors = validateFields();
    setErrors(newErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    
    const newErrors = validateFields();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsLoading(true);
      
      const userRole = currentRole || UserRole.User;
      const userPayload: any = {
        firstName,
        lastName: lastName || undefined,
        username,
        role: userRole,
        password,
      };

      // Add moderator ID if this is a regular user
      // Coerce string to number to match backend expectation
      if (userRole === UserRole.User && contextModeratorId) {
        const moderatorIdNum = typeof contextModeratorId === 'string' 
          ? parseInt(contextModeratorId, 10) 
          : contextModeratorId;
        
        if (Number.isNaN(moderatorIdNum)) {
          addToast('معرّف المشرف غير صالح', 'error');
          return;
        }
        
        userPayload.moderatorId = moderatorIdNum;
      }

      const success = await actions.createUser(userPayload);
      
      if (!success) {
        addToast('فشل إضافة المستخدم', 'error');
        return;
      }

      addToast('تم إضافة المستخدم بنجاح', 'success');
      
      // Refetch users list to ensure UI is in sync with backend
      // Wait for refetch to complete before closing modal and dispatching event
      await actions.fetchUsers();
      
      // Clear form fields after successful creation
      setFirstName('');
      setLastName('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setErrors({});
      setTouched(false);
      
      closeModal('addUser');
      
      // Trigger a custom event to notify other components to refetch
      // Dispatch after a small delay to ensure fetchUsers has updated the state
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userDataUpdated'));
      }, 100);
      
      onUserAdded?.();
      onClose?.();
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as { message?: unknown }).message || 'Unknown error')
          : 'Unknown error';
      logger.error('Failed to add user:', {
        error: errorMessage,
        statusCode: (err && typeof err === 'object' && 'statusCode' in err) ? (err as { statusCode?: unknown }).statusCode : undefined,
        fullError: err,
      });
      addToast('حدث خطأ أثناء إضافة المستخدم', 'error');
    } finally {
      setIsLoading(false);
    }
  };



  // Get modal title based on role - memoized to ensure it updates when role changes
  const modalTitle = useMemo(() => {
    let title = 'إضافة مستخدم جديد';
    
    if (currentRole === UserRole.Moderator) {
      title = 'إضافة مشرف جديد';
    } else if (currentRole === UserRole.SecondaryAdmin) {
      title = 'إضافة مدير ثانوي جديد';
    } else if (currentRole === UserRole.User) {
      title = 'إضافة مستخدم جديد';
    }
    return title;
  }, [currentRole]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('addUser');
        setFirstName('');
        setLastName('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setErrors({});
        setTouched(false);
        onClose?.();
      }}
      title={modalTitle}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username Requirements Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800 font-semibold flex items-center gap-2 mb-2">
            <i className="fas fa-lightbulb"></i>
            متطلبات اسم المستخدم:
          </p>
          <ul className="space-y-1 text-xs text-amber-700 ml-6">
            <li>• يجب أن يبدأ بحرف إنجليزي (a-z, A-Z)</li>
            <li>• يمكن أن يحتوي على أرقام بعد الحرف الأول (0-9)</li>
            <li>• يمكن استخدام الشرطة (-) والشرطة السفلية (_)</li>
            <li>• لا يمكن أن يحتوي على حرفين متتاليين من (_ أو -)</li>
            <li>• لا يمكن أن يحتوي على مسافات</li>
            <li>• الحد الأدنى 3 أحرف، الحد الأقصى 50 حرف</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="addUser-firstName" className="block text-sm font-medium text-gray-700 mb-2">الاسم الأول *</label>
            <input
              id="addUser-firstName"
              name="firstName"
              type="text"
              value={firstName ?? ''}
              onChange={(e) => handleFieldChange('firstName', e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="أدخل الاسم الأول"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                errors.firstName
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.firstName}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="addUser-lastName" className="block text-sm font-medium text-gray-700 mb-2">الاسم الأخير</label>
            <input
              id="addUser-lastName"
              name="lastName"
              type="text"
              value={lastName ?? ''}
              onChange={(e) => handleFieldChange('lastName', e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="أدخل الاسم الأخير (اختياري)"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                errors.lastName
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.lastName}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="addUser-username" className="block text-sm font-medium text-gray-700 mb-2">اسم المستخدم *</label>
          <input
            id="addUser-username"
            name="username"
            type="text"
            value={username ?? ''}
            onChange={(e) => handleFieldChange('username', e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="أدخل اسم المستخدم"
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
              errors.username
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {errors.username && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              {errors.username}
            </p>
          )}
        </div>

        {/* Show moderator info when creating a User role */}
        {currentRole === UserRole.User && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-900 flex items-center gap-2 mb-2">
              <i className="fas fa-info-circle"></i>
              معلومات المشرف
            </p>
            <div className="bg-white rounded p-3 border border-blue-100">
              {contextModeratorId ? (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">المشرف المعين:</span>
                  <br />
                  <span className="text-blue-600">{contextModeratorId}</span>
                  <br />
                  <span className="text-xs text-gray-500 mt-1 block">
                    سيرث هذا المستخدم جميع بيانات المشرف بما في ذلك الحصص والرسائل والعيادات
                  </span>
                </p>
              ) : (
                <p className="text-sm text-red-600 font-semibold flex items-center gap-2">
                  <i className="fas fa-exclamation-triangle"></i>
                  يجب تعيين مشرف لإنشاء مستخدم جديد
                </p>
              )}
            </div>
          </div>
        )}

        {/* Password Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="addUser-password" className="block text-sm font-medium text-gray-700">كلمة المرور *</label>
              <button
                type="button"
                onClick={generateRandomPassword}
                disabled={isLoading}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                <i className="fas fa-magic ml-1"></i>
                توليد عشوائي
              </button>
            </div>
            <div className="relative">
              <input
                id="addUser-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password ?? ''}
                onChange={(e) => handleFieldChange('password', e.target.value)}
                onBlur={handleFieldBlur}
                placeholder="أدخل كلمة المرور"
                disabled={isLoading}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all pr-10 ${
                  errors.password
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.password}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="addUser-confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">تأكيد كلمة المرور *</label>
            <div className="relative">
              <input
                id="addUser-confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword ?? ''}
                onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
                onBlur={handleFieldBlur}
                placeholder="تأكيد كلمة المرور"
                disabled={isLoading}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all pr-10 ${
                  errors.confirmPassword
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.confirmPassword}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isLoading || (currentRole === UserRole.User && !contextModeratorId)}
            title={currentRole === UserRole.User && !contextModeratorId ? 'يجب تعيين مشرف لإضافة مستخدم' : ''}
            className="flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                جاري الإضافة...
              </>
            ) : (
              <>
                <i className="fas fa-plus"></i>
                {modalTitle}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              closeModal('addUser');
              setFirstName('');
              setLastName('');
              setUsername('');
              setPassword('');
              setConfirmPassword('');
              setErrors({});
            }}
            disabled={isLoading}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
