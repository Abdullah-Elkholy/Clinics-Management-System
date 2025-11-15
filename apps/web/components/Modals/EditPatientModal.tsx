'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { COUNTRY_CODES } from '@/constants';
import { validateCountryCode, validateName, validatePhone, ValidationError, MAX_PHONE_DIGITS } from '@/utils/validation';
import Modal from './Modal';
import { useState, useEffect } from 'react';
import CountryCodeSelector from '@/components/Common/CountryCodeSelector';
import { getEffectiveCountryCode, normalizePhoneNumber } from '@/utils/core.utils';
import { patientsApiClient } from '@/services/api/patientsApiClient';
import { useQueue } from '@/contexts/QueueContext';

export default function EditPatientModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const data = getModalData('editPatient');
  const { refreshPatients, queues, patients } = useQueue();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+20');
  const [customCountryCode, setCustomCountryCode] = useState('');
  const [errors, setErrors] = useState<ValidationError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [initialValues, setInitialValues] = useState({
    name: '',
    username: '',
    phone: '',
  });

  const isOpen = openModals.has('editPatient');
  const [freshPatientData, setFreshPatientData] = useState<any>(null);
  
  // Fetch fresh patient data when modal opens
  useEffect(() => {
    if (!isOpen || !data?.patient?.id) return;
    
    const fetchFreshPatientData = async () => {
      try {
        const patientIdNum = Number(data?.patient?.id);
        if (!isNaN(patientIdNum) && patientIdNum > 0) {
          const freshPatientDto = await patientsApiClient.getPatient(patientIdNum);
          // Defensive check: ensure freshPatientDto exists and has required fields
          if (freshPatientDto && typeof freshPatientDto === 'object' && 'id' in freshPatientDto) {
            const patientId = freshPatientDto.id;
            // Ensure id is a valid number before converting to string
            if (patientId !== undefined && patientId !== null && !isNaN(Number(patientId))) {
              // Parse phone number from E.164 format if needed
              const phoneNumber = freshPatientDto.phoneNumber || '';
              const countryCode = freshPatientDto.countryCode || '+20';
              
              // Extract phone number without country code if it's in E.164 format
              let phone = phoneNumber;
              if (phoneNumber.startsWith('+')) {
                const countryCodeDigits = countryCode.replace(/[^\d]/g, '');
                if (phoneNumber.startsWith(`+${countryCodeDigits}`)) {
                  phone = phoneNumber.substring(countryCodeDigits.length + 1);
                  // Remove leading zero for countries that require it
                  if (countryCodeDigits === '20' && phone.startsWith('0')) {
                    phone = phone.substring(1);
                  }
                }
              }
              
            // Convert backend DTO to frontend format
            const freshPatient = {
                id: String(patientId),
              name: freshPatientDto.fullName || '',
                phone: phone,
                countryCode: countryCode,
              queueId: data?.patient?.queueId || '',
            };
            setFreshPatientData(freshPatient);
          } else {
              // If ID is invalid, use existing patient data
              setFreshPatientData(null);
            }
          } else {
            // If response structure is invalid, use existing patient data
            setFreshPatientData(null);
          }
        }
      } catch (err) {
        // If fresh data fetch fails, fall back to existing data
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to fetch fresh patient data:', err);
        }
        setFreshPatientData(null);
      }
    };
    
    // Always refetch when modal opens to ensure fresh data
    fetchFreshPatientData();
  }, [isOpen, data?.patient?.id]);
  
  // Get fresh patient data - prioritize freshPatientData, then patients array, then props
  const freshPatient = freshPatientData 
    || (data?.patient?.id 
      ? patients.find(p => p.id === data?.patient?.id) || data?.patient
      : data?.patient);
  
  // Use useEffect to properly initialize state when modal opens with patient data
  // Get fresh patient data
  useEffect(() => {
    if (!isOpen) return;
    
    if (freshPatient) {
      setName(freshPatient.name ?? '');
      setUsername(freshPatient.username ?? '');
      setPhone(freshPatient.phone ?? '');
      setCountryCode(freshPatient.countryCode ?? '+20');
      setCustomCountryCode('');
      setInitialValues({
        name: freshPatient.name ?? '',
        username: freshPatient.username ?? '',
        phone: freshPatient.phone ?? '',
      });
      setErrors({});
      setTouched(false);
    }
  }, [isOpen, freshPatient?.id, freshPatient?.name, freshPatient?.phone, freshPatient?.countryCode]); // Depend on patient ID and key fields to re-init when data updates

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
    
    if (phone !== initialValues.phone) {
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
    
    if (phone !== initialValues.phone) {
      updatePayload.phone = phone.trim();
    }
    
    const initialCountryCode = data?.patient?.countryCode ?? '+20';
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

    try {
      setIsLoading(true);
      const patientIdNum = Number(data?.patient?.id);
      if (isNaN(patientIdNum)) {
        throw new Error('معرّف المريض غير صالح');
      }

      // Map to API payload fields
      const apiPayload: any = {};
      if (updatePayload.name) apiPayload.fullName = updatePayload.name;
      if (updatePayload.phone || updatePayload.countryCode) {
        const effectiveCode = getEffectiveCountryCode(countryCode, customCountryCode);
        const phoneRaw = updatePayload.phone || data?.patient?.phone || '';
        apiPayload.phoneNumber = normalizePhoneNumber(phoneRaw, effectiveCode);
        // Send countryCode explicitly (backend will extract it if not provided, but better to send it)
        apiPayload.countryCode = effectiveCode;
      }

      await patientsApiClient.updatePatient(patientIdNum, apiPayload);

      addToast('تم تحديث بيانات المريض بنجاح', 'success');
      
      // Refresh patients to reflect changes
      // Wait for refetch to complete before closing modal and dispatching event
      await refreshPatients(String(data?.patient?.queueId || ''));
      
      // Clear form fields after successful update
      setName('');
      setUsername('');
      setPhone('');
      setErrors({});
      setTouched(false);
      
      closeModal('editPatient');
      
      // Trigger a custom event to notify other components to refetch
      // Dispatch after a small delay to ensure refreshPatients has updated the state
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('patientDataUpdated'));
      }, 100);
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
          <label htmlFor="editPatient-name" className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل</label>
          <input
            id="editPatient-name"
            name="name"
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
          <label htmlFor="editPatient-phone" className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف وكود الدولة *</label>
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
                id="editPatient-customCountryCode"
                name="customCountryCode"
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
              id="editPatient-phone"
              name="phone"
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
