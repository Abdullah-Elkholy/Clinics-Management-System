import React, { createContext, useContext } from 'react'

const bundles = {
  en: require('../locales/en.json'),
  ar: require('../locales/ar.json'),
}

const I18nContext = createContext()

const getInitialLocale = () => {
  if (typeof window === 'undefined') return 'ar'
  try {
    const stored = localStorage.getItem('locale')
    if (stored && bundles[stored]) {
      return stored
    }
  } catch (e) {
    // ignore
  }
  const nav = navigator.language || navigator.userLanguage || 'ar'
  return nav.startsWith('en') ? 'en' : 'ar'
}

export class I18nProvider extends React.Component {
  state = {
    locale: getInitialLocale(),
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
    const bundle = bundles[locale] || bundles.en
    let text = bundle[key] || defaultText || key
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
