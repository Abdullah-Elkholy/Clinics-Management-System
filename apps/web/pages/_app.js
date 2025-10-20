import React, { useEffect, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import queryClient from '../lib/queryClient'
import '../styles/globals.css'
import { initAuth } from '../lib/api'
import i18n from '../lib/i18n'

export default function App({ Component, pageProps }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    initAuth()
  }, [])

  // initialize locale on the client after mount to avoid hydration mismatch
  useEffect(() => {
    i18n.initLocaleFromBrowser()
    // toggle a state to force re-render so components pick up the correct locale/dir
    setReady(r => !r)
  }, [])

  // render normally; components will re-render immediately after client init
  return (
    <QueryClientProvider client={queryClient}>
      <Component {...pageProps} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
