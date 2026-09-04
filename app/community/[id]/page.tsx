'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Post {
  id: number
  nickname: string
  title: string
  body: string
  views: number
  created_at: string
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

  useEffect(() => {
    fetch(`/api/posts/${id}`)
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
      headers: { 'Content-Type': 'application/json' },
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#A08872', paddingBottom: 14, borderBottom: '1px solid #F3EEE4' }}>
                <b style={{ color: '#6E5F4D' }}>{post.nickname}</b>
                <span>{new Date(post.created_at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span style={{ marginLeft: 'auto' }}>조회 {post.views}</span>
              </div>
              {/* 사용자가 쓴 글이라 그대로 보여준다. React 가 escape 하므로 HTML 은 실행되지 않는다 */}
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.8, color: '#3E3830', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {post.body}
              </p>
            </article>

            {!asking ? (
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
