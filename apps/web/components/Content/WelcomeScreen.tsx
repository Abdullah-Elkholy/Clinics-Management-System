'use client';

export default function WelcomeScreen() {
  return (
    <div className="p-8 text-center h-full flex items-center justify-center">
      <div className="max-w-md">
        <div className="bg-blue-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-clinic-medical text-blue-600 text-4xl"></i>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">مرحباً بك في نظام إدارة العيادات</h2>
        <p className="text-gray-600 mb-6">اختر من القائمة الجانبية للبدء في إدارة الطوابير والرسائل</p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <i className="fas fa-info-circle ml-2"></i>
          <span>يمكنك اختيار طابور من القائمة لعرض تفاصيله وإدارة المرضى</span>
        </div>
      </div>
    </div>
  );
}
