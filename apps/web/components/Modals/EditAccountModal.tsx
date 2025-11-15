'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useAuth } from '@/contexts/AuthContext';
import { validateName, validateUsername, ValidationError } from '@/utils/validation';
import { useUserManagement } from '@/hooks/useUserManagement';
import { User } from '@/services/userManagementService';
import Modal from './Modal';
import { useState, useEffect } from 'react';

interface EditAccountModalProps {
  selectedUser?: User | null;
}

export default function EditAccountModal({ selectedUser }: EditAccountModalProps) {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const { user: currentUser, refreshUser } = useAuth();
  const [, actions] = useUserManagement();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  
  // Track initial values to detect changes
  const [initialValues, setInitialValues] = useState({
    firstName: '',
    lastName: '',
    username: '',
  });

  const isOpen = openModals.has('editAccount');
  const modalData = getModalData('editAccount');
  
  // Use modal data if available, fallback to prop for backward compatibility
  const userToEdit = modalData?.user || selectedUser;

  // Load user data when modal opens - use currentUser from AuthContext as primary source
  useEffect(() => {
    if (!isOpen) return;
    
    // Use currentUser from AuthContext (most reliable and always fresh after refreshUser call)
    // Fallback to userToEdit if currentUser is not available
    const user = currentUser || userToEdit;
    
    if (user) {
      // Set form fields with user data
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setUsername(user.username || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setInitialValues({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || '',
      });
      setTouched(false);
      setErrors({});
      setIsChangingPassword(false);
      setGeneratedPassword(null);
    }
  }, [isOpen, currentUser?.id, currentUser?.firstName, currentUser?.lastName, currentUser?.username, userToEdit?.id, userToEdit?.firstName, userToEdit?.lastName, userToEdit?.username]);

  // Generate random password
  const generateRandomPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setGeneratedPassword(password);
    setNewPassword(password);
    setConfirmPassword(password);
    
    // Clear password validation errors
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.newPassword;
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

    // Password change validation - requires current password
    if (isChangingPassword) {
      if (!currentPassword) {
        newErrors.currentPassword = 'يرجى إدخال كلمة المرور الحالية';
      }

      if (!newPassword) {
        newErrors.newPassword = 'يرجى إدخال كلمة المرور الجديدة';
      } else if (newPassword.length < 6) {
        newErrors.newPassword = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
      } else if (currentPassword && newPassword === currentPassword) {
        // Validate that new password is different from current password
        newErrors.newPassword = 'كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية';
      }

      if (newPassword !== confirmPassword) {
        newErrors.confirmPassword = 'كلمات المرور الجديدة غير متطابقة';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    
    const newErrors = validateFields();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
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
      
      if (isChangingPassword && newPassword && confirmPassword && newPassword === confirmPassword) {
        updatePayload.currentPassword = currentPassword;
        updatePayload.password = newPassword;
      }

      // If no fields were changed, show a message
      if (Object.keys(updatePayload).length === 0) {
        addToast('لم يتم تغيير أي بيانات', 'info');
        closeModal('editAccount');
        return;
      }

      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log('📤 Sending update payload:', {
          userId: userToEdit.id,
          payload: updatePayload,
        });
      }

      const success = await actions.updateUser(userToEdit.id, updatePayload);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Update response success:', success);
      }
      
      if (!success) {
        addToast('فشل تحديث البيانات', 'error');
        return;
      }

      addToast('تم تحديث بيانات الحساب بنجاح', 'success');
      
      // Mark that editAccount was open so AccountInfoModal and tabs can refetch
      sessionStorage.setItem('editAccountWasOpen', 'true');
      
      // Refresh user data in AuthContext so all components see updated data
      // Wait for refresh to complete before closing modal and dispatching event
      await refreshUser();
      
      // Clear form fields after successful update
      setFirstName('');
      setLastName('');
      setUsername('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      setTouched(false);
      setIsChangingPassword(false);
      setGeneratedPassword(null);
      
      closeModal('editAccount');
      
      // Trigger a custom event to notify other components to refetch
      // Dispatch after a small delay to ensure refreshUser has updated the context
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userDataUpdated'));
      }, 100);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'خطأ غير معروف';
      addToast(`حدث خطأ: ${errorMsg}`, 'error');
      
      if (process.env.NODE_ENV === 'development') {
        console.error('Update error:', err);
      }
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
        closeModal('editAccount');
        setFirstName('');
        setLastName('');
        setUsername('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setErrors({});
        setTouched(false);
        setIsChangingPassword(false);
        setGeneratedPassword(null);
      }}
      title="تعديل معلومات الحساب"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Information Section */}
        <div className="space-y-4">

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

          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="editAccount-firstName" className="block text-sm font-medium text-gray-700 mb-1">
                الاسم الأول *
              </label>
              <input
                id="editAccount-firstName"
                name="firstName"
                type="text"
                value={firstName ?? ''}
                onChange={(e) => handleFieldChange('firstName', e.target.value)}
                onBlur={handleFieldBlur}
                placeholder="أدخل الاسم الأول"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  touched && errors.firstName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {touched && errors.firstName && (
                <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label htmlFor="editAccount-lastName" className="block text-sm font-medium text-gray-700 mb-1">
                الاسم الأخير
              </label>
              <input
                id="editAccount-lastName"
                name="lastName"
                type="text"
                value={lastName ?? ''}
                onChange={(e) => handleFieldChange('lastName', e.target.value)}
                onBlur={handleFieldBlur}
                placeholder="أدخل الاسم الأخير (اختياري)"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  touched && errors.lastName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {touched && errors.lastName && (
                <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* Username Field */}
          <div>
            <label htmlFor="editAccount-username" className="block text-sm font-medium text-gray-700 mb-1">
              اسم المستخدم *
            </label>
            <input
              id="editAccount-username"
              name="username"
              type="text"
              value={username ?? ''}
              onChange={(e) => handleFieldChange('username', e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="أدخل اسم المستخدم"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                touched && errors.username ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {touched && errors.username && (
              <p className="text-sm text-red-600 mt-1">{errors.username}</p>
            )}
          </div>
        </div>

        {/* Password Change Section */}
        <div className="border-t pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <i className="fas fa-lock text-amber-600"></i>
                تغيير كلمة المرور
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(!isChangingPassword);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setGeneratedPassword(null);
                  setErrors({});
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isChangingPassword
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isChangingPassword ? 'إلغاء' : 'تغيير'}
              </button>
            </div>

            {/* Password Change Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-700 flex items-center gap-2">
                <i className="fas fa-exclamation-circle"></i>
                {isChangingPassword 
                  ? 'يجب إدخال كلمة المرور الحالية لتغييرها' 
                  : 'اضغط على زر "تغيير" لتغيير كلمة المرور'}
              </p>
            </div>

            {isChangingPassword && (
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                {/* Current Password */}
                <div>
                  <label htmlFor="editAccount-currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    كلمة المرور الحالية
                  </label>
                  <div className="relative">
                    <input
                      id="editAccount-currentPassword"
                      name="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword ?? ''}
                      onChange={(e) => handleFieldChange('currentPassword', e.target.value)}
                      onBlur={handleFieldBlur}
                      placeholder="أدخل كلمة المرور الحالية"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                        touched && errors.currentPassword ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute left-3 top-2.5 text-gray-500 hover:text-gray-700"
                    >
                      <i className={`fas ${showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                  {touched && errors.currentPassword && (
                    <p className="text-sm text-red-600 mt-1">{errors.currentPassword}</p>
                  )}
                </div>

                {/* Generate Password Button */}
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="w-full px-4 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  <i className="fas fa-magic"></i>
                  توليد كلمة مرور جديدة عشوائية
                </button>

                {/* Generated Password Display */}
                {generatedPassword && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs text-purple-700 font-medium mb-2">كلمة المرور المُولّدة:</p>
                    <div className="flex items-center justify-between gap-2">
                      <code className="bg-white px-3 py-2 rounded border border-purple-200 font-mono text-sm text-purple-900 flex-1 break-all">
                        {generatedPassword}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPassword);
                          addToast('تم نسخ كلمة المرور', 'success');
                        }}
                        className="px-2 py-2 bg-purple-100 text-purple-600 hover:bg-purple-200 rounded transition-colors"
                        title="نسخ"
                      >
                        <i className="fas fa-copy"></i>
                      </button>
                    </div>
                  </div>
                )}

                {/* New Password & Confirm Password Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="editAccount-newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      كلمة المرور الجديدة
                    </label>
                    <div className="relative">
                      <input
                        id="editAccount-newPassword"
                        name="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword ?? ''}
                        onChange={(e) => handleFieldChange('newPassword', e.target.value)}
                        onBlur={handleFieldBlur}
                        placeholder="أدخل كلمة المرور الجديدة"
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                          touched && errors.newPassword ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute left-3 top-2.5 text-gray-500 hover:text-gray-700"
                      >
                        <i className={`fas ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    {touched && errors.newPassword && (
                      <p className="text-sm text-red-600 mt-1">{errors.newPassword}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="editAccount-confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      تأكيد كلمة المرور الجديدة
                    </label>
                    <div className="relative">
                      <input
                        id="editAccount-confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword ?? ''}
                        onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
                        onBlur={handleFieldBlur}
                        placeholder="أعد إدخال كلمة المرور الجديدة"
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                          touched && errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute left-3 top-2.5 text-gray-500 hover:text-gray-700"
                      >
                        <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    {touched && errors.confirmPassword && (
                      <p className="text-sm text-red-600 mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => {
              closeModal('editAccount');
              setFirstName('');
              setLastName('');
              setUsername('');
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setErrors({});
              setTouched(false);
              setIsChangingPassword(false);
              setGeneratedPassword(null);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner animate-spin"></i>
                جاري التحديث...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                حفظ التغييرات
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
