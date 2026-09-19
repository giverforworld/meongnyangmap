import { NextResponse } from 'next/server'
import { boardReady, sbSelect, sbUpdate } from '@/lib/supabase'
import { verifyPassword } from '@/lib/password'
import { viewerOf } from '@/lib/auth'
import { cleanPhotos, MAX_PHOTOS, resolvePlace } from '@/lib/board'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** 글 한 편 — 열 때마다 조회수를 올린다. 로그인해서 보면 내 글인지(mine)도 알려준다 */
export async function GET(req: Request, { params }: Ctx) {
  if (!boardReady) return NextResponse.json({ error: '게시판이 연결되지 않았어요' }, { status: 503 })
  const { id } = await params

  try {
    const rows = await sbSelect<any>(
      `posts?select=id,nickname,title,body,views,created_at,edited_at,photos,place_id,place_title,place_addr,author_id,author_avatar,author_provider,pet_name,pet_emoji,pet_label&id=eq.${Number(id)}&deleted_at=is.null`
    )
    if (rows.length === 0) return NextResponse.json({ error: '없는 글이에요' }, { status: 404 })

    // 조회수는 실패해도 글은 보여준다
    sbUpdate('posts', `id=eq.${Number(id)}`, { views: rows[0].views + 1 }).catch(() => {})
    // 계정 id 는 밖으로 내지 않는다 — 내 글인지만
    const { author_id, ...post } = rows[0]
    const viewer = author_id ? await viewerOf(req) : null
    return NextResponse.json({ post: { ...post, mine: Boolean(viewer && viewer.id === author_id), byAccount: Boolean(author_id) } })
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

/**
 * 수정 — 지우기와 같은 문턱: 내 계정 글이면 그냥, 아니면 비밀번호.
 * `verify: true` 만 보내면 고치지 않고 비밀번호가 맞는지만 답한다 — 폼을 열기 전에 확인하려는 화면용.
 * 작성자·닉네임·반려동물 표시는 바꾸지 않는다. 제목·내용·사진·장소만.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!boardReady) return NextResponse.json({ error: '게시판이 연결되지 않았어요' }, { status: 503 })
  const { id } = await params

  try {
    const input = await req.json().catch(() => ({}))
    const rows = await sbSelect<any>(`posts?select=id,password_hash,author_id&id=eq.${Number(id)}&deleted_at=is.null`)
    if (rows.length === 0) return NextResponse.json({ error: '없는 글이에요' }, { status: 404 })
    const viewer = rows[0].author_id ? await viewerOf(req) : null
    const mine = Boolean(viewer && viewer.id === rows[0].author_id)
    if (!mine && !verifyPassword(String(input.password ?? ''), rows[0].password_hash)) {
      return NextResponse.json({ error: rows[0].author_id ? '이 글을 쓴 계정으로 로그인해야 고칠 수 있어요' : '비밀번호가 달라요' }, { status: 403 })
    }
    if (input.verify) return NextResponse.json({ ok: true })

    const t = String(input.title ?? '').trim()
    const b = String(input.body ?? '').trim()
    if (!t || t.length > 80) return NextResponse.json({ error: '제목은 1~80자로 적어주세요' }, { status: 400 })
    if (!b || b.length > 4000) return NextResponse.json({ error: '내용은 1~4000자로 적어주세요' }, { status: 400 })
    const ph = cleanPhotos(input.photos)
    if (ph === null) return NextResponse.json({ error: `사진은 우리 저장소에 올린 것만 ${MAX_PHOTOS}장까지 붙일 수 있어요` }, { status: 400 })
    // place 를 안 보내면 그대로, null 이면 떼고, 보내면 우리 목록에서 다시 찾는다
    const patch: Record<string, unknown> = { title: t, body: b, photos: ph, edited_at: new Date().toISOString() }
    if ('place' in input) {
      const pl = await resolvePlace(input.place)
      if (pl === null) return NextResponse.json({ error: '연결하려는 장소를 찾지 못했어요' }, { status: 400 })
      Object.assign(patch, pl)
    }
    await sbUpdate('posts', `id=eq.${Number(id)}`, patch)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
