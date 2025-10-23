'use client';

export default function OngoingTasksPanel() {
  // Sample data - this will be connected to actual data from API
  const ongoingTasks = [
    {
      id: 1,
      queueName: 'د. أحمد محمد',
      patientsCount: 5,
      sentCount: 2,
      status: 'جاري',
      startTime: '10:30 AM',
    },
    {
      id: 2,
      queueName: 'د. فاطمة علي',
      patientsCount: 8,
      sentCount: 5,
      status: 'جاري',
      startTime: '10:45 AM',
    },
    {
      id: 3,
      queueName: 'د. محمود حسن',
      patientsCount: 3,
      sentCount: 1,
      status: 'جاري',
      startTime: '11:00 AM',
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">المهام الجارية</h1>
      <p className="text-gray-600 mb-6">مراقبة وإدارة جميع المهام الجارية حالياً</p>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                اسم العيادة/الطبيب
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                إجمالي المرضى
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                تم الإرسال
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                الحالة
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                وقت البدء
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody>
            {ongoingTasks.map((task) => (
              <tr key={task.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-900">{task.queueName}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                    {task.patientsCount}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                    {task.sentCount}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full flex items-center w-fit">
                    <i className="fas fa-spinner fa-spin ml-2"></i>
                    {task.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{task.startTime}</td>
                <td className="px-6 py-4 text-sm">
                  <button className="text-blue-600 hover:text-blue-800 font-medium">
                    <i className="fas fa-eye ml-1"></i>
                    عرض التفاصيل
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {ongoingTasks.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <i className="fas fa-inbox text-4xl mb-4"></i>
            <p>لا توجد مهام جارية حالياً</p>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">إجمالي المهام الجارية</p>
              <p className="text-3xl font-bold mt-2">{ongoingTasks.length}</p>
            </div>
            <i className="fas fa-tasks text-4xl opacity-20"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">إجمالي الرسائل المرسلة</p>
              <p className="text-3xl font-bold mt-2">
                {ongoingTasks.reduce((sum, task) => sum + task.sentCount, 0)}
              </p>
            </div>
            <i className="fas fa-check-circle text-4xl opacity-20"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">إجمالي المرضى المتبقيين</p>
              <p className="text-3xl font-bold mt-2">
                {ongoingTasks.reduce((sum, task) => sum + (task.patientsCount - task.sentCount), 0)}
              </p>
            </div>
            <i className="fas fa-users text-4xl opacity-20"></i>
          </div>
        </div>
      </div>
    </div>
  );
}
