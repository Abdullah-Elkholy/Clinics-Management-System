'use client';

import { useState } from 'react';

export default function FailedTasksPanel() {
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);

  // Sample data - this will be connected to actual data from API
  const failedTasks = [
    {
      id: 1,
      queueName: 'د. أحمد محمد',
      failedCount: 3,
      totalPatients: 10,
      failureReason: 'خطأ في رقم الجوال',
      failedTime: '09:15 AM',
      retryCount: 1,
    },
    {
      id: 2,
      queueName: 'د. فاطمة علي',
      failedCount: 2,
      totalPatients: 8,
      failureReason: 'انقطاع الاتصال',
      failedTime: '09:45 AM',
      retryCount: 0,
    },
    {
      id: 3,
      queueName: 'د. محمود حسن',
      failedCount: 5,
      totalPatients: 15,
      failureReason: 'حد الرسائل اليومي',
      failedTime: '10:30 AM',
      retryCount: 2,
    },
  ];

  const toggleTaskSelection = (id: number) => {
    setSelectedTasks((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAllTasks = () => {
    if (selectedTasks.length === failedTasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(failedTasks.map((task) => task.id));
    }
  };

  const handleRetrySelected = () => {
    console.log('Retrying failed tasks:', selectedTasks);
    // Will implement retry logic here
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">المهام الفاشلة</h1>
      <p className="text-gray-600 mb-6">عرض وإدارة المهام التي فشلت والتي تحتاج إلى إعادة محاولة</p>

      {failedTasks.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedTasks.length === failedTasks.length}
              onChange={toggleAllTasks}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-700">تحديد الكل</span>
          </label>

          {selectedTasks.length > 0 && (
            <button
              onClick={handleRetrySelected}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-redo"></i>
              <span>إعادة محاولة ({selectedTasks.length})</span>
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-red-50 border-b">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 w-12">
                <input
                  type="checkbox"
                  checked={selectedTasks.length === failedTasks.length && failedTasks.length > 0}
                  onChange={toggleAllTasks}
                  className="w-4 h-4 rounded"
                />
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                اسم العيادة/الطبيب
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                عدد الفاشل
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                سبب الفشل
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                وقت الفشل
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                محاولات إعادة
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody>
            {failedTasks.map((task) => (
              <tr
                key={task.id}
                className={`border-b hover:bg-gray-50 transition-colors ${
                  selectedTasks.includes(task.id) ? 'bg-red-50' : ''
                }`}
              >
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(task.id)}
                    onChange={() => toggleTaskSelection(task.id)}
                    className="w-4 h-4 rounded"
                  />
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 font-medium">{task.queueName}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full">
                    {task.failedCount}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-exclamation-circle text-red-500"></i>
                    {task.failureReason}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{task.failedTime}</td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`px-3 py-1 rounded-full ${
                      task.retryCount > 0
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {task.retryCount}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button className="text-orange-600 hover:text-orange-800 font-medium">
                    <i className="fas fa-redo ml-1"></i>
                    إعادة
                  </button>
                  <button className="text-blue-600 hover:text-blue-800 font-medium">
                    <i className="fas fa-eye ml-1"></i>
                    تفاصيل
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {failedTasks.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <i className="fas fa-check-circle text-4xl text-green-500 mb-4"></i>
            <p className="text-lg">لا توجد مهام فاشلة - جميع المهام تعمل بشكل صحيح!</p>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">إجمالي المهام الفاشلة</p>
              <p className="text-3xl font-bold mt-2">{failedTasks.length}</p>
            </div>
            <i className="fas fa-exclamation-circle text-4xl opacity-20"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">إجمالي الرسائل الفاشلة</p>
              <p className="text-3xl font-bold mt-2">
                {failedTasks.reduce((sum, task) => sum + task.failedCount, 0)}
              </p>
            </div>
            <i className="fas fa-times-circle text-4xl opacity-20"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">معدل النجاح</p>
              <p className="text-3xl font-bold mt-2">
                {failedTasks.length > 0
                  ? Math.round(
                      ((failedTasks.reduce((sum, task) => sum + task.totalPatients, 0) -
                        failedTasks.reduce((sum, task) => sum + task.failedCount, 0)) /
                        failedTasks.reduce((sum, task) => sum + task.totalPatients, 0)) *
                        100
                    )
                  : 100}
                %
              </p>
            </div>
            <i className="fas fa-chart-pie text-4xl opacity-20"></i>
          </div>
        </div>
      </div>
    </div>
  );
}
