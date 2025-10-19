const en = require('../locales/en.json')
const ar = require('../locales/ar.json')

let current = 'ar'
try{
  if (typeof window !== 'undefined'){
    const stored = localStorage.getItem('locale')
    if (stored) current = stored
    else {
      const nav = navigator.language || navigator.userLanguage || 'ar'
      current = nav.startsWith('en') ? 'en' : 'ar'
    }
  }
}catch(e){}

const bundles = { en, ar }

export function setLocale(l){
  if (!bundles[l]) return
  current = l
  try{ localStorage.setItem('locale', l) }catch(e){}
}
export function getLocale(){ return current }

export function t(key, vars){
  const buf = bundles[current] && bundles[current][key] ? bundles[current][key] : (bundles['en'][key] ?? key)
  if (!vars) return buf
  return buf.replace(/\{\{(.*?)\}\}/g, (_, k)=> vars[k.trim()] ?? '')
}

export function getDir(){ return current === 'ar' ? 'rtl' : 'ltr' }

export default { t, setLocale, getLocale }
