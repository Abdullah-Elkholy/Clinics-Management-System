import React from 'react'
import Icon from './Icon'
import { useAuthorization } from '../lib/authorization'

export default function ManagementPanel({ onOpenQuotas, onOpenWhatsApp, onOpenTemplates, onOpenUsers }){
  const { canManageUsers, canManageQuotas, canManageWhatsApp, canManageTemplates } = useAuthorization()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {canManageUsers && (
        <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col justify-between transform hover:-translate-y-1 transition duration-200 animate-slide-in">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-2xl">
              <Icon name="fas fa-users" />
            </div>
            <div className="text-right">
              <h3 className="text-lg font-semibold">المستخدمون</h3>
              <p className="text-sm text-gray-500 mt-1">إدارة المستخدمين، الصلاحيات وتغيير كلمات المرور</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={onOpenUsers} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">فتح المستخدمين</button>
            <div className="text-sm text-gray-500">إجمالي المستخدمين: —</div>
          </div>
        </div>
      )}

      {canManageQuotas && (
        <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col justify-between transform hover:-translate-y-1 transition duration-200 animate-slide-in">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-yellow-50 flex items-center justify-center text-yellow-600 text-2xl">
              <Icon name="fas fa-sliders-h" />
            </div>
            <div className="text-right">
              <h3 className="text-lg font-semibold">الحصص والإعدادات</h3>
              <p className="text-sm text-gray-500 mt-1">إعدادات الحصص وحدود الاستخدام</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={onOpenQuotas} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">إدارة الحصص</button>
            <div className="text-sm text-gray-500">آخر تعديل: —</div>
          </div>
        </div>
      )}

      {canManageWhatsApp && (
        <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col justify-between transform hover:-translate-y-1 transition duration-200 animate-slide-in">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-green-50 flex items-center justify-center text-green-600 text-2xl">
              <Icon name="fab fa-whatsapp" />
            </div>
            <div className="text-right">
              <h3 className="text-lg font-semibold">واتساب</h3>
              <p className="text-sm text-gray-500 mt-1">ربط ومراقبة حالة اتصال واتساب</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={onOpenWhatsApp} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">فتح واتساب</button>
            <div className="text-sm text-gray-500">الحالة: غير متصل</div>
          </div>
        </div>
      )}

      {canManageTemplates && (
        <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col justify-between md:col-span-3 transform hover:-translate-y-1 transition duration-200 animate-slide-in">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 text-2xl">
              <Icon name="fas fa-file-alt" />
            </div>
            <div className="text-right">
              <h3 className="text-lg font-semibold">قوالب الرسائل</h3>
              <p className="text-sm text-gray-500 mt-1">استعراض، تحرير وإنشاء قوالب الرسائل</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={onOpenTemplates} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">ادارة القوالب</button>
            <div className="text-sm text-gray-500">قوالب محفوظة: { /* dynamic count could go here */ } —</div>
          </div>
        </div>
      )}
    </div>
  )
}
