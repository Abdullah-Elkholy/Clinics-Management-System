'use client';

import { useState } from 'react';
import { useQueue } from '../../contexts/QueueContext';

export default function PatientsTable() {
  const {
    patients,
    togglePatientSelection,
    selectAllPatients,
    clearPatientSelection,
  } = useQueue();

  const [allSelected, setAllSelected] = useState(false);

  const handleSelectAll = () => {
    if (allSelected) {
      clearPatientSelection();
    } else {
      selectAllPatients();
    }
    setAllSelected(!allSelected);
  };

  const selectedCount = patients.filter((p) => p.selected).length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">قائمة المرضى</h3>
          <div className="flex items-center space-x-2 space-x-reverse">
            <input
              type="checkbox"
              id="selectAll"
              checked={allSelected}
              onChange={handleSelectAll}
              className="rounded cursor-pointer"
            />
            <label htmlFor="selectAll" className="text-sm text-gray-600 cursor-pointer">
              تحديد الكل
            </label>
          </div>
        </div>
      </div>

      {/* Table */}
      {patients.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <i className="fas fa-inbox text-4xl text-gray-300 mb-4 block"></i>
          <p className="text-gray-600">لا توجد مرضى حالياً</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تحديد</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الترتيب</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الاسم الكامل</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">رقم الهاتف</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {patients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={patient.selected || false}
                      onChange={() => togglePatientSelection(patient.id)}
                      className="rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{patient.position}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{patient.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{patient.countryCode} {patient.phone}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex space-x-2 space-x-reverse">
                      <button className="text-blue-600 hover:text-blue-700">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button className="text-red-600 hover:text-red-700">
                        <i className="fas fa-trash"></i>
                      </button>
                      <button className="text-green-600 hover:text-green-700">
                        <i className="fab fa-whatsapp"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Stats */}
      {patients.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
          إجمالي: {patients.length} مريض | محدد: {selectedCount}
        </div>
      )}
    </div>
  );
}
