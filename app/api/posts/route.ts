import { NextResponse } from 'next/server'
import { boardReady, sbInsert, sbSelect } from '@/lib/supabase'
import { hashPassword } from '@/lib/password'

export const dynamic = 'force-dynamic'

export interface Post {
  id: number
  nickname: string
  title: string
  body: string
  views: number
  created_at: string
}

const PAGE = 20

/** 목록 — 지운 글은 빼고 최신순 */
export async function GET(req: Request) {
  if (!boardReady) {
    return NextResponse.json({ posts: [], total: 0, offline: true })
  }
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const from = (page - 1) * PAGE

  try {
    const posts = await sbSelect<Post>(
      `posts?select=id,nickname,title,views,created_at&deleted_at=is.null` +
        `&order=created_at.desc&offset=${from}&limit=${PAGE}`
    )
    return NextResponse.json({ posts, page, hasMore: posts.length === PAGE })
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
    const { nickname, title, body, password } = await req.json()

    // 화면에서도 막지만, 요청은 화면을 거치지 않고도 올 수 있다
    const nick = String(nickname ?? '').trim()
    const t = String(title ?? '').trim()
    const b = String(body ?? '').trim()
    const pw = String(password ?? '')
    if (!nick || nick.length > 20) return bad('닉네임은 1~20자로 적어주세요')
    if (!t || t.length > 80) return bad('제목은 1~80자로 적어주세요')
    if (!b || b.length > 4000) return bad('내용은 1~4000자로 적어주세요')
    if (pw.length < 4) return bad('비밀번호는 4자 이상으로 정해주세요')

    const saved = await sbInsert<{ id: number }>('posts', {
      nickname: nick,
      title: t,
      body: b,
      password_hash: hashPassword(pw),
    })
    return NextResponse.json({ id: saved.id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 })
