import React from 'react'
import '../styles/globals.css'
import { useEffect } from 'react'
import { initAuth } from '../lib/api'

export default function App({ Component, pageProps }) {
  useEffect(()=>{ initAuth() }, [])
  return <Component {...pageProps} />
}
