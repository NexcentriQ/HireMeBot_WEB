import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { OtpInput } from '../components/OtpInput'

function Harness(props: {
  onComplete?: (v: string) => void
}) {
  const [value, setValue] = useState('')
  return (
    <OtpInput value={value} onChange={setValue} onComplete={props.onComplete} autoFocus={false} />
  )
}

describe('OtpInput', () => {
  it('renders six single-digit inputs', () => {
    render(<Harness />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(6)
  })

  it('calls onComplete when the full code is entered', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)
    const inputs = screen.getAllByRole('textbox')
    for (let i = 0; i < 6; i++) {
      await user.type(inputs[i]!, String(i + 1))
    }
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('accepts a 6-digit paste', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)
    const inputs = screen.getAllByRole('textbox')
    inputs[0]!.focus()
    await user.paste('987654')
    expect(onComplete).toHaveBeenCalledWith('987654')
  })

  it('ignores non-numeric characters when typing', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0]!, 'a')
    expect(inputs[0]).toHaveValue('')
  })
})
