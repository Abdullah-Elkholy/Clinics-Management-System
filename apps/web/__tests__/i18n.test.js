import React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { useI18n, I18nProvider } from '../lib/i18n'
import en from '../locales/en.json'
import ar from '../locales/ar.json'

const TestComponent = () => {
  const i18n = useI18n()
  return (
    <div>
      <span data-testid="locale">{i18n.getLocale()}</span>
      <span data-testid="dir">{i18n.getDir()}</span>
      <span data-testid="title">{i18n.t('app.title')}</span>
      <span data-testid="fallback">{i18n.t('dev.title')}</span>
    </div>
  )
}

describe('i18n hook and provider', () => {
  test('default locale is arabic and direction rtl', () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    )
    expect(screen.getByTestId('locale')).toHaveTextContent('ar')
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl')
  })

  test('t returns Arabic translation when available, and falls back to key or english', () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    )
    expect(screen.getByTestId('title')).toHaveTextContent(ar['app.title'])
    expect(screen.getByTestId('fallback')).toHaveTextContent(en['dev.title'])
  })

  test('setLocale changes the locale', async () => {
    const TestComponentWithButton = () => {
      const i18n = useI18n()
      return (
        <div>
          <span data-testid="locale">{i18n.getLocale()}</span>
          <button onClick={() => i18n.setLocale('en')}>Set English</button>
        </div>
      )
    }

    render(
      <I18nProvider>
        <TestComponentWithButton />
      </I18nProvider>
    )

    expect(screen.getByTestId('locale')).toHaveTextContent('ar')

    await act(async () => {
      fireEvent.click(screen.getByText('Set English'))
    })

    expect(screen.getByTestId('locale')).toHaveTextContent('en')
  })
})
