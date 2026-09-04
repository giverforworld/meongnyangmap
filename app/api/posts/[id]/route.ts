import { NextResponse } from 'next/server'
import { boardReady, sbSelect, sbUpdate } from '@/lib/supabase'
import { verifyPassword } from '@/lib/password'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** 글 한 편 — 열 때마다 조회수를 올린다 */
export async function GET(_req: Request, { params }: Ctx) {
  if (!boardReady) return NextResponse.json({ error: '게시판이 연결되지 않았어요' }, { status: 503 })
  const { id } = await params

  try {
    const rows = await sbSelect<any>(
      `posts?select=id,nickname,title,body,views,created_at&id=eq.${Number(id)}&deleted_at=is.null`
    )
    if (rows.length === 0) return NextResponse.json({ error: '없는 글이에요' }, { status: 404 })

    // 조회수는 실패해도 글은 보여준다
    sbUpdate('posts', `id=eq.${Number(id)}`, { views: rows[0].views + 1 }).catch(() => {})
    return NextResponse.json({ post: rows[0] })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** 삭제 — 비밀번호가 맞아야 한다. 실제로 지우지 않고 표시만 한다 */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!boardReady) return NextResponse.json({ error: '게시판이 연결되지 않았어요' }, { status: 503 })
  const { id } = await params

  try {
    const { password } = await req.json()
    const rows = await sbSelect<any>(
      `posts?select=id,password_hash&id=eq.${Number(id)}&deleted_at=is.null`
    )
    if (rows.length === 0) return NextResponse.json({ error: '없는 글이에요' }, { status: 404 })
    if (!verifyPassword(String(password ?? ''), rows[0].password_hash)) {
      return NextResponse.json({ error: '비밀번호가 달라요' }, { status: 403 })
    }
    await sbUpdate('posts', `id=eq.${Number(id)}`, { deleted_at: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
