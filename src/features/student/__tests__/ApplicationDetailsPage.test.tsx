import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ApplicationDetailsPage } from '../pages/ApplicationDetailsPage'

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/student/applications/:applicationId" element={<ApplicationDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

describe('ApplicationDetailsPage', () => {
  it('shows backend-aligned job details for a known application', async () => {
    renderAt('/student/applications/1000000025')
    expect(await screen.findByRole('heading', { name: 'Amazon' })).toBeInTheDocument()
    // Several values intentionally appear in both the hero and the Job Details
    // table (Company / Role / Location). Assert they render at all.
    expect(screen.getAllByText('Software Development Engineer').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Seattle, WA, USA').length).toBeGreaterThan(0)
    expect(screen.getByText('Amazon Careers')).toBeInTheDocument()
    expect(screen.getByText('#1000000025')).toBeInTheDocument()
  })

  it('renders a "View Job Posting" link that opens the backend jobLink in a new tab', async () => {
    renderAt('/student/applications/1000000025')
    const link = await screen.findByRole('link', { name: /view job posting at Amazon/i })
    expect(link).toHaveAttribute('href', 'https://www.amazon.jobs/en/jobs/1234567')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('renders resume and cover letter document links to the S3 URLs', async () => {
    renderAt('/student/applications/1000000025')
    const resume = await screen.findByRole('link', { name: /view Resume/i })
    expect(resume).toHaveAttribute('href', expect.stringMatching(/sample-resume\.pdf$/))
    const cover = screen.getByRole('link', { name: /view Cover Letter/i })
    expect(cover).toHaveAttribute('href', expect.stringMatching(/sample-cover-letter\.pdf$/))
  })

  it('offers a Download action for a DOCX cover letter', async () => {
    renderAt('/student/applications/1000000024') // Microsoft entry uses .docx
    const cover = await screen.findByRole('link', { name: /download Cover Letter/i })
    expect(cover).toHaveAttribute('href', expect.stringMatching(/\.docx$/))
    expect(cover).toHaveAttribute('download')
  })

  it('renders a not-found state for an unknown id', async () => {
    renderAt('/student/applications/999999999')
    expect(await screen.findByText(/application not found/i)).toBeInTheDocument()
  })

  it('renders a not-found state for a non-numeric id', async () => {
    renderAt('/student/applications/not-a-number')
    expect(await screen.findByText(/application not found/i)).toBeInTheDocument()
  })

  it('does not render application-status UI (deferred to a future release)', async () => {
    renderAt('/student/applications/1000000025')
    await screen.findByRole('heading', { name: 'Amazon' })
    expect(screen.queryByText(/application submitted/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/interview scheduled/i)).not.toBeInTheDocument()
  })
})
