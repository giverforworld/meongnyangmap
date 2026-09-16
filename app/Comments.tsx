'use client'

import { useEffect, useRef, useState } from 'react'
import type { Pet } from '@/lib/types'
import Author from './Author'
import { ProviderMark } from './PetSwitch'
import { authHeaders } from '@/lib/authHeader'

/**
 * 글 아래 댓글.
 *
 * 글과 같은 규칙 — 로그인이면 계정으로 달리고(이름 고정, 비밀번호 없음, 내 것만 지운다),
 * 아니면 닉네임+비밀번호로 달리고 누구나 비밀번호로 지울 수 있다.
 * 계정 댓글의 '지우기'는 쓴 사람에게만 보인다. 남이 눌러봐야 안 되는 버튼은 안 보이는 게 맞다.
 */
interface Comment {
  id: number
  nickname: string
  body: string
  created_at: string
  author_avatar: string | null
  author_provider: string | null
  pet_name: string | null
  pet_emoji: string | null
  pet_label: string | null
  mine: boolean
  byAccount: boolean
}

const field: React.CSSProperties = {
  font: 'inherit', fontSize: 13.5, padding: '9px 11px', borderRadius: 10,
  border: '1.5px solid #EAE3D6', background: '#FFFFFF', color: '#2B2420', outline: 'none', width: '100%',
}

function when(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function Comments({
  postId, loggedIn, provider, nickname: presetNick, pet, onCount,
}: {
  postId: number
  loggedIn: boolean
  provider?: string
  nickname?: string
  pet: Pet | null
  /** 개수가 바뀌면 알린다 — 글 머리의 '댓글 N' 용 */
  onCount?: (n: number) => void
}) {
  const [list, setList] = useState<Comment[] | null>(null)
  const [body, setBody] = useState('')
  const [nickname, setNickname] = useState(presetNick ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [delPw, setDelPw] = useState('')
  const [delError, setDelError] = useState('')
  const seq = useRef(0)

  const load = () => {
    const my = ++seq.current
    authHeaders()
      .then((h) => fetch(`/api/posts/${postId}/comments`, { headers: h }))
      .then((r) => r.json())
      .then((d) => { if (my !== seq.current) return; const c = d.comments ?? []; setList(c); onCount?.(c.length) })
      .catch(() => { if (my === seq.current) setList([]) })
  }
  useEffect(() => { load() }, [postId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (presetNick) setNickname(presetNick) }, [presetNick])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const r = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ nickname, body, password, petKey: pet?.key ?? null }),
      })
      const d = await r.json()
      if (!r.ok) return setError(d.error ?? '댓글을 올리지 못했어요')
      setBody('')
      setPassword('')
      load()
    } catch {
      setError('댓글을 올리지 못했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    setDelError('')
    const r = await fetch(`/api/comments/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ password: delPw }) })
    const d = await r.json()
    if (!r.ok) return setDelError(d.error ?? '지우지 못했어요')
    setDeleting(null)
    setDelPw('')
    load()
  }

  return (
    <section style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#2B2420' }}>
        댓글 <span style={{ color: '#E85D3D' }}>{list ? list.length : '…'}</span>
      </h2>

      {list && list.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: '#B3A78F' }}>첫 댓글을 남겨주세요</p>
      )}

      {list?.map((c) => (
        <article key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid #F3EEE4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#B3A78F' }}>
            <Author a={c} size={22} fontSize={13} />
            <span style={{ marginLeft: 'auto' }}>{when(c.created_at)}</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: '#3E3830', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</p>
          {/* 계정 댓글은 쓴 사람만, 비로그인 댓글은 누구나(비밀번호로) */}
          {c.mine ? (
            <button onClick={() => { setDelPw(''); remove(c.id) }}
              style={{ alignSelf: 'flex-end', fontFamily: 'inherit', fontSize: 12, color: '#C0392B', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              내 댓글 지우기
            </button>
          ) : c.byAccount ? null : deleting === c.id ? (
            <form onSubmit={(e) => { e.preventDefault(); remove(c.id) }} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <input value={delPw} onChange={(e) => setDelPw(e.target.value)} type="password" placeholder="비밀번호" required autoFocus
                style={{ ...field, width: 120, padding: '6px 10px', fontSize: 12.5 }} />
              <button type="submit" style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#C0392B', color: '#FFFFFF', cursor: 'pointer' }}>지우기</button>
              <button type="button" onClick={() => { setDeleting(null); setDelPw(''); setDelError('') }}
                style={{ fontFamily: 'inherit', fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>취소</button>
              {delError && <span style={{ fontSize: 12, color: '#C0392B', width: '100%', textAlign: 'right' }}>{delError}</span>}
            </form>
          ) : (
            <button onClick={() => setDeleting(c.id)}
              style={{ alignSelf: 'flex-end', fontFamily: 'inherit', fontSize: 12, color: '#C4B8A4', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              지우기
            </button>
          )}
        </article>
      ))}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid #F3EEE4' }}>
        {loggedIn ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6E5F4D' }}>
            <b style={{ color: '#2B2420' }}>{presetNick || '로그인 계정'}</b>
            <ProviderMark provider={provider} /> 계정
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" maxLength={20} required style={{ ...field, flex: '1 1 120px' }} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 (지울 때)" type="password" minLength={4} required style={{ ...field, flex: '1 1 140px' }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={2} required
            placeholder="댓글을 남겨주세요" style={{ ...field, resize: 'vertical', lineHeight: 1.6, flex: 1 }} />
          <button type="submit" disabled={saving} className="btn-primary"
            style={{ flex: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '10px 16px', borderRadius: 10, border: 'none', background: saving ? '#C4B8A4' : '#E85D3D', color: '#FFFFFF', cursor: saving ? 'default' : 'pointer' }}>
            {saving ? '…' : '등록'}
          </button>
        </div>
        {error && <span style={{ fontSize: 12.5, color: '#C0392B' }}>{error}</span>}
      </form>
    </section>
  )
}
