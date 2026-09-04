'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { judge, isDangerousBreed, sizeOf } from '@/lib/petTour'
import type { CardState, Detail, Judgement, Pet, Place, RulesEntry } from '@/lib/types'
import { restStatus, todayLabel } from '@/lib/openHours'
import { useIsMobile } from '@/lib/useIsMobile'
import { distance } from '@/lib/geo'
import KakaoMap from './KakaoMap'

const PETS: Record<string, Pet> = {
  choco: {
    key: 'choco', name: '초코', breed: '말티즈', kg: 3.2, emoji: '🐶',
    size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false,
  },
  bori: {
    key: 'bori', name: '보리', breed: '리트리버', kg: 28, emoji: '🦮',
    size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false,
  },
}

const BADGE = {
  ok: {
    text: '✓ 입장 가능', border: '#2F8F4E', color: '#2F8F4E', bg: '#EAF6EA', checkBg: '#F2FAF2',
  },
  cond: {
    text: '△ 조건부 가능', border: '#C98A12', color: '#8A6208', bg: '#FBF3DD', checkBg: '#FDF8EA',
  },
  loading: {
    text: '조건 확인 중…', border: '#E3DCCE', color: '#A08872', bg: '#F8F5EE', checkBg: '#FAF8F3',
  },
  failed: {
    text: '! 조건 확인 실패', border: '#E0A9A0', color: '#C0392B', bg: '#FBEDEA', checkBg: '#FDF5F3',
  },
} as const

const CAT_EMOJI: Record<string, string> = {
  관광지: '🏞', 문화시설: '🎨', 행사: '🎪', 레포츠: '⛰', 숙박: '🏡', 쇼핑: '🛍', 음식점: '🍽',
}

/** 버튼 순서. 목록에 실제로 있는 것만 그린다 — 행사는 현재 전 지역 0건이다 */
const CAT_ORDER = ['관광지', '음식점', '숙박', '문화시설', '레포츠', '쇼핑', '행사']

/** 한 번에 그리는 카드 수. 이 수만큼만 동반 조건을 조회한다 */
const PAGE = 50

interface Region {
  code: string
  name: string
  sigungu: { code: string; name: string }[]
}

/**
 * 전화 필드는 "전통가옥 운영사무실 02-6358-5533" 처럼 이름과 번호가 한 덩어리로 온다.
 * 그대로 버튼에 넣으면 번호 중간에서 줄이 바뀌어 읽기 어렵다 — 갈라서 번호는 붙여 둔다.
 */
function splitTel(raw: string) {
  const m = raw.match(/(0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}|1[35]\d{2}[-\s.]?\d{4})/)
  if (!m) return { label: '', num: raw.trim() }
  return {
    label: raw.slice(0, m.index).trim().replace(/[(,\/·]+$/, '').trim(),
    num: m[0],
  }
}

type Judged = Place & { j: Judgement | null; state: CardState }

