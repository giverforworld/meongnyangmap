/**
 * Supabase REST(PostgREST) 얇은 클라이언트 — 서버 전용.
 *
 * service_role 키를 쓴다. RLS 를 우회하므로 **절대 브라우저로 나가면 안 된다.**
 * 이 파일을 클라이언트 컴포넌트에서 import 하지 말 것.
 */
const URL_ = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const boardReady = Boolean(URL_ && KEY)

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: KEY!,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export async function sbSelect<T>(path: string): Promise<T[]> {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers: headers(), cache: 'no-store' })
  if (!res.ok) throw new Error(`조회 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

export async function sbInsert<T>(table: string, row: unknown): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify([row]),
  })
  if (!res.ok) throw new Error(`저장 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`)
  return (await res.json())[0]
}

export async function sbUpdate(table: string, filter: string, patch: unknown) {
  const res = await fetch(`${URL_}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`수정 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`)
}

// ── Storage — 사진 ─────────────────────────────────────────────

/** 사진 버킷 이름. supabase/2026-09-15_photos_reviews.sql 이 만든다 */
export const PHOTO_BUCKET = 'photos'

/** 우리 버킷의 공개 URL 인지 — 글에 붙는 사진 주소는 이걸 통과해야 저장한다 */
export function isOurPhotoUrl(u: string) {
  return typeof u === 'string' && u.startsWith(`${URL_}/storage/v1/object/public/${PHOTO_BUCKET}/`)
}

/**
 * 사진 한 장을 올리고 공개 URL 을 돌려준다.
 * service_role 로 올리므로 Storage 정책이 필요 없다 — 브라우저는 이 라우트를 거쳐야만 쓸 수 있다.
 */
export async function sbUpload(path: string, body: ArrayBuffer, contentType: string): Promise<string> {
  const res = await fetch(`${URL_}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': contentType, 'x-upsert': 'false' },
    body,
  })
  if (!res.ok) throw new Error(`사진 저장 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`)
  return `${URL_}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`
}

