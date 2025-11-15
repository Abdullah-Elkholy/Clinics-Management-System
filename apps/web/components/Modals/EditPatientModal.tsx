'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { COUNTRY_CODES } from '@/constants';
import { validateCountryCode, validateName, validatePhone, ValidationError, MAX_PHONE_DIGITS } from '@/utils/validation';
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل</label>
          <input
            type="text"
            value={name ?? ''}
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
          <label className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف وكود الدولة *</label>
          <div className="flex flex-wrap gap-2">
            {/* Country Code Selector */}
            <CountryCodeSelector
              value={countryCode}
              onChange={setCountryCode}
              disabled={isLoading}
              hasError={!!errors.phone || !!errors.customCountryCode}
              size="md"
              showOptgroups={true}
            />

            {/* Custom Country Code Input (only when OTHER is selected) */}
            {countryCode === 'OTHER' && (
              <input
                type="text"
                value={customCountryCode ?? ''}
                onChange={(e) => {
                  // Limit to 4 characters for country code format (+XXX)
                  const value = e.target.value;
                  if (value.length <= 4) {
                    handleFieldChange('customCountryCode', value);
                  }
                }}
                onBlur={handleFieldBlur}
                placeholder="+966"
                disabled={isLoading}
                maxLength={4}
                title="الصيغة: + متبوعة بـ 1-4 أرقام"
                className={`w-20 px-2 py-2.5 border-2 rounded-lg focus:ring-2 focus:border-transparent transition-all text-center font-mono text-sm ${
                  errors.customCountryCode
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
            )}

            {/* Phone Input */}
            <input
              type="tel"
              value={phone ?? ''}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="أدخل رقم الهاتف"
              disabled={isLoading}
              maxLength={MAX_PHONE_DIGITS}
              inputMode="numeric"
              pattern="[0-9]*"
              className={`min-w-40 flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all font-mono ${
                errors.phone
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />

            {/* Phone Extension Input removed to reduce ambiguity */}
          </div>

          {errors.phone && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              {errors.phone}
            </p>
          )}

          {errors.customCountryCode && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              {errors.customCountryCode}
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
              // phoneExtension state removed
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
