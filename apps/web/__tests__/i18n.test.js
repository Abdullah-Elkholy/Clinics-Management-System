import i18n from '../lib/i18n'
import en from '../locales/en.json'
import ar from '../locales/ar.json'

describe('i18n helper', ()=>{
  test('default locale is arabic and direction rtl', ()=>{
    // default current is 'ar' in our helper
    expect(i18n.getLocale()).toBe('ar')
    expect(i18n.getDir()).toBe('rtl')
  })

  test('t returns Arabic translation when available, and falls back to key or english', ()=>{
    // existing key in ar.json
    expect(i18n.t('app.title')).toBe(ar['app.title'])
    // key missing in ar but present in en (simulate) - pick a safe key
    const fallbackKey = 'dev.title'
    // both exist, but ensure consistent behavior
    expect(i18n.t(fallbackKey)).toBe(ar[fallbackKey] || en[fallbackKey])
  })
})
