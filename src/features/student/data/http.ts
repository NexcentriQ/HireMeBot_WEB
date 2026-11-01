import { assertLiveEnv } from '@/lib/env'
import type { ApiErrorEnvelope, ApiSuccessEnvelope } from './apiTypes'

/**
 * Narrow error class the UI can branch on. Covers both HTTP-level errors
 * (status + optional server `error` code / `message`) and network-level
 * failures (status = 0).
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly details: string[] | undefined

  constructor(args: { status: number; code?: string; message: string; details?: string[] }) {
    super(args.message)
    this.name = 'ApiError'
    this.status = args.status
    this.code = args.code
    this.details = args.details
  }

  get isNetwork(): boolean {
    return this.status === 0
  }

  get isTransient(): boolean {
    return this.status === 503 || this.isNetwork
  }
}

type HttpOptions = {
  signal?: AbortSignal
}

/**
 * Student-authenticated GET helper. Builds the URL, attaches the dev
 * student header (until Cognito/JWT replaces it), unwraps the standard
 * `{ success, data }` envelope, and throws `ApiError` for anything else.
 *
 * Never retries. Never logs response bodies.
 */
export async function studentHttpGet<T>(path: string, opts: HttpOptions = {}): Promise<T> {
  const { apiBaseUrl, devStudentId } = assertLiveEnv()
  const url = joinUrl(apiBaseUrl, path)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Dev-Student-Id': devStudentId
      },
      // No credentials — dev auth is header-based; prod will use Authorization
      credentials: 'omit',
      signal: opts.signal
    })
  } catch (networkErr) {
    throw new ApiError({
      status: 0,
      message:
        networkErr instanceof Error
          ? `Network error: ${networkErr.message}`
          : 'Network error while contacting the HireMeBot API.'
    })
  }

  const contentType = res.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json')
    ? ((await res.json().catch(() => null)) as unknown)
    : null

  if (res.ok) {
    if (body && typeof body === 'object' && (body as ApiSuccessEnvelope<T>).success === true) {
      return (body as ApiSuccessEnvelope<T>).data
    }
    throw new ApiError({
      status: res.status,
      message: 'The server returned an unexpected response shape.'
    })
  }

  if (body && typeof body === 'object' && (body as ApiErrorEnvelope).success === false) {
    const env2 = body as ApiErrorEnvelope
    throw new ApiError({
      status: res.status,
      code: env2.error,
      message: env2.message,
      details: env2.details
    })
  }

  throw new ApiError({
    status: res.status,
    message: `Request failed with status ${res.status}.`
  })
}

function joinUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p // same-origin relative URL (used with the Vite dev proxy)
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  return `${b}${p}`
}
