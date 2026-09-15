import { isOurPhotoUrl } from './supabase'
import { catalog } from './catalog'

/**
 * 게시글·리뷰 입력 검사 — 서버 라우트들이 같이 쓴다.
 * route.ts 는 GET/POST 말고 다른 것을 export 할 수 없어서 여기 둔다.
 */

export const MAX_PHOTOS = 4

/** sbUpload 가 만드는 모양 그대로 — YYYYMM/uuid.jpg|png|webp. 접두사만 보면 뒤에 아무거나 붙여 4MB 를 넣을 수 있다 */
const PHOTO_TAIL = /^\d{6}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/
const PHOTO_URL_MAX = 300

/** 우리 버킷에 우리 이름 규칙으로 올라간 URL 만, 최대 장수까지. 아니면 null */
export function cleanPhotos(v: unknown): string[] | null {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v) || v.length > MAX_PHOTOS) return null
  for (const u of v) {
    if (typeof u !== 'string' || u.length > PHOTO_URL_MAX || !isOurPhotoUrl(u)) return null
    if (!PHOTO_TAIL.test(u.slice(u.lastIndexOf('/photos/') + '/photos/'.length))) return null
  }
  return v as string[]
}

/** contentid 로만 걸러 쓸 때 */
export const isContentId = (s: string) => /^\d{1,12}$/.test(s)

/**
 * 장소 연결. { id } 를 받아 **우리 목록에서 이름·주소를 찾는다** — 화면이 보낸 이름은 쓰지 않는다.
 * 안 그러면 아무 글에나 없는 관광지 이름을 달 수 있다. 없는 id 면 null(거부), 비어 있으면 연결 없음.
 */
export async function resolvePlace(v: unknown): Promise<{ place_id: string | null; place_title: string | null; place_addr: string | null } | null> {
  if (!v) return { place_id: null, place_title: null, place_addr: null }
  if (typeof v !== 'object') return null
  const id = String((v as Record<string, unknown>).id ?? '').trim()
  if (!isContentId(id)) return null
  const p = (await catalog()).find((x) => x.contentid === id)
  if (!p) return null
  return { place_id: p.contentid, place_title: p.title.slice(0, 100), place_addr: p.addr1?.slice(0, 200) || null }
}
