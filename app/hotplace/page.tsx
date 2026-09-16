'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePetsContext } from '../PetsProvider'
import PetFace from '../PetFace'
import PlaceDetail from '../PlaceDetail'
import type { Place } from '@/lib/types'
import { splitTags, type Camp, type CampJudge } from '@/lib/camping'
import { distance } from '@/lib/geo'
import { useIsMobile } from '@/lib/useIsMobile'

interface Curated {
  contentid: string
  contenttypeid: string
  title: string
  addr1: string
  cat: string
  firstimage: string
  mapx: number
  mapy: number
  regnCd: string
  reasons: string[]
  summary: string
  needs: string[]
  usetime: string
  restdate: string
  regionName: string
  regionRank: number | null
}

interface Region {
  code: string
  name: string
}

const CAT_EMOJI: Record<string, string> = {
  관광지: '🏞', 문화시설: '🎨', 레포츠: '⛰', 숙박: '🏡', 음식점: '🍽', 쇼핑: '🛍',
}

const PAGE = 24

/**
 * "뭐 하고 놀지?"에 답하는 화면. 지도가 "이 장소, 갈 수 있나?"의 반대 방향이라
 * 우리가 먼저 골라 줘야 한다. 고르는 기준이 서로 달라 중메뉴로 나눈다 —
 * 핫플레이스는 조건이 확실한 곳, 캠핑은 별도 서비스(고캠핑)에서 온 3,115곳이다.
 */
type Tab = 'hot' | 'camp'

const TABS: { key: Tab; label: string; title: string; lede: React.ReactNode }[] = [
  {
    key: 'hot',
    label: '핫플레이스',
    title: '우리 아이와 함께 가기 좋은 핫플레이스',
    lede: (
      <>
        <b style={{ color: '#2B2420' }}>눈치 볼 일 없이</b>, 함께 입장이 가능한 핫플레이스만을 모아놨어요.
      </>
    ),
  },
  {
    key: 'camp',
    label: '캠핑장',
    title: '우리 아이랑 하룻밤',
    lede: (
      <>
        전국 캠핑장 중 <b style={{ color: '#2B2420' }}>반려동물과 함께 묵을 수 있는 곳</b>이에요.
        크기 제한이 있는 곳은 우리 아이 기준으로 걸러서 보여드려요.
      </>
    ),
  },
]

/** 정렬 — 고르는 기준이 셋이라 각각 무엇을 앞으로 보내는지 이름에 담는다 */
type Sort = 'default' | 'visitors' | 'near'

const SORTS: { key: Sort; label: string }[] = [
  { key: 'near', label: '나와 가까운 순' },
  { key: 'default', label: '동반 조건이 확실한 순' },
  { key: 'visitors', label: '요즘 붐비는 지역 순' },
]

