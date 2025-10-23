'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { validateName, validatePhone, ValidationError } from '@/utils/validation';
import Modal from './Modal';
import { useState } from 'react';

interface PatientField {
  name: string;
  phone: string;
  countryCode: string;
}

interface PatientErrors {
  [key: string]: ValidationError;
}

export default function AddPatientModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [patients, setPatients] = useState<PatientField[]>([
    { name: '', phone: '', countryCode: '+20' }
  ]);
  const [errors, setErrors] = useState<PatientErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const isOpen = openModals.has('addPatient');

  const validatePatient = (index: number, patient: PatientField): ValidationError => {
    const patientErrors: ValidationError = {};
    
    // Name validation
    const nameError = validateName(patient.name, 'اسم المريض');
    if (nameError) patientErrors.name = nameError;
    
    // Phone validation
    const phoneError = validatePhone(patient.phone);
    if (phoneError) patientErrors.phone = phoneError;
    
    return patientErrors;
  };

  const addPatientSlot = () => {
    if (patients.length >= 50) {
      addToast('الحد الأقصى 50 مريض', 'error');
      return;
    }
    setPatients([...patients, { name: '', phone: '', countryCode: '+20' }]);
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
    
    patients.forEach((patient, index) => {
      // Only validate non-empty patients
      if (patient.name.trim() || patient.phone.trim()) {
        const patientErrors = validatePatient(index, patient);
        
        if (Object.keys(patientErrors).length > 0) {
          newErrors[`patient_${index}`] = patientErrors;
        } else {
          validCount++;
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
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // TODO: Add patients through context
      addToast(`تم إضافة ${validCount} مريض بنجاح`, 'success');
      setPatients([{ name: '', phone: '', countryCode: '+20' }]);
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
        setPatients([{ name: '', phone: '', countryCode: '+20' }]);
        setErrors({});
      }}
      title="إضافة مرضى جدد"
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-4">
        <div id="patientSlots" className="space-y-4 flex-1 overflow-y-auto pr-2">
          {patients.map((patient, index) => {
            const patientError = errors[`patient_${index}`];
            return (
              <div
                key={index}
                className={`border rounded-lg p-4 transition-colors ${
                  patientError
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الاسم الكامل *
                    </label>
                    <input
                      type="text"
                      value={patient.name}
                      onChange={(e) => updatePatient(index, 'name', e.target.value)}
                      onBlur={() => handleFieldBlur(index)}
                      placeholder="أدخل الاسم الكامل"
                      disabled={isLoading}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                        patientError?.name
                          ? 'border-red-500 focus:ring-red-500'
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      رقم الهاتف *
                    </label>
                    <div className="flex gap-1">
                      <select
                        value={patient.countryCode}
                        onChange={(e) => updatePatient(index, 'countryCode', e.target.value)}
                        disabled={isLoading}
                        className={`px-2 py-2 border rounded-r-lg bg-gray-50 text-sm transition-all ${
                          patientError?.phone
                            ? 'border-red-500'
                            : 'border-gray-300'
                        }`}
                      >
                        <option value="+20">+20 (مصر)</option>
                        <option value="+966">+966 (السعودية)</option>
                        <option value="+971">+971 (الإمارات)</option>
                      </select>
                      <input
                        type="tel"
                        value={patient.phone}
                        onChange={(e) => updatePatient(index, 'phone', e.target.value)}
                        onBlur={() => handleFieldBlur(index)}
                        placeholder="رقم الهاتف"
                        disabled={isLoading}
                        className={`flex-1 px-3 py-2 border rounded-l-lg focus:ring-2 focus:border-transparent transition-all ${
                          patientError?.phone
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                      />
                    </div>
                    {patientError?.phone && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <i className="fas fa-exclamation-circle"></i>
                        {patientError.phone}
                      </p>
                    )}
                  </div>
                </div>
                {patients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePatientSlot(index)}
                    disabled={isLoading}
                    className="mt-2 text-red-600 hover:text-red-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-trash ml-1"></i>
                    حذف هذا المريض
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <button
            type="button"
            onClick={addPatientSlot}
            disabled={isLoading}
            className="text-blue-600 hover:text-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-plus ml-1"></i>
            إضافة مريض آخر
          </button>
          <span className="text-sm text-gray-600">
            {patients.length} / 50 مريض
          </span>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isLoading}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
              isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                جاري الإضافة...
              </>
            ) : (
              <>
                <i className="fas fa-plus"></i>
                إضافة المرضى
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              closeModal('addPatient');
              setPatients([{ name: '', phone: '', countryCode: '+20' }]);
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
