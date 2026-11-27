import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const SESSION_TTL = 900
const AUX_TTL = 300

function getSessionKey(): Buffer {
  const raw = process.env.SESSION_SECRET
  if (!raw) {
    throw new Error('SESSION_SECRET ausente')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('SESSION_SECRET inválido')
  }
  return key
}

export function sessionSecretValid(): boolean {
  try {
    getSessionKey()
    return true
  } catch {
    return false
  }
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64url')
}

function base64urlDecode(str: string): Buffer {
  return Buffer.from(str, 'base64url')
}

export function seal(
  groups: string[],
  sub: string,
  email: string,
  now: number,
): string {
  const key = getSessionKey()
  const iv = randomBytes(12)
  const exp = now + SESSION_TTL
  const payload = JSON.stringify({ groups, sub, email, exp })
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(payload, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return base64urlEncode(Buffer.concat([iv, encrypted, tag]))
}

export function open(
  token: string,
  now: number,
): { groups: string[]; sub: string; email: string } | null {
  try {
    const key = getSessionKey()
    const buf = base64urlDecode(token)
    if (buf.length < 12 + 16) return null
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(buf.length - 16)
    const ciphertext = buf.subarray(12, buf.length - 16)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')
    const payload = JSON.parse(plain) as {
      groups?: unknown
      sub?: unknown
      email?: unknown
      exp?: unknown
    }
    if (typeof payload.exp !== 'number' || now >= payload.exp) return null
    if (typeof payload.sub !== 'string') return null
    if (!Array.isArray(payload.groups)) return null
    const groups = payload.groups.filter((g): g is string => typeof g === 'string')
    const email = typeof payload.email === 'string' ? payload.email : ''
    return { groups, sub: payload.sub, email }
  } catch {
    return null
  }
}

export function hasGroup(groups: string[], name: string): boolean {
  if (!groups.includes(name)) return false
  if (name.startsWith('patrimonio-') && !groups.includes('patrimonio')) {
    return false
  }
  return true
}

const COOKIE_FLAGS = 'HttpOnly; Path=/patrimonio; SameSite=Lax'

export function sessionCookie(token: string): string {
  return `patrimonio_session=${token}; ${COOKIE_FLAGS}; Max-Age=${SESSION_TTL}`
}

export function clearSessionCookie(): string {
  return `patrimonio_session=; ${COOKIE_FLAGS}; Max-Age=0`
}

export function auxCookie(name: string, value: string): string {
  return `${name}=${value}; ${COOKIE_FLAGS}; Max-Age=${AUX_TTL}`
}

export function clearAuxCookie(name: string): string {
  return `${name}=; ${COOKIE_FLAGS}; Max-Age=0`
}

export function safeNext(value: string | null | undefined): string {
  if (value == null || value === '') return '/'
  if (!/^\/[A-Za-z0-9._~/-]*$/.test(value)) return '/'
  if (value.startsWith('//')) return '/'
  if (value.includes('..')) return '/'
  return value
}

export function createPkce(): {
  verifier: string
  challenge: string
  method: 'S256'
} {
  const verifier = base64urlEncode(randomBytes(32))
  const challenge = base64urlEncode(
    createHash('sha256').update(verifier).digest(),
  )
  return { verifier, challenge, method: 'S256' }
}

export function authorizationUrl(params: {
  issuer: string
  browserOrigin: string
  redirectUri: string
  state: string
  codeChallenge: string
}): string {
  const issuerUrl = new URL(params.issuer)
  let issuerPath = issuerUrl.pathname
  if (!issuerPath.endsWith('/')) issuerPath += '/'
  const url = new URL(`${issuerPath}authorize/`, params.browserOrigin)
  url.searchParams.set('client_id', 'patrimonio')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile email groups')
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export function readIdToken(
  idToken: string,
): { sub: string; email: string; groups: string[] } | null {
  const parts = idToken.split('.')
  if (parts.length < 2) return null
  try {
    const payload = JSON.parse(
      base64urlDecode(parts[1]!).toString('utf8'),
    ) as Record<string, unknown>
    if (typeof payload.sub !== 'string') return null
    const email = typeof payload.email === 'string' ? payload.email : ''
    let groups: string[] = []
    if (Array.isArray(payload.groups)) {
      groups = payload.groups.filter((g): g is string => typeof g === 'string')
    }
    return { sub: payload.sub, email, groups }
  } catch {
    return null
  }
}

export function randomState(): string {
  return base64urlEncode(randomBytes(16))
}