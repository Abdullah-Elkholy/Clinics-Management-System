'use client';

import { useQueue } from '../../contexts/QueueContext';
import { useModal } from '../../contexts/ModalContext';
import { useState } from 'react';

// Sample patient data
const SAMPLE_PATIENTS = [
  { id: 1, name: 'أحمد محمد', phone: '+201012345678', queue: 3 },
  { id: 2, name: 'فاطمة علي', phone: '+201087654321', queue: 5 },
  { id: 3, name: 'محمود حسن', phone: '+201098765432', queue: 2 },
  { id: 4, name: 'نور الدين', phone: '+201011223344', queue: 7 },
  { id: 5, name: 'سارة إبراهيم', phone: '+201055667788', queue: 1 },
];

export default function QueueDashboard() {
  const { selectedQueueId, queues } = useQueue();
  const { openModal } = useModal();
  const [isEditingName, setIsEditingName] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [isEditingCQP, setIsEditingCQP] = useState(false);
  const [currentCQP, setCurrentCQP] = useState('3');
  const [isEditingETS, setIsEditingETS] = useState(false);
  const [currentETS, setCurrentETS] = useState('15');
  const [selectedPatients, setSelectedPatients] = useState<number[]>([]);
  const queue = queues.find((q) => q.id === selectedQueueId);

  const handleEditName = () => {
    if (queue) {
      setDoctorName(queue.doctorName);
      setIsEditingName(true);
    }
  };

  const handleSaveName = () => {
    if (doctorName.trim() && queue) {
      // Update queue name through context if available
      setIsEditingName(false);
    }
  };

  const handleEditCQP = () => {
    setIsEditingCQP(true);
  };

  const handleSaveCQP = () => {
    if (currentCQP.trim()) {
      setIsEditingCQP(false);
      // Save CQP value
    }
  };

  const handleEditETS = () => {
    setIsEditingETS(true);
  };

  const handleSaveETS = () => {
    if (currentETS.trim()) {
      setIsEditingETS(false);
      // Save ETS value
    }
  };

  const togglePatientSelection = (id: number) => {
    setSelectedPatients((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAllPatients = () => {
    if (selectedPatients.length === SAMPLE_PATIENTS.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(SAMPLE_PATIENTS.map((p) => p.id));
    }
  };

  return (
    <div className="p-6">
      <div className="bg-gradient-to-l from-blue-600 to-purple-600 text-white p-6 rounded-xl mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {isEditingName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="px-3 py-1 text-gray-800 rounded"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded text-sm"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold">{queue?.doctorName}</h2>
                  <button
                    onClick={handleEditName}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-1 rounded text-sm"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                </>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-blue-100">
              <div>
                <p className="text-sm">عدد المرضى</p>
                <p className="text-xl font-bold">15</p>
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm">الموضع الحالي (CQP)</p>
                  {isEditingCQP ? (
                    <div className="flex gap-1 mt-1">
                      <input
                        type="number"
                        value={currentCQP}
                        onChange={(e) => setCurrentCQP(e.target.value)}
                        className="w-16 px-2 py-1 text-gray-800 rounded text-sm"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveCQP}
                        className="bg-green-500 hover:bg-green-600 px-2 py-1 rounded text-xs"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setIsEditingCQP(false)}
                        className="bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xl font-bold">{currentCQP}</p>
                      <button
                        onClick={handleEditCQP}
                        className="bg-white bg-opacity-20 hover:bg-opacity-30 px-1 py-0.5 rounded text-xs"
                        title="تعديل CQP"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm">الوقت المقدر للجلسة (ETS)</p>
                  {isEditingETS ? (
                    <div className="flex gap-1 mt-1 items-center">
                      <input
                        type="number"
                        value={currentETS}
                        onChange={(e) => setCurrentETS(e.target.value)}
                        className="w-16 px-2 py-1 text-gray-800 rounded text-sm"
                        autoFocus
                      />
                      <span className="text-sm">دقيقة</span>
                      <button
                        onClick={handleSaveETS}
                        className="bg-green-500 hover:bg-green-600 px-2 py-1 rounded text-xs"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setIsEditingETS(false)}
                        className="bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xl font-bold">{currentETS}</p>
                      <span className="text-sm">دقيقة</span>
                      <button
                        onClick={handleEditETS}
                        className="bg-white bg-opacity-20 hover:bg-opacity-30 px-1 py-0.5 rounded text-xs"
                        title="تعديل ETS"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="text-left">
            <div className="bg-white bg-opacity-20 px-4 py-2 rounded-lg">
              <i className="fas fa-users text-2xl"></i>
            </div>
          </div>
        </div>
      </div>

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
        
        <button className="bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 space-x-reverse">
          <i className="fas fa-trash"></i>
          <span>حذف المحدد</span>
        </button>
        
        <button 
          onClick={() => openModal('messagePreview')}
          className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 space-x-reverse"
        >
          <i className="fab fa-whatsapp"></i>
          <span>إرسال للمحدد</span>
        </button>
      </div>

      {/* Selected Message Display with Edit Button */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 mb-2">الرسالة الافتراضية المحددة:</h3>
          <p className="text-gray-700">مرحباً {'{PN}'}، ترتيبك {'{PQP}'} والموضع الحالي {'{CQP}'}، الوقت المتبقي المقدر {'{ETR}'} دقيقة</p>
        </div>
        <button 
          onClick={() => openModal('messageSelection')}
          className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center ml-4 flex-shrink-0"
          title="تغيير الرسالة"
        >
          <i className="fas fa-edit"></i>
        </button>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-gray-800">قائمة المرضى</h3>
            <span className="text-sm text-gray-600">
              {selectedPatients.length} من {SAMPLE_PATIENTS.length} محدد
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
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-12">
                  <input
                    type="checkbox"
                    checked={selectedPatients.length === SAMPLE_PATIENTS.length && SAMPLE_PATIENTS.length > 0}
                    onChange={toggleAllPatients}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">الاسم</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">رقم الجوال</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">ترتيب الانتظار</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_PATIENTS.map((patient, idx) => (
                <tr
                  key={patient.id}
                  className={`border-b hover:bg-gray-50 transition-colors ${
                    selectedPatients.includes(patient.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedPatients.includes(patient.id)}
                      onChange={() => togglePatientSelection(patient.id)}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{patient.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{patient.phone}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                      #{patient.queue}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {SAMPLE_PATIENTS.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <i className="fas fa-inbox text-4xl mb-3"></i>
            <p>لا يوجد مرضى في هذه العيادة</p>
          </div>
        )}
      </div>
    </div>
  );
}
