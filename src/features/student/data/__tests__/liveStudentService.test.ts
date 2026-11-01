import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Live-mode tests for the HTTP layer. Env is stubbed into live mode BEFORE
 * each test and the modules under test are dynamically re-imported so they
 * pick up the stubbed values.
 */
describe('LiveStudentService / studentHttpGet', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_STUDENT_API_MODE', 'live')
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:3000')
    vi.stubEnv('VITE_DEV_STUDENT_ID', '1000000002')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('issues GET /api/v1/student/applications with no query params', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              studentId: 1000000002,
              date: '2026-10-29',
              totalApplications: 0,
              pageSize: 20,
              totalPages: 0,
              pages: {},
              statistics: {
                asOfDate: '2026-10-29',
                timezone: 'America/Chicago',
                monthlyProgress: {
                  month: '2026-10',
                  applied: 0,
                  target: 1100,
                  remaining: 1100,
                  percentage: 0
                },
                todayProgress: {
                  date: '2026-10-29',
                  applied: 0,
                  target: 50,
                  remaining: 50,
                  percentage: 0
                },
                weeklyActivity: {
                  weekStartDate: '2026-10-26',
                  targetPerWeekday: 50,
                  days: []
                }
              }
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

    const { LiveStudentService } = await import('../studentService')
    const svc = new LiveStudentService()
    await svc.getDashboard()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchSpy.mock.calls[0]!
    const url = String(calledUrl)
    expect(url).toBe('http://127.0.0.1:3000/api/v1/student/applications')
    expect(url.includes('?')).toBe(false)
    const headers = new Headers(init!.headers as HeadersInit)
    expect(headers.get('X-Dev-Student-Id')).toBe('1000000002')
    expect(init!.method).toBe('GET')
  })

  it('wraps a 403 error-envelope response in ApiError', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: 'FORBIDDEN',
          message: 'Student authentication is not configured'
        }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      )
    )

    const { LiveStudentService } = await import('../studentService')
    const { ApiError } = await import('../http')
    const svc = new LiveStudentService()
    let caught: unknown
    try {
      await svc.getDashboard()
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as InstanceType<typeof ApiError>).code).toBe('FORBIDDEN')
    expect((caught as InstanceType<typeof ApiError>).status).toBe(403)
  })

  it('wraps a network failure as a status-0 ApiError', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const { LiveStudentService } = await import('../studentService')
    const { ApiError } = await import('../http')
    const svc = new LiveStudentService()
    let caught: unknown
    try {
      await svc.getDashboard()
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as InstanceType<typeof ApiError>).status).toBe(0)
    expect((caught as InstanceType<typeof ApiError>).isNetwork).toBe(true)
  })
})
