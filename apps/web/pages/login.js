import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useLogin } from '../lib/hooks'
import { showToast } from '../lib/toast'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const i18n = useI18n()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const loginMutation = useLogin()

  const handleLogin = async (e) => {
    e.preventDefault()
    loginMutation.mutate(
      { username, password },
      {
        onSuccess: (data) => {
          if (data?.data?.accessToken) {
            login(data.data.accessToken)
            showToast(i18n.t('login.success', 'تم تسجيل الدخول بنجاح'))
            router.push('/dashboard')
          } else {
            showToast(i18n.t('login.fail', 'فشل تسجيل الدخول'), 'error')
          }
        },
        onError: () => {
          showToast(i18n.t('login.fail', 'فشل تسجيل الدخول'), 'error')
        },
      }
    )
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <div className="max-w-md w-full mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {i18n.t('login.title', 'تسجيل الدخول')}
            </h1>
          </div>
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-gray-700 block mb-2"
                >
                  {i18n.t('login.username', 'اسم المستخدم')}
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700 block mb-2"
                >
                  {i18n.t('login.password', 'كلمة المرور')}
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loginMutation.isPending
                    ? i18n.t('login.loading', 'جارٍ تسجيل الدخول...')
                    : i18n.t('login.submit', 'تسجيل الدخول')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
