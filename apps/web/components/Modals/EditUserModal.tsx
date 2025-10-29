'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, ValidationError } from '@/utils/validation';
import Modal from './Modal';
import { useState } from 'react';

export default function EditUserModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const isOpen = openModals.has('editUser');

  const validateFields = () => {
    const newErrors: ValidationError = {};
    
    const firstNameError = validateName(firstName, 'الاسم الأول');
    if (firstNameError) newErrors.firstName = firstNameError;
    
    const lastNameError = validateName(lastName, 'الاسم الأخير');
    if (lastNameError) newErrors.lastName = lastNameError;
    
    const usernameError = validateName(username, 'اسم المستخدم');
    if (usernameError) newErrors.username = usernameError;
    
    return newErrors;
  };

  const handleFieldChange = (field: string, value: string) => {
    if (field === 'firstName') setFirstName(value);
    if (field === 'lastName') setLastName(value);
    if (field === 'username') setUsername(value);
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
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      addToast('تم تحديث بيانات المستخدم بنجاح', 'success');
      setFirstName('');
      setLastName('');
      setUsername('');
      setErrors({});
      setTouched(false);
      closeModal('editUser');
    } catch (err) {
      addToast('حدث خطأ أثناء تحديث البيانات', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Validation errors check
  const hasValidationErrors = Object.keys(errors).length > 0 || 
                             !firstName.trim() || 
                             !lastName.trim() || 
                             !username.trim();

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('editUser');
        setFirstName('');
        setLastName('');
        setUsername('');
        setErrors({});
        setTouched(false);
      }}
      title="تعديل بيانات المستخدم"
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-700">
            <i className="fas fa-info-circle ml-1"></i>
            يمكنك إعادة تعيين كلمة المرور من خلال زر الإجراءات في الجدول
          </p>
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
