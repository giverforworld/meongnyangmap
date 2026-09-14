import { NextResponse } from 'next/server'
import { boardReady, sbInsert, sbSelect } from '@/lib/supabase'
import { hashPassword } from '@/lib/password'
import { MAX_PHOTOS, cleanPhotos, cleanPlace, isContentId } from '@/lib/board'

export const dynamic = 'force-dynamic'

export interface Post {
  id: number
  nickname: string
  title: string
  body: string
  views: number
  created_at: string
  /** 사진 공개 URL. 없으면 빈 배열 */
  photos: string[]
  /** 어느 장소 이야기인지 — 한국관광공사 contentid. 자유글이면 null */
  place_id: string | null
  place_title: string | null
  place_addr: string | null
}

const PAGE = 20

/** 목록 — 지운 글은 빼고 최신순. place 를 주면 그 장소 글만 */
export async function GET(req: Request) {
  if (!boardReady) {
    return NextResponse.json({ posts: [], total: 0, offline: true })
  }
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const place = (searchParams.get('place') ?? '').trim()
  if (place && !isContentId(place)) return NextResponse.json({ posts: [], page: 1, hasMore: false })
  // 장소 상세에서 "최근 이야기 셋"처럼 조금만 볼 때
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || PAGE, 1), PAGE)
  const from = (page - 1) * limit

  try {
    const posts = await sbSelect<Post>(
      `posts?select=id,nickname,title,views,created_at,photos,place_id,place_title&deleted_at=is.null` +
        (place ? `&place_id=eq.${encodeURIComponent(place)}` : '') +
        `&order=created_at.desc&offset=${from}&limit=${limit}`
    )
    return NextResponse.json({ posts, page, hasMore: posts.length === limit })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, posts: [] }, { status: 500 })
  }
}

/** 글쓰기 */
export async function POST(req: Request) {
  if (!boardReady) {
    return NextResponse.json({ error: '게시판이 아직 연결되지 않았어요' }, { status: 503 })
  }
  try {
    const { nickname, title, body, password, photos, place } = await req.json()

    // 화면에서도 막지만, 요청은 화면을 거치지 않고도 올 수 있다
    const nick = String(nickname ?? '').trim()
    const t = String(title ?? '').trim()
    const b = String(body ?? '').trim()
    const pw = String(password ?? '')
    if (!nick || nick.length > 20) return bad('닉네임은 1~20자로 적어주세요')
    if (!t || t.length > 80) return bad('제목은 1~80자로 적어주세요')
    if (!b || b.length > 4000) return bad('내용은 1~4000자로 적어주세요')
    if (pw.length < 4) return bad('비밀번호는 4자 이상으로 정해주세요')

    const ph = cleanPhotos(photos)
    if (ph === null) return bad(`사진은 우리 저장소에 올린 것만 ${MAX_PHOTOS}장까지 붙일 수 있어요`)
    const pl = cleanPlace(place)
    if (pl === null) return bad('장소 정보가 올바르지 않아요')

    const saved = await sbInsert<{ id: number }>('posts', {
      nickname: nick,
      title: t,
      body: b,
      password_hash: hashPassword(pw),
      photos: ph,
      ...pl,
    })
    return NextResponse.json({ id: saved.id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 })
