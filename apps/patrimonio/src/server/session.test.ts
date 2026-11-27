import { beforeAll, describe, expect, test } from 'bun:test'
import {
  authorizationUrl,
  createPkce,
  hasGroup,
  open,
  safeNext,
  seal,
  sessionCookie,
} from '@/server/session'

const TEST_SECRET = Buffer.from(new Uint8Array(32).fill(7)).toString('base64')

beforeAll(() => {
  process.env.SESSION_SECRET = TEST_SECRET
})

describe('seal and open', () => {
  const now = 1_700_000_000

  test('round-trip preserves groups, sub and email', () => {
    const groups = ['patrimonio', 'patrimonio-baixa']
    const token = seal(groups, 'user-1', 'a@b.c', now)
    const session = open(token, now)
    expect(session).toEqual({ groups, sub: 'user-1', email: 'a@b.c' })
  })

  test('open accepts token until exp', () => {
    const token = seal([], 'sub', '', now)
    expect(open(token, now + 899)).not.toBeNull()
  })

  test('open returns null after exp', () => {
    const token = seal([], 'sub', '', now)
    expect(open(token, now + 901)).toBeNull()
  })

  test('tampered token returns null', () => {
    const token = seal(['patrimonio'], 'sub', '', now)
    const broken = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect(open(broken, now)).toBeNull()
  })
})

describe('hasGroup', () => {
  test('patrimonio-baixa without patrimonio parent', () => {
    expect(hasGroup(['patrimonio-baixa'], 'patrimonio-baixa')).toBe(false)
  })

  test('patrimonio-baixa with patrimonio parent', () => {
    expect(hasGroup(['patrimonio', 'patrimonio-baixa'], 'patrimonio-baixa')).toBe(
      true,
    )
  })

  test('patrimonio alone', () => {
    expect(hasGroup(['patrimonio'], 'patrimonio')).toBe(true)
  })

  test('empty list', () => {
    expect(hasGroup([], 'patrimonio')).toBe(false)
  })
})

describe('sessionCookie', () => {
  test('has required attributes and no Domain', () => {
    const header = sessionCookie('tok')
    expect(header).toContain('patrimonio_session=')
    expect(header).toContain('HttpOnly')
    expect(header).toContain('Path=/patrimonio')
    expect(header).toContain('SameSite=Lax')
    expect(header).toContain('Max-Age=900')
    expect(header).not.toContain('Domain=')
  })
})

describe('authorizationUrl', () => {
  test('rewrites issuer host to browser origin', () => {
    const url = authorizationUrl({
      issuer: 'http://authentik:9000/authentik/application/o/patrimonio/',
      browserOrigin: 'http://10.0.0.8',
      redirectUri: 'http://10.0.0.8/patrimonio/api/auth/callback',
      state: 'st',
      codeChallenge: 'ch',
    })
    expect(url.startsWith('http://10.0.0.8/authentik/application/o/patrimonio/authorize/')).toBe(
      true,
    )
    expect(url).not.toContain('authentik:9000')
  })
})

describe('createPkce', () => {
  test('uses S256', () => {
    const pkce = createPkce()
    expect(pkce.method).toBe('S256')
    expect(pkce.verifier.length).toBeGreaterThan(0)
    expect(pkce.challenge.length).toBeGreaterThan(0)
  })
})

describe('safeNext', () => {
  test('rejects open redirect patterns', () => {
    expect(safeNext('//evil')).toBe('/')
    expect(safeNext('/../x')).toBe('/')
    expect(safeNext('/ok/path')).toBe('/ok/path')
  })
})