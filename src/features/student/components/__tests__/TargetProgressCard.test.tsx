import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TargetProgressCard } from '../TargetProgressCard'

describe('TargetProgressCard', () => {
  it('renders the raw server percentage in the label (not capped)', () => {
    render(
      <TargetProgressCard
        title="Monthly Progress"
        submitted={1265}
        target={1100}
        remaining={0}
        percent={115}
      />
    )
    expect(screen.getByText('115%')).toBeInTheDocument()
  })

  it('clamps the progress-bar width to 100% even when the percentage exceeds 100', () => {
    render(
      <TargetProgressCard
        title="Monthly Progress"
        submitted={1265}
        target={1100}
        remaining={0}
        percent={115}
      />
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    const fill = bar.firstElementChild as HTMLElement
    expect(fill).toHaveStyle({ width: '100%' })
  })

  it('reports a 0% bar for 0 progress', () => {
    render(
      <TargetProgressCard
        title="Today’s Progress"
        submitted={0}
        target={50}
        remaining={50}
        percent={0}
      />
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
  })
})
