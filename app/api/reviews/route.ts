import { NextResponse } from 'next/server'
import { boardReady, sbInsert, sbSelect } from '@/lib/supabase'
import { hashPassword } from '@/lib/password'
import { cleanPhotos, isContentId, resolvePlace } from '@/lib/board'
import { EXPIRED, petSnapshotOf, sentToken, viewerOf } from '@/lib/auth'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'

export type Entry = 'ok' | 'cond' | 'denied'

export interface Review {
  id: number
  place_id: string
  nickname: string
  /** 현장 확인만 남긴 행은 별점이 없다 */
  rating: number | null
  entry: Entry | null
  body: string
  /** 현장에서 요구된 것 — 사용자가 고른 칩 */
  needs: string[]
  /** 다녀온 날(YYYY-MM-DD). 없으면 작성일 */
  visited_on: string | null
  photos: string[]
  pet_size: 'small' | 'medium' | 'large' | null
  created_at: string
  author_avatar: string | null
  author_provider: string | null
  pet_name: string | null
  pet_emoji: string | null
  /** 로그인해서 보는 사람의 것인지 — 서버가 계정으로 확인 */
  mine?: boolean
  byAccount?: boolean
}

/**
 * 장소별 방문 리뷰.
 *
 * 한국관광공사 데이터가 아니라 **멍냥맵 사용자가 남긴 것**이다. 화면도 그렇게 구분해 보여준다.
 * 별점보다 먼저 묻는 것이 '실제로 들어갔는지'(entry) — 이 서비스가 있는 이유가 그것이다.
 */
const MAX = 50

/** 요약 — 입장 결과 셋과 요구된 것의 빈도, 마지막 거부일 */
export interface Summary {
  entry: Record<Entry, number>
  needs: Record<string, number>
  lastDenied: string | null
  last: string | null
}

