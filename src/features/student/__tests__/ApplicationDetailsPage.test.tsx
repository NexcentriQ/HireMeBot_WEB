import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ApplicationDetailsPage } from '../pages/ApplicationDetailsPage'
import { studentDashboardKey } from '../hooks/useStudentDashboard'
import { MOCK_DASHBOARD } from '../data/mockApplications'
import { studentService } from '../data/studentService'

function renderAt(path: string, opts: { seedCache?: boolean; client?: QueryClient } = {}) {
  const client =
    opts.client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (opts.seedCache) {
    client.setQueryData(studentDashboardKey(), MOCK_DASHBOARD)
  }
  return {
    client,
    ...render(
      <ThemeProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <AuthProvider>
              <Routes>
                <Route
                  path="/student/applications/:applicationId"
                  element={<ApplicationDetailsPage />}
                />
                <Route path="/student/applications" element={<div>list-page</div>} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>
    )
  }
}

describe('ApplicationDetailsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads from the dashboard cache without triggering a service call', async () => {
    const spy = vi.spyOn(studentService, 'getDashboard')
    renderAt('/student/applications/1000000125', { seedCache: true })
    expect(await screen.findByRole('heading', { name: 'Amazon' })).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('fetches the dashboard once on direct nav and renders the matching application', async () => {
    const spy = vi.spyOn(studentService, 'getDashboard')
    renderAt('/student/applications/1000000125')
    expect(await screen.findByRole('heading', { name: 'Amazon' })).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('shows "Application details are unavailable." when the id is not in the response', async () => {
    renderAt('/student/applications/999999999', { seedCache: true })
    expect(
      await screen.findByText(/application details are unavailable\./i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /return to today's applications/i })
    ).toBeInTheDocument()
  })

  it('shows the "unavailable" state for a non-numeric id without hitting the service', async () => {
    const spy = vi.spyOn(studentService, 'getDashboard')
    renderAt('/student/applications/not-a-number', { seedCache: true })
    expect(
      await screen.findByText(/application details are unavailable\./i)
    ).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('renders a View Job Posting link that opens the backend jobLink in a new tab', async () => {
    renderAt('/student/applications/1000000125', { seedCache: true })
    const link = await screen.findByRole('link', { name: /view job posting at Amazon/i })
    expect(link).toHaveAttribute('href', 'https://www.amazon.jobs/en/jobs/1234567')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('renders resume and cover letter S3 document links', async () => {
    renderAt('/student/applications/1000000125', { seedCache: true })
    const resume = await screen.findByRole('link', { name: /view Resume/i })
    expect(resume).toHaveAttribute('href', expect.stringMatching(/sample-resume\.pdf$/))
    const cover = screen.getByRole('link', { name: /view Cover Letter/i })
    expect(cover).toHaveAttribute('href', expect.stringMatching(/sample-cover-letter\.pdf$/))
  })

  it('offers a Download action for a DOCX cover letter', async () => {
    renderAt('/student/applications/1000000124', { seedCache: true }) // Microsoft entry has DOCX
    const cover = await screen.findByRole('link', { name: /download Cover Letter/i })
    expect(cover).toHaveAttribute('href', expect.stringMatching(/\.docx$/))
    expect(cover).toHaveAttribute('download')
  })
})
