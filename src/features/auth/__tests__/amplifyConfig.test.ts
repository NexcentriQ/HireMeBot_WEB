import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cognitoEnv, missingCognitoEnv } from '@/lib/env'

describe('Cognito env', () => {
  it('reads and normalizes the VITE_COGNITO_* variables', () => {
    vi.stubEnv('VITE_COGNITO_DOMAIN', 'https://example.auth.us-east-2.amazoncognito.com/')
    vi.stubEnv('VITE_COGNITO_REDIRECT_URL', 'http://localhost:5173/auth/callback, https://app.example.com/auth/callback')
    const env = cognitoEnv()
    expect(env.domain).toBe('example.auth.us-east-2.amazoncognito.com')
    expect(env.redirectSignIn).toEqual([
      'http://localhost:5173/auth/callback',
      'https://app.example.com/auth/callback'
    ])
    expect(missingCognitoEnv(env)).toEqual([])
  })

  it('lists missing or malformed variables by name', () => {
    vi.stubEnv('VITE_COGNITO_USER_POOL_ID', '')
    vi.stubEnv('VITE_COGNITO_REDIRECT_URL', 'not-a-url')
    expect(missingCognitoEnv()).toEqual(['VITE_COGNITO_USER_POOL_ID', 'VITE_COGNITO_REDIRECT_URL'])
  })
})

describe('Amplify configuration', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('builds the Amplify v6 Cognito OAuth config (code flow, openid email, Google)', async () => {
    const { buildAmplifyConfig } = await import('../amplifyConfig')
    expect(buildAmplifyConfig(cognitoEnv())).toEqual({
      Auth: {
        Cognito: {
          userPoolId: 'us-east-2_TESTPOOL',
          userPoolClientId: 'testclientid',
          loginWith: {
            oauth: {
              domain: 'test-domain.auth.us-east-2.amazoncognito.com',
              scopes: ['openid', 'email'],
              redirectSignIn: ['http://localhost:3000/auth/callback'],
              redirectSignOut: ['http://localhost:3000/'],
              responseType: 'code',
              providers: ['Google']
            }
          }
        }
      }
    })
  })

  it('configures Amplify once, with session-scoped token storage', async () => {
    const { Amplify } = await import('aws-amplify')
    const { cognitoUserPoolsTokenProvider } = await import('aws-amplify/auth/cognito')
    const { sessionStorage } = await import('aws-amplify/utils')
    const configure = vi.spyOn(Amplify, 'configure').mockImplementation(() => {})
    const setStorage = vi.spyOn(cognitoUserPoolsTokenProvider, 'setKeyValueStorage')
    const { initializeAuth } = await import('../amplifyConfig')

    expect(initializeAuth()).toEqual({ configured: true })
    expect(initializeAuth()).toEqual({ configured: true })

    expect(configure).toHaveBeenCalledTimes(1)
    expect(setStorage).toHaveBeenCalledWith(sessionStorage)
    const [config, libraryOptions] = configure.mock.calls[0]!
    expect(config).toMatchObject({ Auth: { Cognito: { userPoolClientId: 'testclientid' } } })
    expect(libraryOptions).toEqual({ Auth: { tokenProvider: cognitoUserPoolsTokenProvider } })
    // The config never carries a client secret.
    expect(JSON.stringify(config)).not.toMatch(/secret/i)
  })

  it('skips configuration (without throwing) when env vars are missing', async () => {
    vi.stubEnv('VITE_COGNITO_DOMAIN', '')
    const { Amplify } = await import('aws-amplify')
    const configure = vi.spyOn(Amplify, 'configure').mockImplementation(() => {})
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { initializeAuth } = await import('../amplifyConfig')

    expect(initializeAuth()).toEqual({ configured: false, missing: ['VITE_COGNITO_DOMAIN'] })
    expect(configure).not.toHaveBeenCalled()
    // Logs names only, never values.
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain('testclientid')
    errorLog.mockRestore()
  })
})
