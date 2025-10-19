import React, { useState } from 'react'
import i18n from '../lib/i18n'

export default function DevI18n(){
  const [locale, setLocale] = useState(i18n.getLocale())
  function switchTo(l){ i18n.setLocale(l); setLocale(i18n.getLocale()) }
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">i18n dev helper</h1>
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={()=>switchTo('en')} className="px-3 py-2 bg-slate-800 text-white rounded">English</button>
        <button type="button" onClick={()=>switchTo('ar')} className="px-3 py-2 bg-slate-800 text-white rounded">العربية</button>
      </div>

      <div className="space-y-2">
        <div><strong>locale:</strong> {locale}</div>
        <div><strong>app.title:</strong> {i18n.t('app.title')}</div>
        <div><strong>login.title:</strong> {i18n.t('login.title')}</div>
        <div><strong>login.username:</strong> {i18n.t('login.username')}</div>
        <div><strong>users.title:</strong> {i18n.t('users.title')}</div>
      </div>
    </div>
  )
}
