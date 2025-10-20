import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import queryClient from '../lib/queryClient'
import '../styles/globals.css'
import { I18nProvider } from '../lib/i18n'
import { AuthProvider } from '../lib/auth'
import Toast from '../components/Toast'

export default function App({ Component, pageProps }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <Component {...pageProps} />
          <Toast />
        </AuthProvider>
      </I18nProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
