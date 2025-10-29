'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, validatePhone, ValidationError, validateCountryCode } from '@/utils/validation';
import { COUNTRY_CODES } from '@/constants';
import Modal from './Modal';
import { useState } from 'react';
import CountryCodeSelector from '@/components/Common/CountryCodeSelector';
import { getEffectiveCountryCode } from '@/utils/core.utils';

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
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [patients, setPatients] = useState<PatientField[]>([
    { name: '', phone: '', countryCode: '+20', customCountryCode: '' }
  ]);
  const [errors, setErrors] = useState<PatientErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set([0])); // Track expanded patients

  const isOpen = openModals.has('addPatient');

  const validatePatient = (index: number, patient: PatientField): ValidationError => {
    const patientErrors: ValidationError = {};
    
    // Name validation
    const nameError = validateName(patient.name, 'اسم المريض');
    if (nameError) patientErrors.name = nameError;
    
    // Phone validation
    const phoneError = validatePhone(patient.phone);
    if (phoneError) patientErrors.phone = phoneError;
    
    // Validate custom country code if 'OTHER' is selected
    if (patient.countryCode === 'OTHER') {
      const customCodeError = validateCountryCode(patient.customCountryCode || '', true);
      if (customCodeError) patientErrors.customCountryCode = customCodeError;
    }
    
    return patientErrors;
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
    
    // Clear error for this patient if it was filled
    if (errors[`patient_${index}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`patient_${index}`];
        return newErrors;
      });
    }
  };

  const handleFieldBlur = (index: number) => {
    const patient = patients[index];
    const patientErrors = validatePatient(index, patient);
    
    if (Object.keys(patientErrors).length > 0) {
      setErrors((prev) => ({
        ...prev,
        [`patient_${index}`]: patientErrors,
      }));
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`patient_${index}`];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all patients
    const newErrors: PatientErrors = {};
    let validCount = 0;
    const validPatients: Array<PatientField & { effectiveCountryCode: string }> = [];
    
    patients.forEach((patient, index) => {
      // Only validate non-empty patients
      if (patient.name.trim() || patient.phone.trim()) {
        const patientErrors = validatePatient(index, patient);
        
        // Validate country code
        const effectiveCountryCode = getEffectiveCountryCode(
          patient.countryCode,
          patient.customCountryCode || ''
        );
        const countryCodeError = validateCountryCode(effectiveCountryCode, true);
        
        if (countryCodeError) {
          if (!patientErrors.country) {
            patientErrors.country = countryCodeError;
          }
        }
        
        if (Object.keys(patientErrors).length > 0) {
          newErrors[`patient_${index}`] = patientErrors;
        } else {
          validCount++;
          validPatients.push({
            ...patient,
            effectiveCountryCode
          });
        }
      }
    });
    
    setErrors(newErrors);
    
    if (validCount === 0) {
      addToast('يرجى إدخال بيانات المرضى بشكل صحيح', 'error');
      return;
    }
    
    if (Object.keys(newErrors).length > 0) {
      addToast(`يوجد أخطاء في ${Object.keys(newErrors).length} صفوف. يرجى التحقق`, 'error');
      return;
    }

    try {
      setIsLoading(true);
      
      // Process valid patients with effective country codes
      const patientsToAdd = validPatients.map(p => ({
        name: p.name.trim(),
        phone: p.phone.trim(),
        countryCode: p.effectiveCountryCode
      }));
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // TODO: Add patients through context using patientsToAdd
      addToast(`تم إضافة ${validCount} مريض بنجاح`, 'success');
      setPatients([{ name: '', phone: '', countryCode: '+20', customCountryCode: '' }]);
      setErrors({});
      closeModal('addPatient');
    } catch (error) {
      addToast('حدث خطأ أثناء إضافة المرضى', 'error');
    } finally {
      setIsLoading(false);
    }
  };

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
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-4">
        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700 flex items-center gap-2">
            <i className="fas fa-info-circle flex-shrink-0"></i>
            <span>يمكنك إضافة حتى <strong>50 مريض</strong> في مرة واحدة. أملأ البيانات وانقر "إضافة المرضى"</span>
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
                <div className={`px-4 py-3 border-b ${patientError ? 'bg-red-100' : 'bg-gradient-to-r from-blue-50 to-blue-100'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePatientExpanded(index)}
                        disabled={isLoading}
                        className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                        title={isExpanded ? "طي" : "توسيع"}
                      >
                        <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} transition-transform`}></i>
                      </button>
                      <span className="text-sm font-semibold text-gray-700">
                        <i className="fas fa-user-circle text-blue-600 ml-2"></i>
                        المريض #{index + 1}
                      </span>
                    </div>
                    {patients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePatientSlot(index)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <i className="fas fa-trash ml-1"></i>
                        حذف
                      </button>
                    )}
                  </div>
                </div>

                {/* Patient Form Fields - Collapsible */}
                {isExpanded && (
                <div className="p-4 space-y-3">
                  {/* Name Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <i className="fas fa-signature text-gray-500 ml-1"></i>
                      الاسم الكامل *
                    </label>
                    <input
                      type="text"
                      value={patient.name}
                      onChange={(e) => updatePatient(index, 'name', e.target.value)}
                      onBlur={() => handleFieldBlur(index)}
                      placeholder="مثال: أحمد محمد علي"
                      disabled={isLoading}
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

                  {/* Phone Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <i className="fas fa-phone text-gray-500 ml-1"></i>
                      رقم الهاتف *
                    </label>
                    
                    {/* Country Code + Phone */}
                    <div className="flex gap-2">
                      {/* Country Code Selector */}
                      <CountryCodeSelector
                        value={patient.countryCode}
                        onChange={(value) => updatePatient(index, 'countryCode', value)}
                        disabled={isLoading}
                        hasError={!!patientError?.phone}
                        size="sm"
                        showOptgroups={true}
                      />

                      {/* Phone Input */}
                      {patient.countryCode === 'OTHER' ? (
                        <input
                          type="text"
                          value={patient.customCountryCode || ''}
                          onChange={(e) => updatePatient(index, 'customCountryCode', e.target.value)}
                          onBlur={() => handleFieldBlur(index)}
                          placeholder="مثال: +44 أو +1 أو +886"
                          disabled={isLoading}
                          className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                            patientError?.customCountryCode
                              ? 'border-red-500 bg-red-50 focus:ring-red-500'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                          title="الصيغة: + متبوعة بـ 1-4 أرقام"
                        />
                      ) : (
                        <input
                          type="tel"
                          value={patient.phone}
                          onChange={(e) => updatePatient(index, 'phone', e.target.value)}
                          onBlur={() => handleFieldBlur(index)}
                          placeholder="01012345678"
                          disabled={isLoading}
                          className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                            patientError?.phone
                              ? 'border-red-500 bg-red-50 focus:ring-red-500'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        />
                      )}
                    </div>

                    {patientError?.phone && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <i className="fas fa-exclamation-circle"></i>
                        {patientError.phone}
                      </p>
                    )}

                    {/* Custom Country Code Error */}
                    {patientError?.customCountryCode && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <i className="fas fa-exclamation-circle"></i>
                        {patientError.customCountryCode}
                      </p>
                    )}
                  </div>

                  {/* Custom Country Code Info */}
                  {patient.countryCode === 'OTHER' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                      <p className="text-xs text-blue-700 mb-1">
                        <i className="fas fa-info-circle ml-1"></i>
                        <strong>الصيغة:</strong> + متبوعة بـ 1-4 أرقام (مثال: +44 أو +212)
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
