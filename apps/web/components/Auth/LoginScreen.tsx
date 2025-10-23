'use client';

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { TEST_CREDENTIALS } from '../../constants';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('يرجى ملء جميع الحقول');
      return;
    }

    const success = login(username, password);
    if (!success) {
      setError('بيانات تسجيل الدخول غير صحيحة');
    }
  };

  const handleQuickLogin = (username: string, password: string) => {
    const success = login(username, password);
    if (success) {
      setError('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-clinic-medical text-blue-600 text-3xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">نظام إدارة العيادات</h1>
          <p className="text-gray-600">تسجيل الدخول إلى النظام</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اسم المستخدم
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit(e as any);
                }
              }}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium"
          >
            تسجيل الدخول
          </button>
        </form>

        {/* Test Credentials Info */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-4 font-medium">للتجربة، استخدم أحد الحسابات التالية:</p>
          <div className="space-y-2 text-xs">
            {Object.entries(TEST_CREDENTIALS).map(([key, cred]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleQuickLogin(cred.username, cred.password)}
                className="w-full p-2 text-left bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{cred.username}</p>
                    <p className="text-gray-600">{cred.password}</p>
                  </div>
                  <i className="fas fa-arrow-left text-blue-600"></i>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