/** 한 장소의 리뷰 — 최신순, 요약 숫자와 함께 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const place = (searchParams.get('place') ?? '').trim()
  if (!isContentId(place)) return NextResponse.json({ reviews: [], count: 0, avg: null, entry: { ok: 0, cond: 0, denied: 0 } })
  if (!boardReady) return NextResponse.json({ reviews: [], count: 0, avg: null, entry: { ok: 0, cond: 0, denied: 0 }, offline: true })

  try {
    const rows = await sbSelect<Review & { author_id: string | null }>(
      `reviews?select=id,place_id,nickname,rating,entry,body,needs,visited_on,photos,pet_size,created_at,author_id,author_avatar,author_provider,pet_name,pet_emoji` +
        `&place_id=eq.${place}&deleted_at=is.null&order=created_at.desc&limit=${MAX}`
    )
    // 계정 id 는 밖으로 내지 않는다 — 내 것인지만
    const viewer = rows.some((r) => r.author_id) ? await viewerOf(req) : null
    const reviews: Review[] = rows.map(({ author_id, ...r }) => ({ ...r, needs: r.needs ?? [], mine: Boolean(viewer && viewer.id === author_id), byAccount: Boolean(author_id) }))
    const count = reviews.length
    const rated = reviews.filter((r) => r.rating !== null)
    const avg = rated.length ? Math.round((rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) * 10) / 10 : null
    const entry = { ok: 0, cond: 0, denied: 0 }
    const needs: Record<string, number> = {}
    let lastDenied: string | null = null
    let last: string | null = null
    for (const r of reviews) {
      const day = (r.visited_on ?? r.created_at).slice(0, 10)
      if (r.entry) {
        entry[r.entry]++
        if (!last || day > last) last = day
        if (r.entry === 'denied' && (!lastDenied || day > lastDenied)) lastDenied = day
      }
      for (const n of r.needs) needs[n] = (needs[n] ?? 0) + 1
    }
    const summary: Summary = { entry, needs, lastDenied, last }
    // 요약은 받아온 만큼(최근 MAX 개)으로 센다. 그보다 많으면 화면이 '최근 N개 기준'이라고 적는다
    return NextResponse.json({ reviews, count, avg, entry, summary, capped: count >= MAX })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, reviews: [], count: 0, avg: null }, { status: 500 })
  }
}

/** 리뷰 쓰기 */
export async function POST(req: Request) {
  if (!boardReady) return NextResponse.json({ error: '리뷰 저장소가 아직 연결되지 않았어요' }, { status: 503 })
  try {
    const { placeId, nickname, rating, entry, body, needs, visitedOn, photos, petSize, password, petKey } = await req.json()
    const viewer = await viewerOf(req)
    if (!viewer && sentToken(req)) return NextResponse.json({ error: EXPIRED }, { status: 401 })

    // 장소 이름은 화면이 보낸 것이 아니라 우리 목록에서 찾는다
    const pl = await resolvePlace({ id: placeId })
    if (!pl?.place_id) return bad('어느 장소의 리뷰인지 알 수 없어요')
    const pid = pl.place_id
    const ptitle = pl.place_title!
    if (entry != null && !['ok', 'cond', 'denied'].includes(entry)) return bad('입장 결과 값이 올바르지 않아요')

    /**
     * 두 가지 모양이 온다.
     *   현장 확인: entry 필수, 별점 없음. 한 줄 메모는 붙어도 된다. 30초에 남기는 것이라 비로그인이면 닉네임·비밀번호도 선택
     *   리뷰:     별점·글 필수 (종전 규칙 그대로)
     */
    const quick = entry != null && (rating == null || rating === 0)
    // 로그인 리뷰는 계정 이름으로 고정한다
    const nick = (viewer?.name || String(nickname ?? '')).trim() || (quick ? '방문자' : '')
    const b = String(body ?? '').trim()
    // 비밀번호가 없는 비로그인 현장 확인은 지울 수 없다 — 난수를 넣어 잠근다
    const pw = viewer || (quick && !password) ? randomBytes(24).toString('hex') : String(password ?? '')
    const rt = rating == null || rating === 0 ? null : Number(rating)
    if (!nick || nick.length > 20) return bad('닉네임은 1~20자로 적어주세요')
    if (!quick) {
      if (rt === null || !Number.isInteger(rt) || rt < 1 || rt > 5) return bad('별점을 골라주세요')
      if (!b || b.length > 1000) return bad('내용은 1~1000자로 적어주세요')
    } else if (rt !== null && (!Number.isInteger(rt) || rt < 1 || rt > 5)) return bad('별점 값이 올바르지 않아요')
    if (b.length > 1000) return bad('내용은 1000자까지예요')
    if (pw.length < 4) return bad('비밀번호는 4자 이상으로 정해주세요')
    const ph = cleanPhotos(photos)
    if (ph === null) return bad('사진은 우리 저장소에 올린 것만 4장까지 붙일 수 있어요')
    const size = ['small', 'medium', 'large'].includes(petSize) ? petSize : null
    const nd = cleanNeeds(needs)
    if (nd === null) return bad('요구된 것은 6개까지, 항목당 20자까지예요')
    const day = cleanDay(visitedOn)
    if (day === undefined) return bad('다녀온 날짜가 올바르지 않아요')

    const pet = viewer ? await petSnapshotOf(viewer.id, typeof petKey === 'string' ? petKey : null) : null
    const saved = await sbInsert<{ id: number }>('reviews', {
      place_id: pid,
      place_title: ptitle,
      nickname: nick,
      rating: rt,
      entry: entry ?? null,
      body: b,
      needs: nd,
      visited_on: day,
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

/** 요구된 것 — 문자열 배열, 항목 1~20자, 중복 제거, 6개까지. 모양이 틀리면 null */
function cleanNeeds(v: unknown): string[] | null {
  if (v == null) return []
  if (!Array.isArray(v)) return null
  const out: string[] = []
  for (const x of v) {
    if (typeof x !== 'string') return null
    const t = x.replace(/\s+/g, ' ').trim()
    if (!t) continue
    if (t.length > 20) return null
    if (!out.includes(t)) out.push(t)
  }
  return out.length > 6 ? null : out
}

/** 다녀온 날 — 없으면 null, 있으면 2020년 이후 ~ 오늘까지의 YYYY-MM-DD. 틀리면 undefined */
function cleanDay(v: unknown): string | null | undefined {
  if (v == null || v === '') return null
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined
  const t = Date.parse(v)
  if (!Number.isFinite(t)) return undefined
  const today = new Date().toISOString().slice(0, 10)
  if (v > today || v < '2020-01-01') return undefined
  return v
}
