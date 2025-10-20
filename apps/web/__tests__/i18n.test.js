import React from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'

// Unmock the i18n module for this test since we want to test the real implementation
jest.unmock('../lib/i18n')

import { useI18n, I18nProvider } from '../lib/i18n'
import en from '../locales/en.json'
import ar from '../locales/ar.json'
import { renderWithProviders } from '../test-utils/renderWithProviders'

const TestComponent = () => {
  const i18n = useI18n()
  return (
    <div>
      <span data-testid="locale">{i18n.getLocale()}</span>
      <span data-testid="dir">{i18n.getDir()}</span>
      <span data-testid="title">{i18n.t('app.title')}</span>
      <span data-testid="existing">{i18n.t('dev.title')}</span>
      <span data-testid="missing">{i18n.t('nonexistent.key', 'Fallback Text')}</span>
    </div>
  )
}

describe('i18n hook and provider', () => {
  test('default locale is arabic and direction rtl', () => {
    renderWithProviders(<TestComponent />)
    expect(screen.getByTestId('locale')).toHaveTextContent('ar')
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl')
  })

  test('t returns translation for current locale and falls back to defaultText when key is missing', () => {
    renderWithProviders(<TestComponent />, { localStorage: { locale: 'ar' } })
    // Key exists in Arabic
    expect(screen.getByTestId('title')).toHaveTextContent(ar['app.title'])
    // dev.title exists in both locales
    expect(screen.getByTestId('existing')).toHaveTextContent(ar['dev.title'])
    // nonexistent.key doesn't exist, should use defaultText
    expect(screen.getByTestId('missing')).toHaveTextContent('Fallback Text')
  })

  test('setLocale changes the locale', async () => {
    const TestComponentWithButton = () => {
      const i18n = useI18n()
      return (
        <div>
          <span data-testid="locale">{i18n.getLocale()}</span>
          <span data-testid="title">{i18n.t('app.title')}</span>
          <button onClick={() => i18n.setLocale('en')}>Set English</button>
        </div>
      )
    }

    renderWithProviders(<TestComponentWithButton />)

    expect(screen.getByTestId('locale')).toHaveTextContent('ar')
    expect(screen.getByTestId('title')).toHaveTextContent(ar['app.title'])

    fireEvent.click(screen.getByText('Set English'))

    await waitFor(() => {
      expect(screen.getByTestId('locale')).toHaveTextContent('en')
      expect(screen.getByTestId('title')).toHaveTextContent(en['app.title'])
    })
  })
})
