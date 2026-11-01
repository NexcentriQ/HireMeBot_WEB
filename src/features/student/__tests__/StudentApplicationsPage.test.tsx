import { describe, expect, it, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentApplicationsPage } from '../pages/StudentApplicationsPage'
import { renderWithProviders } from '@/test/renderWithProviders'
import { MOCK_DASHBOARD } from '../data/mockApplications'
import { studentService } from '../data/studentService'

describe("StudentApplicationsPage (Today's Applications)", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('populates page 1 from the server-sorted flattened list', async () => {
    renderWithProviders(<StudentApplicationsPage />)
    expect(
      await screen.findByRole('heading', { name: /today's applications/i })
    ).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: /today's applications/i })
    const items = within(list).getAllByRole('listitem')
    // Page 1 shows the first `pageSize` entries of the flattened list.
    expect(items.length).toBe(MOCK_DASHBOARD.pageSize)
    expect(within(items[0]!).getByText('Amazon')).toBeInTheDocument()
  })

  it('Prev/Next pagination walks the flattened result set without extra service calls', async () => {
    const spy = vi.spyOn(studentService, 'getDashboard')
    const user = userEvent.setup()
    renderWithProviders(<StudentApplicationsPage />)
    const next = await screen.findByRole('button', { name: /next page/i })
    const nav = screen.getByRole('navigation', { name: /pagination/i })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(nav).toHaveTextContent(/Page\s*1\s*of\s*2/)
    await user.click(next)
    expect(nav).toHaveTextContent(/Page\s*2\s*of\s*2/)
    expect(spy).toHaveBeenCalledTimes(1) // page change must not fetch again
    const prev = screen.getByRole('button', { name: /previous page/i })
    await user.click(prev)
    expect(nav).toHaveTextContent(/Page\s*1\s*of\s*2/)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('renders the friendly empty state when today has no applications', async () => {
    vi.spyOn(studentService, 'getDashboard').mockResolvedValue({
      ...MOCK_DASHBOARD,
      totalApplications: 0,
      totalPages: 0,
      pages: {},
      statistics: {
        ...MOCK_DASHBOARD.statistics,
        todayProgress: {
          ...MOCK_DASHBOARD.statistics.todayProgress,
          applied: 0,
          remaining: 50,
          percentage: 0
        }
      }
    })
    renderWithProviders(<StudentApplicationsPage />)
    expect(
      await screen.findByText(/no applications recorded for today yet/i)
    ).toBeInTheDocument()
  })

  it('search spans every cached page, not just the current one', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentApplicationsPage />)

    // Pre-condition: the "LinkedIn" company record lives on page 2 in the
    // mock, so it is not rendered when page 1 is active.
    expect(await screen.findByText('Amazon')).toBeInTheDocument()
    expect(screen.queryByText('LinkedIn')).not.toBeInTheDocument()

    // Type a term that only matches a page-2 record. The filter must look
    // at the whole cached dataset, not just the current page.
    const input = await screen.findByLabelText(/search applications/i)
    await user.type(input, 'LinkedIn')

    expect(await screen.findByText('LinkedIn')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: /pagination/i })
    // Only one record matches "LinkedIn" by company name, so the paginator
    // collapses to a single page and the count reflects the filtered total.
    expect(nav).toHaveTextContent(/Page\s*1\s*of\s*1/)
    expect(nav).toHaveTextContent(/1 of 25 match/i)
  })

  it('resets to page 1 when the search query changes', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentApplicationsPage />)

    // Move to page 2 first.
    const next = await screen.findByRole('button', { name: /next page/i })
    await user.click(next)
    const nav = screen.getByRole('navigation', { name: /pagination/i })
    expect(nav).toHaveTextContent(/Page\s*2\s*of\s*2/)

    // Any typing should reset the view to page 1 of the filtered result set.
    const input = screen.getByLabelText(/search applications/i)
    await user.type(input, 'A')
    expect(nav).toHaveTextContent(/Page\s*1\s*of/i)
  })

  it('shows a cross-page "no matches" state when the search returns nothing', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentApplicationsPage />)
    const input = await screen.findByLabelText(/search applications/i)
    await user.type(input, 'definitely-not-a-company-xyz')
    expect(await screen.findByText(/no matches today/i)).toBeInTheDocument()
  })
})
