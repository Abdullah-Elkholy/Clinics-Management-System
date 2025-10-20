import React, { createContext, useContext } from 'react'

const bundles = {
  en: require('../locales/en.json'),
  ar: require('../locales/ar.json'),
}

const I18nContext = createContext()

const getInitialLocale = () => {
  // Always return 'ar' as the default to prevent hydration mismatches
  // Client-side locale switching happens after hydration
  if (typeof window === 'undefined') return 'ar'
  
  // On client, still default to 'ar' initially to match server
  // The locale will be updated after mount if needed
  return 'ar'
}

export class I18nProvider extends React.Component {
  constructor(props){
    super(props)
    this.state = { locale: props.initialLocale || getInitialLocale() }
  }

  componentDidMount() {
    // After hydration, check for stored locale preference
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locale')
        if (stored && bundles[stored] && stored !== this.state.locale) {
          this.setState({ locale: stored })
        }
      } catch (e) {
        // ignore
      }
    }
  }

  setLocale = (locale) => {
    if (!bundles[locale]) return
    this.setState({ locale })
    try {
      localStorage.setItem('locale', locale)
    } catch (e) {
      // ignore
    }
  }

  t = (key, defaultText, options) => {
    const { locale } = this.state
    const bundle = bundles[locale] || bundles.ar
    // Try current locale first, then fallback to Arabic, then defaultText, then key
    let text = bundle[key] || bundles.ar[key] || defaultText || key
    if (options) {
      text = Object.entries(options).reduce(
        (acc, [optKey, optVal]) => acc.replace(`{${optKey}}`, optVal),
        text
      )
    }
    return text
  }

  getDir = () => (this.state.locale === 'ar' ? 'rtl' : 'ltr')

  getLocale = () => this.state.locale

  render() {
    const value = {
      t: this.t,
      setLocale: this.setLocale,
      getLocale: this.getLocale,
      getDir: this.getDir,
      locale: this.state.locale,
    }
    return (
      <I18nContext.Provider value={value}>
        {this.props.children}
      </I18nContext.Provider>
    )
  }
}

export const useI18n = () => {
  return useContext(I18nContext)
}
