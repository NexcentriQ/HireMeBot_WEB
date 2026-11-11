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
              student: {
                firstName: 'Sarah',
                lastName: 'Johnson',
                email: 'sarah.johnson@example.com',
                phoneE164: '+17135550123',
                phoneVerified: true
              },
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
    await svc.getDashboard({ studentId: 1000000002 })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchSpy.mock.calls[0]!
    const url = String(calledUrl)
    expect(url).toBe('http://127.0.0.1:3000/api/v1/student/applications')
    expect(url.includes('?')).toBe(false)
    const headers = new Headers(init!.headers as HeadersInit)
    // The header carries the studentId passed by the caller (the signed-in
    // student's account), not a value from the environment.
    expect(headers.get('X-Dev-Student-Id')).toBe('1000000002')
    expect(init!.method).toBe('GET')
  })

  it('sends the studentId it is given, whatever the environment says', async () => {
    vi.stubEnv('VITE_DEV_STUDENT_ID', '999') // legacy variable must have no effect
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )

    const { LiveStudentService } = await import('../studentService')
    await new LiveStudentService().getDashboard({ studentId: 1000000007 })

    const headers = new Headers(fetchSpy.mock.calls[0]![1]!.headers as HeadersInit)
    expect(headers.get('X-Dev-Student-Id')).toBe('1000000007')
  })

  it('refuses to call the backend without a student id', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')

    const { LiveStudentService } = await import('../studentService')
    await expect(new LiveStudentService().getDashboard()).rejects.toThrow(/student id is required/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it.each([
    { phoneE164: '+17135550123', phoneVerified: true },
    { phoneE164: '+17135550123', phoneVerified: false },
    { phoneE164: null, phoneVerified: false }
  ])(
    'returns data.student verbatim from the single dashboard call (%j) with no profile request',
    async (phone) => {
      const student = {
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@example.com',
        ...phone
      }
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              studentId: 1000000002,
              date: '2026-11-02',
              student,
              totalApplications: 0,
              pageSize: 20,
              totalPages: 0,
              pages: {},
              statistics: {}
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

      const { LiveStudentService } = await import('../studentService')
      const result = await new LiveStudentService().getDashboard({ studentId: 1000000002 })

      expect(result.student).toEqual(student)
      // Exactly one request, to the existing dashboard endpoint — never a profile endpoint.
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(String(fetchSpy.mock.calls[0]![0])).toBe(
        'http://127.0.0.1:3000/api/v1/student/applications'
      )
      expect(String(fetchSpy.mock.calls[0]![0])).not.toMatch(/profile/i)
    }
  )

  it('live mode never falls back to mock profile data when the backend fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'The service is temporarily unavailable.'
        }),
        { status: 503, headers: { 'content-type': 'application/json' } }
      )
    )

    // Go through the public facade, which is what the UI uses.
    const { studentService } = await import('../studentService')
    const { ApiError } = await import('../http')
    let resolved: unknown
    let caught: unknown
    try {
      resolved = await studentService.getDashboard({ studentId: 1000000002 })
    } catch (e) {
      caught = e
    }
    expect(resolved).toBeUndefined() // no mock dashboard handed back
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as InstanceType<typeof ApiError>).status).toBe(503)
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
      await svc.getDashboard({ studentId: 1000000002 })
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
      await svc.getDashboard({ studentId: 1000000002 })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as InstanceType<typeof ApiError>).status).toBe(0)
    expect((caught as InstanceType<typeof ApiError>).isNetwork).toBe(true)
  })
})
