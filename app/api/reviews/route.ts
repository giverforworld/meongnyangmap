import { NextResponse } from 'next/server'
import { boardReady, sbInsert, sbSelect } from '@/lib/supabase'
import { hashPassword } from '@/lib/password'
import { cleanPhotos, isContentId, resolvePlace } from '@/lib/board'
import { petSnapshotOf, viewerOf } from '@/lib/auth'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'

export type Entry = 'ok' | 'cond' | 'denied'

export interface Review {
  id: number
  place_id: string
  nickname: string
  rating: number
  entry: Entry | null
  body: string
  photos: string[]
  pet_size: 'small' | 'medium' | 'large' | null
  created_at: string
  author_avatar: string | null
  author_provider: string | null
  pet_name: string | null
  pet_emoji: string | null
  /** 로그인해서 보는 사람의 것인지 — 서버가 계정으로 확인 */
  mine?: boolean
}

/**
 * 장소별 방문 리뷰.
 *
 * 한국관광공사 데이터가 아니라 **멍냥맵 사용자가 남긴 것**이다. 화면도 그렇게 구분해 보여준다.
 * 별점보다 먼저 묻는 것이 '실제로 들어갔는지'(entry) — 이 서비스가 있는 이유가 그것이다.
 */
const MAX = 50

/** 한 장소의 리뷰 — 최신순, 요약 숫자와 함께 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const place = (searchParams.get('place') ?? '').trim()
  if (!isContentId(place)) return NextResponse.json({ reviews: [], count: 0, avg: null, entry: { ok: 0, cond: 0, denied: 0 } })
  if (!boardReady) return NextResponse.json({ reviews: [], count: 0, avg: null, entry: { ok: 0, cond: 0, denied: 0 }, offline: true })

  try {
    const rows = await sbSelect<Review & { author_id: string | null }>(
      `reviews?select=id,place_id,nickname,rating,entry,body,photos,pet_size,created_at,author_id,author_avatar,author_provider,pet_name,pet_emoji` +
        `&place_id=eq.${place}&deleted_at=is.null&order=created_at.desc&limit=${MAX}`
    )
    // 계정 id 는 밖으로 내지 않는다 — 내 것인지만
    const viewer = rows.some((r) => r.author_id) ? await viewerOf(req) : null
    const reviews: Review[] = rows.map(({ author_id, ...r }) => ({ ...r, mine: Boolean(viewer && viewer.id === author_id) }))
    const count = reviews.length
    const avg = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null
    const entry = { ok: 0, cond: 0, denied: 0 }
    for (const r of reviews) if (r.entry) entry[r.entry]++
    // 요약은 받아온 만큼(최근 MAX 개)으로 센다. 그보다 많으면 화면이 '최근 N개 기준'이라고 적는다
    return NextResponse.json({ reviews, count, avg, entry, capped: count >= MAX })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, reviews: [], count: 0, avg: null }, { status: 500 })
  }
}

/** 리뷰 쓰기 */
export async function POST(req: Request) {
  if (!boardReady) return NextResponse.json({ error: '리뷰 저장소가 아직 연결되지 않았어요' }, { status: 503 })
  try {
    const { placeId, nickname, rating, entry, body, photos, petSize, password, petKey } = await req.json()
    const viewer = await viewerOf(req)

    // 장소 이름은 화면이 보낸 것이 아니라 우리 목록에서 찾는다
    const pl = await resolvePlace({ id: placeId })
    if (!pl?.place_id) return bad('어느 장소의 리뷰인지 알 수 없어요')
    const pid = pl.place_id
    const ptitle = pl.place_title!
    // 로그인 리뷰는 계정 이름으로 고정한다
    const nick = (viewer?.name || String(nickname ?? '')).trim()
    const b = String(body ?? '').trim()
    const pw = viewer ? randomBytes(24).toString('hex') : String(password ?? '')
    const rt = Number(rating)
    if (!nick || nick.length > 20) return bad('닉네임은 1~20자로 적어주세요')
    if (!Number.isInteger(rt) || rt < 1 || rt > 5) return bad('별점을 골라주세요')
    if (entry != null && !['ok', 'cond', 'denied'].includes(entry)) return bad('입장 결과 값이 올바르지 않아요')
    if (!b || b.length > 1000) return bad('내용은 1~1000자로 적어주세요')
    if (pw.length < 4) return bad('비밀번호는 4자 이상으로 정해주세요')
    const ph = cleanPhotos(photos)
    if (ph === null) return bad('사진은 우리 저장소에 올린 것만 4장까지 붙일 수 있어요')
    const size = ['small', 'medium', 'large'].includes(petSize) ? petSize : null

    const pet = viewer ? await petSnapshotOf(viewer.id, typeof petKey === 'string' ? petKey : null) : null
    const saved = await sbInsert<{ id: number }>('reviews', {
      place_id: pid,
      place_title: ptitle,
      nickname: nick,
      rating: rt,
      entry: entry ?? null,
      body: b,
      photos: ph,
      pet_size: size,
      password_hash: hashPassword(pw),
      author_id: viewer?.id ?? null,
      author_name: viewer?.name ?? null,
      author_avatar: viewer?.avatar ?? null,
      author_provider: viewer?.provider ?? null,
      pet_name: pet?.pet_name ?? null,
      pet_emoji: pet?.pet_emoji ?? null,
    })
    return NextResponse.json({ id: saved.id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 })
