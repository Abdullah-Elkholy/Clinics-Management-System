'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, ValidationError } from '@/utils/validation';
import Modal from './Modal';
import { useState } from 'react';

export default function AccountInfoModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const isOpen = openModals.has('accountInfo');

  const validateFields = () => {
    const newErrors: ValidationError = {};
    
    const firstNameError = validateName(firstName, 'الاسم الأول');
    if (firstNameError) newErrors.firstName = firstNameError;
    
    const lastNameError = validateName(lastName, 'الاسم الأخير');
    if (lastNameError) newErrors.lastName = lastNameError;
    
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    
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
        setTouched(false);
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
        setTouched(false);
      }}
      title="تعديل معلومات الحساب"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الأخير *</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => handleFieldChange('lastName', e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="أدخل الاسم الأخير"
              disabled={isLoading}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور الحالية</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => handleFieldChange('currentPassword', e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="أدخل كلمة المرور الحالية"
                  disabled={isLoading}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => handleFieldChange('newPassword', e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="أدخل كلمة المرور الجديدة"
                  disabled={isLoading}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">إعادة كتابة كلمة المرور الجديدة</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="أعد كتابة كلمة المرور الجديدة"
                  disabled={isLoading}
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
              setTouched(false);
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
