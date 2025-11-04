'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, validateUsername, ValidationError } from '@/utils/validation';
import { useUserManagement } from '@/hooks/useUserManagement';
import { UserRole } from '@/types/roles';
import Modal from './Modal';
import { useState } from 'react';

interface AddUserModalProps {
  onUserAdded?: () => void;
}

export default function AddUserModal({ onUserAdded }: AddUserModalProps) {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [, actions] = useUserManagement();
  
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const isOpen = openModals.has('addUser');

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
  };

  const validateFields = () => {
    const newErrors: ValidationError = {};
    
    const nameError = validateName(name, 'الاسم الكامل');
    if (nameError) newErrors.name = nameError;
    
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
    if (field === 'name') setName(value);
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
      
      const success = await actions.createUser({
        name,
        username,
        role: UserRole.User,
      });
      
      if (success) {
        addToast('تم إضافة المستخدم بنجاح', 'success');
        setName('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setErrors({});
        setTouched(false);
        closeModal('addUser');
        onUserAdded?.();
      }
    } catch (err) {
      addToast('حدث خطأ أثناء إضافة المستخدم', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Validation errors check
  const hasValidationErrors = Object.keys(errors).length > 0 || 
                             !name.trim() || 
                             !username.trim() ||
                             !password.trim() ||
                             password !== confirmPassword;

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('addUser');
        setName('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setErrors({});
        setTouched(false);
      }}
      title="إضافة مستخدم جديد"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Validation Errors Alert - Only show if user touched and there are errors */}
        {touched && Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
            <p className="text-red-800 font-semibold flex items-center gap-2 mb-2">
              <i className="fas fa-exclamation-circle text-red-600"></i>
              يرجى تصحيح الأخطاء التالية:
            </p>
            <ul className="space-y-1 text-sm text-red-700">
              {Object.entries(errors).map(([field, error]) => (
                <li key={field} className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

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
            <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="أدخل الاسم الكامل"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                errors.name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.name}
              </p>
            )}
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
            disabled={isLoading || hasValidationErrors}
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
                إضافة المستخدم
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              closeModal('addUser');
              setName('');
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
