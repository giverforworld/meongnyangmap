'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import type { CardState, Detail, Judgement, Place, PetRules, RulesEntry } from '@/lib/types'
import type { Pet } from '@/lib/types'
import { judge } from '@/lib/petTour'
import { crowdHint, crowdLevel, dowOf, type CrowdDay } from '@/lib/crowd'
import { restStatus, todayLabel } from '@/lib/openHours'
import { phoneScript } from '@/lib/phoneScript'
import { recentChange, shortDate } from '@/lib/ruleText'
import { PlaceReviews, PlaceStories, type CheckSummary } from './PlaceSocial'
import { BADGE, CAT_EMOJI, ruleLines, siteNotes, splitTel } from './placeUi'
import { PhoneIcon, PlacePinIcon } from './icons'
import PetFace from './PetFace'

/**
 * 장소 상세 — 지도 화면의 패널과 핫플레이스의 '상세 보기'가 같은 것을 쓴다.
 *
 * 판정·휴무·조건·붐빔·소개·리뷰·이야기·길찾기·전화까지 한 덩어리다. 화면마다 따로 두면
 * 한쪽만 고쳐져 같은 장소가 다르게 보인다. 데이터(상세·집중률·조건)는 여기서 직접 받는다 —
 * 지도 목록이 이미 받아둔 조건이 있으면 넘겨받아 다시 묻지 않는다.
 *
 * 사진부터 내용까지 한 덩어리로 스크롤된다 — 지도앱들처럼 사진이 위로 밀려 올라간다.
 * 닫기 버튼은 사진이 아니라 패널에 붙어 있어 스크롤해도 남는다.
 */
export interface PlaceDetailProps {
  place: Place
  pet: Pet | null
  /** 목록이 이미 받아둔 조건. 없으면 직접 받는다 */
  rulesEntry?: RulesEntry
  onClose: () => void
  mobile: boolean
  /** 로그인 — 리뷰 닉네임 고정과 마크에 쓴다 */
  nickname?: string
  loggedIn?: boolean
  provider?: string
}

