'use client';

import React, { useState, useEffect } from 'react';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, validateUsername, ValidationError } from '@/utils/validation';
import { useUserManagement } from '@/hooks/useUserManagement';
import { User } from '@/services/userManagementService';
import Modal from './Modal';
import logger from '@/utils/logger';

interface EditUserModalProps {
  selectedUser?: User | null;
}

export default function EditUserModal({ selectedUser }: EditUserModalProps) {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const [state, actions] = useUserManagement();
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
  const [freshUserData, setFreshUserData] = useState<User | null>(null);
  
  // Track initial values to detect changes
  const [initialValues, setInitialValues] = useState({
    firstName: '',
    lastName: '',
    username: '',
  });

  const isOpen = openModals.has('editUser');
  const modalData = getModalData('editUser');
  
  // Use modal data if available, fallback to prop for backward compatibility
  const userToEditFromProps = modalData?.user || selectedUser;
  
  // Get fresh user data - prioritize freshUserData, then state.users, then props
  const userToEdit = freshUserData 
    || (userToEditFromProps?.id 
      ? state.users.find(u => u.id === userToEditFromProps.id) || userToEditFromProps
      : userToEditFromProps);

  // Fetch fresh user data when modal opens
  useEffect(() => {
    if (!isOpen || !userToEditFromProps?.id) return;
    
    const fetchFreshUserData = async () => {
      try {
        const freshUser = await actions.getUser(userToEditFromProps.id);
        if (freshUser) {
          setFreshUserData(freshUser);
        }
      } catch (err) {
        // If fresh data fetch fails, fall back to existing data
        if (process.env.NODE_ENV === 'development') {
          logger.error('Failed to fetch fresh user data:', err);
        }
        setFreshUserData(null);
      }
    };
    
    // Always refetch when modal opens to ensure fresh data
    fetchFreshUserData();
  }, [isOpen, userToEditFromProps?.id]);

  // Load selected user data when modal opens - use fresh data
  useEffect(() => {
    if (!isOpen) return;
    
    // Use fresh user data (most reliable and always fresh after getUser call)
    // Fallback to userToEditFromProps if not available
    const user = userToEdit;
    
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setUsername(user.username || '');
      setPassword('');
      setConfirmPassword('');
      setInitialValues({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || '',
      });
      setTouched(false);
      setErrors({});
    }
  }, [isOpen, userToEdit?.id, userToEdit?.firstName, userToEdit?.lastName, userToEdit?.username]);

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
    
    // Only validate firstName if it was changed
    if (firstName !== initialValues.firstName && firstName) {
      const nameError = validateName(firstName, 'الاسم الأول');
      if (nameError) newErrors.firstName = nameError;
    }

    // Only validate lastName if it was changed (optional field)
    if (lastName !== initialValues.lastName && lastName) {
      const nameError = validateName(lastName, 'الاسم الأخير');
      if (nameError) newErrors.lastName = nameError;
    }

    // Only validate username if it was changed
    if (username !== initialValues.username && username) {
      const usernameError = validateUsername(username);
      if (usernameError) newErrors.username = usernameError;
    }

    // Password validation - optional on edit (only if password entered)
    if (password) {
      if (password.length < 6) {
        newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
      }

      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'كلمات المرور غير متطابقة';
      }
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

    // Check if password is entered but confirmPassword is not
    if (password && !confirmPassword) {
      addToast('يرجى تأكيد كلمة المرور', 'error');
      return;
    }

    if (!userToEdit) {
      addToast('لم يتم تحديد مستخدم', 'error');
      return;
    }

    try {
      setIsLoading(true);
      
      // Only include fields that were changed
      const updatePayload: any = {};
      
      if (firstName !== initialValues.firstName && firstName.trim()) {
        updatePayload.firstName = firstName.trim();
      }

      if (lastName !== initialValues.lastName && lastName.trim()) {
        updatePayload.lastName = lastName.trim();
      }
      
      if (username !== initialValues.username && username.trim()) {
        updatePayload.username = username.trim();
      }
      
      if (password && confirmPassword && password === confirmPassword) {
        updatePayload.password = password;
      }

      // If no fields were changed, show a message
      if (Object.keys(updatePayload).length === 0) {
        addToast('لم يتم تغيير أي بيانات', 'info');
        closeModal('editUser');
        return;
      }

      const success = await actions.updateUser(userToEdit.id, updatePayload);
      
      if (!success) {
        addToast('فشل تحديث البيانات', 'error');
        return;
      }

      addToast('تم تحديث بيانات المستخدم بنجاح', 'success');
      
      // Refetch users list to ensure UI is in sync with backend
      // Wait for refetch to complete before closing modal and dispatching event
      await actions.fetchUsers();
      
      // Clear form fields after successful update
      setFirstName('');
      setLastName('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setErrors({});
      setTouched(false);
      
      closeModal('editUser');
      
      // Trigger a custom event to notify other components to refetch
      // Dispatch after a small delay to ensure fetchUsers has updated the state
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userDataUpdated'));
      }, 100);
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as { message?: unknown }).message || 'Unknown error')
          : 'Unknown error';
      logger.error('Failed to update user:', {
        error: errorMessage,
        statusCode: (err && typeof err === 'object' && 'statusCode' in err) ? (err as { statusCode?: unknown }).statusCode : undefined,
        fullError: err,
      });
      addToast('حدث خطأ أثناء تحديث البيانات', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  // Only disable if loading - validation errors show on blur but don't disable submit
  // User can still click submit, which will show validation errors

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('editUser');
        setFirstName('');
        setLastName('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setErrors({});
        setTouched(false);
      }}
      title="تعديل بيانات المستخدم"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Disclaimer */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700 flex items-center gap-2">
            <i className="fas fa-info-circle"></i>
            عدل البيانات المراد تغييرها فقط
          </p>
        </div>

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
            <label htmlFor="editUser-firstName" className="block text-sm font-medium text-gray-700 mb-2">الاسم الأول *</label>
            <input
              id="editUser-firstName"
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
            <label htmlFor="editUser-lastName" className="block text-sm font-medium text-gray-700 mb-2">الاسم الأخير</label>
            <input
              id="editUser-lastName"
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
          <label htmlFor="editUser-username" className="block text-sm font-medium text-gray-700 mb-2">اسم المستخدم</label>
          <input
            id="editUser-username"
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

        {/* Password Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="editUser-password" className="block text-sm font-medium text-gray-700">كلمة المرور الجديدة *</label>
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
                id="editUser-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password ?? ''}
                onChange={(e) => handleFieldChange('password', e.target.value)}
                onBlur={handleFieldBlur}
                placeholder="اتركها فارغة للاحتفاظ بكلمة المرور الحالية"
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
            <label htmlFor="editUser-confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">تأكيد كلمة المرور الجديدة *</label>
            <div className="relative">
              <input
                id="editUser-confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword ?? ''}
                onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
                onBlur={handleFieldBlur}
                placeholder="تأكيد كلمة المرور الجديدة"
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
            disabled={isLoading}
            className="flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                جاري الحفظ...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                حفظ التغييرات
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              closeModal('editUser');
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
