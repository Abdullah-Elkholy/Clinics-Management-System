'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import { validateName, validatePhone, ValidationError, validateCountryCode, MAX_PHONE_DIGITS } from '@/utils/validation';
import { patientsApiClient } from '@/services/api/patientsApiClient';
import Modal from './Modal';
import { useState, useRef, type FormEvent } from 'react';
import CountryCodeSelector from '@/components/Common/CountryCodeSelector';
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation';
import { getEffectiveCountryCode } from '@/utils/core.utils';
import logger from '@/utils/logger';

interface PatientField {
  name: string;
  phone: string;
  countryCode: string;
  customCountryCode?: string;
}

interface PatientErrors {
  [key: string]: ValidationError;
}

export default function AddPatientModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const { selectedQueueId, refreshPatients } = useQueue();
  const [patients, setPatients] = useState<PatientField[]>([
    { name: '', phone: '', countryCode: '+20', customCountryCode: '' }
  ]);
  const [errors, setErrors] = useState<PatientErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set([0])); // Track expanded patients
  const formRef = useRef<HTMLFormElement>(null);

  const isOpen = openModals.has('addPatient');
  const modalData = getModalData('addPatient');
  const queueId = modalData?.queueId || selectedQueueId;

  // Validate only a specific field
  const validateField = (index: number, fieldName: string, patient: PatientField): string | undefined => {
    switch (fieldName) {
      case 'name':
        return validateName(patient.name, 'اسم المريض');
      case 'phone':
        return validatePhone(patient.phone);
      case 'customCountryCode':
        if (patient.countryCode === 'OTHER') {
          return validateCountryCode(patient.customCountryCode || '', true);
        }
        return undefined;
      default:
        return undefined;
    }
  };

  // Toggle expand/collapse for a single patient
  const togglePatientExpanded = (index: number) => {
    const newExpanded = new Set(expandedPatients);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedPatients(newExpanded);
  };

  // Expand all patients
  const expandAll = () => {
    const allIndices = new Set(patients.map((_, i) => i));
    setExpandedPatients(allIndices);
  };

  // Collapse all patients
  const collapseAll = () => {
    setExpandedPatients(new Set());
  };

  const addPatientSlot = () => {
    if (patients.length >= 50) {
      addToast('الحد الأقصى 50 مريض', 'error');
      return;
    }
  setPatients([...patients, { name: '', phone: '', countryCode: '+20', customCountryCode: '' }]);
  };

  const removePatientSlot = (index: number) => {
    const newPatients = patients.filter((_, i) => i !== index);
    setPatients(newPatients);
    
    // Remove errors for deleted patient
    const newErrors = { ...errors };
    delete newErrors[`patient_${index}`];
    setErrors(newErrors);
  };

  const updatePatient = (index: number, field: string, value: string) => {
    const updated = [...patients];
    updated[index] = { ...updated[index], [field]: value };
    setPatients(updated);
    
    // Don't clear errors on update - let handleFieldBlur do that on blur
  };

  const handleFieldBlur = (index: number, fieldName: string) => {
    const patient = patients[index];
    const fieldError = validateField(index, fieldName, patient);
    
    setErrors((prev) => {
      const patientErrors = prev[`patient_${index}`] ? { ...prev[`patient_${index}`] } : {};
      
      if (fieldError) {
        patientErrors[fieldName] = fieldError;
      } else {
        delete patientErrors[fieldName];
      }
      
      // Update errors for this patient
      const newErrors = { ...prev };
      if (Object.keys(patientErrors).length > 0) {
        newErrors[`patient_${index}`] = patientErrors;
      } else {
        delete newErrors[`patient_${index}`];
      }
      
      return newErrors;
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate all patients - check that each patient has all required fields filled
    const newErrors: PatientErrors = {};
    let validCount = 0;
    const validPatients: Array<PatientField & { effectiveCountryCode: string }> = [];
    
    patients.forEach((patient, index) => {
      const patientErrors: ValidationError = {};
      
      // Check if patient has any data entered
      const hasAnyData = patient.name.trim() || patient.phone.trim() || patient.countryCode;
      
      if (hasAnyData) {
        // If patient has any data, validate ALL fields (name and phone are required)
        
        // Name validation
        const nameError = validateName(patient.name, 'اسم المريض');
        if (nameError) patientErrors.name = nameError;
        
        // Phone validation
        const phoneError = validatePhone(patient.phone);
        if (phoneError) patientErrors.phone = phoneError;
        
        // Country Code validation
        const effectiveCountryCode = getEffectiveCountryCode(
          patient.countryCode,
          patient.customCountryCode || ''
        );
        const countryCodeError = validateCountryCode(effectiveCountryCode, true);
        if (countryCodeError) patientErrors.country = countryCodeError;
        
        // Custom country code validation (if OTHER is selected)
        if (patient.countryCode === 'OTHER') {
          const customCodeError = validateCountryCode(patient.customCountryCode || '', true);
          if (customCodeError) patientErrors.customCountryCode = customCodeError;
        }
        
        // Add errors for this patient if any exist
        if (Object.keys(patientErrors).length === 0) {
          validCount++;
          validPatients.push({
            ...patient,
            effectiveCountryCode
          });
        } else {
          newErrors[`patient_${index}`] = patientErrors;
        }
      }
    });
    
    setErrors(newErrors);
    
    // Check if there are no valid patients to add
    if (validCount === 0) {
      // Don't use toast if there are validation errors - they'll be shown in the form
      if (Object.keys(newErrors).length === 0) {
        // Only show toast if no data was entered at all
        return;
      }
      // Validation errors are displayed in the form, no need for toast
      return;
    }
    
    // If there are validation errors alongside valid patients, show them in the form only
    if (Object.keys(newErrors).length > 0) {
      // Errors are displayed in the form validation alerts
      return;
    }

    try {
      setIsLoading(true);
      
      // Validate that we have a queue ID
      if (!queueId) {
        addToast('يجب تحديد طابور', 'error');
        return;
      }

      // Process valid patients and call backend API
      const qidNum = Number(queueId);
      let addedCount = 0;
      for (const p of validPatients) {
        try {
          const phoneNumber = p.phone.trim(); // Store phone number as-is, no normalization
          await patientsApiClient.createPatient({
            queueId: qidNum,
            fullName: p.name.trim(),
            phoneNumber,
            countryCode: p.effectiveCountryCode, // Send countryCode explicitly
          });
          addedCount++;
        } catch (err) {
          const errorMessage = err instanceof Error 
            ? err.message 
            : (err && typeof err === 'object' && 'message' in err)
              ? String((err as { message?: unknown }).message || 'Unknown error')
              : 'Unknown error';
          logger.error(`Failed to add patient: ${p.name}`, {
            error: errorMessage,
            statusCode: (err && typeof err === 'object' && 'statusCode' in err) ? (err as { statusCode?: unknown }).statusCode : undefined,
            fullError: err,
          });
        }
      }
      
      if (addedCount === 0) {
        addToast('فشل إضافة المرضى', 'error');
        return;
      }

      addToast(`تم إضافة ${addedCount} مريض بنجاح`, 'success');
      
      // Reload patients from backend to reflect latest state
      // Wait for refetch to complete before closing modal and dispatching event
      await refreshPatients(String(queueId));
      
      // Clear form fields after successful creation
      setPatients([{ name: '', phone: '', countryCode: '+20', customCountryCode: '' }]);
      setErrors({});
      
      closeModal('addPatient');
      
      // Trigger a custom event to notify other components to refetch
      // Dispatch after a small delay to ensure refreshPatients has updated the state
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('patientDataUpdated'));
      }, 100);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' && 'message' in error)
          ? String((error as { message?: unknown }).message || 'Unknown error')
          : 'Unknown error';
      logger.error('Failed to add patients:', {
        error: errorMessage,
        statusCode: (error && typeof error === 'object' && 'statusCode' in error) ? (error as { statusCode?: unknown }).statusCode : undefined,
        fullError: error,
      });
      addToast('حدث خطأ أثناء إضافة المرضى', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Setup keyboard navigation (after handleSubmit is defined)
  useFormKeyboardNavigation({
    formRef,
    onEnterSubmit: () => {
      const fakeEvent = { preventDefault: () => {} } as FormEvent<HTMLFormElement>;
      handleSubmit(fakeEvent);
    },
    enableEnterSubmit: true,
    disabled: isLoading,
  });

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('addPatient');
        setPatients([{ name: '', phone: '', countryCode: '+20', customCountryCode: '' }]);
        setErrors({});
      }}
      title="إضافة مرضى جدد"
      size="xl"
    >
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col h-full space-y-4">
        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700 flex items-center gap-2">
            <i className="fas fa-info-circle flex-shrink-0"></i>
            <span>
              يمكنك إضافة حتى <strong>50 مريض</strong> في مرة واحدة. أملأ البيانات وانقر
              &nbsp;&quot;إضافة المرضى&quot;
            </span>
          </p>
        </div>

        {/* Form-level Validation Alert */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
            <p className="text-red-800 font-semibold flex items-center gap-2 mb-2">
              <i className="fas fa-exclamation-circle text-red-600"></i>
              يوجد أخطاء في البيانات
            </p>
            <ul className="space-y-1 text-sm text-red-700">
              {Object.entries(errors).map(([rowKey, patientErrors]) => {
                const rowNum = parseInt(rowKey.replace('patient_', '')) + 1;
                return (
                  <li key={rowKey} className="flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                    <span>
                      <strong>المريض #{rowNum}:</strong> {Object.values(patientErrors).join(' و ')}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Patients List */}
        <div id="patientSlots" className="space-y-3 flex-1 overflow-y-auto pr-2">
          {/* Collapse/Expand All Buttons */}
          {patients.length > 1 && (
            <div className="flex gap-2 mb-3 sticky top-0 bg-white z-10 pb-2">
              <button
                type="button"
                onClick={expandAll}
                disabled={isLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <i className="fas fa-expand"></i>
                توسيع الكل
              </button>
              <button
                type="button"
                onClick={collapseAll}
                disabled={isLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <i className="fas fa-compress"></i>
                طي الكل
              </button>
            </div>
          )}

          {patients.map((patient, index) => {
            const patientError = errors[`patient_${index}`];
            const isExpanded = expandedPatients.has(index);
            return (
              <div
                key={index}
                className={`border rounded-lg transition-all overflow-hidden ${
                  patientError
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                {/* Patient Card Header */}
                <div className={`px-4 py-3 border-b text-right flex items-center justify-between transition-all ${
                  patientError ? 'bg-red-100' : 'bg-gradient-to-r from-blue-50 to-blue-100'
                }`}>
                  <button
                    type="button"
                    onClick={() => togglePatientExpanded(index)}
                    disabled={isLoading}
                    className="flex items-center gap-2 flex-1 text-right transition-all hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isExpanded ? "طي القسم" : "توسيع القسم"}
                  >
                    <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-gray-600 transition-transform`}></i>
                    <span className="text-sm font-semibold text-gray-700">
                      <i className="fas fa-user-circle text-blue-600 ml-2"></i>
                      المريض #{index + 1}
                    </span>
                  </button>
                  {patients.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePatientSlot(index);
                      }}
                      disabled={isLoading}
                      className="text-red-600 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ml-2"
                    >
                      <i className="fas fa-trash ml-1"></i>
                      حذف
                    </button>
                  )}
                </div>

                {/* Patient Form Fields - Collapsible */}
                {isExpanded && (
                <div className="p-4 space-y-3">
                  {/* Name & Phone Row */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Name Field */}
                    <div>
                      <label htmlFor={`addPatient-name-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                        <i className="fas fa-signature text-gray-500 ml-1"></i>
                        الاسم الكامل *
                      </label>
                      <input
                        id={`addPatient-name-${index}`}
                        name={`patient-${index}-name`}
                        type="text"
                        value={patient.name}
                        onChange={(e) => updatePatient(index, 'name', e.target.value)}
                        onBlur={() => handleFieldBlur(index, 'name')}
                        placeholder="مثال: أحمد محمد علي"
                        disabled={isLoading}
                        autoComplete="name"
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:border-transparent transition-all ${
                          patientError?.name
                            ? 'border-red-500 bg-red-50 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                      />
                      {patientError?.name && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <i className="fas fa-exclamation-circle"></i>
                          {patientError.name}
                        </p>
                      )}
                    </div>

                    {/* Phone Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <i className="fas fa-phone text-gray-500 ml-1"></i>
                        رقم الهاتف *
                      </label>
                      
                      {/* Country Code + Custom Code + Phone */}
                      <div className="flex flex-wrap gap-2">
                        {/* Country Code Selector */}
                        <CountryCodeSelector
                          value={patient.countryCode}
                          onChange={(value) => updatePatient(index, 'countryCode', value)}
                          disabled={isLoading}
                          hasError={!!patientError?.phone || !!patientError?.customCountryCode || !!patientError?.country}
                          size="sm"
                          showOptgroups={true}
                        />

                        {/* Custom Country Code Input (only when OTHER is selected) */}
                        {patient.countryCode === 'OTHER' && (
                          <input
                            id={`addPatient-customCountryCode-${index}`}
                            name={`patient-${index}-customCountryCode`}
                            type="text"
                            value={patient.customCountryCode || ''}
                            onChange={(e) => {
                              // Limit to 4 characters for country code format (+XXX) and validate no spaces
                              const value = e.target.value.replace(/\s/g, '');
                              if (value.length <= 4) {
                                updatePatient(index, 'customCountryCode', value);
                              }
                            }}
                            onBlur={() => handleFieldBlur(index, 'customCountryCode')}
                            placeholder="+966"
                            disabled={isLoading}
                            maxLength={4}
                            title="الصيغة: + متبوعة بـ 1-4 أرقام"
                            autoComplete="tel-country-code"
                            className={`w-20 px-2 py-2 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all text-center font-mono ${
                              patientError?.customCountryCode
                                ? 'border-red-500 bg-red-50 focus:ring-red-500'
                                : 'border-gray-300 hover:border-gray-400 focus:ring-blue-500'
                            }`}
                          />
                        )}

                        {/* Phone Input */}
                        <input
                          id={`addPatient-phone-${index}`}
                          name={`patient-${index}-phone`}
                          type="tel"
                          value={patient.phone}
                          onChange={(e) => {
                            // Validate no spaces
                            const value = e.target.value.replace(/\s/g, '');
                            updatePatient(index, 'phone', value);
                          }}
                          onBlur={() => handleFieldBlur(index, 'phone')}
                          placeholder={patient.countryCode && patient.countryCode !== 'OTHER' 
                            ? require('@/utils/phoneUtils').getPhonePlaceholder(patient.countryCode)
                            : '123456789'}
                          disabled={isLoading}
                          maxLength={MAX_PHONE_DIGITS}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="tel"
                          className={`min-w-40 flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all font-mono ${
                            patientError?.phone
                              ? 'border-red-500 bg-red-50 focus:ring-red-500'
                              : 'border-gray-300 hover:border-gray-400 focus:ring-blue-500'
                          }`}
                        />

                        {/* Phone Extension Input removed to reduce ambiguity */}
                      </div>

                      {patientError?.phone && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <i className="fas fa-exclamation-circle"></i>
                          {patientError.phone}
                        </p>
                      )}

                      {patientError?.customCountryCode && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <i className="fas fa-exclamation-circle"></i>
                          {patientError.customCountryCode}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Custom Country Code Info / OTHER Disclaimer */}
                  {patient.countryCode === 'OTHER' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs text-amber-800 mb-1">
                        <i className="fas fa-exclamation-triangle ml-1"></i>
                        <strong>تنبيه:</strong> عند اختيار "أخرى"، يرجى التأكد من إدخال رقم الهاتف بالتنسيق الصحيح لتجنب أخطاء الإرسال.
                      </p>
                      <p className="text-xs text-amber-700">
                        <strong>الصيغة:</strong> + متبوعة بـ 1-4 أرقام (مثال: +44 أو +212). لا تستخدم مسافات في رقم الهاتف أو رمز الدولة.
                      </p>
                    </div>
                  )}
                </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Patient Button */}
        <div className="flex items-center justify-between pt-2 border-t">
          <button
            type="button"
            onClick={addPatientSlot}
            disabled={isLoading || patients.length >= 50}
            className="text-blue-600 hover:text-blue-700 text-sm px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <i className="fas fa-plus"></i>
            إضافة مريض آخر
          </button>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${
            patients.length >= 50 
              ? 'bg-red-100 text-red-700' 
              : 'bg-blue-100 text-blue-700'
          }`}>
            {patients.length} / 50 مريض
          </span>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 font-medium bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                جاري الإضافة...
              </>
            ) : (
              <>
                <i className="fas fa-check-circle"></i>
                إضافة المرضى ({patients.length})
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              closeModal('addPatient');
              setPatients([{ name: '', phone: '', countryCode: '+20', customCountryCode: '' }]);
              setErrors({});
            }}
            disabled={isLoading}
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <i className="fas fa-times ml-1"></i>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}



