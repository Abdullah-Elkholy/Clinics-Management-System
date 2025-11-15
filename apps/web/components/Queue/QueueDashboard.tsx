'use client';

import { useQueue } from '@/contexts/QueueContext';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { validateNumber } from '@/utils/validation';
import { createDeleteConfirmation, createBulkDeleteConfirmation } from '@/utils/confirmationHelpers';
import { patientsApiClient } from '@/services/api/patientsApiClient';
import queuesApiClient from '@/services/api/queuesApiClient';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { ResponsiveTable } from '@/components/Common/ResponsiveTable';
import { EmptyState } from '@/components/Common/EmptyState';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { ConflictWarning } from '@/components/Common/ConflictBadge';
import { QueueStatsCard } from './QueueStatsCard';
import { formatPhoneForDisplay } from '@/utils/phoneUtils';
import logger from '@/utils/logger';

export default function QueueDashboard() {
  const { selectedQueueId, queues, messageTemplates, messageConditions, patients, refreshPatients, refreshQueueData, refreshQueues } = useQueue();
  const { openModal } = useModal();
  const { confirm } = useConfirmDialog();
  const { addToast } = useUI();
  
  const queue = queues.find((q) => q.id === selectedQueueId);
  
  // Initialize CQP and ETS from queue data
  const [currentCQP, setCurrentCQP] = useState(() => queue?.currentPosition?.toString() || '1');
  const [originalCQP, setOriginalCQP] = useState(() => queue?.currentPosition?.toString() || '1');
  const [isEditingCQP, setIsEditingCQP] = useState(false);
  
  const [currentETS, setCurrentETS] = useState(() => queue?.estimatedWaitMinutes?.toString() || '15');
  const [originalETS, setOriginalETS] = useState(() => queue?.estimatedWaitMinutes?.toString() || '15');
  const [isEditingETS, setIsEditingETS] = useState(false);
  
  // Update CQP and ETS when queue data changes
  useEffect(() => {
    if (queue) {
      setCurrentCQP(queue.currentPosition?.toString() || '1');
      setOriginalCQP(queue.currentPosition?.toString() || '1');
      setCurrentETS(queue.estimatedWaitMinutes?.toString() || '15');
      setOriginalETS(queue.estimatedWaitMinutes?.toString() || '15');
    }
  }, [queue?.currentPosition, queue?.estimatedWaitMinutes, queue?.id]);
  
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [editingQueueValue, setEditingQueueValue] = useState('');
  const [isMessageSectionExpanded, setIsMessageSectionExpanded] = useState(true);

  /**
   * Listen for data updates and refetch
   */
  useEffect(() => {
    const handleDataUpdate = async () => {
      if (selectedQueueId) {
        if (typeof refreshPatients === 'function') {
          await refreshPatients();
        }
        if (typeof refreshQueueData === 'function') {
          await refreshQueueData(selectedQueueId);
        }
      }
    };

    window.addEventListener('patientDataUpdated', handleDataUpdate);
    window.addEventListener('queueDataUpdated', handleDataUpdate);
    window.addEventListener('templateDataUpdated', handleDataUpdate);
    window.addEventListener('conditionDataUpdated', handleDataUpdate);

    return () => {
      window.removeEventListener('patientDataUpdated', handleDataUpdate);
      window.removeEventListener('queueDataUpdated', handleDataUpdate);
      window.removeEventListener('templateDataUpdated', handleDataUpdate);
      window.removeEventListener('conditionDataUpdated', handleDataUpdate);
    };
  }, [selectedQueueId, refreshPatients, refreshQueueData]);

  // Compute guide items dynamically based on queue and default template
  const guideItems = useMemo(() => {
    const baseItems = [
      {
        title: '',
        description: 'كل دكتور/عيادة له قائمة المرضى الخاصة وقوالب الرسائل والشروط الخاصة به المنفصلة عن باقي الدكاترة/العيادات',
      },
      {
        title: '',
        description: 'لكل مشرف عدد محدود من "الرسائل المرسلة" و"عدد الطوابير (الدكاترة)", برجاء مراجعة الإدارة في حالة نفاذهم',
      },
      {
        title: '',
        description: 'للتمكن من إرسال الرسائل, يجب أولا التأكد من وجود مريض واحد على الأقل مضاف عن طريق زر "إضافة مريض يدوياً" أو "رفع ملف المرضى", ووجود رسالة افتراضية من خلال زر "تحديث الشروط" بالأعلى إذا كان هناك رسائل تم إنشاؤها أو قسم "الرسائل" في الشريط الجانبي لإنشاء رسالة وجعلها افتراضية, وعدم وجود أي تضاربات في شروط الرسائل عن طريق نفس الزر',
      },
      {
        title: 'CQP',
        description: 'هو الموضع الحالي في قائمة الانتظار, يمكنك تعديل قيمته من خلال زر "تعديل" بجواره بالأعلى'
      },
      {
        title: 'ETS',
        description: 'هي المدة المتوقعة لكل كشف بالدقائق, يمكنك تعديل قيمتها من خلال زر "تعديل" بجواره بالأعلى '
      },
      {
        title: 'إدارة قوالب الرسائل',
        description: 'لإدارة الرسائل والقوالب بشكل كامل، توجه إلى قسم الرسائل في الشريط الجانبي'
      },
      {
        title: 'إدارة المستخدمين',
        description: 'لإدارة المستخدمين المصرح لك بهم ومراجعة عدد الرسائل والطوابير المسموحة، توجه إلى قسم الإدارة في الشريط الجانبي'
      },
      {
        title: 'إضافة طابور',
        description: 'لإضافة طابور جديد، استخدم زر الزائد "إضافة طابور" في الشريط الجانبي. للعلم أن الطوابير محدودة لكل مشرف, برجاء الرجوع للإدارة في حالة نفاذهم'
      },
      {
        title: 'تعديل اسم الطابور',
        description: 'لتعديل اسم الطابور, استخدم زر القلم "تعديل" بجوار الاسم في الشريط الجانبي',
      },
      {
        title: 'حذف الطابور بالكامل',
        description: 'لحذف الطابور بالكامل, استخدم زر سلة المهملات "حذف" بجوار الاسم في الشريط الجانبي',
      },
      {
        title: 'المهام الجارية',
        description: 'لمراجعة المهام الجارية مثل الرسائل التي أخدت أمر الإرسال وفي انتظار التنفيذ، استخدم قسم "المهام الجارية" في الشريط الجانبي'
      },
      {
        title: 'المهام الفاشلة',
        description: 'لمراجعة المهام الفاشلة مثل الرسائل التي لم ترسل بنجاح، استخدم قسم "المهام الفاشلة" في الشريط الجانبي'
      },
      {
        title: 'المهام المكتملة',
        description: 'لمراجعة المهام المكتملة مثل الرسائل التي تم إرسالها بنجاح، استخدم قسم "المهام المكتملة" في الشريط الجانبي'
      },
      {
        title: 'إدارة شروط الرسائل',
        description: 'لتعديل الشروط الخاصة بالرسائل، استخدم زر "تحديث الشروط" في الأعلى, تحت زر "إرسال". ويمكنك توسيع الخانة بالنقر عليها للإطلاع على الرسالة الافتراضية والشروط',
      },
      {
        title: 'إعادة ترتيب المرضى',
        description: 'يمكنك تعديل ترتيب المرضى بالنقر على زر القلم "تعديل" في عمود ترتيب الانتظار'
      },
      {
        title: 'إرسال رسالة جماعية',
        description: 'اضف عدد من المرضى وارسل لهم رسائل جماعية عن طريق زر "إرسال" في الأعلى'
      },
      {
        title: 'إضافة مريض جديد',
        description: 'لإضافة مرضى جدد بشكل يدوي، استخدم زر "إضافة مريض" في الأعلى'
      },
      {
        title: 'إضافة مرضى من ملف إكسيل',
        description: 'لإضافة مرضى جدد بشكل جماعي عن طريق ملف، استخدم زر "رفع ملف المرضى" في الأعلى',
      },
      {
        title: 'حذف مرضى محددين',
        description: 'لحذف مرضى محددين، اخترهم ثم استخدم زر "حذف المحددين" في الأعلى'
      },
      {
        title: 'حذف مريض من الطابور',
        description: 'لحذف مريض من الطابور، استخدم زر سلة المهملات "حذف" في عمود الإجراءات'
      },
      {
        title: 'تعديل بيانات المريض',
        description: 'لتعديل بيانات المريض، استخدم زر القلم "تعديل" في عمود الإجراءات'
      },
      {
        title: 'فتح محادثة واتساب',
        description: 'لفتح محادثة واتساب مع المريض في المتصفح، استخدم زر أيقونة واتساب في عمود الإجراءات',
      },
    ];

    // Check if queue has a default template from context
    if (selectedQueueId) {
      const defaultTemplate = messageTemplates.find((t) => t.condition?.operator === 'DEFAULT');

      if (!defaultTemplate) {
        // Add warning item if no default template
        baseItems.push({
          title: '⚠️ تنبيه هام',
          description: 'لم يتم تحديد قالب رسالة افتراضي لهذه الطابور. يجب إنشاء قالب افتراضي قبل تفعيل الرسائل الآلية.'
        });
      }
    }

    return baseItems;
  }, [selectedQueueId, messageTemplates]);

  /**
   * Handle CQP (Current Queue Position) Edit - memoized
   */
  const handleEditCQP = useCallback(() => {
    setOriginalCQP(currentCQP);
    setIsEditingCQP(true);
  }, [currentCQP]);

  /**
   * Handle CQP Save - memoized
   */
  const handleSaveCQP = useCallback(async () => {
    const error = validateNumber(currentCQP, 'الموضع الحالي', 1, 1000);
    if (error) {
      addToast(error, 'error');
      return;
    }
    if (!queue || !selectedQueueId) {
      addToast('الطابور غير محدد', 'error');
      return;
    }
    
    try {
      const queueIdNum = Number(selectedQueueId);
      if (isNaN(queueIdNum)) {
        addToast('معرف الطابور غير صالح', 'error');
        return;
      }
      
      await queuesApiClient.updateQueue(queueIdNum, {
        doctorName: queue.doctorName,
        currentPosition: parseInt(currentCQP, 10),
      });
      
      setIsEditingCQP(false);
      addToast('تم تحديث الموضع الحالي بنجاح', 'success');
      
      // Refetch queue metadata to update currentPosition immediately
      if (typeof refreshQueues === 'function') {
        await refreshQueues();
      }
      // Refetch templates/conditions
      if (typeof refreshQueueData === 'function') {
        await refreshQueueData(selectedQueueId);
      }
      window.dispatchEvent(new CustomEvent('queueDataUpdated'));
    } catch (err: any) {
      addToast(err?.message || 'فشل تحديث الموضع الحالي', 'error');
    }
  }, [currentCQP, addToast, queue, selectedQueueId, refreshQueueData, refreshQueues]);

  /**
   * Handle CQP Cancel - memoized
   */
  const handleCancelCQP = useCallback(() => {
    setCurrentCQP(originalCQP);
    setIsEditingCQP(false);
  }, [originalCQP]);

  /**
   * Handle ETS (Estimated Time per Session) Edit - memoized
   */
  const handleEditETS = useCallback(() => {
    setOriginalETS(currentETS);
    setIsEditingETS(true);
  }, [currentETS]);

  /**
   * Handle ETS Save - memoized
   */
  const handleSaveETS = useCallback(async () => {
    const error = validateNumber(currentETS, 'الوقت المقدر', 1, 600);
    if (error) {
      addToast(error, 'error');
      return;
    }
    if (!queue || !selectedQueueId) {
      addToast('الطابور غير محدد', 'error');
      return;
    }
    
    try {
      const queueIdNum = Number(selectedQueueId);
      if (isNaN(queueIdNum)) {
        addToast('معرف الطابور غير صالح', 'error');
        return;
      }
      
      await queuesApiClient.updateQueue(queueIdNum, {
        doctorName: queue.doctorName,
        estimatedWaitMinutes: parseInt(currentETS, 10),
      });
      
      setIsEditingETS(false);
      addToast('تم تحديث الوقت المقدر بنجاح', 'success');
      
      // Refetch queue metadata to update estimatedWaitMinutes immediately
      if (typeof refreshQueues === 'function') {
        await refreshQueues();
      }
      // Refetch templates/conditions
      if (typeof refreshQueueData === 'function') {
        await refreshQueueData(selectedQueueId);
      }
      window.dispatchEvent(new CustomEvent('queueDataUpdated'));
    } catch (err: any) {
      addToast(err?.message || 'فشل تحديث الوقت المقدر', 'error');
    }
  }, [currentETS, addToast, queue, selectedQueueId, refreshQueueData, refreshQueues]);

  /**
   * Handle ETS Cancel - memoized
   */
  const handleCancelETS = useCallback(() => {
    setCurrentETS(originalETS);
    setIsEditingETS(false);
  }, [originalETS]);

  /**
   * Toggle patient selection - memoized
   */
  const togglePatientSelection = useCallback((id: string) => {
    setSelectedPatients((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  /**
   * Get condition range for conflict detection
   */
  const getConditionRange = (cond: any): { min: number; max: number } | null => {
    switch (cond.operator) {
      case 'EQUAL':
        if (cond.value === undefined || cond.value <= 0) return null;
        return { min: cond.value, max: cond.value };
      case 'GREATER':
        if (cond.value === undefined || cond.value <= 0) return null;
        return { min: cond.value + 1, max: 999 };
      case 'LESS':
        if (cond.value === undefined || cond.value <= 0) return null;
        return { min: 1, max: cond.value - 1 };
      case 'RANGE':
        if (cond.minValue === undefined || cond.maxValue === undefined || cond.minValue <= 0 || cond.maxValue <= 0) return null;
        return { min: cond.minValue, max: cond.maxValue };
      default:
        return null;
    }
  };

  /**
   * Check if two conditions overlap/intersect
   */
  const conditionsOverlap = (cond1: any, cond2: any): boolean => {
    const range1 = getConditionRange(cond1);
    const range2 = getConditionRange(cond2);
    
    if (!range1 || !range2) return false;
    
    return !(range1.max < range2.min || range2.max < range1.min);
  };

  /**
   * Detect all overlapping conditions in the queue
   */
  const detectQueueConflicts = useCallback(() => {
    if (!selectedQueueId) return [];

    // Get conditions from context
    const queueConditions = messageConditions.filter(
      (c) => c.queueId === selectedQueueId && !c.id?.startsWith('DEFAULT_')
    );

    if (queueConditions.length < 2) return [];

    const overlappingConditions = [];

    for (let i = 0; i < queueConditions.length; i++) {
      for (let j = i + 1; j < queueConditions.length; j++) {
        const cond1 = queueConditions[i];
        const cond2 = queueConditions[j];

        if (
          cond1.operator &&
          cond2.operator &&
          getConditionRange(cond1) &&
          getConditionRange(cond2) &&
          conditionsOverlap(cond1, cond2)
        ) {
          overlappingConditions.push({
            id1: cond1.id,
            id2: cond2.id,
            description: `تقاطع: ${getConditionText(cond1)} و ${getConditionText(cond2)}`
          });
        }
      }
    }

    return overlappingConditions;
  }, [selectedQueueId, messageConditions]);

  /**
   * Get human-readable condition text
   */
  const getConditionText = (cond: any): string => {
    const operatorMap: Record<string, string> = {
      'EQUAL': 'يساوي',
      'GREATER': 'أكثر من',
      'LESS': 'أقل من',
      'RANGE': 'نطاق',
    };

    const operatorText = operatorMap[cond.operator] || cond.operator;
    const valueText =
      cond.operator === 'RANGE' ? `${cond.minValue}-${cond.maxValue}` : cond.value;

    return `${operatorText} ${valueText}`;
  };

  /**
   * Check if there are any conflicts in the current queue
   */
  const hasQueueConflicts = useCallback(() => {
    return detectQueueConflicts().length > 0;
  }, [selectedQueueId]);

  /**
   * Toggle all patients - memoized
   */
  const toggleAllPatients = useCallback(() => {
    if (selectedPatients.length === patients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(patients.map((p) => p.id));
    }
  }, [selectedPatients.length, patients.length]);

  /**
   * Start editing queue position - memoized
   */
  const startEditingQueue = useCallback((patientId: string, currentPosition: number | undefined) => {
    setEditingQueueId(patientId);
    setEditingQueueValue((currentPosition || 0).toString());
  }, []);

  /**
   * Save queue edit - memoized
   * Updates patient position via API
   */
  const saveQueueEdit = useCallback(async (patientId: string) => {
    const newPosition = parseInt(editingQueueValue, 10);
    if (isNaN(newPosition) || newPosition < 1) {
      addToast('الترتيب يجب أن يكون رقم موجب', 'error');
      return;
    }
    
    try {
      const patientIdNum = Number(patientId);
      if (isNaN(patientIdNum)) {
        addToast('معرف المريض غير صالح', 'error');
        return;
      }
      
      await patientsApiClient.updatePatientPosition(patientIdNum, newPosition);
      setEditingQueueId(null);
      addToast('تم تحديث ترتيب الانتظار بنجاح', 'success');
      
      // Refetch patients
      if (typeof refreshPatients === 'function') {
        await refreshPatients();
      }
      window.dispatchEvent(new CustomEvent('patientDataUpdated'));
    } catch (err: any) {
      addToast(err?.message || 'فشل تحديث ترتيب الانتظار', 'error');
    }
  }, [editingQueueValue, addToast, refreshPatients]);

  /**
   * Cancel queue edit - memoized
   */
  const cancelQueueEdit = useCallback(() => {
    setEditingQueueId(null);
    setEditingQueueValue('');
  }, []);

  /**
   * Memoize table columns configuration
   */
  const tableColumns = useMemo(() => [
    { key: 'checkbox', label: '', width: '5%' },
    { key: 'queue', label: 'ترتيب الانتظار', width: '15%' },
    { key: 'name', label: 'الاسم', width: '25%' },
    { key: 'phone', label: 'رقم الجوال', width: '20%' },
    { key: 'actions', label: 'الإجراءات', width: '35%' },
  ], []);

  /**
   * Memoize table data rows - sorted by position
   */
  const tableRows = useMemo(() =>
    patients
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((patient) => ({
        id: patient.id,
        checkbox: (
          <input
            type="checkbox"
            checked={selectedPatients.includes(patient.id)}
            onChange={() => togglePatientSelection(patient.id)}
            className="w-4 h-4 rounded cursor-pointer"
          />
        ),
        queue:
          editingQueueId === patient.id ? (
            <div className="flex gap-1 items-center">
              <input
                type="number"
                value={editingQueueValue}
                onChange={(e) => setEditingQueueValue(e.target.value)}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                autoFocus
              />
              <button
                onClick={() => saveQueueEdit(patient.id)}
                className="bg-green-500 hover:bg-green-600 px-1 py-0.5 rounded text-xs text-white"
              >
                ✓
              </button>
              <button
                onClick={cancelQueueEdit}
                className="bg-red-500 hover:bg-red-600 px-1 py-0.5 rounded text-xs text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                #{patient.position || '-'}
              </span>
              <button
                onClick={() => startEditingQueue(patient.id, patient.position)}
                title="تعديل ترتيب الانتظار"
                className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-xs"
              >
                <i className="fas fa-edit"></i>
              </button>
            </div>
          ),
        name: patient.name,
        phone: formatPhoneForDisplay(patient.phone, patient.countryCode || '+20'),
        actions: (
          <div className="flex gap-2 justify-start">
            <button
              onClick={() => {
                const num = (patient.countryCode + patient.phone).replace(/[^0-9]/g, '');
                const url = `https://wa.me/${num}`;
                window.open(url, '_blank');
              }}
              title="فتح في واتساب"
              className="bg-green-50 text-green-600 hover:bg-green-100 px-2 py-1 rounded"
            >
              <i className="fab fa-whatsapp"></i>
            </button>
            <button
              onClick={() =>
                openModal('editPatient', {
                  patient,
                  onSave: (_updated: any) => {
                    // Patient updates now handled through API
                    // QueueContext will auto-refresh on next load
                  },
                })
              }
              title="تعديل"
              className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded"
            >
              <i className="fas fa-edit"></i>
            </button>
            <button
              onClick={async () => {
                const confirmed = await confirm(createDeleteConfirmation(patient.name));
                if (confirmed) {
                  try {
                    const patientId = Number(patient.id);
                    await patientsApiClient.deletePatient(patientId);
                    addToast('تم حذف المريض بنجاح', 'success');
                    // Refresh patients list from API
                    if (selectedQueueId) {
                      await refreshPatients(selectedQueueId);
                    }
                  } catch (error) {
                    logger.error('Error deleting patient:', error);
                    addToast('فشل حذف المريض', 'error');
                  }
                }
              }}
              title="حذف"
              className="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        ),
      })),
    [patients, selectedPatients, editingQueueId, editingQueueValue, togglePatientSelection, startEditingQueue, saveQueueEdit, cancelQueueEdit, openModal]
  );

  return (
    <PanelWrapper>
      <PanelHeader
        title={`لوحة التحكم الرئيسية ${queue ? `- ${queue.doctorName}` : ''}`}
        icon="fa-gauge-high"
        description="إدارة قائمة انتظار العيادة والمرضى"
        stats={[
          {
            label: 'إجمالي المرضى',
            value: patients.length.toString(),
            icon: 'fa-users',
          },
          {
            label: 'المحددون',
            value: selectedPatients.length.toString(),
            icon: 'fa-check-circle',
          },
        ]}
      />

      {/* Editable Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Current Queue Position (CQP) Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <i className="fas fa-layer-group text-blue-700 text-lg"></i>
              <span>الموضع الحالي (CQP)</span>
            </h3>
            {!isEditingCQP && (
              <button
                onClick={handleEditCQP}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-all shadow-md hover:shadow-lg text-sm font-medium"
                title="تعديل"
              >
                <i className="fas fa-pen-to-square mr-1"></i>
                <span>تعديل</span>
              </button>
            )}
          </div>
          {isEditingCQP ? (
            <div className="flex gap-2 items-end">
              <input
                type="number"
                value={currentCQP}
                onChange={(e) => setCurrentCQP(e.target.value)}
                className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleSaveCQP}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <i className="fas fa-check"></i>
              </button>
              <button
                onClick={handleCancelCQP}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ) : (
            <p className="text-3xl font-bold text-blue-700">{currentCQP}</p>
          )}
        </div>

        {/* Estimated Time per Session (ETS) Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <i className="fas fa-hourglass-end text-green-700 text-lg"></i>
              <span>الوقت المقدر لكل كشف (ETS)</span>
            </h3>
            {!isEditingETS && (
              <button
                onClick={handleEditETS}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-all shadow-md hover:shadow-lg text-sm font-medium"
                title="تعديل"
              >
                <i className="fas fa-pen-to-square mr-1"></i>
                <span>تعديل</span>
              </button>
            )}
          </div>
          {isEditingETS ? (
            <div className="flex gap-2 items-end">
              <input
                type="number"
                value={currentETS}
                onChange={(e) => setCurrentETS(e.target.value)}
                className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
              <span className="text-gray-600">دقيقة</span>
              <button
                onClick={handleSaveETS}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <i className="fas fa-check"></i>
              </button>
              <button
                onClick={handleCancelETS}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ) : (
            <p className="text-3xl font-bold text-green-700">{currentETS} دقيقة</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => openModal('addPatient')}
          className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 space-x-reverse"
        >
          <i className="fas fa-user-plus"></i>
          <span>إضافة مريض يدوياً</span>
        </button>

        <button
          onClick={() => openModal('upload')}
          className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 space-x-reverse"
        >
          <i className="fas fa-upload"></i>
          <span>رفع ملف المرضى</span>
        </button>

        <button
          onClick={async () => {
            if (selectedPatients.length === 0) {
              addToast('يرجى تحديد مريض واحد على الأقل', 'error');
              return;
            }
            const confirmed = await confirm(createBulkDeleteConfirmation(selectedPatients.length, 'مريض'));
            if (confirmed) {
              try {
                let deletedCount = 0;
                for (const patientId of selectedPatients) {
                  try {
                    const patientIdNum = Number(patientId);
                    if (!isNaN(patientIdNum)) {
                      await patientsApiClient.deletePatient(patientIdNum);
                      deletedCount++;
                    }
                  } catch (error) {
                    logger.error(`Failed to delete patient ${patientId}:`, error);
                  }
                }
                
                if (deletedCount > 0) {
                  addToast(`تم حذف ${deletedCount} مريض بنجاح`, 'success');
                  setSelectedPatients([]);
                  
                  // Refresh patients list from API
                  if (selectedQueueId) {
                    await refreshPatients(selectedQueueId);
                  }
                  
                  // Trigger a custom event to notify other components to refetch
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('patientDataUpdated'));
                  }, 100);
                } else {
                  addToast('فشل حذف المرضى', 'error');
                }
              } catch (error) {
                logger.error('Error during bulk delete:', error);
                addToast('حدث خطأ أثناء حذف المرضى', 'error');
              }
            }
          }}
          className="bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 space-x-reverse"
        >
          <i className="fas fa-trash"></i>
          <span>حذف ({selectedPatients.length})</span>
        </button>

        <button
          onClick={() => {
            // Check if there are conflicts - if yes, show toast and prevent sending
            if (hasQueueConflicts()) {
              addToast('هناك تضارب في الشروط. يرجى حل جميع التضاربات قبل الإرسال', 'error');
              return;
            }
            
            // Send to all patients (no need to select)
            if (patients.length === 0) {
              addToast('لا يوجد مرضى للإرسال إليهم', 'error');
              return;
            }

            const defaultTemplate = messageTemplates.find((t) => t.condition?.operator === 'DEFAULT');
            openModal('messagePreview', {
              selectedPatients: patients.map(p => p.id), // Send to ALL patients
              selectedPatientCount: patients.length,
              queueId: selectedQueueId,
              queueName: queue?.doctorName || 'طابور',
              currentCQP: parseInt(currentCQP),
              estimatedTimeRemaining: parseInt(currentETS),
              patients: patients, // All patients
              conditions: messageConditions,
              messageTemplate: defaultTemplate?.content || 'مرحباً بك {PN}',
              defaultTemplateId: defaultTemplate?.id,
            });
          }}
          className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 space-x-reverse"
          title="إرسال الرسائل لجميع المرضى"
        >
          <i className="fab fa-whatsapp"></i>
          <span>إرسال</span>
        </button>
      </div>

      {/* Selected Message Display - Collapsible */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl overflow-hidden shadow-md mb-6">
        {/* Collapsible Header */}
        <button
          onClick={() => setIsMessageSectionExpanded(!isMessageSectionExpanded)}
          className="w-full flex items-center justify-between hover:bg-blue-100 transition-colors px-6 py-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-200">
              <i className="fas fa-envelope text-blue-700 text-lg"></i>
            </div>
            <div className="text-right">
              <h3 className="font-bold text-gray-900 text-lg">إدارة شروط الرسائل</h3>
              <p className="text-sm text-gray-600">الرسالة الافتراضية والشروط المطبقة</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              onClick={(e) => {
                e.stopPropagation();
                openModal('manageConditions', {
                  templateId: null,
                  queueId: selectedQueueId,
                  queueName: queue?.doctorName || 'طابور',
                  currentConditions: messageConditions,
                  allConditions: messageConditions,
                  allTemplates: [], // Templates will be populated by the context
                  onSave: (_conditions: any) => {
                    // intentionally no-op
                  },
                });
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  openModal('manageConditions', {
                    templateId: null,
                    queueId: selectedQueueId,
                    queueName: queue?.doctorName || 'طابور',
                    currentConditions: messageConditions,
                    allConditions: messageConditions,
                    allTemplates: [], // Templates will be populated by the context
                    onSave: (_conditions: any) => {
                      // intentionally no-op
                    },
                  });
                }
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-semibold shadow-md hover:shadow-lg flex-shrink-0 cursor-pointer"
              title="إدارة شروط الرسائل"
            >
              <i className="fas fa-sliders-h"></i>
              <span>تحديث الشروط</span>
            </div>
            <i className={`fas fa-chevron-down text-blue-700 text-xl transition-transform duration-300 ${isMessageSectionExpanded ? 'rotate-180' : ''}`}></i>
          </div>
        </button>

        {/* Expanded Content */}
        {isMessageSectionExpanded && (
          <>
            <div className="border-t-2 border-blue-200"></div>
            <div className="px-6 py-4 space-y-6">
              {/* Check if default template exists */}
              {(() => {
                const defaultTemplate = messageTemplates.find((t) => t.condition?.operator === 'DEFAULT');
                const hasDefaultTemplate = !!defaultTemplate;

                if (!hasDefaultTemplate) {
                  return (
                    <div className="flex flex-col gap-4">
                      <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg px-4 py-3">
                        <div className="flex items-start gap-3">
                          <i className="fas fa-exclamation-triangle text-amber-600 mt-0.5 flex-shrink-0 text-lg"></i>
                          <div className="flex-1">
                            <h4 className="font-bold text-amber-900 mb-1">لم يتم تحديد رسالة افتراضية</h4>
                            <p className="text-sm text-amber-800 mb-2">
                              يجب إنشاء قالب رسالة بشرط افتراضي (DEFAULT) قبل تفعيل الرسائل الآلية
                            </p>
                            <p className="text-xs text-amber-700">
                              توجه إلى قسم <span className="font-semibold">الرسائل</span> في الشريط الجانبي لإنشاء قالب افتراضي
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Show conditions if they exist - load from context
                const queueConditions = messageConditions.filter((c) => c.queueId === selectedQueueId);
                const hasConditions = queueConditions && queueConditions.length > 0;

                // Get the actual default template text from messageTemplates
                const defaultTemplateText = defaultTemplate?.content || '';
                
                return (
                  <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-lg border border-blue-200 p-4 shadow-sm">
                      <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <i className="fas fa-message text-blue-600"></i>
                        الرسالة الافتراضية:
                      </h4>
                      {defaultTemplateText ? (
                        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                          <p className="text-gray-800 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                            {defaultTemplateText}
                          </p>
                          <p className="text-xs text-gray-600 mt-3 border-t border-blue-200 pt-3">
                            <i className="fas fa-info-circle text-blue-500 ml-1"></i>
                            المتغيرات المتاحة: {'{PN}'} = اسم المريض، {'{PQP}'} = موضع المريض، {'{CQP}'} = الموضع الحالي، {'{ETR}'} = الوقت المتبقي
                          </p>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg px-4 py-3">
                          <div className="flex items-start gap-3">
                            <i className="fas fa-exclamation-triangle text-amber-600 mt-0.5 flex-shrink-0"></i>
                            <div className="flex-1">
                              <p className="text-sm text-amber-800 font-semibold">
                                لم يتم تحميل نص الرسالة الافتراضية
                              </p>
                              <p className="text-xs text-amber-700 mt-1">
                                يرجى التحقق من إعدادات الشروط أو إعادة تحميل الصفحة
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {hasConditions && (
                      <div className="bg-white rounded-lg border border-green-200 p-4 shadow-sm">
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <i className="fas fa-filter text-green-600"></i>
                          الشروط المطبقة:
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-200 text-green-700 text-xs font-bold ml-1">
                            {queueConditions.length}
                          </span>
                        </h4>
                        <div className="space-y-2">
                          {queueConditions.map((condition, idx) => (
                            <div key={idx} className="flex items-start gap-3 bg-green-50 rounded-lg p-3 border border-green-100 hover:border-green-300 hover:bg-green-100 transition-colors">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-300 text-green-900 text-xs font-bold flex-shrink-0">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900">
                                  {condition.name || 'شرط بدون عنوان'}
                                </p>
                                <p className="text-xs text-gray-700 mt-1">
                                  {condition.operator === 'EQUAL' && `✓ يساوي: ${condition.value}`}
                                  {condition.operator === 'GREATER' && `✓ أكبر من: ${condition.value}`}
                                  {condition.operator === 'LESS' && `✓ أقل من: ${condition.value}`}
                                  {(condition.operator as string) === 'RANGE' && `✓ نطاق: من ${(condition as any).minValue} إلى ${(condition as any).maxValue}`}
                                  {(condition.operator as string) === 'DEFAULT' && `✓ قالب افتراضي`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {/* Conflict Warning Section */}
      {(() => {
        const conflicts = detectQueueConflicts();
        return conflicts.length > 0 ? (
          <div className="mb-6">
            <ConflictWarning 
              overlappingConditions={conflicts}
              hasDefaultConflict={false}
            />
          </div>
        ) : null;
      })()}


      {/* Patients Table */}
      {patients.length === 0 ? (
        <EmptyState
          icon="fa-users"
          title="لا يوجد مرضى"
          message="لم يتم إضافة أي مريض بعد. ابدأ بإضافة مريض جديد"
          actionLabel="إضافة مريض"
          onAction={() => openModal('addPatient')}
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                onClick={toggleAllPatients}
                className="relative w-5 h-5 border-2 rounded cursor-pointer transition-all"
                style={{
                  borderColor: selectedPatients.length === 0 ? '#d1d5db' : selectedPatients.length === patients.length ? '#3b82f6' : '#f59e0b',
                  backgroundColor: selectedPatients.length === 0 ? 'white' : selectedPatients.length === patients.length ? '#3b82f6' : '#fef3c7',
                }}
                title={selectedPatients.length === 0 ? 'تحديد الكل' : selectedPatients.length === patients.length ? 'إلغاء التحديد' : 'تحديد الكل'}
              >
                {selectedPatients.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i
                      className={`fas text-white text-xs ${
                        selectedPatients.length === patients.length ? 'fa-check' : 'fa-minus'
                      }`}
                    ></i>
                  </div>
                )}
              </div>
              <h3 className="font-bold text-gray-800">قائمة المرضى</h3>
              <span className="text-sm text-gray-600">
                {selectedPatients.length} من {patients.length} محدد
              </span>
            </div>
            {selectedPatients.length > 0 && (
              <button
                onClick={() => setSelectedPatients([])}
                className="text-sm text-red-600 hover:text-red-800"
              >
                إلغاء التحديد
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {tableColumns.map((col) => (
                    <th
                      key={col.key}
                      style={{ width: col.width }}
                      className="px-6 py-3 text-right text-sm font-semibold text-gray-700"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b hover:bg-gray-50 transition-colors ${
                      selectedPatients.includes(row.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-6 py-3 text-sm">{row.checkbox}</td>
                    <td className="px-6 py-3 text-sm">{row.queue}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{row.phone}</td>
                    <td className="px-6 py-3 text-sm">{row.actions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Box */}
      <UsageGuideSection 
        items={guideItems}
      />
    </PanelWrapper>
  );
}
