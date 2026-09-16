'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Author from '../../Author'
import { authHeaders } from '@/lib/authHeader'

interface Post {
  id: number
  nickname: string
  title: string
  body: string
  views: number
  created_at: string
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
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [post, setPost] = useState<Post | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [asking, setAsking] = useState(false)
  const [password, setPassword] = useState('')
  const [delError, setDelError] = useState('')
  /** 크게 보는 사진의 순번. null 이면 닫힘 */
  const [viewing, setViewing] = useState<number | null>(null)

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
                <span style={{ marginLeft: 'auto' }}>조회 {post.views}</span>
              </div>
              {/* 어느 곳 이야기인지 — 누르면 지도에서 그 장소가 열린다 */}
              {post.place_id && post.place_title && (
                <Link href={`/?focus=${post.place_id}`} className="hov-accent"
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 12, border: '1.5px solid #F3C9BB', background: '#FFF4EF', textDecoration: 'none' }}>
                  <span style={{ fontSize: 14, flex: 'none' }}>📍</span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                    <b style={{ fontSize: 13.5, color: '#2B2420' }}>{post.place_title}</b>
                    {post.place_addr && <span style={{ fontSize: 11.5, color: '#A08872' }}>{post.place_addr}</span>}
                  </span>
                  <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: '#E85D3D' }}>지도에서 보기 →</span>
                </Link>
              )}
              {post.place_id && (
                <span style={{ fontSize: 10.5, color: '#B3A78F', marginTop: -8 }}>장소 정보 출처 ⓒ한국관광공사</span>
              )}

              {/* 사용자가 쓴 글이라 그대로 보여준다. React 가 escape 하므로 HTML 은 실행되지 않는다 */}
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.8, color: '#3E3830', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {post.body}
              </p>

              {post.photos?.length > 0 && (
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
              <form onSubmit={remove} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, color: '#B3A78F' }}>내 계정으로 쓴 글이에요</span>
                <button type="submit"
                  style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#C0392B', cursor: 'pointer' }}>
                  글 지우기
                </button>
                {delError && <span style={{ fontSize: 12.5, color: '#C0392B' }}>{delError}</span>}
              </form>
            ) : !asking ? (
              <button onClick={() => setAsking(true)}
                style={{ alignSelf: 'flex-end', fontFamily: 'inherit', fontSize: 13, color: '#B3A78F', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                글 지우기
              </button>
            ) : (
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
          </>
        )}
      </div>
    </div>
  )
}
