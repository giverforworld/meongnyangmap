'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'

interface Post {
  id: number
  nickname: string
  title: string
  views: number
  created_at: string
}

/** 오늘 쓴 글은 시간만, 그 전은 날짜만 — 목록에서 눈이 덜 피곤하다 */
function when(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : `${d.getMonth() + 1}.${d.getDate()}`
}

export default function Community() {
  const isMobile = useIsMobile()
  const [posts, setPosts] = useState<Post[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [writing, setWriting] = useState(false)

  const [nickname, setNickname] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function load(p: number) {
    setLoading(true)
    fetch(`/api/posts?page=${p}`)
      .then((r) => r.json())
      .then((d) => {
        setOffline(Boolean(d.offline))
        setPosts((prev) => (p === 1 ? d.posts ?? [] : [...prev, ...(d.posts ?? [])]))
        setHasMore(Boolean(d.hasMore))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => load(1), [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const r = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, title, body, password }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error ?? '글을 올리지 못했어요')
        return
      }
      setTitle('')
      setBody('')
      setPassword('')
      setWriting(false)
      setPage(1)
      load(1)
    } catch {
      setError('글을 올리지 못했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setSaving(false)
    }
  }

  const field: React.CSSProperties = {
    font: 'inherit',
    fontSize: 14,
    padding: '10px 12px',
    borderRadius: 12,
    border: '1.5px solid #EAE3D6',
    background: '#FFFFFF',
    color: '#2B2420',
    outline: 'none',
    width: '100%',
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#FAF6EF' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: isMobile ? '20px 14px 48px' : '28px 20px 56px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <header style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'flex-end', justifyContent: 'space-between', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h1 className="jua" style={{ margin: 0, fontSize: isMobile ? 23 : 26, color: '#2B2420' }}>커뮤니티</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: '#8A7A65', wordBreak: 'keep-all' }}>
              우리 아이랑 다녀온 곳, 좋았던 순간을 나눠요
            </p>
          </div>
          {!offline && (
            <button className="btn-primary" onClick={() => setWriting((v) => !v)}
              style={{ flex: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '11px 20px', borderRadius: 12, border: 'none', background: writing ? '#8A7A65' : '#E85D3D', color: '#FFFFFF', cursor: 'pointer' }}>
              {writing ? '접기' : '글쓰기'}
            </button>
          )}
        </header>

        {offline && (
          <div style={{ background: '#FBF3DD', border: '1.5px solid #F0D9A0', borderRadius: 14, padding: '14px 16px', fontSize: 13.5, color: '#8A6208', lineHeight: 1.6 }}>
            게시판이 아직 연결되지 않았어요. <code>supabase/board.sql</code> 을 실행하고
            <code> SUPABASE_URL</code>·<code>SUPABASE_SERVICE_ROLE_KEY</code> 를 넣으면 바로 열립니다.
          </div>
        )}

        {writing && (
          <form onSubmit={submit}
            style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임" maxLength={20} required style={{ ...field, flex: '1 1 160px' }} />
              <input value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 (지울 때 필요해요)" type="password" minLength={4} required
                style={{ ...field, flex: '1 1 200px' }} />
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="제목" maxLength={80} required style={field} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="어디를 다녀오셨나요? 우리 아이는 어땠나요?" maxLength={4000} rows={7} required
              style={{ ...field, resize: 'vertical', lineHeight: 1.6 }} />
            {error && <p style={{ margin: 0, fontSize: 13, color: '#C0392B' }}>{error}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" disabled={saving} className="btn-primary"
                style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '10px 22px', borderRadius: 12, border: 'none', background: saving ? '#C4B8A4' : '#E85D3D', color: '#FFFFFF', cursor: saving ? 'default' : 'pointer' }}>
                {saving ? '올리는 중…' : '올리기'}
              </button>
              <span style={{ fontSize: 12, color: '#B3A78F' }}>{body.length} / 4000자</span>
            </div>
          </form>
        )}

        {/* 목록 */}
        <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, overflow: 'hidden' }}>
          {loading && posts.length === 0 && (
            <p style={{ padding: 40, textAlign: 'center', fontSize: 13.5, color: '#A08872' }}>불러오는 중…</p>
          )}
          {!loading && posts.length === 0 && !offline && (
            <p style={{ padding: 44, textAlign: 'center', fontSize: 13.5, color: '#A08872', lineHeight: 1.7 }}>
              아직 글이 없어요.<br />첫 글을 남겨주세요 🐾
            </p>
          )}
          {posts.map((p, i) => (
            <Link key={p.id} href={`/community/${p.id}`} className="hov-row"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px', textDecoration: 'none', borderTop: i === 0 ? 'none' : '1px solid #F3EEE4' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: '#2B2420', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.title}
              </span>
              <span style={{ flex: 'none', fontSize: 12.5, color: '#8A7A65', maxWidth: isMobile ? 70 : 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.nickname}
              </span>
              <span style={{ flex: 'none', fontSize: 12, color: '#B3A78F', width: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {when(p.created_at)}
              </span>
              {/* 좁은 화면에서는 조회수를 뺀다 — 제목이 잘리는 쪽이 손해가 크다 */}
              {!isMobile && (
                <span style={{ flex: 'none', fontSize: 12, color: '#C4B8A4', width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {p.views}
                </span>
              )}
            </Link>
          ))}
        </div>

        {hasMore && (
          <button className="hov-accent" onClick={() => { const n = page + 1; setPage(n); load(n) }}
            style={{ alignSelf: 'center', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '11px 28px', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
            더 보기
          </button>
        )}
      </div>
    </div>
  )
}
