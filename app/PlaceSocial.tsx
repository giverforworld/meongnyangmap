'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Pet } from '@/lib/types'
import PhotoPicker from './PhotoPicker'
import PetFace from './PetFace'
import Author from './Author'
import { ProviderMark } from './PetSwitch'
import { authHeaders } from '@/lib/authHeader'

/**
 * 장소 상세에 붙는 사용자 참여 두 덩이 — 방문 리뷰와 커뮤니티 이야기.
 *
 * 둘 다 **멍냥맵 사용자가 남긴 것**이지 한국관광공사 데이터가 아니다. 판정 블록과
 * 섞이지 않게 표제에 그 사실을 적는다. 없는 걸 있는 것처럼 보이게 하지 않는다 —
 * 리뷰가 0개면 0개라고 보여준다.
 */

type Entry = 'ok' | 'cond' | 'denied'

interface Review {
  id: number
  nickname: string
  rating: number
  entry: Entry | null
  body: string
  photos: string[]
  pet_size: 'small' | 'medium' | 'large' | null
  created_at: string
  author_avatar: string | null
  author_provider: string | null
  pet_name: string | null
  pet_emoji: string | null
  mine?: boolean
}

const ENTRY: Record<Entry, { label: string; color: string; bg: string; border: string }> = {
  ok: { label: '문제없이 입장', color: '#2F8F4E', bg: '#EAF6EA', border: '#2F8F4E' },
  cond: { label: '조건 붙어서 입장', color: '#9A7300', bg: '#FFF7D6', border: '#E8B400' },
  denied: { label: '입장 거부', color: '#C0392B', bg: '#FBEDEA', border: '#E0A9A0' },
}
const SIZE_LABEL = { small: '소형견', medium: '중형견', large: '대형견' } as const

const field: React.CSSProperties = {
  font: 'inherit', fontSize: 13.5, padding: '9px 11px', borderRadius: 10,
  border: '1.5px solid #EAE3D6', background: '#FFFFFF', color: '#2B2420', outline: 'none', width: '100%',
}

function Stars({ n, size = 13 }: { n: number; size?: number }) {
  return (
    <span aria-label={`별점 ${n}점`} style={{ fontSize: size, letterSpacing: 1, color: '#E8A33D', whiteSpace: 'nowrap' }}>
      {'★'.repeat(n)}<span style={{ color: '#E3DCCE' }}>{'★'.repeat(5 - n)}</span>
    </span>
  )
}

