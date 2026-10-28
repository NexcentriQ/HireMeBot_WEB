import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '../ThemeProvider'

function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  it('toggles the dark class on <html> and persists the choice', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )
    await act(async () => {
      await user.click(screen.getByText('dark'))
    })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem('hiremebot-theme')).toBe('dark')

    await act(async () => {
      await user.click(screen.getByText('light'))
    })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(window.localStorage.getItem('hiremebot-theme')).toBe('light')
  })
})
