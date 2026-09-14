import { isOurPhotoUrl } from './supabase'

/**
 * 게시글·리뷰 입력 검사 — 서버 라우트들이 같이 쓴다.
 * route.ts 는 GET/POST 말고 다른 것을 export 할 수 없어서 여기 둔다.
 */

export const MAX_PHOTOS = 4

/** 우리 버킷 URL 만, 최대 장수까지. 아니면 null */
export function cleanPhotos(v: unknown): string[] | null {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v) || v.length > MAX_PHOTOS) return null
  if (!v.every((u) => isOurPhotoUrl(u))) return null
  return v as string[]
}

/**
 * 장소 연결. { id, title, addr } 또는 없음.
 * id 는 한국관광공사 contentid(숫자 문자열)만 받는다 — 링크 주소에 그대로 들어가기 때문이다.
 */
export function cleanPlace(v: unknown): { place_id: string | null; place_title: string | null; place_addr: string | null } | null {
  if (!v) return { place_id: null, place_title: null, place_addr: null }
  if (typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const id = String(o.id ?? '').trim()
  const title = String(o.title ?? '').trim().slice(0, 100)
  const addr = String(o.addr ?? '').trim().slice(0, 200)
  if (!/^\d{1,12}$/.test(id) || !title) return null
  return { place_id: id, place_title: title, place_addr: addr || null }
}

/** contentid 로만 걸러 쓸 때 */
export const isContentId = (s: string) => /^\d{1,12}$/.test(s)
