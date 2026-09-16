import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { boardReady, sbInsert, sbSelect } from '@/lib/supabase'
import { hashPassword } from '@/lib/password'
import { petSnapshotOf, viewerOf } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export interface Comment {
  id: number
  nickname: string
  body: string
  created_at: string
  author_avatar: string | null
  author_provider: string | null
  pet_name: string | null
  pet_emoji: string | null
  pet_label: string | null
  /** 로그인해서 보는 사람의 것인지 — 서버가 계정으로 확인 */
  mine: boolean
  /** 계정으로 쓴 댓글인지 — 지우기 버튼을 누구에게 보일지 정한다 */
  byAccount: boolean
}

const MAX = 200

/** 한 글의 댓글 — 오래된 것부터 */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params
  const pid = Number(id)
  if (!Number.isInteger(pid)) return NextResponse.json({ comments: [] })
  if (!boardReady) return NextResponse.json({ comments: [], offline: true })
  try {
    const rows = await sbSelect<Comment & { author_id: string | null }>(
      `comments?select=id,nickname,body,created_at,author_id,author_avatar,author_provider,pet_name,pet_emoji,pet_label` +
        `&post_id=eq.${pid}&deleted_at=is.null&order=created_at.asc&limit=${MAX}`
    )
    const viewer = rows.some((r) => r.author_id) ? await viewerOf(req) : null
    // 계정 id 는 밖으로 내지 않는다
    const comments = rows.map(({ author_id, ...r }) => ({
      ...r,
      mine: Boolean(viewer && viewer.id === author_id),
      byAccount: Boolean(author_id),
    }))
    return NextResponse.json({ comments })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, comments: [] }, { status: 500 })
  }
}

/** 댓글 쓰기 — 로그인이면 계정으로, 아니면 닉네임+비밀번호 */
export async function POST(req: Request, { params }: Ctx) {
  if (!boardReady) return NextResponse.json({ error: '게시판이 아직 연결되지 않았어요' }, { status: 503 })
  const { id } = await params
  const pid = Number(id)
  if (!Number.isInteger(pid)) return bad('없는 글이에요')
  try {
    const { nickname, body, password, petKey } = await req.json()
    const viewer = await viewerOf(req)

    const nick = (viewer?.name || String(nickname ?? '')).trim()
    const b = String(body ?? '').trim()
    const pw = viewer ? randomBytes(24).toString('hex') : String(password ?? '')
    if (!nick || nick.length > 20) return bad('닉네임은 1~20자로 적어주세요')
    if (!b || b.length > 1000) return bad('댓글은 1~1000자로 적어주세요')
    if (pw.length < 4) return bad('비밀번호는 4자 이상으로 정해주세요')

    // 지운 글에는 못 단다
    const post = await sbSelect<{ id: number }>(`posts?select=id&id=eq.${pid}&deleted_at=is.null`)
    if (post.length === 0) return NextResponse.json({ error: '없는 글이에요' }, { status: 404 })

    const pet = viewer ? await petSnapshotOf(viewer.id, typeof petKey === 'string' ? petKey : null) : null
    const saved = await sbInsert<{ id: number }>('comments', {
      post_id: pid,
      nickname: nick,
      body: b,
      password_hash: hashPassword(pw),
      author_id: viewer?.id ?? null,
      author_name: viewer?.name ?? null,
      author_avatar: viewer?.avatar ?? null,
      author_provider: viewer?.provider ?? null,
      ...(pet ?? { pet_name: null, pet_emoji: null, pet_label: null }),
    })
    return NextResponse.json({ id: saved.id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 })
