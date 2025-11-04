'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { COUNTRY_CODES } from '@/constants';
import { validateCountryCode, validateName, validatePhone, ValidationError } from '@/utils/validation';
import Modal from './Modal';
import { useState } from 'react';
import CountryCodeSelector from '@/components/Common/CountryCodeSelector';
import { getEffectiveCountryCode } from '@/utils/core.utils';

export default function EditPatientModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const data = getModalData('editPatient');

  const initialName = data?.patient?.name ?? '';
  const initialUsername = data?.patient?.username ?? '';
  const initialPhone = data?.patient?.phone ?? '';
  const initialCountryCode = data?.patient?.countryCode ?? '+20';

  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [phone, setPhone] = useState(initialPhone);
  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [customCountryCode, setCustomCountryCode] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [initialValues, setInitialValues] = useState({
    name: initialName,
    username: initialUsername,
  });

  const isOpen = openModals.has('editPatient');

  // When modal opens with data, keep local state in sync
  if (isOpen && (name === '' && initialName !== '')) {
    setName(initialName);
  }
  if (isOpen && (phone === '' && initialPhone !== '')) {
    setPhone(initialPhone);
  }
  if (isOpen && countryCode === initialCountryCode && initialCountryCode !== data?.patient?.countryCode) {
    setCountryCode(data?.patient?.countryCode ?? '+20');
  }

  const validateFields = () => {
    const newErrors: ValidationError = {};
    
    // Only validate fields that have changed
    if (name !== initialValues.name && name) {
      const nameError = validateName(name, 'اسم المريض');
      if (nameError) newErrors.name = nameError;
    }
    
    if (username !== initialValues.username && username) {
      // Basic username validation
      if (username.trim().length < 2) {
        newErrors.username = 'اسم المستخدم يجب أن يكون على الأقل 2 أحرف';
      }
    }
    
    if (phone !== initialPhone) {
      const phoneError = validatePhone(phone);
      if (phoneError) newErrors.phone = phoneError;
    }
    
    // Validate custom country code if 'OTHER' is selected
    if (countryCode === 'OTHER') {
      const customCodeError = validateCountryCode(customCountryCode, true);
      if (customCodeError) newErrors.customCountryCode = customCodeError;
    }
    
    return newErrors;
  };

  const handleFieldChange = (field: string, value: string) => {
    if (field === 'name') setName(value);
    if (field === 'username') setUsername(value);
    if (field === 'phone') setPhone(value);
    if (field === 'customCountryCode') setCustomCountryCode(value);
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

    // Build update payload with only changed fields
    const updatePayload: any = {};
    
    if (name !== initialValues.name && name.trim()) {
      updatePayload.name = name.trim();
    }
    
    if (username !== initialValues.username && username.trim()) {
      updatePayload.username = username.trim();
    }
    
    if (phone !== initialPhone) {
      updatePayload.phone = phone.trim();
    }
    
    if (countryCode !== initialCountryCode || customCountryCode) {
      const effectiveCountryCode = getEffectiveCountryCode(countryCode, customCountryCode);
      const countryCodeError = validateCountryCode(effectiveCountryCode, true);
      if (countryCodeError) {
        setErrors({ country: countryCodeError });
        addToast(`خطأ في كود الدولة: ${countryCodeError}`, 'error');
        return;
      }
      updatePayload.countryCode = effectiveCountryCode;
    }

    // Check if any data was changed
    if (Object.keys(updatePayload).length === 0) {
      addToast('لم يتم تغيير أي بيانات', 'info');
      closeModal('editPatient');
      return;
    }

    const updated = {
      ...data?.patient,
      ...updatePayload,
    };

    // call onSave callback if provided
    try {
      setIsLoading(true);
      data?.onSave && data.onSave(updated);
      addToast('تم تحديث بيانات المريض بنجاح', 'success');
      setName('');
      setUsername('');
      setPhone('');
      setErrors({});
      closeModal('editPatient');
    } catch (err) {
      addToast('حدث خطأ أثناء تحديث البيانات', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Validation errors check
  const hasValidationErrors = Object.keys(errors).length > 0;

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('editPatient');
        setName('');
        setUsername('');
        setPhone('');
        setErrors({});
        setTouched(false);
      }}
      title="تعديل بيانات المريض"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Disclaimer */}
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
          <p className="text-blue-800 text-sm font-medium flex items-center gap-2">
            <i className="fas fa-info-circle text-blue-600"></i>
            عدل البيانات المراد تغييرها فقط
          </p>
        </div>

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل</label>
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
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">اسم المستخدم</label>
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
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              {errors.username}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">كود الدولة</label>
          <CountryCodeSelector
            value={countryCode}
            onChange={setCountryCode}
            size="md"
            showOptgroups={true}
          />
        </div>

        {/* Custom Country Code Input */}
        {countryCode === 'OTHER' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              أدخل كود الدولة المخصص *
            </label>
            <input
              type="text"
              value={customCountryCode}
              onChange={(e) => handleFieldChange('customCountryCode', e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="مثال: +44 (بريطانيا) أو +1 (أمريكا) أو +86 (الصين)"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                errors.customCountryCode
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.customCountryCode && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.customCountryCode}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              <i className="fas fa-info-circle ml-1"></i>
              الصيغة: + متبوعة بـ 1-4 أرقام (مثال: +44 أو +212)
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => handleFieldChange('phone', e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="أدخل رقم الهاتف"
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
              errors.phone
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              {errors.phone}
            </p>
          )}
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
              closeModal('editPatient');
              setName('');
              setUsername('');
              setPhone('');
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
