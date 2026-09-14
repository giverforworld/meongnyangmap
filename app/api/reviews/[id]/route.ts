import { NextResponse } from 'next/server'
import { boardReady, sbSelect, sbUpdate } from '@/lib/supabase'
import { verifyPassword } from '@/lib/password'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** 리뷰 삭제 — 비밀번호가 맞아야 한다. 게시글처럼 표시만 한다 */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!boardReady) return NextResponse.json({ error: '리뷰 저장소가 연결되지 않았어요' }, { status: 503 })
  const { id } = await params
  const n = Number(id)
  if (!Number.isInteger(n)) return NextResponse.json({ error: '없는 리뷰예요' }, { status: 404 })

  try {
    const { password } = await req.json()
    const rows = await sbSelect<{ id: number; password_hash: string }>(
      `reviews?select=id,password_hash&id=eq.${n}&deleted_at=is.null`
    )
    if (rows.length === 0) return NextResponse.json({ error: '없는 리뷰예요' }, { status: 404 })
    if (!verifyPassword(String(password ?? ''), rows[0].password_hash)) {
      return NextResponse.json({ error: '비밀번호가 달라요' }, { status: 403 })
    }
    await sbUpdate('reviews', `id=eq.${n}`, { deleted_at: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
