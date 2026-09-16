'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/lib/useIsMobile'
import { usePetsContext } from '../PetsProvider'
import PhotoPicker from '../PhotoPicker'
import PlacePicker, { type PlaceRef } from '../PlacePicker'
import Author from '../Author'
import { ProviderMark } from '../PetSwitch'
import PetFace from '../PetFace'
import { authHeaders } from '@/lib/authHeader'

interface Post {
  id: number
  nickname: string
  title: string
  /** 본문 첫 100자 — 목록 맛보기 */
  excerpt: string
  views: number
  created_at: string
  photos: string[]
  place_id: string | null
  place_title: string | null
  author_avatar: string | null
  author_provider: string | null
  pet_name: string | null
  pet_emoji: string | null
  pet_label: string | null
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
  // useSearchParams 는 정적 빌드 때 Suspense 경계가 있어야 한다
  return (
    <Suspense fallback={null}>
      <Board />
    </Suspense>
  )
}

function Board() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const params = useSearchParams()
  const petStore = usePetsContext()

  /**
   * 주소로 들어오는 두 가지 —
   *   ?place=ID           그 장소 이야기만 본다 (지도·핫플레이스의 "이야기 N개 보기")
   *   ?write=1&place=ID&title=…&addr=…   그 장소를 붙인 채 바로 쓴다 ("이곳 이야기 쓰기")
   */
  const placeFilter = params.get('place') ?? ''
  const placeFilterTitle = params.get('title') ?? ''

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
  const [photos, setPhotos] = useState<string[]>([])
  const [place, setPlace] = useState<PlaceRef | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // 필터를 바꾸면 앞 목록의 늦은 응답이 새 목록을 덮지 않게 마지막 요청만 쓴다
  const seq = useRef(0)
  function load(p: number) {
    const my = ++seq.current
    setLoading(true)
    fetch(`/api/posts?page=${p}${placeFilter ? `&place=${encodeURIComponent(placeFilter)}` : ''}`)
      .then((r) => r.json())
      .then((d) => {
        if (my !== seq.current) return
        setOffline(Boolean(d.offline))
        setPosts((prev) => (p === 1 ? d.posts ?? [] : [...prev, ...(d.posts ?? [])]))
        setHasMore(Boolean(d.hasMore))
      })
      .catch(() => { if (my === seq.current) setError('목록을 불러오지 못했어요') })
      .finally(() => { if (my === seq.current) setLoading(false) })
  }

  // 필터가 바뀌면 앞 목록을 비우고 새로 받는다 — 다른 장소의 글이 잠깐이라도 섞여 보이지 않게
  useEffect(() => { setPosts([]); setPage(1); load(1) }, [placeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // "이곳 이야기 쓰기"로 들어왔으면 장소를 붙인 채 폼을 연다
  useEffect(() => {
    if (params.get('write') !== '1') return
    const id = params.get('place') ?? ''
    const t = params.get('title') ?? ''
    if (id && t) setPlace({ id, title: t, addr: params.get('addr') ?? '' })
    setWriting(true)
  }, [params])

  // 로그인돼 있으면 이름은 계정 것으로 고정된다 — 서버도 화면이 보낸 닉네임을 쓰지 않는다
  const m = petStore.session?.user.user_metadata ?? {}
  const sessionNick = ((m.nickname as string) || (m.name as string) || '').slice(0, 20)
  useEffect(() => { if (sessionNick) setNickname(sessionNick) }, [sessionNick])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const r = await fetch('/api/posts', {
        method: 'POST',
        // 로그인돼 있으면 토큰을 같이 보낸다 — 서버가 확인해 계정과 아이를 글에 남긴다
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ nickname, title, body, password, photos, place, petKey: petStore.activeKey }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error ?? '글을 올리지 못했어요')
        return
      }
      setTitle('')
      setBody('')
      setPassword('')
      setPhotos([])
      setPlace(null)
      setWriting(false)
      // 장소를 붙여 쓴 글은 그 장소 목록으로 — 방금 쓴 글이 바로 보이게
      if (place && placeFilter !== place.id) {
        router.replace(`/community?place=${place.id}&title=${encodeURIComponent(place.title)}`)
      } else {
        if (params.get('write')) router.replace(placeFilter ? `/community?place=${placeFilter}&title=${encodeURIComponent(placeFilterTitle)}` : '/community')
        setPage(1)
        load(1)
      }
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
            {placeFilter ? (
              <>
                <Link href="/community" style={{ fontSize: 12.5, fontWeight: 700, color: '#8A7A65', textDecoration: 'none' }}>← 전체 커뮤니티</Link>
                <h1 className="jua" style={{ margin: 0, fontSize: isMobile ? 23 : 26, color: '#2B2420' }}>📍 {placeFilterTitle || '이 장소'} 이야기</h1>
                <p style={{ margin: 0, fontSize: 13.5, color: '#8A7A65', wordBreak: 'keep-all' }}>
                  이곳에 다녀온 이야기만 모았어요 ·{' '}
                  <Link href={`/?focus=${placeFilter}`} style={{ color: '#E85D3D', fontWeight: 700, textDecoration: 'none' }}>지도에서 보기</Link>
                  <span style={{ fontSize: 11.5, color: '#B3A78F' }}> · 장소 정보 출처 ⓒ한국관광공사</span>
                </p>
              </>
            ) : (
              <>
                <h1 className="jua" style={{ margin: 0, fontSize: isMobile ? 23 : 26, color: '#2B2420' }}>커뮤니티</h1>
                <p style={{ margin: 0, fontSize: 13.5, color: '#8A7A65', wordBreak: 'keep-all' }}>
                  우리 아이랑 다녀온 곳, 좋았던 순간을 나눠요
                </p>
              </>
            )}
          </div>
          {!offline && (
            <button className="btn-primary"
              onClick={() => {
                if (!writing && placeFilter && placeFilterTitle && !place) setPlace({ id: placeFilter, title: placeFilterTitle, addr: '' })
                setWriting((v) => !v)
              }}
              style={{ flex: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '11px 20px', borderRadius: 12, border: 'none', background: writing ? '#8A7A65' : '#E85D3D', color: '#FFFFFF', cursor: 'pointer' }}>
              {writing ? '접기' : placeFilter ? '이곳 이야기 쓰기' : '글쓰기'}
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
            <PlacePicker value={place} onChange={setPlace} />
            {petStore.session ? (
              // 로그인 글 — 이름은 계정으로 고정, 비밀번호 없음(계정으로 지운다). 무엇이 같이 남는지 보여준다
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 12px', borderRadius: 12, border: '1.5px solid #EAE3D6', background: '#FAF6EF', fontSize: 13, color: '#6E5F4D' }}>
                {(petStore.session.user.user_metadata?.picture as string) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={petStore.session.user.user_metadata.picture} alt="" referrerPolicy="no-referrer" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                )}
                <b style={{ color: '#2B2420' }}>{sessionNick || '로그인 계정'}</b>
                <ProviderMark provider={petStore.session.user.app_metadata?.provider as string} />
                <span>계정으로 올라가요</span>
                {petStore.pet && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    · <PetFace emoji={petStore.pet.emoji} size={16} /> {petStore.pet.name} · {petStore.pet.sizeLabel}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input value={nickname} onChange={(e) => setNickname(e.target.value)}
                  placeholder="닉네임" maxLength={20} required style={{ ...field, flex: '1 1 160px' }} />
                <input value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 (지울 때 필요해요)" type="password" minLength={4} required
                  style={{ ...field, flex: '1 1 200px' }} />
              </div>
            )}
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="제목" maxLength={80} required style={field} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              placeholder={place ? `${place.title}, 우리 아이는 어땠나요?` : '어디를 다녀오셨나요? 우리 아이는 어땠나요?'} maxLength={4000} rows={7} required
              style={{ ...field, resize: 'vertical', lineHeight: 1.6 }} />
            <PhotoPicker photos={photos} onChange={setPhotos} />
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

        {/* 목록 — 카드. 사진이 있으면 왼쪽에, 없으면 장소·발자국으로 자리를 채운다 */}
        {loading && posts.length === 0 && (
          <p style={{ padding: 40, textAlign: 'center', fontSize: 13.5, color: '#A08872' }}>불러오는 중…</p>
        )}
        {!loading && posts.length === 0 && !offline && (
          <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, padding: 44, textAlign: 'center', fontSize: 13.5, color: '#A08872', lineHeight: 1.7 }}>
            {placeFilter ? <>이곳 이야기가 아직 없어요.<br />처음으로 남겨주세요 🐾</> : <>아직 글이 없어요.<br />첫 글을 남겨주세요 🐾</>}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.map((p) => {
            const thumb = p.photos?.[0]
            return (
              <Link key={p.id} href={`/community/${p.id}`} className="hov-card"
                style={{ display: 'flex', gap: 14, padding: 14, background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, textDecoration: 'none' }}>
                <div style={{ width: isMobile ? 72 : 96, height: isMobile ? 72 : 96, borderRadius: 12, flex: 'none', overflow: 'hidden', background: thumb ? '#F3EEE4' : 'linear-gradient(135deg,#FFE0D3,#FFF4EF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 26 : 32, position: 'relative' }}>
                  {thumb
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={thumb} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <span aria-hidden="true">{p.place_title ? '📍' : '🐾'}</span>}
                  {p.photos?.length > 1 && (
                    <span style={{ position: 'absolute', right: 5, bottom: 5, fontSize: 10.5, fontWeight: 700, color: '#FFFFFF', background: 'rgba(43,36,32,.62)', borderRadius: 99, padding: '2px 6px' }}>
                      +{p.photos.length - 1}
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {p.place_title && !placeFilter && (
                    <span style={{ alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, color: '#E85D3D', background: '#FFF4EF', borderRadius: 99, padding: '2px 9px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📍 {p.place_title}
                    </span>
                  )}
                  <span style={{ fontSize: isMobile ? 15 : 16, fontWeight: 700, color: '#2B2420', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title}
                  </span>
                  {p.excerpt && (
                    <span style={{ fontSize: 13, color: '#8A7A65', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                      {p.excerpt}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 2, fontSize: 12, color: '#B3A78F', flexWrap: 'wrap' }}>
                    <Author a={p} size={20} fontSize={12} />
                    <span>·</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{when(p.created_at)}</span>
                    <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>👁 {p.views}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {posts.some((p) => p.place_title) && !placeFilter && (
          <span style={{ fontSize: 11, color: '#B3A78F', textAlign: 'right' }}>📍 장소 정보 출처 ⓒ한국관광공사</span>
        )}

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