export default function Home() {
  const [regions, setRegions] = useState<Region[]>([])
  const [regnCd, setRegnCd] = useState('11')
  const [signguCd, setSignguCd] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  /** 소개글은 길어서 접어 둔다 — 판정과 현장 규정이 먼저 보여야 한다 */
  const [overviewOpen, setOverviewOpen] = useState(false)
  /** 검색어와 '내 주변' — 셋 다 같은 전국 목록 위에서 걸러낸다 */
  const [q, setQ] = useState('')
  /** 현재 위치로 고른 contentid 목록. 좌표 자체는 서버로 보내지 않는다 */
  const [nearIds, setNearIds] = useState<string[] | null>(null)
  /** contentid → 내 위치에서의 거리(m). 브라우저가 계산한 값이다 */
  const [nearDist, setNearDist] = useState<Record<string, number>>({})
  const [nearBusy, setNearBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const [petKey, setPetKey] = useState('choco')
  const [cat, setCat] = useState('전체')
  const [sub, setSub] = useState('전체')
  const [limit, setLimit] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /** 동반 조건 — 화면에 그려진 장소만 채워진다 */
  const [rulesById, setRulesById] = useState<Record<string, RulesEntry>>({})
  /** 이미 조회를 건 contentid. 같은 장소를 두 번 부르지 않기 위한 것 */
  const requested = useRef(new Set<string>())
  /** 상세 패널 스크롤 영역 */
  const panelBody = useRef<HTMLDivElement>(null)
  /** 분류체계 코드 → 이름 */
  const [catNames, setCatNames] = useState<Record<string, string>>({})

  const isMobile = useIsMobile()
  /** 좁은 화면에서는 지도와 목록을 동시에 못 보여준다 — 탭으로 전환한다 */
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')

  const pet = PETS[petKey]

  useEffect(() => {
    fetch('/api/regions')
      .then((r) => r.json())
      .then((d) => setRegions(d.regions ?? []))
      .catch(() => {})
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCatNames(d.names ?? {}))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setSelectedId(null)
    setCat('전체')
    setSub('전체')
    setLimit(PAGE)
    setRulesById({})
    // 이걸 비우지 않으면 지역을 갔다 돌아왔을 때 조회를 건너뛰어 카드가 '확인 중'에 멈춘다
    requested.current.clear()
    // 목록을 비워두지 않으면, 새 목록이 도착하기 전에 이전 지역 장소로 조건 조회가
    // 한 번 더 나간다 — 조회 기록을 방금 비웠기 때문이다. 그만큼 한도가 새어나간다.
    setPlaces([])
    const qs = new URLSearchParams(
      nearIds
        ? { ids: nearIds.join(',') }
        : { regnCd, ...(signguCd ? { signguCd } : {}), ...(q ? { q } : {}) }
    )
    fetch(`/api/places?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        setPlaces(d.places ?? [])
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [regnCd, signguCd, q, nearIds])

  // 장소를 바꾸면 앞 장소의 정보가 남지 않게 비우고 새로 받는다
  useEffect(() => {
    setDetail(null)
    setOverviewOpen(false)
    // 다른 장소를 열었는데 앞 장소에서 내려둔 스크롤이 남아 있으면 제목과 판정이 가려진다
    panelBody.current?.scrollTo({ top: 0 })
    if (!selectedId) return
    const p = places.find((x) => x.contentid === selectedId)
    if (!p) return

    let alive = true
    setDetailLoading(true)
    fetch(`/api/detail?contentId=${p.contentid}&contentTypeId=${p.contenttypeid}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setDetail(d.detail ?? null) })
      .catch(() => { if (alive) setDetail(null) })
      .finally(() => { if (alive) setDetailLoading(false) })
    return () => { alive = false }
  }, [selectedId, places])

  /**
   * 내 주변 — 좌표를 서버로 보내지 않는다.
   *
   * 사용자 위치를 서버로 전송하면 저장 여부와 무관하게 위치기반서비스사업자 신고
   * 대상이 된다(공모전 공지 FAQ). 그래서 좌표만 담긴 색인을 받아 브라우저에서
   * 거리를 재고, 가까운 contentid 만 서버에 되묻는다. 위치는 단말을 떠나지 않는다.
   */
  const RADIUS = 20000
  const coordsRef = useRef<[string, number, number][] | null>(null)

  async function findNearby() {
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError('이 브라우저는 위치를 알려주지 못해요')
      return
    }
    setNearBusy(true)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      )
      if (!coordsRef.current) {
        const d = await fetch('/api/places/coords').then((r) => r.json())
        coordsRef.current = d.coords ?? []
      }
      const { latitude: lat, longitude: lng } = pos.coords
      const near = coordsRef.current!
        .map(([id, x, y]) => [id, distance(lat, lng, y, x)] as const)
        .filter(([, m]) => m <= RADIUS)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 200)

      if (near.length === 0) {
        setGeoError('20km 안에 등록된 곳이 없어요')
        return
      }
      setNearDist(Object.fromEntries(near))
      setNearIds(near.map(([id]) => id))
    } catch {
      setGeoError('위치를 가져오지 못했어요 — 브라우저에서 위치 권한을 허용해주세요')
    } finally {
      setNearBusy(false)
    }
  }

  // ── 필터: 콘텐츠 타입 → 분류체계 세분류 → 표시 개수
  //    거르는 일은 전부 여기서 한다. 서버는 API가 주는 7종을 그대로 내려준다.
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    places.forEach((p) => (m[p.cat] = (m[p.cat] ?? 0) + 1))
    return m
  }, [places])

  const cats = useMemo(
    () => ['전체', ...CAT_ORDER.filter((c) => (catCounts[c] ?? 0) > 0)],
    [catCounts]
  )

  const inCat = useMemo(
    () => places.filter((p) => cat === '전체' || p.cat === cat),
    [places, cat]
  )

  // 쇼핑처럼 한 타입에 수천 곳이 몰린 경우를 위한 2차 필터. 종류가 하나뿐이면 숨긴다
  const subCounts = useMemo(() => {
    const m: Record<string, number> = {}
    inCat.forEach((p) => {
      if (p.lclsSystm2) m[p.lclsSystm2] = (m[p.lclsSystm2] ?? 0) + 1
    })
    return m
  }, [inCat])

  // '전체'에서는 세분류가 20종을 넘어 필터 바가 넘친다. 많은 순 상위만 노출한다
  const subs = useMemo(() => {
    // 좁은 화면에서는 세부 줄이 목록을 아래로 밀어낸다. 카테고리를 고른 뒤에만 보여준다
    if (isMobile && cat === '전체') return []
    const keys = Object.keys(subCounts).sort((a, b) => subCounts[b] - subCounts[a])
    return keys.length > 1 ? keys.slice(0, isMobile ? 6 : 10) : []
  }, [subCounts, isMobile, cat])

  const filtered = useMemo(
    () => inCat.filter((p) => sub === '전체' || p.lclsSystm2 === sub),
    [inCat, sub]
  )

  const shown = useMemo(() => filtered.slice(0, limit), [filtered, limit])

  // ── 동반 조건은 화면에 그려진 것만 조회한다.
  //    목록 전체를 조회하면 서울(3,170곳)에서 일일 한도를 한 번에 넘긴다.
  useEffect(() => {
    const need = shown.map((p) => p.contentid).filter((id) => !requested.current.has(id))
    if (need.length === 0) return
    need.forEach((id) => requested.current.add(id))

    setRulesById((m) => {
      const next = { ...m }
      need.forEach((id) => (next[id] = { state: 'loading' }))
      return next
    })

    const mark = (fn: (id: string) => RulesEntry) =>
      setRulesById((m) => {
        const next = { ...m }
        need.forEach((id) => (next[id] = fn(id)))
        return next
      })

    fetch(`/api/pet-rules?ids=${need.join(',')}`)
      .then((r) => r.json())
      .then((d) => {
        const got: Record<string, any> = d.rules ?? {}
        // 조회 실패와 '조건 정보 미등록'은 다른 상태다. 실패를 미등록으로 뭉개면
        // 화면에 "정보가 없는 장소"로 잘못 표시된다.
        mark((id) => (id in got ? { state: 'done', rules: got[id] } : { state: 'failed' }))
      })
      .catch(() => {
        need.forEach((id) => requested.current.delete(id))
        mark(() => ({ state: 'failed' }))
      })
  }, [shown])

  // ── 판정
  type Row = Place & { j: Judgement | null; state: CardState | 'no' }

  const rows: Row[] = useMemo(
    () =>
      shown.map((p) => {
        const e = rulesById[p.contentid]
        if (!e || e.state === 'loading') return { ...p, j: null, state: 'loading' as const }
        if (e.state === 'failed') return { ...p, j: null, state: 'failed' as const }
        const j = judge(e.rules, pet)
        return { ...p, j, state: j.status }
      }),
    [shown, rulesById, pet]
  )

  const visible = useMemo(() => rows.filter((r) => r.state !== 'no') as Judged[], [rows])
  const hiddenCount = rows.length - visible.length

  const okCount = visible.filter((p) => p.state === 'ok').length
  const condCount = visible.filter((p) => p.state === 'cond').length
  const failedCount = visible.filter((p) => p.state === 'failed').length

  const sel = visible.find((p) => p.contentid === selectedId) ?? null

  /** 상세 패널에서 원본 조건이 필요할 때 — 조회가 끝난 경우에만 있다 */
  const rules = (p: Judged) => {
    const e = rulesById[p.contentid]
    return e && e.state === 'done' ? e.rules : null
  }
  const region = regions.find((r) => r.code === regnCd)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: isMobile ? 0 : 1100, overflow: 'hidden' }}>
      {/* ── 상단 바 */}
      <header style={{ display: 'flex', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 6 : 16, padding: isMobile ? '8px 12px' : '12px 20px', background: '#FFFFFF', borderBottom: '1px solid #EAE3D6', flex: 'none' }}>
        <div className="hov-accent" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F6F1E7', border: '1.5px solid #EAE3D6', borderRadius: 12, padding: '7px 12px' }}>
          <span>📍</span>
          <select value={regnCd} onChange={(e) => { setRegnCd(e.target.value); setSignguCd('') }}
            style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 14, color: '#2B2420', cursor: 'pointer', outline: 'none' }}>
            {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
          <select value={signguCd} onChange={(e) => setSignguCd(e.target.value)}
            style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 14, color: '#6E5F4D', cursor: 'pointer', outline: 'none' }}>
            <option value="">전체</option>
            {region?.sigungu.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        {/* 검색 — 전국 목록 위에서 이름·주소로 찾는다 */}
        <div className="hov-accent" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F6F1E7', border: '1.5px solid #EAE3D6', borderRadius: 12, padding: '7px 12px', minWidth: isMobile ? 0 : 210, flex: isMobile ? '1 1 100%' : 'none', order: isMobile ? 3 : 0 }}>
          <span>🔎</span>
          <input value={q} placeholder="장소 이름으로 찾기"
            onChange={(e) => { setQ(e.target.value); setNearIds(null) }}
            style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 14, color: '#2B2420', outline: 'none', width: '100%' }} />
          {q && (
            <button onClick={() => setQ('')} title="검색어 지우기"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#A08872', fontSize: 15, lineHeight: 1, padding: 0 }}>✕</button>
          )}
        </div>

        <button className="hov-accent" disabled={nearBusy}
          onClick={() => (nearIds ? setNearIds(null) : findNearby())}
          title={nearIds ? '지역으로 돌아가기' : '현재 위치 20km 안에서 찾기 — 위치는 이 기기 밖으로 나가지 않아요'}
          style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: nearIds ? 700 : 500, padding: '8px 14px', borderRadius: 12, border: `1.5px solid ${nearIds ? '#E85D3D' : '#EAE3D6'}`, background: nearIds ? '#FFF4EF' : '#F6F1E7', color: nearIds ? '#E85D3D' : '#6E5F4D', cursor: nearBusy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
          🧭 {nearBusy ? '위치 확인 중…' : nearIds ? '내 주변 해제' : '내 주변'}
        </button>

        {geoError && (
          <span style={{ fontSize: 12, color: '#C0392B', maxWidth: 220, lineHeight: 1.35 }}>{geoError}</span>
        )}

        <div style={{ flex: 1 }} />

        <button className="hov-accent" onClick={() => { setPetKey(petKey === 'choco' ? 'bori' : 'choco'); setSelectedId(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#FFF4EF', border: '1.5px solid #F3C9BB', borderRadius: 99, padding: '6px 14px 6px 8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#2B2420' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: '#FFE0D3', borderRadius: '50%', fontSize: 16 }}>{pet.emoji}</span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
            <span style={{ fontWeight: 700 }}>{pet.name} · {pet.breed}</span>
            <span style={{ fontSize: 11.5, color: '#A08872' }}>
              {pet.kg}kg · {pet.sizeLabel}{isMobile ? ' ▾' : ' · 프로필 전환 ▾'}
            </span>
          </span>
        </button>
      </header>

      {/* ── 필터 바 */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #EAE3D6', flex: 'none' }}>
        <div className="chip-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '7px 12px 0' : '10px 20px 0', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {cats.map((label) => {
            const on = label === cat
            const n = label === '전체' ? places.length : catCounts[label]
            return (
              <button key={label} className="hov-accent"
                onClick={() => { setCat(label); setSub('전체'); setLimit(PAGE); setSelectedId(null) }}
                style={{ flex: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 700 : 500, padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${on ? '#2B2420' : '#E3DCCE'}`, background: on ? '#2B2420' : '#FFFFFF', color: on ? '#FFFFFF' : '#6E5F4D', cursor: 'pointer' }}>
                {label} <span style={{ opacity: .65, fontWeight: 500 }}>{n}</span>
              </button>
            )
          })}
          <div style={{ flex: 1 }} />
          {failedCount > 0 && (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#C0392B' }}>
              ! 조건 정보를 불러오지 못한 곳 {failedCount}개 — 새로고침하면 다시 시도해요
            </span>
          )}
        </div>

        {/* 세분류 — 쇼핑처럼 한 타입에 수천 곳이 몰릴 때 좁혀 보기 위한 2차 필터 */}
        {(!isMobile || subs.length > 0) && (
        <div className="chip-row" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '5px 12px 7px' : '8px 20px 10px', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: 'nowrap' }}>
          {subs.length > 0 && (
            <>
              <span style={{ fontSize: 12, color: '#B3A78F', marginRight: 2 }}>세부</span>
              {['전체', ...subs].map((code) => {
                const on = code === sub
                const label = code === '전체' ? '전체' : (catNames[code] ?? code)
                const n = code === '전체' ? inCat.length : subCounts[code]
                return (
                  <button key={code} className="hov-accent"
                    onClick={() => { setSub(code); setLimit(PAGE); setSelectedId(null) }}
                    style={{ flex: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, padding: '4px 11px', borderRadius: 99, border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF4EF' : '#FFFFFF', color: on ? '#E85D3D' : '#8A7A65', cursor: 'pointer' }}>
                    {label} <span style={{ opacity: .6, fontWeight: 500 }}>{n}</span>
                  </button>
                )
              })}
            </>
          )}
          {!isMobile && <div style={{ flex: 1 }} />}
          <span style={{ fontSize: 12.5, color: '#B3A78F', flex: 'none', paddingLeft: isMobile ? 4 : 0 }}>
            {q && <b style={{ color: '#E85D3D' }}>전국 검색 · </b>}
            {nearIds && <b style={{ color: '#E85D3D' }}>내 주변 20km · </b>}
            {filtered.length}곳 중 {shown.length}곳 확인함
            {hiddenCount > 0 && ` · 동반 불가 ${hiddenCount}곳 숨김`}
          </span>
        </div>
        )}
      </div>

      {/* ── 본문 */}
      {/* 좁은 화면: 목록과 지도를 탭으로 전환 */}
      {isMobile && (
        <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px', background: '#FFFFFF', borderBottom: '1px solid #EAE3D6', flex: 'none' }}>
          {(['list', 'map'] as const).map((v) => {
            const on = v === mobileView
            return (
              <button key={v} onClick={() => setMobileView(v)}
                style={{ flex: 1, fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 700 : 500, padding: '8px 0', borderRadius: 10, border: `1.5px solid ${on ? '#2B2420' : '#E3DCCE'}`, background: on ? '#2B2420' : '#FFFFFF', color: on ? '#FFFFFF' : '#6E5F4D', cursor: 'pointer' }}>
                {v === 'list' ? `목록 ${visible.length}` : '지도'}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 좌측 결과 리스트 */}
        <aside style={{ width: isMobile ? '100%' : 312, flex: 'none', background: '#FFFFFF', borderRight: isMobile ? 'none' : '1px solid #EAE3D6', display: isMobile && mobileView !== 'list' ? 'none' : 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {pet.name}가 갈 수 있는 곳 <span style={{ color: '#E85D3D' }}>{visible.length}</span>
            </span>
            <span style={{ fontSize: 12, color: '#B3A78F' }}>
              {isMobile && subs.length === 0 ? `${filtered.length.toLocaleString()}곳 중` : '이름 순'}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading && <div style={{ padding: 20, fontSize: 13, color: '#A08872', textAlign: 'center' }}>불러오는 중…</div>}
            {!loading && error && <div style={{ padding: 16, fontSize: 12.5, color: '#C0392B', lineHeight: 1.5 }}>{error}</div>}
            {!loading && !error && visible.length === 0 && (
              <div style={{ padding: 20, fontSize: 13, color: '#A08872', textAlign: 'center', lineHeight: 1.6 }}>
                이 조건에 맞는<br />동반 가능 장소가 없어요
              </div>
            )}

            {visible.map((p) => {
              const b = BADGE[p.state]
              const on = p.contentid === selectedId
              const condCheck = p.j?.checks.find((c) => c.icon === '!')
              return (
                <div key={p.contentid} className="hov-card"
                  onClick={() => { setSelectedId(p.contentid); if (isMobile) setMobileView('map') }}
                  style={{ border: `1.5px solid ${on ? '#E85D3D' : '#EFE8DA'}`, background: on ? '#FFF6F2' : '#FFFFFF', borderRadius: 14, padding: '11px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 99, border: `1.5px solid ${b.border}`, color: b.color, background: b.bg, whiteSpace: 'nowrap' }}>{b.text}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#A08872' }}>
                    {p.cat} · {p.addr1.split(' ').slice(1, 3).join(' ')}
                    {nearDist[p.contentid] !== undefined && (
                      <span style={{ color: '#E85D3D', fontWeight: 700 }}>
                        {' · '}{nearDist[p.contentid] < 1000
                          ? `${Math.round(nearDist[p.contentid])}m`
                          : `${(nearDist[p.contentid] / 1000).toFixed(1)}km`}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: p.j ? (condCheck ? '#8A6208' : '#2F8F4E') : '#A08872' }}>
                    {p.j ? (condCheck ? condCheck.text : p.j.checks[0]?.text) : b.text}
                  </div>
                </div>
              )
            })}

            {!loading && !error && shown.length < filtered.length && (
              <button className="hov-accent" onClick={() => setLimit((n) => n + PAGE)}
                style={{ fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '11px 0', marginTop: 4, borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#6E5F4D', cursor: 'pointer' }}>
                {PAGE}곳 더 보기 <span style={{ fontWeight: 500, color: '#B3A78F' }}>({filtered.length - shown.length} 남음)</span>
              </button>
            )}
          </div>
        </aside>

        {/* 지도 영역 */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#EFEAE0', display: isMobile && mobileView !== 'map' ? 'none' : 'block' }}>
          <KakaoMap places={visible} selectedId={selectedId} onSelect={setSelectedId} />

          {/* 범례 */}
          <div style={{ position: 'absolute', right: 16, bottom: 16, background: '#FFFFFF', border: '1px solid #EAE3D6', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 5, boxShadow: '0 4px 14px rgba(43,36,32,.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#2F8F4E' }} />입장 가능 {okCount}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#C98A12' }} />조건부 가능 {condCount}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#B3A78F' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#D8D0C0' }} />불가 {hiddenCount} (숨김)</div>
            {visible.some((p) => p.state === 'loading') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#A08872' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#B3A78F' }} />조건 확인 중 {visible.filter((p) => p.state === 'loading').length}</div>
            )}
          </div>

          <div style={{ position: 'absolute', left: 16, top: 14, background: 'rgba(255,255,255,.92)', border: '1px solid #EAE3D6', borderRadius: 99, padding: '6px 14px', fontSize: 12.5, color: '#6E5F4D' }}>
            {pet.emoji} <b>{pet.name}</b> 기준으로 판정된 지도예요 · 출처 ⓒ한국관광공사
          </div>

          {/* 상세 패널 */}
          {sel && (() => {
            const b = BADGE[sel.state]
            return (
              <div style={isMobile
                ? { position: 'absolute', inset: 0, background: '#FFFFFF', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 30 }
                : { position: 'absolute', left: 14, top: 56, bottom: 14, width: 330, background: '#FFFFFF', border: '1px solid #EAE3D6', borderRadius: 18, boxShadow: '0 10px 34px rgba(43,36,32,.16)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slidein .22s ease-out', zIndex: 30 }}>
                {(() => {
                  // 대표 사진이 없는 곳이 많다(숙박 32%·음식점 58%만 보유). detailImage2 로 메운다
                  const hero = sel.firstimage || detail?.images[0]?.url || ''
                  return (
                    <div style={{ height: 96, background: hero ? `center/cover url(${hero})` : 'linear-gradient(135deg,#FFE0D3,#FFF4EF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, position: 'relative' }}>
                      {!hero && (CAT_EMOJI[sel.cat] ?? '📍')}
                      <button onClick={() => { setSelectedId(null); if (isMobile) setMobileView('list') }}
                        style={{ position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.85)', cursor: 'pointer', fontSize: 14, color: '#6E5F4D' }}>✕</button>
                    </div>
                  )
                })()}

                {/* overflowAnchor: 상세 정보가 뒤늦게 채워질 때 브라우저가 스크롤을 밀어
                    제목·판정이 화면 밖으로 나가는 것을 막는다 */}
                <div ref={panelBody} style={{ flex: 1, overflowY: 'auto', overflowAnchor: 'none', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="jua" style={{ fontSize: 21 }}>{sel.title}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '3px 11px', borderRadius: 99, border: `1.5px solid ${b.border}`, color: b.color, background: b.bg, whiteSpace: 'nowrap' }}>{b.text}</span>
                  </div>

                  <div style={{ fontSize: 12.5, color: '#A08872' }}>{sel.cat} · {sel.addr1}</div>

                  {/* 오늘 휴무 — 동반 가능해도 문이 닫혀 있으면 똑같이 헛걸음이다.
                      '오늘 쉰다'가 확실할 때만 알리고, 규칙을 못 읽으면 원문을 그대로 보여준다 */}
                  {(() => {
                    if (!detail) return null
                    const st = restStatus(detail.restdate)
                    if (st.kind === 'closed') {
                      return (
                        <div style={{ border: '1.5px solid #E0A9A0', background: '#FBEDEA', borderRadius: 12, padding: '10px 13px', fontSize: 13, fontWeight: 700, color: '#C0392B' }}>
                          🔴 오늘({todayLabel()}) 휴무 — {st.label}
                        </div>
                      )
                    }
                    // 요일은 쉬는 날이지만 "단, 공휴일이면 개관" 같은 예외가 붙은 경우.
                    // 단정하면 열린 곳을 막게 되므로 원문을 함께 보여주고 확인을 권한다
                    if (st.kind === 'maybe') {
                      return (
                        <div style={{ border: '1.5px solid #F0D9A0', background: '#FBF3DD', borderRadius: 12, padding: '10px 13px', fontSize: 12.5, color: '#8A6208', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <b style={{ fontSize: 13 }}>🟡 오늘({todayLabel()}) 휴무일 수 있어요 — {st.label}</b>
                          <span>{st.note}</span>
                          <span style={{ color: '#A08872' }}>예외 규정이 있어 방문 전 확인을 권해요</span>
                        </div>
                      )
                    }
                    if (!detail.usetime && !detail.restdate) return null
                    return (
                      <div style={{ border: '1.5px solid #EFE8DA', background: '#FAF8F3', borderRadius: 12, padding: '10px 13px', fontSize: 12.5, color: '#6E5F4D', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {detail.usetime && <div>🕘 {detail.usetime}</div>}
                        {detail.restdate && (
                          <div style={{ color: st.kind === 'always' ? '#2F8F4E' : '#8A6208' }}>
                            📅 {detail.restdate}
                          </div>
                        )}
                        {detail.parking && <div>🅿️ 주차 {detail.parking}</div>}
                      </div>
                    )
                  })()}

                  <div style={{ border: `1.5px solid ${b.border}`, background: b.checkBg, borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>입장 조건 체크리스트 — {pet.name} 기준</span>
                    {(sel.j?.checks ?? [{ icon: '!' as const, color: '#A08872', text: b.text }]).map((ck, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700, color: ck.color }}>{ck.icon}</span>
                        <span>{ck.text}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1.5px dashed #E3D9C6', paddingTop: 7, fontSize: 11.5, color: '#A08872' }}>
                      조건 정보 충실도 {rules(sel)?.completeness ?? '—'}등급 · 출처 ⓒ한국관광공사
                    </div>
                  </div>

                  {rules(sel) && rules(sel)!.notes.length > 0 && (
                    <div style={{ border: '1.5px solid #F0D9A0', background: '#FBF3DD', borderRadius: 12, padding: '10px 13px', fontSize: 12.5, color: '#8A6208', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <b>현장 규정</b>
                      {rules(sel)!.notes.map((n, i) => <div key={i}>• {n}</div>)}
                    </div>
                  )}

                  {detailLoading && (
                    <div style={{ fontSize: 12.5, color: '#B3A78F' }}>장소 정보를 불러오는 중…</div>
                  )}

                  {/* 입장료·시설 — 있는 곳만 (관광지 100%, 나머지 41~66%) */}
                  {detail && detail.extras.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 7, fontSize: 12.5, alignItems: 'baseline' }}>
                      {detail.extras.slice(0, 4).map((x, i) => (
                        <Fragment key={i}>
                          <span style={{ color: '#A08872', whiteSpace: 'nowrap' }}>{x.name}</span>
                          <span style={{ whiteSpace: 'pre-line', color: '#2B2420' }}>{x.text}</span>
                        </Fragment>
                      ))}
                    </div>
                  )}

                  {/* 소개글 — 사람이 쓴 문장이라 손대지 않고 그대로 보여준다.
                      판정·현장 규정 같은 '결정에 쓰는' 블록과 구분되게 테두리 대신
                      작은 표제와 가는 선으로 묶는다. 길면 접어 두고 펼치게 한다 */}
                  {detail?.overview && (() => {
                    const LIMIT = 200
                    const long = detail.overview.length > LIMIT
                    // 문장 중간에서 끊지 않는다 — 마지막 마침표까지만 보여준다
                    const cut = () => {
                      const head = detail.overview.slice(0, LIMIT)
                      const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('.\n'), head.lastIndexOf('다.'))
                      return (end > LIMIT * 0.5 ? head.slice(0, end + 1) : head.replace(/[\s,·]+$/, '') + '…')
                    }
                    const shown = !long || overviewOpen ? detail.overview : cut()
                    return (
                      <section style={{ borderTop: '1px solid #EFE8DA', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', color: '#B3A78F' }}>
                          이런 곳이에요
                        </span>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: '#5C5347', whiteSpace: 'pre-line', wordBreak: 'keep-all' }}>
                          {shown}
                        </p>
                        {long && (
                          <button onClick={() => setOverviewOpen((v) => !v)}
                            style={{ alignSelf: 'flex-start', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#E85D3D', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            {overviewOpen ? '접기' : '더 보기'}
                          </button>
                        )}
                      </section>
                    )
                  })()}

                  {/* 사진이 더 있으면 — Type3 은 변경 금지라 자르거나 덧씌우지 않는다 */}
                  {detail && detail.images.length > 1 && (
                    <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                      {detail.images.slice(0, 6).map((im) => (
                        <img key={im.url} src={im.url} alt="" loading="lazy"
                          style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 8, flex: 'none' }} />
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 'auto', paddingTop: 4 }}>
                    <a className="btn-primary" href={`https://map.kakao.com/link/to/${encodeURIComponent(sel.title)},${sel.mapy},${sel.mapx}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 14.5, fontWeight: 700, padding: '12px 0', borderRadius: 12, border: 'none', background: '#E85D3D', color: '#FFFFFF', textAlign: 'center', textDecoration: 'none' }}>
                      길찾기
                    </a>

                    {detail?.homepage && (
                      <a className="hov-accent" href={detail.homepage} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', textDecoration: 'none' }}>
                        <span style={{ fontSize: 13, flex: 'none', color: '#A08872' }}>🔗</span>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#2B2420' }}>공식 홈페이지</span>
                      </a>
                    )}

                    {detailLoading ? (
                      <span style={{ fontSize: 12.5, color: '#B3A78F', textAlign: 'center' }}>연락처 확인 중…</span>
                    ) : !detail || detail.tels.length === 0 ? (
                      <span style={{ fontSize: 12.5, color: '#B3A78F', textAlign: 'center' }}>등록된 전화번호가 없어요</span>
                    ) : (
                      detail.tels.slice(0, 3).map((t) => {
                        const { label, num } = splitTel(t)
                        return (
                          <a key={t} className="hov-accent" href={`tel:${num.replace(/[^0-9+]/g, '')}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderRadius: 12, border: '1.5px solid #E3DCCE', background: '#FFFFFF', textDecoration: 'none' }}>
                            <span style={{ fontSize: 13, flex: 'none', color: '#A08872' }}>☎</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#2B2420', whiteSpace: 'nowrap' }}>
                              {num}
                            </span>
                            {label && (
                              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#A08872', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {label}
                              </span>
                            )}
                          </a>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