/** 거리 표기 — 1km 미만은 m 로 */
const meters = (m: number) => (m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`)

const chip = (on: boolean): React.CSSProperties => ({
  flex: 'none',
  fontFamily: 'inherit',
  fontSize: 13.5,
  fontWeight: on ? 700 : 500,
  padding: '7px 14px',
  borderRadius: 99,
  border: `1.5px solid ${on ? '#2B2420' : '#E3DCCE'}`,
  background: on ? '#2B2420' : '#FFFFFF',
  color: on ? '#FFFFFF' : '#6E5F4D',
  cursor: 'pointer',
})

export default function Hotplace() {
  const [tab, setTab] = useState<Tab>('hot')
  const meta = TABS.find((t) => t.key === tab)!

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#FAF6EF' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 56px' }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <h1 className="jua" style={{ margin: 0, fontSize: 26, color: '#2B2420' }}>
            {meta.title}
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#8A7A65', lineHeight: 1.6, maxWidth: 620 }}>
            {meta.lede}
          </p>
        </header>

        {/* 중메뉴 — 고르는 기준이 다른 목록들이라 나란히 둔다 */}
        <div
          className="chip-row"
          role="tablist"
          style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid #EAE3D6' }}
        >
          {TABS.map((t) => {
            const on = t.key === tab
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 'none',
                  fontFamily: 'inherit',
                  fontSize: 15,
                  fontWeight: on ? 700 : 500,
                  padding: '10px 16px',
                  border: 'none',
                  borderBottom: `2.5px solid ${on ? '#E85D3D' : 'transparent'}`,
                  background: 'transparent',
                  color: on ? '#E85D3D' : '#8A7A65',
                  cursor: 'pointer',
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'hot' ? <HotView /> : <CampView />}

        <p style={{ marginTop: 32, fontSize: 12, color: '#B3A78F' }}>출처 ⓒ한국관광공사</p>
      </div>
    </div>
  )
}

/* ── 핫플레이스 ──────────────────────────────────────────── */

/** 핫플레이스 항목을 상세가 받는 모양으로. 목록엔 없는 칸은 비워 보낸다 */
function toPlace(c: Curated): Place {
  return { contentid: c.contentid, contenttypeid: c.contenttypeid, title: c.title, addr1: c.addr1, mapx: c.mapx, mapy: c.mapy, firstimage: c.firstimage, cat: c.cat, lclsSystm1: '', lclsSystm2: '', lclsSystm3: '', regnCd: c.regnCd, signguCd: '' }
}

function HotView() {
  const petStore = usePetsContext()
  const isMobile = useIsMobile()
  const [items, setItems] = useState<Curated[]>([])
  /** 상세 보기로 연 장소 — 지도 화면으로 넘어가지 않고 여기서 본다 */
  const [open, setOpen] = useState<Curated | null>(null)
  const sessionNick = ((petStore.session?.user.user_metadata?.nickname as string) || (petStore.session?.user.user_metadata?.name as string) || '').slice(0, 20)
  const [regions, setRegions] = useState<Region[]>([])
  const [regnCd, setRegnCd] = useState('')
  const [cat, setCat] = useState('전체')
  const [limit, setLimit] = useState(PAGE)
  const [loading, setLoading] = useState(true)
  /** 기본은 '조건이 확실한 순'. 방문자 순은 지역 인기를 얹어 보는 것이다 */
  const [sort, setSort] = useState<Sort>('default')
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null)

  /**
   * 나와 가까운 순 — 좌표를 서버로 보내지 않는다.
   *
   * 위치를 서버로 전송하면 저장 여부와 무관하게 위치기반서비스사업자 신고 대상이
   * 된다(공모전 공지 FAQ). 목록이 이미 각 장소의 좌표를 들고 있으니, 브라우저에서
   * 거리만 재고 다시 늘어놓는다. 위치는 단말을 떠나지 않는다.
   */
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  async function pickSort(k: Sort) {
    setGeoError(null)
    setLimit(PAGE)
    if (k !== 'near' || here) {
      setSort(k)
      return
    }
    if (!navigator.geolocation) {
      setGeoError('이 브라우저는 위치를 알려주지 못해요')
      return
    }
    setGeoBusy(true)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      )
      setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      setSort('near')
    } catch {
      setGeoError('위치를 가져오지 못했어요 — 브라우저에서 위치 권한을 허용해주세요')
    } finally {
      setGeoBusy(false)
    }
  }

  useEffect(() => {
    fetch('/api/regions')
      .then((r) => r.json())
      .then((d) => setRegions(d.regions ?? []))
      .catch(() => {})
  }, [])

  // 처음부터 가까운 순으로 — 위치를 못 받으면 '조건이 확실한 순'에 머문다
  useEffect(() => { pickSort('near') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 거리순은 받아온 목록을 브라우저에서 다시 늘어놓는 것이라 서버에 되묻지 않는다
  const serverSort = sort === 'visitors' ? 'visitors' : 'default'

  useEffect(() => {
    setLoading(true)
    setLimit(PAGE)
    const qs = new URLSearchParams({
      kind: 'hotplace',
      ...(regnCd ? { regnCd } : {}),
      ...(serverSort === 'visitors' ? { sort: serverSort } : {}),
    })
    fetch(`/api/curated?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? [])
        setPeriod(d.visitPeriod?.from ? d.visitPeriod : null)
      })
      .finally(() => setLoading(false))
  }, [regnCd, serverSort])

  const cats = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach((i) => (m[i.cat] = (m[i.cat] ?? 0) + 1))
    return ['전체', ...Object.keys(m).sort((a, b) => m[b] - m[a])]
  }, [items])

  /** 좌표가 없는 곳은 거리를 알 수 없다 — 0km 로 속이지 말고 뒤로 보낸다 */
  const matched = useMemo<(Curated & { meters?: number })[]>(() => {
    const list = items.filter((i) => cat === '전체' || i.cat === cat)
    if (sort !== 'near' || !here) return list
    return list
      .map((i) => ({
        ...i,
        meters: i.mapx && i.mapy ? distance(here.lat, here.lng, i.mapy, i.mapx) : Infinity,
      }))
      .sort((a, b) => a.meters - b.meters)
  }, [items, cat, sort, here])
  const shown = matched.slice(0, limit)

  return (
    <>
      {/* 상세 보기 — 지도 화면과 같은 PlaceDetail 을 이 자리에서 연다. Esc·바깥 클릭으로 닫는다 */}
      {open && (
        <div onClick={() => setOpen(null)} role="dialog" aria-label={`${open.title} 상세`}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(43,36,32,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', width: '100%', maxWidth: isMobile ? undefined : 400, height: isMobile ? '100%' : 'min(720px, 92vh)', background: '#FFFFFF', borderRadius: isMobile ? 0 : 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(43,36,32,.24)' }}>
            <PlaceDetail
              place={toPlace(open)}
              pet={petStore.pet}
              onClose={() => setOpen(null)}
              mobile={isMobile}
              nickname={sessionNick}
              loggedIn={Boolean(petStore.session)}
              provider={petStore.session?.user.app_metadata?.provider as string | undefined}
            />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <select
          value={regnCd}
          onChange={(e) => setRegnCd(e.target.value)}
          style={{ font: 'inherit', fontSize: 14, padding: '7px 12px', borderRadius: 12, border: '1.5px solid #EAE3D6', background: '#FFFFFF', color: '#2B2420', cursor: 'pointer' }}
        >
          <option value="">전국</option>
          {regions.map((r) => (
            <option key={r.code} value={r.code}>{r.name}</option>
          ))}
        </select>
        {cats.map((c) => (
          <button key={c} className="hov-accent" onClick={() => { setCat(c); setLimit(PAGE) }} style={chip(c === cat)}>
            {c}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#B3A78F' }}>
          {loading ? '불러오는 중…' : `${matched.length.toLocaleString()}곳`}
        </span>
      </div>

      {/* 정렬 — 방문자 데이터는 '지역'의 것이라 문구가 그 선을 넘지 않아야 한다 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {SORTS.map(({ key: k, label }) => {
          const on = k === sort
          const busy = k === 'near' && geoBusy
          return (
            <button key={k} className="hov-accent" onClick={() => pickSort(k)} disabled={busy}
              style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, padding: '5px 12px', borderRadius: 99, border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF4EF' : '#FFFFFF', color: on ? '#E85D3D' : '#8A7A65', cursor: busy ? 'default' : 'pointer' }}>
              {busy ? '위치 확인 중…' : label}
            </button>
          )
        })}
        {sort === 'visitors' && period && (
          <span style={{ fontSize: 11.5, color: '#B3A78F', lineHeight: 1.5 }}>
            장소가 아니라 <b style={{ color: '#8A7A65' }}>시군구</b> 기준 외지인 방문 수예요
            · {period.from.slice(4, 6)}.{period.from.slice(6)}~{period.to.slice(4, 6)}.{period.to.slice(6)} 집계
          </span>
        )}
        {sort === 'near' && here && (
          <span style={{ fontSize: 11.5, color: '#B3A78F', lineHeight: 1.5 }}>
            위치는 <b style={{ color: '#8A7A65' }}>이 브라우저 안에서만</b> 쓰고 서버로 보내지 않아요
          </span>
        )}
        {geoError && (
          <span style={{ fontSize: 11.5, color: '#C0392B', lineHeight: 1.5 }}>{geoError}</span>
        )}
      </div>

      {!loading && matched.length === 0 && (
        <p style={{ padding: 40, textAlign: 'center', color: '#A08872', fontSize: 14 }}>
          이 지역에는 조건이 완전하게 등록된 곳이 아직 없어요
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 14 }}>
        {shown.map((p) => (
          <article key={p.contentid} style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 132, background: p.firstimage ? `center/cover url(${p.firstimage})` : 'linear-gradient(135deg,#FFE0D3,#FFF4EF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>
              {!p.firstimage && (CAT_EMOJI[p.cat] ?? '📍')}
            </div>
            <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: '#2B2420', wordBreak: 'keep-all' }}>{p.title}</h2>
              <p style={{ margin: 0, fontSize: 12, color: '#A08872' }}>
                {p.cat} · {p.addr1.split(' ').slice(0, 2).join(' ')}
                {p.meters !== undefined && Number.isFinite(p.meters) && (
                  <span style={{ color: '#E85D3D', fontWeight: 700 }}> · {meters(p.meters)}</span>
                )}
              </p>
              {p.summary && (
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: '#6E5F4D', wordBreak: 'keep-all' }}>
                  {p.summary}…
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto', paddingTop: 4 }}>
                {p.reasons.map((r) => (
                  <span key={r} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: '#EAF6EA', color: '#2F8F4E' }}>
                    {r}
                  </span>
                ))}
              </div>
              {/* 지도 상세(판정·리뷰)로, 그리고 커뮤니티에 이곳 이야기 쓰기로 */}
              <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid #F3EEE4', marginTop: 4 }}>
                <button onClick={() => setOpen(p)} className="hov-accent"
                  style={{ flex: 1, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '7px 0', borderRadius: 9, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
                  상세 보기
                </button>
                <Link href={`/community?write=1&place=${p.contentid}&title=${encodeURIComponent(p.title)}&addr=${encodeURIComponent(p.addr1)}`} className="hov-accent"
                  style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 700, padding: '7px 0', borderRadius: 9, border: '1.5px solid #F3C9BB', background: '#FFF4EF', color: '#E85D3D', textDecoration: 'none' }}>
                  이곳 이야기 쓰기
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {shown.length < matched.length && (
        <button className="hov-accent" onClick={() => setLimit((n) => n + PAGE)}
          style={{ display: 'block', margin: '20px auto 0', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '11px 28px', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
          {Math.min(PAGE, matched.length - shown.length)}곳 더 보기
        </button>
      )}
    </>
  )
}

/* ── 캠핑 ────────────────────────────────────────────────── */

type JudgedCamp = Camp & { j: CampJudge }

/** 위치 유형 — 데이터에 실제로 쓰이는 값들. 어떤 곳인지 한 단어로 고르게 한다 */
const TAGS = ['해변', '산', '숲', '강', '호수', '섬', '도심']

/**
 * 거리순으로 서버에 되물을 캠핑장 수.
 *
 * 목록 API 가 한 번에 내주는 상한이 200 곳이라 그보다 넉넉하다. 3,115곳의 id 를
 * 전부 붙이면 주소가 18KB 로 불어나 요청이 잘린다.
 */
const NEAR_MAX = 300

const CAMP_SORTS: { key: 'default' | 'near'; label: string }[] = [
  { key: 'near', label: '나와 가까운 순' },
  { key: 'default', label: '동반 조건이 확실한 순' },
]

function CampView() {
  const petStore = usePetsContext()
  const [region, setRegion] = useState('')
  const [tag, setTag] = useState('')
  const [limit, setLimit] = useState(PAGE)
  /**
   * 나와 가까운 순 — 좌표를 서버로 보내지 않는다.
   *
   * 캠핑 목록은 우리 아이 기준으로 서버가 걸러 한 페이지씩 보내므로, 받아온 24곳만
   * 다시 늘어놓으면 '가까운 순'이 되지 않는다. 그래서 지도의 '내 주변'과 같은 길을 쓴다 —
   * /api/camping/coords 로 좌표 색인만 받아 브라우저에서 거리를 재고, 가까운 id 만
   * 서버에 되묻는다. 위치는 단말을 떠나지 않는다.
   */
  const [sort, setSort] = useState<'default' | 'near'>('default')
  const [nearIds, setNearIds] = useState<string[] | null>(null)
  const [nearDist, setNearDist] = useState<Record<string, number>>({})
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const coordsRef = useRef<[string, number, number][] | null>(null)
  const [data, setData] = useState<{
    camps: JudgedCamp[]
    total: number
    hidden: number
    okCount: number
    regions: { name: string; n: number }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const pet = petStore.pet

  // 아이가 바뀌면 판정이 달라져 목록이 통째로 바뀐다 — 첫 페이지부터 다시
  useEffect(() => setLimit(PAGE), [pet])

  // 처음부터 가까운 순으로 — 위치를 못 받으면 '확실한 곳 먼저'에 머문다
  useEffect(() => { pickSort('near') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function pickSort(k: 'default' | 'near') {
    setGeoError(null)
    setLimit(PAGE)
    if (k === 'default' || nearIds) {
      setSort(k)
      return
    }
    if (!navigator.geolocation) {
      setGeoError('이 브라우저는 위치를 알려주지 못해요')
      return
    }
    setGeoBusy(true)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      )
      if (!coordsRef.current) {
        const d = await fetch('/api/camping/coords').then((r) => r.json())
        coordsRef.current = d.coords ?? []
      }
      const { latitude: lat, longitude: lng } = pos.coords
      const near = coordsRef
        .current!.map(([id, x, y]) => [id, distance(lat, lng, y, x)] as const)
        .sort((a, b) => a[1] - b[1])
        .slice(0, NEAR_MAX)

      if (near.length === 0) {
        setGeoError('좌표가 등록된 캠핑장이 없어요')
        return
      }
      setNearDist(Object.fromEntries(near))
      setNearIds(near.map(([id]) => id))
      setSort('near')
    } catch {
      setGeoError('위치를 가져오지 못했어요 — 브라우저에서 위치 권한을 허용해주세요')
    } finally {
      setGeoBusy(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({
      // 등록 전에는 크기를 보내지 않는다 — 서버가 크기 조건을 걸지 않고 전부 준다
      ...(pet ? { size: pet.size, petName: pet.name } : {}),
      limit: String(limit),
      ...(region ? { do: region } : {}),
      ...(tag ? { tag } : {}),
      ...(sort === 'near' && nearIds ? { ids: nearIds.join(',') } : {}),
    })
    fetch(`/api/camping?${qs}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [pet?.size, pet?.name, region, tag, limit, sort, nearIds])

  const camps = data?.camps ?? []

  return (
    <>
      {/* 프로필 버튼은 상단 메뉴에 있다. 여기는 지금 기준과 개수만 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13.5, color: '#6E5F4D' }}>
          {pet
            ? <><span style={{ display: 'inline-block', verticalAlign: '-4px', marginRight: 3 }}><PetFace emoji={pet.emoji} size={17} /></span><b>{pet.name}</b> ({pet.sizeLabel}) 기준 검색 결과</>
            : <>🐶 프로필을 등록하면 크기 조건까지 우리 아이 기준으로 걸러요</>}
        </span>

        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#B3A78F' }}>
          {loading && !data ? '불러오는 중…' : `${(data?.total ?? 0).toLocaleString()}곳`}
          {data && data.hidden > 0 && (
            <span style={{ color: '#C4B8A4' }}> · 동반 불가 {data.hidden.toLocaleString()}곳 숨김</span>
          )}
        </span>
      </div>

      {/* 지역 */}
      <div className="chip-row" style={{ display: 'flex', gap: 7, marginBottom: 10, overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 2 }}>
        <button className="hov-accent" onClick={() => { setRegion(''); setLimit(PAGE) }} style={chip(region === '')}>전국</button>
        {(data?.regions ?? []).map((r) => (
          <button key={r.name} className="hov-accent" onClick={() => { setRegion(r.name); setLimit(PAGE) }} style={chip(region === r.name)}>
            {r.name} <span style={{ opacity: 0.65, fontWeight: 500 }}>{r.n}</span>
          </button>
        ))}
      </div>

      {/* 어떤 곳 — 해변·산·숲 */}
      <div className="chip-row" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {['전체', ...TAGS].map((t) => {
          const key = t === '전체' ? '' : t
          const on = key === tag
          return (
            <button key={t} className="hov-accent" onClick={() => { setTag(key); setLimit(PAGE) }}
              style={{ flex: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, padding: '4px 11px', borderRadius: 99, border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF4EF' : '#FFFFFF', color: on ? '#E85D3D' : '#8A7A65', cursor: 'pointer' }}>
              {t}
            </button>
          )
        })}
      </div>

      {/* 정렬 — 거리는 브라우저에서만 잰다 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {CAMP_SORTS.map(({ key: k, label }) => {
          const on = k === sort
          const busy = k === 'near' && geoBusy
          return (
            <button key={k} className="hov-accent" onClick={() => pickSort(k)} disabled={busy}
              style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, padding: '5px 12px', borderRadius: 99, border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF4EF' : '#FFFFFF', color: on ? '#E85D3D' : '#8A7A65', cursor: busy ? 'default' : 'pointer' }}>
              {busy ? '위치 확인 중…' : label}
            </button>
          )
        })}
        {sort === 'near' && nearIds && (
          <span style={{ fontSize: 11.5, color: '#B3A78F', lineHeight: 1.5 }}>
            내 위치에서 <b style={{ color: '#8A7A65' }}>가까운 {NEAR_MAX}곳</b> 안에서 봐요
            · 위치는 이 브라우저 안에서만 쓰고 서버로 보내지 않아요
          </span>
        )}
        {geoError && (
          <span style={{ fontSize: 11.5, color: '#C0392B', lineHeight: 1.5 }}>{geoError}</span>
        )}
      </div>

      {!loading && camps.length === 0 && (
        <p style={{ padding: 40, textAlign: 'center', color: '#A08872', fontSize: 14, lineHeight: 1.7 }}>
          {pet ? `${pet.name}가 묵을 수 있는 캠핑장이` : '반려동물 동반 가능한 캠핑장이'}<br />이 조건에는 없어요
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 14 }}>
        {camps.map((c) => {
          const ok = c.j.state === 'ok'
          return (
            <article key={c.id} style={{ background: '#FFFFFF', border: '1px solid #EFE8DA', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 132, background: c.image ? `center/cover url(${c.image})` : 'linear-gradient(135deg,#E4F0E4,#F4FAF4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>
                {!c.image && '⛺'}
              </div>
              <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: '#2B2420', wordBreak: 'keep-all' }}>{c.name}</h2>
                  <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap', border: `1.5px solid ${ok ? '#2F8F4E' : '#E8B400'}`, color: ok ? '#2F8F4E' : '#9A7300', background: ok ? '#EAF6EA' : '#FFF7D6' }}>
                    {ok ? '○ 동반 가능' : '✓ 확인 필요'}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 12, color: '#A08872' }}>
                  {c.doNm} {c.sigunguNm}
                  {c.induty && <> · {splitTags(c.induty)[0]}</>}
                  {sort === 'near' && nearDist[c.id] !== undefined && (
                    <span style={{ color: '#E85D3D', fontWeight: 700 }}> · {meters(nearDist[c.id])}</span>
                  )}
                </p>

                <p style={{ margin: 0, fontSize: 12.5, color: ok ? '#2F8F4E' : '#9A7300', lineHeight: 1.5 }}>
                  {c.j.why}
                </p>

                {c.intro && (
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: '#6E5F4D', wordBreak: 'keep-all' }}>
                    {c.intro}…
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto', paddingTop: 4 }}>
                  {splitTags(c.lctCl).map((t) => (
                    <span key={t} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: '#F1EDE3', color: '#6E5F4D' }}>
                      {t}
                    </span>
                  ))}
                </div>

                {(c.mapx > 0 || c.tel) && (
                  <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
                    {c.mapx > 0 && (
                      <a className="hov-accent" href={`https://map.kakao.com/link/to/${encodeURIComponent(c.name)},${c.mapy},${c.mapx}`} target="_blank" rel="noreferrer"
                        style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 700, padding: '7px 0', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#2B2420', textDecoration: 'none' }}>
                        길찾기
                      </a>
                    )}
                    {c.tel && (
                      <a className="hov-accent" href={`tel:${c.tel.replace(/[^0-9+]/g, '')}`}
                        style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 700, padding: '7px 0', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#2B2420', textDecoration: 'none' }}>
                        ☎ 전화
                      </a>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {data && camps.length < data.total && (
        <button className="hov-accent" onClick={() => setLimit((n) => n + PAGE)}
          style={{ display: 'block', margin: '20px auto 0', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '11px 28px', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
          {Math.min(PAGE, data.total - camps.length)}곳 더 보기
        </button>
      )}
    </>
  )
}