export default function PlaceDetail({ place, pet, rulesEntry, onClose, mobile, nickname, loggedIn = false, provider }: PlaceDetailProps) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [crowd, setCrowd] = useState<CrowdDay[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [ownRules, setOwnRules] = useState<RulesEntry | null>(null)
  /** 사용자 현장 확인 요약 — 리뷰 섹션이 받아서 올려준다. 출발 전 체크에 '최근 거부' 경고를 붙인다 */
  const [checks, setChecks] = useState<CheckSummary | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // 상세·집중률 — 장소가 바뀌면 앞 장소 것을 남기지 않는다
  useEffect(() => {
    setDetail(null)
    setCrowd(null)
    setChecks(null)
    setOverviewOpen(false)
    scroller.current?.scrollTo({ top: 0 })
    let alive = true
    setDetailLoading(true)
    fetch(`/api/detail?contentId=${place.contentid}&contentTypeId=${place.contenttypeid}`)
      .then((r) => r.json())
      .then((d) => { if (!alive) return; setDetail(d.detail ?? null); setCrowd(d.crowd ?? null) })
      .catch(() => { if (alive) { setDetail(null); setCrowd(null) } })
      .finally(() => { if (alive) setDetailLoading(false) })
    return () => { alive = false }
  }, [place.contentid, place.contenttypeid])

  // 조건 — 넘겨받은 게 없을 때만 직접 받는다 (핫플레이스에서 열 때)
  useEffect(() => {
    if (rulesEntry) { setOwnRules(null); return }
    let alive = true
    setOwnRules({ state: 'loading' })
    fetch(`/api/pet-rules?ids=${place.contentid}`)
      .then((r) => r.json())
      .then((d) => { if (!alive) return; setOwnRules(place.contentid in (d.rules ?? {}) ? { state: 'done', rules: d.rules[place.contentid] } : { state: 'failed' }) })
      .catch(() => { if (alive) setOwnRules({ state: 'failed' }) })
    return () => { alive = false }
  }, [place.contentid, rulesEntry])

  const entry = rulesEntry ?? ownRules ?? { state: 'loading' as const }
  const rules: PetRules | null = entry.state === 'done' ? entry.rules : null
  const j: Judgement | null = entry.state === 'done' && pet ? judge(entry.rules, pet) : null
  const state: CardState | 'no' =
    entry.state === 'loading' ? 'loading' : entry.state === 'failed' ? 'failed' : !pet ? 'info' : j!.status
  const b = BADGE[state === 'no' ? 'cond' : state]
  const sel = { ...place, j, state }

  return (
    <>
      {/* 닫기는 사진이 아니라 패널에 붙인다 — 사진이 스크롤돼 올라가도 남아 있어야 한다 */}
      <button onClick={onClose} aria-label="닫기"
        style={{ position: 'absolute', right: 10, top: 10, zIndex: 2, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.9)', boxShadow: '0 2px 8px rgba(43,36,32,.18)', cursor: 'pointer', fontSize: 14, color: '#6E5F4D' }}>✕</button>

      {/* 사진부터 내용까지 한 덩어리로 스크롤된다 — 지도앱들처럼 사진이 위로 밀려 올라간다.
          overflowAnchor: 상세 정보가 뒤늦게 채워질 때 브라우저가 스크롤을 밀어
          제목·판정이 화면 밖으로 나가는 것을 막는다 */}
      <div ref={scroller} style={{ flex: 1, overflowY: 'auto', overflowAnchor: 'none', display: 'flex', flexDirection: 'column' }}>
      {(() => {
        // 대표 사진이 없는 곳이 많다(숙박 32%·음식점 58%만 보유). detailImage2 로 메우되
        // Type3(변경 금지)은 배경 cover 로 잘리므로 쓰지 않는다 — Type1 만 대표 자리에 올린다
        const hero = place.firstimage || detail?.images.find((im) => im.copyright !== 'Type3')?.url || ''
        return (
          <div style={{ height: mobile ? 210 : 120, flex: 'none', background: hero ? `center/cover url(${hero})` : 'linear-gradient(135deg,#FFE0D3,#FFF4EF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>
            {!hero && (CAT_EMOJI[place.cat] ?? <span style={{ color: '#E85D3D' }}><PlacePinIcon size={38} /></span>)}
          </div>
        )
      })()}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="jua" style={{ fontSize: 21 }}>{place.title}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '3px 11px', borderRadius: 99, border: `1.5px solid ${b.border}`, color: b.color, background: b.bg, whiteSpace: 'nowrap' }}>{b.text}</span>
        </div>

        <div style={{ fontSize: 12.5, color: '#A08872' }}>{place.cat} · {place.addr1}</div>

        {/* ── 출발 전 체크 — 헛걸음의 세 원인(오늘 닫힘 · 우리 아이 조건 · 모호함)을 한 블록에.
            오늘 문 여는지 → 아이 기준 조건 → 확인 전화 순서로, 위에서 아래로 읽으면 출발 준비가 끝난다 */}
        <Preflight pet={pet} detail={detail} detailLoading={detailLoading} rules={rules} j={sel.j} state={sel.state} checks={checks} />

        {/* 영업시간·휴무·주차 — 체크 첫 줄이 요약이고, 여기는 원문. 글머리표('- ')와 빈 줄은 걷어내고
            이름표 : 값 표로 놓는다 — 원문을 그대로 붓던 예전 모양은 줄 간격이 들쭉날쭉했다 */}
        {detail && (detail.usetime || detail.restdate || detail.parking) && (() => {
          const st = restStatus(detail.restdate)
          const lines = (v: string) => v.split('\n').map((l) => l.replace(/^[-*·•※]\s*/, '').trim()).filter(Boolean)
          const rows: { label: string; lines: string[]; color?: string }[] = []
          if (detail.usetime) rows.push({ label: '영업시간', lines: lines(detail.usetime) })
          if (detail.restdate) rows.push({ label: '휴무', lines: lines(detail.restdate), color: st.kind === 'always' ? '#2F8F4E' : st.kind === 'closed' ? '#C0392B' : undefined })
          if (detail.parking) rows.push({ label: '주차', lines: lines(detail.parking) })
          return (
            <div style={{ border: '1.5px solid #EFE8DA', background: '#FAF8F3', borderRadius: 12, padding: '10px 13px', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 14, rowGap: 6, fontSize: 12.5, alignItems: 'baseline' }}>
              {rows.map((r) => (
                <Fragment key={r.label}>
                  <span style={{ color: '#A08872', whiteSpace: 'nowrap' }}>{r.label}</span>
                  <span style={{ color: r.color ?? '#2B2420', display: 'flex', flexDirection: 'column', gap: 2, wordBreak: 'keep-all' }}>
                    {r.lines.map((l, i) => <span key={i}>{l}</span>)}
                  </span>
                </Fragment>
              ))}
            </div>
          )
        })()}

        {/* 최근 바뀐 조건 — 배치가 어제 스냅샷과 비교해 적은 것. 전후를 나란히 놓는다 */}
        {(() => {
          const c = recentChange(rules)
          if (!c) return null
          const gone = c.before.filter((l) => !c.after.includes(l))
          const came = c.after.filter((l) => !c.before.includes(l))
          return (
            <div style={{ border: '1.5px solid #F3C9BB', background: '#FFF4EF', borderRadius: 12, padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <b style={{ fontSize: 12.5, color: '#E85D3D' }}>최근 바뀐 조건</b>
                <span style={{ fontSize: 11, color: '#A08872' }}>{shortDate(c.at)} 감지</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5 }}>
                {gone.map((l) => <span key={'-' + l} style={{ color: '#A08872', textDecoration: 'line-through' }}>{l}</span>)}
                {came.map((l) => <span key={'+' + l} style={{ color: '#2B2420', fontWeight: 700 }}>+ {l}</span>)}
              </div>
              <span style={{ fontSize: 11, color: '#A08872' }}>바뀐 걸 알아챈 날짜예요. 현장 규정은 그 전에 바뀌었을 수 있어요</span>
            </div>
          )
        })()}

        {rules && rules!.notes.length > 0 && (
          <div style={{ border: '1.5px solid #F0D9A0', background: '#FBF3DD', borderRadius: 12, padding: '10px 13px', fontSize: 12.5, color: '#8A6208', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <b>현장 규정</b>
            {rules!.notes.map((n, i) => <div key={i}>• {n}</div>)}
          </div>
        )}

        {/* 현장 참고 — 사고 위험 요소·구비 시설·비치/대여/구매 품목. 조건은 아니지만 현장에서 알아야 할 것 */}
        {(() => {
          const rows = siteNotes(rules)
          if (rows.length === 0) return null
          return (
            <div style={{ border: '1.5px solid #EFE8DA', background: '#FFFFFF', borderRadius: 12, padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <b style={{ fontSize: 12.5, color: '#6E5F4D' }}>현장 참고</b>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 5, fontSize: 12.5, alignItems: 'baseline' }}>
                {rows.map((x) => (
                  <Fragment key={x.label}>
                    <span style={{ color: x.warn ? '#C0392B' : '#A08872', fontWeight: x.warn ? 700 : 500, whiteSpace: 'nowrap' }}>{x.warn ? '⚠ ' : ''}{x.label}</span>
                    <span style={{ color: '#2B2420', wordBreak: 'keep-all' }}>{x.text}</span>
                  </Fragment>
                ))}
              </div>
              <span style={{ fontSize: 11, color: '#B3A78F' }}>데이터 출처: ⓒ한국관광공사</span>
            </div>
          )
        })()}

        {/* 언제 가면 좋을까 — 붐비는 곳은 리드줄이 엉키고 아이가 스트레스를 받는다.
            숫자는 그 장소가 가장 붐빌 때를 100 으로 본 상대값이라, 다른 장소와
            견주면 안 된다. 같은 장소의 날짜끼리만 비교할 수 있다 */}
        {(() => {
          if (!crowd) return null
          const hint = crowdHint(crowd)
          if (!hint) return null
          const BAR = { quiet: '#2F8F4E', normal: '#FFC93C', busy: '#C0392B' } as const
          return (
            <section style={{ border: '1.5px solid #EFE8DA', background: '#FAF8F3', borderRadius: 12, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <b style={{ fontSize: 13 }}>언제 가면 좋을까</b>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}>
                {hint.days.map((d) => {
                  const lv = crowdLevel(d.rate)
                  const on = d.ymd === hint.best.ymd
                  return (
                    <div key={d.ymd} title={`${d.ymd.slice(4, 6)}.${d.ymd.slice(6)} · 집중률 ${d.rate}`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: '100%', height: 40, display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{
                          width: '100%',
                          // 상한을 100 으로 고정한다. 구간 최댓값에 맞추면
                          // 전부 한산한 주에도 하나가 '붐빔'처럼 보인다
                          height: `${Math.max(6, Math.min(100, d.rate))}%`,
                          background: BAR[lv],
                          opacity: on ? 1 : 0.42,
                          borderRadius: 3,
                        }} />
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? '#2F8F4E' : '#A08872' }}>
                        {dowOf(d.ymd)}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div style={{ fontSize: 12.5, color: '#5C5347' }}>
                <b style={{ color: '#2F8F4E' }}>{dowOf(hint.best.ymd)}요일</b>이 가장 한산해요
                <span style={{ color: '#A08872' }}> · {dowOf(hint.worst.ymd)}요일이 가장 붐벼요</span>
              </div>

              <div style={{ borderTop: '1.5px dashed #E3D9C6', paddingTop: 7, fontSize: 11, color: '#A08872', lineHeight: 1.5 }}>
                이동통신 데이터로 추정한 예측값이에요. 이 장소가 가장 붐빌 때를 100으로 본
                상대적인 정도라, 다른 장소와 비교하는 숫자는 아니에요 · 데이터 출처: ⓒ한국관광공사
              </div>
            </section>
          )
        })()}

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

        {/* 사진이 더 있으면 — Type3 은 변경 금지라 자르지 않는다(contain). Type1 은 출처만 밝히면 되므로 채워 보인다 */}
        {detail && detail.images.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {detail.images.slice(0, 6).map((im) => (
              <img key={im.url} src={im.url} alt="" loading="lazy"
                style={{ width: 84, height: 64, objectFit: im.copyright === 'Type3' ? 'contain' : 'cover', background: '#F6F1E7', borderRadius: 8, flex: 'none' }} />
            ))}
          </div>
        )}

        {/* 사용자 참여 — 관광공사 데이터가 아니라 우리 사용자가 남긴 것. 표제에 그렇게 적혀 있다 */}
        <PlaceReviews placeId={place.contentid} placeTitle={place.title} pet={pet} nickname={nickname} loggedIn={loggedIn} provider={provider} onSummary={setChecks} />
        <PlaceStories placeId={place.contentid} placeTitle={place.title} placeAddr={place.addr1} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 'auto', paddingTop: 4 }}>
          <a className="btn-primary" href={`https://map.kakao.com/link/to/${encodeURIComponent(place.title)},${place.mapy},${place.mapx}`} target="_blank" rel="noreferrer"
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
                  <span style={{ fontSize: 13, flex: 'none', color: '#A08872', display: 'flex' }}><PhoneIcon size={15} /></span>
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

    </>
  )
}

/**
 * 출발 전 체크.
 *
 * 첫 줄은 오늘 문 여는지(휴무 규칙을 읽어서), 가운데는 우리 아이 기준 판정 근거(judge 의 ✓/!),
 * 마지막은 확인 전화 — 번호와 함께 "뭘 물어봐야 하는지" 문장까지 만들어 준다.
 * 프로필이 없으면 원문 조건을 그대로 늘어놓고 등록을 권한다.
 */
function Preflight({ pet, detail, detailLoading, rules, j, state, checks }: {
  pet: Pet | null
  detail: Detail | null
  detailLoading: boolean
  rules: PetRules | null
  j: Judgement | null
  state: CardState | 'no'
  checks: CheckSummary | null
}) {
  // 사용자 현장 확인 — 최근 60일 안에 거부 보고가 있으면 판정 옆에 알린다. 공사 데이터와 섞지 않고 '사용자 보고'라고 말한다
  const recentDenied = (() => {
    if (!checks?.lastDenied) return null
    const age = Date.now() - Date.parse(checks.lastDenied)
    if (!Number.isFinite(age) || age > 60 * 24 * 60 * 60 * 1000) return null
    return { n: checks.deniedRecent, at: checks.lastDenied }
  })()
  const b = BADGE[state === 'no' ? 'cond' : state]
  const [askOpen, setAskOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // 오늘 문 여는지 — 확실할 때만 단정한다. 규칙을 못 읽으면 영업시간만 보여준다
  const today = (() => {
    if (!detail) return detailLoading ? { icon: '…', color: '#B3A78F', text: '영업시간 확인 중' } : null
    const st = restStatus(detail.restdate)
    // 원문 첫 줄만, 글머리표('- ')는 떼고. 전체는 아래 영업시간 블록에 그대로 있다
    const hours = (detail.usetime ?? '').split('\n').map((l) => l.replace(/^[-*·•]\s*/, '').trim()).filter(Boolean)[0] ?? ''
    const short = (v: string) => (v.length > 34 ? v.slice(0, 33) + '…' : v)
    if (st.kind === 'closed') return { icon: '✕', color: '#C0392B', text: `오늘(${todayLabel()}) 휴무 — ${st.label}` }
    if (st.kind === 'maybe') return { icon: '!', color: '#D4A000', text: `오늘(${todayLabel()}) 휴무일 수 있어요 — ${st.label}. ${st.note}` }
    if (st.kind === 'always') return { icon: '✓', color: '#2F8F4E', text: `오늘은 문 여는 날 · 연중무휴${hours ? ` · ${short(hours)}` : ''}` }
    if (st.kind === 'open') return { icon: '✓', color: '#2F8F4E', text: `오늘은 문 여는 날${hours ? ` · ${short(hours)}` : ''}${st.label ? ` (${st.label})` : ''}` }
    if (hours) return { icon: '🕘', color: '#6E5F4D', text: `${short(hours)}${detail.restdate ? ` · 휴무 ${short(detail.restdate.split('\n')[0])}` : ''}` }
    return null
  })()

  const tel = detail?.tels[0] ? splitTel(detail.tels[0]) : null
  const script = phoneScript(pet, rules)
  const copy = async () => {
    try { await navigator.clipboard.writeText(script) } catch {
      const ta = document.createElement('textarea'); ta.value = script; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch {}
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const row = (icon: string, color: string, text: string, key: string | number, bold = false) => (
    <div key={key} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.45 }}>
      <span style={{ fontWeight: 700, color, flex: 'none', width: 14, textAlign: 'center' }}>{icon}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: bold ? color : '#2B2420', wordBreak: 'keep-all' }}>{text}</span>
    </div>
  )

  return (
    <div style={{ border: `1.5px solid ${b.border}`, background: b.checkBg, borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700 }}>
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: b.color, color: '#FFFFFF', fontSize: 11, flex: 'none' }}>✓</span>
          {pet ? `${pet.name}와 출발 전 체크 사항` : '출발 전 체크 사항'}
        </span>
        <span style={{ fontSize: 11.5, color: '#A08872', whiteSpace: 'nowrap' }}>{todayLabel()}요일 기준</span>
      </div>

      {today && row(today.icon, today.color, today.text, 'today', today.icon === '✕' || today.icon === '!')}
      {recentDenied && row('!', '#C0392B', `최근 입장 거부 보고 ${recentDenied.n}건 (${shortDate(recentDenied.at)}, 멍냥맵 사용자) — 아래 현장 확인을 보세요`, 'denied', true)}

      {j ? (
        j.checks.map((ck, i) => row(ck.icon, ck.color, ck.text, i))
      ) : state === 'info' ? (
        // 등록 전 — 판정 없이 원문 조건을 그대로 늘어놓는다. ✓/! 를 찍지 않는다
        <>
          {ruleLines(rules).map((line, i) => row('•', '#B3A78F', line, i))}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: '#E85D3D', fontWeight: 700, marginTop: 2, lineHeight: 1.45 }}>
            <span style={{ flex: 'none', marginTop: 1 }}><PetFace emoji="🐶" size={17} /></span>
            <span>프로필 등록시,<br />반려동물 기준으로 체크 항목을 정리해줘요</span>
          </div>
        </>
      ) : (
        row('!', '#A08872', b.text, 'state')
      )}

      {/* 확인 전화 — 조건이 모호할수록 마지막 관문은 전화다. 물어볼 말까지 만들어 둔다 */}
      {tel && (
        <div style={{ borderTop: '1.5px dashed #E3D9C6', paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <a href={`tel:${tel.num.replace(/[^0-9+]/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: '#2B2420', textDecoration: 'none' }}>
              <span style={{ color: '#A08872', display: 'flex' }}><PhoneIcon size={14} /></span>
              <span>{tel.num}</span>
            </a>
            <button onClick={() => setAskOpen((v) => !v)} aria-expanded={askOpen}
              style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#E85D3D', background: 'none', border: 'none', padding: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              전화로 여쭤볼 말 정리 {askOpen ? '▴' : '▾'}
            </button>
          </div>
          {askOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, lineHeight: 1.65, background: '#FFFFFF', border: '1px dashed #E3DCCE', borderRadius: 10, padding: '9px 12px', color: '#2B2420', wordBreak: 'keep-all' }}>
                “{script}”
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a className="btn-primary" href={`tel:${tel.num.replace(/[^0-9+]/g, '')}`}
                  style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, padding: '9px 0', borderRadius: 10, background: '#E85D3D', color: '#FFFFFF', textDecoration: 'none' }}>
                  <PhoneIcon size={14} style={{ marginRight: 5 }} />전화 걸기
                </a>
                <button onClick={copy}
                  style={{ flex: 1, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '9px 0', borderRadius: 10, border: '1.5px solid #E3DCCE', background: '#FFFFFF', color: '#2B2420', cursor: 'pointer' }}>
                  {copied ? '복사됐어요 ✓' : '문장 복사'}
                </button>
              </div>
              {tel.label && <span style={{ fontSize: 11.5, color: '#A08872' }}>{tel.label}</span>}
            </div>
          )}
        </div>
      )}

      <div style={{ borderTop: '1.5px dashed #E3D9C6', paddingTop: 7, fontSize: 11.5, color: '#A08872' }}>
        조건 정보 충실도 {rules?.completeness ?? '—'}등급 · 데이터 출처: ⓒ한국관광공사
      </div>
    </div>
  )
}
