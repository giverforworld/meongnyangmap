import { NextResponse } from 'next/server'
import { boardReady, sbSelect, sbUpdate } from '@/lib/supabase'
import { verifyPassword } from '@/lib/password'
import { viewerOf } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** 글 한 편 — 열 때마다 조회수를 올린다. 로그인해서 보면 내 글인지(mine)도 알려준다 */
export async function GET(req: Request, { params }: Ctx) {
  if (!boardReady) return NextResponse.json({ error: '게시판이 연결되지 않았어요' }, { status: 503 })
  const { id } = await params

  try {
    const rows = await sbSelect<any>(
      `posts?select=id,nickname,title,body,views,created_at,photos,place_id,place_title,place_addr,author_id,author_avatar,author_provider,pet_name,pet_emoji,pet_label&id=eq.${Number(id)}&deleted_at=is.null`
    )
    if (rows.length === 0) return NextResponse.json({ error: '없는 글이에요' }, { status: 404 })

    // 조회수는 실패해도 글은 보여준다
    sbUpdate('posts', `id=eq.${Number(id)}`, { views: rows[0].views + 1 }).catch(() => {})
    // 계정 id 는 밖으로 내지 않는다 — 내 글인지만
    const { author_id, ...post } = rows[0]
    const viewer = author_id ? await viewerOf(req) : null
    return NextResponse.json({ post: { ...post, mine: Boolean(viewer && viewer.id === author_id) } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** 삭제 — 내 계정 글이면 그냥, 아니면 비밀번호가 맞아야 한다. 실제로 지우지 않고 표시만 한다 */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!boardReady) return NextResponse.json({ error: '게시판이 연결되지 않았어요' }, { status: 503 })
  const { id } = await params

  try {
    const { password } = await req.json().catch(() => ({}))
    const rows = await sbSelect<any>(
      `posts?select=id,password_hash,author_id&id=eq.${Number(id)}&deleted_at=is.null`
    )
    if (rows.length === 0) return NextResponse.json({ error: '없는 글이에요' }, { status: 404 })
    const viewer = rows[0].author_id ? await viewerOf(req) : null
    const mine = Boolean(viewer && viewer.id === rows[0].author_id)
    if (!mine && !verifyPassword(String(password ?? ''), rows[0].password_hash)) {
      return NextResponse.json({ error: rows[0].author_id ? '이 글을 쓴 계정으로 로그인해야 지울 수 있어요' : '비밀번호가 달라요' }, { status: 403 })
    }
    await sbUpdate('posts', `id=eq.${Number(id)}`, { deleted_at: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
