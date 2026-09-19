'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Author from '../../Author'
import { authHeaders } from '@/lib/authHeader'
import { PlacePinIcon } from '../../icons'
import Comments from '../../Comments'
import { usePetsContext } from '../../PetsProvider'
import PlacePicker, { type PlaceRef } from '../../PlacePicker'
import PhotoPicker from '../../PhotoPicker'

interface Post {
  id: number
  nickname: string
  title: string
  body: string
  views: number
  created_at: string
  /** 고친 적 있으면 그 시각 */
  edited_at?: string | null
  photos: string[]
  place_id: string | null
  place_title: string | null
  place_addr: string | null
  author_avatar: string | null
  author_provider: string | null
  pet_name: string | null
  pet_emoji: string | null
  pet_label: string | null
  /** 로그인한 내가 쓴 글 — 비밀번호 없이 지운다 */
  mine?: boolean
  /** 계정으로 쓴 글 — 지우기는 쓴 사람에게만 보인다 */
  byAccount?: boolean
}

const editField: React.CSSProperties = {
  font: 'inherit', fontSize: 14, padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid #EAE3D6', background: '#FFFFFF', color: '#2B2420', outline: 'none', width: '100%',
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const petStore = usePetsContext()
  const m = petStore.session?.user.user_metadata ?? {}
  const sessionNick = ((m.nickname as string) || (m.name as string) || '').slice(0, 20)

  const [post, setPost] = useState<Post | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [asking, setAsking] = useState(false)
  const [password, setPassword] = useState('')
  const [delError, setDelError] = useState('')
  /** 크게 보는 사진의 순번. null 이면 닫힘 */
  const [viewing, setViewing] = useState<number | null>(null)
  /** 수정 — 'ask' 는 비회원 글의 비밀번호 확인 단계, 'edit' 은 폼 */
  const [editing, setEditing] = useState<'ask' | 'edit' | null>(null)
  const [editPw, setEditPw] = useState('')
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)
  const [eTitle, setETitle] = useState('')
  const [eBody, setEBody] = useState('')
  const [ePhotos, setEPhotos] = useState<string[]>([])
  const [ePlace, setEPlace] = useState<PlaceRef | null>(null)

  /** 폼을 현재 글 내용으로 채워서 연다 */
  function openEdit() {
    if (!post) return
    setETitle(post.title); setEBody(post.body); setEPhotos(post.photos ?? [])
    setEPlace(post.place_id && post.place_title ? { id: post.place_id, title: post.place_title, addr: post.place_addr ?? '' } : null)
    setEditError('')
    setEditing('edit')
  }

  /** 비회원 글 — 비밀번호가 맞는지 먼저 확인하고 폼을 연다. 다 고친 뒤에 틀렸다고 하면 허탈하다 */
  async function verifyThenEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditError('')
    const r = await fetch(`/api/posts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ password: editPw, verify: true }) })
    const d = await r.json()
    if (!r.ok) return setEditError(d.error ?? '확인하지 못했어요')
    openEdit()
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setEditError('')
    setSaving(true)
    try {
      const r = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ password: editPw, title: eTitle, body: eBody, photos: ePhotos, place: ePlace ? { id: ePlace.id } : null }),
      })
      const d = await r.json()
      if (!r.ok) return setEditError(d.error ?? '고치지 못했어요')
      setPost({ ...post!, title: eTitle.trim(), body: eBody.trim(), photos: ePhotos, place_id: ePlace?.id ?? null, place_title: ePlace?.title ?? null, place_addr: ePlace?.addr ?? null, edited_at: new Date().toISOString() })
      setEditing(null); setEditPw('')
    } catch {
      setEditError('고치지 못했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    authHeaders()
      .then((h) => fetch(`/api/posts/${id}`, { headers: h }))
      .then((r) => r.json())
      .then((d) => (d.post ? setPost(d.post) : setError(d.error ?? '글을 찾지 못했어요')))
      .catch(() => setError('글을 불러오지 못했어요'))
      .finally(() => setLoading(false))
  }, [id])

  async function remove(e: React.FormEvent) {
    e.preventDefault()
    setDelError('')
    // 되돌릴 수 없는 일이라 한 번 더 묻는다
    if (!window.confirm('이 글을 지울까요? 댓글도 함께 사라지고 되돌릴 수 없어요.')) return
    const r = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ password }),
    })
    const d = await r.json()
    if (!r.ok) {
      setDelError(d.error ?? '지우지 못했어요')
      return
    }
    router.push('/community')
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#FAF6EF' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 56px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Link href="/community" style={{ fontSize: 13.5, fontWeight: 700, color: '#8A7A65', textDecoration: 'none' }}>
          ← 커뮤니티
        </Link>

        {loading && <p style={{ padding: 40, textAlign: 'center', color: '#A08872', fontSize: 13.5 }}>불러오는 중…</p>}
        {error && <p style={{ padding: 40, textAlign: 'center', color: '#C0392B', fontSize: 13.5 }}>{error}</p>}

        {post && (
          <>
            <article style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: '#2B2420', lineHeight: 1.4, wordBreak: 'keep-all' }}>
                {post.title}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#A08872', paddingBottom: 14, borderBottom: '1px solid #F3EEE4', flexWrap: 'wrap' }}>
                <Author a={post} size={24} fontSize={13} />
                <span>{new Date(post.created_at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                {post.edited_at && <span title={new Date(post.edited_at).toLocaleString('ko-KR')} style={{ color: '#C4B8A4' }}>· 수정됨</span>}
                <span style={{ marginLeft: 'auto' }}>조회 {post.views}</span>
              </div>
              {/* 어느 곳 이야기인지 — 누르면 지도에서 그 장소가 열린다 */}
              {post.place_id && post.place_title && (
                <Link href={`/?focus=${post.place_id}`} className="hov-accent"
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 12, border: '1.5px solid #F3C9BB', background: '#FFF4EF', textDecoration: 'none' }}>
                  <span style={{ color: '#E85D3D', flex: 'none', display: 'flex' }}><PlacePinIcon size={18} /></span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                    <b style={{ fontSize: 13.5, color: '#2B2420' }}>{post.place_title}</b>
                    {post.place_addr && <span style={{ fontSize: 11.5, color: '#A08872' }}>{post.place_addr}</span>}
                  </span>
                  <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: '#E85D3D' }}>지도에서 보기 →</span>
                </Link>
              )}
              {post.place_id && (
                <span style={{ fontSize: 10.5, color: '#B3A78F', marginTop: -8 }}>장소 정보 · 데이터 출처: ⓒ한국관광공사</span>
              )}

              {editing === 'edit' && (
                <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1.5px solid #F3C9BB', background: '#FFFBF9', borderRadius: 12, padding: 12 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#E85D3D' }}>글 수정</span>
                  <input value={eTitle} onChange={(e) => setETitle(e.target.value)} maxLength={80} required placeholder="제목" style={editField} />
                  <PlacePicker value={ePlace} onChange={setEPlace} />
                  <textarea value={eBody} onChange={(e) => setEBody(e.target.value)} maxLength={4000} rows={8} required placeholder="내용"
                    style={{ ...editField, resize: 'vertical', lineHeight: 1.7 }} />
                  <PhotoPicker photos={ePhotos} onChange={setEPhotos} />
                  {editError && <span style={{ fontSize: 12.5, color: '#C0392B' }}>{editError}</span>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => { setEditing(null); setEditError('') }}
                      style={{ fontFamily: 'inherit', fontSize: 13.5, padding: '9px 14px', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
                      취소
                    </button>
                    <button type="submit" disabled={saving} className="btn-primary"
                      style={{ flex: 1, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '9px 0', borderRadius: 10, border: 'none', background: saving ? '#C4B8A4' : '#E85D3D', color: '#FFFFFF', cursor: saving ? 'default' : 'pointer' }}>
                      {saving ? '저장 중…' : '저장'}
                    </button>
                  </div>
                </form>
              )}

              {/* 사용자가 쓴 글이라 그대로 보여준다. React 가 escape 하므로 HTML 은 실행되지 않는다 */}
              {editing !== 'edit' && (
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.8, color: '#3E3830', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {post.body}
              </p>
              )}

              {editing !== 'edit' && post.photos?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: post.photos.length === 1 ? '1fr' : 'repeat(2, 1fr)', gap: 8 }}>
                  {post.photos.map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt={`사진 ${i + 1}`} onClick={() => setViewing(i)}
                      style={{ width: '100%', aspectRatio: post.photos.length === 1 ? 'auto' : '4 / 3', maxHeight: 520, objectFit: 'cover', borderRadius: 12, border: '1px solid #F3EEE4', cursor: 'zoom-in', display: 'block' }} />
                  ))}
                </div>
              )}
            </article>

            {viewing !== null && post.photos[viewing] && (
              <div onClick={() => setViewing(null)} role="dialog" aria-label="사진 크게 보기"
                style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,16,12,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.photos[viewing]} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
              </div>
            )}

            {post.mine ? (
              <form onSubmit={remove} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: '#B3A78F' }}>내 계정으로 쓴 글이에요</span>
                {editing !== 'edit' && (
                  <button type="button" onClick={openEdit}
                    style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#2B2420', cursor: 'pointer' }}>
                    수정
                  </button>
                )}
                <button type="submit"
                  style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#C0392B', cursor: 'pointer' }}>
                  글 지우기
                </button>
                {delError && <span style={{ fontSize: 12.5, color: '#C0392B' }}>{delError}</span>}
              </form>
            ) : post.byAccount ? null : editing === 'ask' ? (
              // 비회원 글 수정 — 비밀번호가 맞는지 먼저 본다
              <form onSubmit={verifyThenEdit} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input value={editPw} onChange={(e) => setEditPw(e.target.value)} type="password" placeholder="비밀번호" required autoFocus style={{ ...editField, width: 150, padding: '8px 12px' }} />
                <button type="submit"
                  style={{ fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#E85D3D', color: '#FFFFFF', cursor: 'pointer' }}>
                  수정하기
                </button>
                <button type="button" onClick={() => { setEditing(null); setEditPw(''); setEditError('') }}
                  style={{ fontFamily: 'inherit', fontSize: 13.5, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
                  취소
                </button>
                {editError && <span style={{ fontSize: 12.5, color: '#C0392B', width: '100%', textAlign: 'right' }}>{editError}</span>}
              </form>
            ) : !asking && editing !== 'edit' ? (
              <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 14 }}>
                <button onClick={() => { setEditing('ask'); setEditError('') }}
                  style={{ fontFamily: 'inherit', fontSize: 13, color: '#8A7A65', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  수정
                </button>
                <button onClick={() => setAsking(true)}
                  style={{ fontFamily: 'inherit', fontSize: 13, color: '#B3A78F', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  글 지우기
                </button>
              </div>
            ) : editing === 'edit' ? null : (
              <form onSubmit={remove}
                style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input value={password} onChange={(e) => setPassword(e.target.value)}
                  type="password" placeholder="비밀번호" required autoFocus
                  style={{ font: 'inherit', fontSize: 13.5, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #EAE3D6', background: '#FFFFFF', outline: 'none', width: 150 }} />
                <button type="submit"
                  style={{ fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#C0392B', color: '#FFFFFF', cursor: 'pointer' }}>
                  지우기
                </button>
                <button type="button" onClick={() => { setAsking(false); setDelError('') }}
                  style={{ fontFamily: 'inherit', fontSize: 13.5, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
                  취소
                </button>
                {delError && <span style={{ fontSize: 12.5, color: '#C0392B', width: '100%', textAlign: 'right' }}>{delError}</span>}
              </form>
            )}

            <Comments
              postId={post.id}
              loggedIn={Boolean(petStore.session)}
              provider={petStore.session?.user.app_metadata?.provider as string | undefined}
              nickname={sessionNick}
              pet={petStore.pet}
            />
          </>
        )}
      </div>
    </div>
  )
}
