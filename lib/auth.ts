import { sbSelect } from './supabase'
import { sizeOf } from './petTour'
import { sizeLabelOf } from './pets'

/**
 * "이 요청을 보낸 사람이 누구인가" — 서버에서 확인한다.
 *
 * 브라우저는 Supabase 세션 토큰을 Authorization 헤더로 같이 보낸다. 여기서 Supabase 에
 * "이 토큰 누구야?" 하고 물어 답을 받은 것만 로그인으로 친다. 화면이 "나 로그인했어"라고
 * 보내는 값은 믿지 않는다 — 그건 누구나 흉내 낼 수 있다.
 *
 * 로그인은 선택이라, 토큰이 없거나 틀리면 오류가 아니라 '비로그인'이다.
 */
const URL_ = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export interface Viewer {
  id: string
  /** 카카오 닉네임 등 계정 이름 */
  name: string
  avatar: string | null
  /** kakao · google */
  provider: string
}

export async function viewerOf(req: Request): Promise<Viewer | null> {
  const h = req.headers.get('authorization') ?? ''
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : ''
  if (!token || !URL_ || !KEY) return null
  try {
    const res = await fetch(`${URL_}/auth/v1/user`, {
      headers: { apikey: KEY, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const u = await res.json()
    if (!u?.id) return null
    const m = u.user_metadata ?? {}
    const p: string = u.app_metadata?.provider ?? ''
    return {
      id: String(u.id),
      name: String(m.nickname || m.name || m.full_name || '').slice(0, 20),
      avatar: (m.picture || m.avatar_url || null) as string | null,
      provider: p === 'custom:kakao' ? 'kakao' : p,
    }
  } catch {
    return null
  }
}

export interface PetSnapshot {
  pet_name: string
  pet_emoji: string
  /** 소형견 · 중형묘 … */
  pet_label: string
}

/**
 * 글에 같이 남길 아이. 화면이 고른 key 의 아이를 **그 계정의 pets 표에서** 찾는다.
 * 남의 아이 이름을 보내도 붙지 않는다. key 가 없거나 못 찾으면 첫 아이.
 */
export async function petSnapshotOf(userId: string, key: string | null): Promise<PetSnapshot | null> {
  try {
    const rows = await sbSelect<{ key: string; name: string; species: 'dog' | 'cat' | null; kg: number | string; emoji: string }>(
      `pets?select=key,name,species,kg,emoji&user_id=eq.${userId}&order=created_at&limit=20`
    )
    if (rows.length === 0) return null
    const p = (key && rows.find((r) => r.key === key)) || rows[0]
    const species = p.species === 'cat' ? 'cat' : 'dog'
    return { pet_name: p.name, pet_emoji: p.emoji || (species === 'cat' ? '🐱' : '🐶'), pet_label: sizeLabelOf(species, sizeOf(Number(p.kg) || 1)) }
  } catch {
    return null
  }
}