function when(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

/* ── 방문 리뷰 ─────────────────────────────────────────── */

export function PlaceReviews({
  placeId, placeTitle, pet, nickname: presetNick, loggedIn = false, provider,
}: {
  placeId: string
  placeTitle: string
  /** 지금 기준이 되는 아이 — 어떤 크기의 아이와 갔는지 리뷰에 남긴다 */
  pet: Pet | null
  /** 로그인돼 있으면 닉네임을 미리 채운다 */
  nickname?: string
  /** 로그인 상태 — 비밀번호 대신 계정으로 남긴다. 확인은 서버가 토큰으로 한다 */
  loggedIn?: boolean
  provider?: string
}) {
  const [data, setData] = useState<{ reviews: Review[]; count: number; avg: number | null; entry: Record<Entry, number>; capped?: boolean; offline?: boolean } | null>(null)
  const [writing, setWriting] = useState(false)
  const [rating, setRating] = useState(0)
  const [entry, setEntry] = useState<Entry | null>(null)
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [nickname, setNickname] = useState(presetNick ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [delPw, setDelPw] = useState('')
  const [delError, setDelError] = useState('')
  const [viewing, setViewing] = useState<string | null>(null)
  // 장소를 빨리 바꾸면 앞 장소의 응답이 늦게 온다. 마지막 요청만 화면에 쓴다
  const seq = useRef(0)

  const load = () => {
    const my = ++seq.current
    authHeaders()
      .then((h) => fetch(`/api/reviews?place=${placeId}`, { headers: h }))
      .then((r) => r.json())
      .then((d) => { if (my === seq.current) setData(d) })
      .catch(() => { if (my === seq.current) setData({ reviews: [], count: 0, avg: null, entry: { ok: 0, cond: 0, denied: 0 } }) })
  }

  // 장소가 바뀌면 앞 장소의 리뷰와 쓰던 폼을 남기지 않는다
  useEffect(() => {
    setData(null)
    setWriting(false)
    setRating(0); setEntry(null); setBody(''); setPhotos([]); setError('')
    setDeleting(null); setDelPw(''); setDelError('')
    load()
  }, [placeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (presetNick) setNickname((v) => v || presetNick) }, [presetNick])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (rating === 0) return setError('별점을 골라주세요')
    setSaving(true)
    try {
      const r = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ placeId, placeTitle, nickname, rating, entry, body, photos, petSize: pet?.size ?? null, password, petKey: pet?.key ?? null }),
      })
      const d = await r.json()
      if (!r.ok) return setError(d.error ?? '리뷰를 올리지 못했어요')
      setWriting(false)
      setRating(0); setEntry(null); setBody(''); setPhotos([]); setPassword('')
      load()
    } catch {
      setError('리뷰를 올리지 못했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    setDelError('')
    const r = await fetch(`/api/reviews/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ password: delPw }) })
    const d = await r.json()
    if (!r.ok) return setDelError(d.error ?? '지우지 못했어요')
    setDeleting(null); setDelPw('')
    load()
  }

  if (data?.offline) return null

  return (
    <section style={{ borderTop: '1px solid #EFE8DA', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', color: '#B3A78F' }}>
          방문 리뷰 <span style={{ color: '#E85D3D' }}>{data ? `${data.count}${data.capped ? '+' : ''}` : '…'}</span>
          <span style={{ fontWeight: 500, letterSpacing: 0 }}> · 멍냥맵 사용자가 남긴 것{data?.capped ? ' · 최근 50개 기준' : ''}</span>
        </span>
        {!writing && (
          <button onClick={() => setWriting(true)}
            style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#E85D3D', background: 'none', border: 'none', padding: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + 리뷰 쓰기
          </button>
        )}
      </div>

      {/* 요약 — 별점 평균과 입장 결과. 숫자가 있을 때만 */}
      {data && data.count > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#5C5347' }}>
          <Stars n={Math.round(data.avg ?? 0)} size={14} />
          <b>{data.avg}</b>
          {(['ok', 'cond', 'denied'] as Entry[]).filter((k) => data.entry[k] > 0).map((k) => (
            <span key={k} style={{ fontSize: 11.5, fontWeight: 700, color: ENTRY[k].color, background: ENTRY[k].bg, borderRadius: 99, padding: '2px 8px' }}>
              {ENTRY[k].label} {data.entry[k]}
            </span>
          ))}
        </div>
      )}

      {writing && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 9, border: '1.5px solid #F3C9BB', background: '#FFFBF9', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>우리 아이랑 실제로 들어갔나요?</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {(['ok', 'cond', 'denied'] as Entry[]).map((k) => {
                const on = entry === k
                return (
                  <button key={k} type="button" onClick={() => setEntry(on ? null : k)}
                    style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 700 : 500, padding: '5px 10px', borderRadius: 99, border: `1.5px solid ${on ? ENTRY[k].border : '#EAE3D6'}`, background: on ? ENTRY[k].bg : '#FFFFFF', color: on ? ENTRY[k].color : '#6E5F4D', cursor: 'pointer' }}>
                    {ENTRY[k].label}
                  </button>
                )
              })}
            </div>
            {pet && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#A08872' }}><PetFace emoji={pet.emoji} size={15} />{pet.name}({pet.sizeLabel})와 다녀온 것으로 남겨요</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>별점</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n}점`}
                  style={{ fontSize: 22, lineHeight: 1, padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: n <= rating ? '#E8A33D' : '#E3DCCE' }}>★</button>
              ))}
            </div>
          </div>

          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={4} required
            placeholder="어땠나요? 다음 사람에게 도움이 될 걸 적어주세요 — 직원 반응, 자리, 물그릇…"
            style={{ ...field, resize: 'vertical', lineHeight: 1.6 }} />
          <PhotoPicker photos={photos} onChange={setPhotos} />
          {loggedIn ? (
            // 로그인 리뷰 — 이름은 계정으로 고정, 비밀번호 없음
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6E5F4D', padding: '7px 10px', borderRadius: 10, border: '1.5px solid #EAE3D6', background: '#FAF6EF' }}>
              <b style={{ color: '#2B2420' }}>{presetNick || '로그인 계정'}</b>
              <ProviderMark provider={provider} /> 계정
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" maxLength={20} required style={{ ...field, flex: 1 }} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 (지울 때)" type="password" minLength={4} required style={{ ...field, flex: 1 }} />
            </div>
          )}
          {error && <span style={{ fontSize: 12.5, color: '#C0392B' }}>{error}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => { setWriting(false); setError('') }}
              style={{ fontFamily: 'inherit', fontSize: 13, padding: '9px 14px', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
              취소
            </button>
            <button type="submit" disabled={saving} className="btn-primary"
              style={{ flex: 1, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '9px 0', borderRadius: 10, border: 'none', background: saving ? '#C4B8A4' : '#E85D3D', color: '#FFFFFF', cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '올리는 중…' : '리뷰 올리기'}
            </button>
          </div>
        </form>
      )}

      {data && data.count === 0 && !writing && (
        <span style={{ fontSize: 12.5, color: '#B3A78F' }}>아직 리뷰가 없어요. 다녀오셨다면 첫 리뷰를 남겨주세요</span>
      )}

      {data?.reviews.map((r) => (
        <article key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderTop: '1px solid #F3EEE4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', fontSize: 12 }}>
            <Author a={{ nickname: r.nickname, author_avatar: r.author_avatar, author_provider: r.author_provider, pet_name: r.pet_name, pet_emoji: r.pet_emoji, pet_label: r.pet_size ? SIZE_LABEL[r.pet_size] : null }} size={20} fontSize={13} />
            {!r.pet_name && r.pet_size && <span style={{ color: '#A08872' }}>{SIZE_LABEL[r.pet_size]}와</span>}
            <Stars n={r.rating} />
            {r.entry && (
              <span style={{ fontSize: 11, fontWeight: 700, color: ENTRY[r.entry].color, background: ENTRY[r.entry].bg, borderRadius: 99, padding: '2px 7px' }}>
                {ENTRY[r.entry].label}
              </span>
            )}
            <span style={{ marginLeft: 'auto', color: '#B3A78F', fontSize: 11.5 }}>{when(r.created_at)}</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: '#3E3830', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.body}</p>
          {r.photos?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {r.photos.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="" loading="lazy" onClick={() => setViewing(u)}
                  style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 8, flex: 'none', cursor: 'zoom-in', border: '1px solid #F3EEE4' }} />
              ))}
            </div>
          )}
          {r.mine ? (
            <button onClick={() => { setDelPw(''); remove(r.id) }}
              style={{ alignSelf: 'flex-end', fontFamily: 'inherit', fontSize: 11.5, color: '#C0392B', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              내 리뷰 지우기
            </button>
          ) : deleting === r.id ? (
            <form onSubmit={(e) => { e.preventDefault(); remove(r.id) }} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <input value={delPw} onChange={(e) => setDelPw(e.target.value)} type="password" placeholder="비밀번호" required autoFocus
                style={{ ...field, width: 120, padding: '6px 10px', fontSize: 12.5 }} />
              <button type="submit" style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#C0392B', color: '#FFFFFF', cursor: 'pointer' }}>지우기</button>
              <button type="button" onClick={() => { setDeleting(null); setDelPw(''); setDelError('') }}
                style={{ fontFamily: 'inherit', fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>취소</button>
              {delError && <span style={{ fontSize: 12, color: '#C0392B', width: '100%' }}>{delError}</span>}
            </form>
          ) : (
            <button onClick={() => setDeleting(r.id)}
              style={{ alignSelf: 'flex-end', fontFamily: 'inherit', fontSize: 11.5, color: '#C4B8A4', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              지우기
            </button>
          )}
        </article>
      ))}

      {viewing && (
        <div onClick={() => setViewing(null)} role="dialog" aria-label="사진 크게 보기"
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,16,12,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
        </div>
      )}
    </section>
  )
}

/* ── 커뮤니티 이야기 ───────────────────────────────────── */

interface Story {
  id: number
  nickname: string
  title: string
  created_at: string
  photos: string[]
}

export function PlaceStories({ placeId, placeTitle, placeAddr }: { placeId: string; placeTitle: string; placeAddr: string }) {
  const [stories, setStories] = useState<Story[] | null>(null)
  const [more, setMore] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const my = ++seq.current
    setStories(null)
    fetch(`/api/posts?place=${placeId}&limit=3`)
      .then((r) => r.json())
      .then((d) => { if (my !== seq.current || d.offline) return; setStories(d.posts ?? []); setMore(Boolean(d.hasMore)) })
      .catch(() => { if (my === seq.current) setStories([]) })
  }, [placeId])

  if (stories === null) return null
  const q = `place=${placeId}&title=${encodeURIComponent(placeTitle)}`

  return (
    <section style={{ borderTop: '1px solid #EFE8DA', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', color: '#B3A78F' }}>
          커뮤니티 이야기 <span style={{ color: '#E85D3D' }}>{stories.length}{more ? '+' : ''}</span>
        </span>
        <Link href={`/community?write=1&${q}&addr=${encodeURIComponent(placeAddr)}`}
          style={{ fontSize: 12.5, fontWeight: 700, color: '#E85D3D', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          + 이곳 이야기 쓰기
        </Link>
      </div>
      {stories.length === 0 ? (
        <span style={{ fontSize: 12.5, color: '#B3A78F' }}>아직 이곳 이야기가 없어요</span>
      ) : (
        stories.map((s) => (
          <Link key={s.id} href={`/community/${s.id}`} className="hov-row"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px', textDecoration: 'none', borderRadius: 8 }}>
            {s.photos?.length > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.photos[0]} alt="" loading="lazy" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flex: 'none' }} />
            )}
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#2B2420', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
            <span style={{ flex: 'none', fontSize: 11.5, color: '#B3A78F' }}>{s.nickname}</span>
          </Link>
        ))
      )}
      {(more || stories.length > 0) && (
        <Link href={`/community?${q}`} style={{ alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 700, color: '#8A7A65', textDecoration: 'none' }}>
          이곳 이야기 모두 보기 →
        </Link>
      )}
    </section>
  )
}
