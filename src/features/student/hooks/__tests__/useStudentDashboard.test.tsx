import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import { dashboardFor, seedMockAuthUser } from '@/test/dashboardFixtures'
import { FAKE_STUDENT_ID } from '@/test/fakeStudentAccountApi'
import { studentService } from '../../data/studentService'
import { studentDashboardKey, useStudentDashboard } from '../useStudentDashboard'

function Probe() {
  const { data } = useStudentDashboard()
  return <div>{data ? 'loaded' : 'waiting'}</div>
}

describe('useStudentDashboard — student identity', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests the dashboard with the signed-in student’s studentId from GET /auth/me', async () => {
    seedMockAuthUser()
    const spy = vi.spyOn(studentService, 'getDashboard').mockResolvedValue(dashboardFor())

    renderWithProviders(<Probe />)

    expect(await screen.findByText('loaded')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toMatchObject({ studentId: FAKE_STUDENT_ID })
  })

  it('does not fetch while nobody is signed in', async () => {
    const spy = vi.spyOn(studentService, 'getDashboard').mockResolvedValue(dashboardFor())

    renderWithProviders(<Probe />)

    // Let the (signed-out) session check settle, then confirm nothing was requested.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByText('waiting')).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('studentDashboardKey', () => {
  it('is scoped per student id', () => {
    expect(studentDashboardKey(1000000002)).toEqual(['student-dashboard', '1000000002'])
    expect(studentDashboardKey(1000000002)).not.toEqual(studentDashboardKey(1000000003))
  })
})
