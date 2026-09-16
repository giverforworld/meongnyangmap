import { NextResponse } from 'next/server'
import { boardReady, sbSelect, sbUpdate } from '@/lib/supabase'
import { verifyPassword } from '@/lib/password'
import { viewerOf } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** 댓글 삭제 — 내 계정 댓글이면 그냥, 아니면 비밀번호. 표시만 한다 */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!boardReady) return NextResponse.json({ error: '게시판이 연결되지 않았어요' }, { status: 503 })
  const { id } = await params
  const n = Number(id)
  if (!Number.isInteger(n)) return NextResponse.json({ error: '없는 댓글이에요' }, { status: 404 })
  try {
    const { password } = await req.json().catch(() => ({}))
    const rows = await sbSelect<{ id: number; password_hash: string; author_id: string | null }>(
      `comments?select=id,password_hash,author_id&id=eq.${n}&deleted_at=is.null`
    )
    if (rows.length === 0) return NextResponse.json({ error: '없는 댓글이에요' }, { status: 404 })
    const viewer = rows[0].author_id ? await viewerOf(req) : null
    const mine = Boolean(viewer && viewer.id === rows[0].author_id)
    if (!mine && !verifyPassword(String(password ?? ''), rows[0].password_hash)) {
      return NextResponse.json({ error: rows[0].author_id ? '이 댓글을 쓴 계정으로 로그인해야 지울 수 있어요' : '비밀번호가 달라요' }, { status: 403 })
    }
    await sbUpdate('comments', `id=eq.${n}`, { deleted_at: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
