const en = require('../locales/en.json')
const ar = require('../locales/ar.json')

const bundles = { en, ar }

// default language used on the server until the client initializes
let current = 'ar'

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

// Client-only init to read navigator/localStorage safely and avoid
// changing `current` at module-evaluation time which causes hydration
// mismatches between server and client HTML.
export function initLocaleFromBrowser(){
  try{
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('locale')
    if (stored && bundles[stored]) { current = stored; return }
    const nav = navigator.language || navigator.userLanguage || 'ar'
    current = nav.startsWith('en') ? 'en' : 'ar'
  }catch(e){}
}

export default { t, setLocale, getLocale, initLocaleFromBrowser }
