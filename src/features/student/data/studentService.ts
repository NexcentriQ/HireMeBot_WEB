import { env, type StudentApiMode } from '@/lib/env'
import type { DashboardResponse } from './apiTypes'
import { studentHttpGet } from './http'
import { MOCK_DASHBOARD } from './mockApplications'

/**
 * Student-facing API facade. Two implementations are selected on demand
 * based on `VITE_STUDENT_API_MODE`:
 *
 *   mock → in-process MockStudentService (sample data; no network)
 *   live → LiveStudentService that calls GET /api/v1/student/applications
 *
 * The frontend never silently falls back from live to mock on error — if a
 * live request fails, the UI surfaces the error with a retry affordance.
 *
 * Implementation detail: the picker is lazy and re-evaluates on every call
 * so tests can switch modes with `vi.stubEnv` without reloading modules.
 */
export interface StudentService {
  getDashboard(opts?: { signal?: AbortSignal }): Promise<DashboardResponse>
}

export class MockStudentService implements StudentService {
  async getDashboard(): Promise<DashboardResponse> {
    // Return a defensive clone so a caller mutating the result cannot
    // corrupt the shared mock. Modest cost; the dataset is tiny.
    return structuredClone(MOCK_DASHBOARD)
  }
}

export class LiveStudentService implements StudentService {
  async getDashboard(opts: { signal?: AbortSignal } = {}): Promise<DashboardResponse> {
    // No query params — the backend always reports the current date and
    // returns every page inline.
    return studentHttpGet<DashboardResponse>('/api/v1/student/applications', opts)
  }
}

let cachedImpl: StudentService | undefined
let cachedMode: StudentApiMode | undefined

function pickImpl(): StudentService {
  const mode = env().STUDENT_API_MODE
  if (!cachedImpl || cachedMode !== mode) {
    cachedImpl = mode === 'live' ? new LiveStudentService() : new MockStudentService()
    cachedMode = mode
  }
  return cachedImpl
}

/**
 * Public facade. Delegates to whichever implementation matches the current
 * env mode. The delegation layer is intentionally thin so `vi.spyOn` on
 * `studentService.getDashboard` still works in tests.
 */
export const studentService: StudentService = {
  getDashboard: (opts) => pickImpl().getDashboard(opts)
}

/**
 * Front-end only helper. The backend returns `companyName` but no brand slug;
 * we derive one from the display name to pick a brand mark/color locally.
 */
export function companySlugFor(companyName: string): string {
  return companyName.toLowerCase().replace(/[^a-z0-9]+/g, '')
}
