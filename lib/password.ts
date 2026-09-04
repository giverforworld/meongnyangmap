import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * 게시글 삭제용 비밀번호. 로그인 계정이 아니라 "내가 쓴 글임을 증명하는" 용도다.
 * 그래도 평문으로 두지 않는다 — 사람들은 어디서나 같은 비밀번호를 쓴다.
 */
export function hashPassword(plain: string) {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(plain, salt, 32).toString('hex')
  return `${salt}:${key}`
}

export function verifyPassword(plain: string, stored: string) {
  const [salt, key] = stored.split(':')
  if (!salt || !key) return false
  const got = scryptSync(plain, salt, 32)
  const want = Buffer.from(key, 'hex')
  // 길이가 다르면 timingSafeEqual 이 예외를 던진다
  return got.length === want.length && timingSafeEqual(got, want)
}
