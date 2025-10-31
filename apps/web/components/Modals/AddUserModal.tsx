'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, ValidationError } from '@/utils/validation';
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
  const [role, setRole] = useState<UserRole>(UserRole.User);
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const isOpen = openModals.has('addUser');

  const validateFields = () => {
    const newErrors: ValidationError = {};
    
    const nameError = validateName(name, 'الاسم الكامل');
    if (nameError) newErrors.name = nameError;
    
    const usernameError = validateName(username, 'اسم المستخدم');
    if (usernameError) newErrors.username = usernameError;
    
    return newErrors;
  };

  const handleFieldChange = (field: string, value: string) => {
    if (field === 'name') setName(value);
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
      
      const success = await actions.createUser({
        name,
        username,
        role,
      });
      
      if (success) {
        addToast('تم إضافة المستخدم بنجاح', 'success');
        setName('');
        setUsername('');
        setRole(UserRole.User);
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
                             !username.trim();

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('addUser');
        setName('');
        setUsername('');
        setRole(UserRole.User);
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">نوع المستخدم *</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value={UserRole.User}>مستخدم عادي</option>
            <option value={UserRole.Moderator}>مشرف</option>
            <option value={UserRole.SecondaryAdmin}>مدير ثانوي</option>
            <option value={UserRole.PrimaryAdmin}>مدير أساسي</option>
          </select>
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
              setRole(UserRole.User);
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
