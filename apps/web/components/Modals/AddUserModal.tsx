'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, validateUsername, ValidationError } from '@/utils/validation';
import { useUserManagement } from '@/hooks/useUserManagement';
import { UserRole } from '@/types/roles';
import Modal from './Modal';
import { useState, useMemo, useEffect } from 'react';

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
  
  // Try to get role from modal context data (passed via openModal)
  const modalData = getModalData('addUser');
  const contextRole = modalData?.role || role;
  
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
        lastName,
        username,
        role: userRole,
      };

      // Add moderator ID if this is a regular user being added to a moderator
      if (userRole === UserRole.User && moderatorId) {
        userPayload.assignedModerator = moderatorId;
      }

      const success = await actions.createUser(userPayload);
      
      if (success) {
        addToast('تم إضافة المستخدم بنجاح', 'success');
        setFirstName('');
        setLastName('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setErrors({});
        setTouched(false);
        closeModal('addUser');
        onUserAdded?.();
        onClose?.();
      }
    } catch (err) {
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
            <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الأول *</label>
            <input
              type="text"
              value={firstName}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الأخير</label>
            <input
              type="text"
              value={lastName}
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
          <label className="block text-sm font-medium text-gray-700 mb-2">اسم المستخدم *</label>
          <input
            type="text"
            value={username}
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
              <label className="block text-sm font-medium text-gray-700">كلمة المرور *</label>
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
                type={showPassword ? 'text' : 'password'}
                value={password}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">تأكيد كلمة المرور *</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
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
            disabled={isLoading}
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
