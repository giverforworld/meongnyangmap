'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import type { CardState, Detail, Judgement, Place, PetRules, RulesEntry } from '@/lib/types'
import type { Pet } from '@/lib/types'
import { judge } from '@/lib/petTour'
import { crowdHint, crowdLevel, dowOf, type CrowdDay } from '@/lib/crowd'
import { restStatus, todayLabel } from '@/lib/openHours'
import { PlaceReviews, PlaceStories } from './PlaceSocial'
import { BADGE, CAT_EMOJI, ruleLines, splitTel } from './placeUi'
import { PlacePinIcon } from './icons'

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
  const scroller = useRef<HTMLDivElement>(null)

  // 상세·집중률 — 장소가 바뀌면 앞 장소 것을 남기지 않는다
  useEffect(() => {
    setDetail(null)
    setCrowd(null)
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
        // 대표 사진이 없는 곳이 많다(숙박 32%·음식점 58%만 보유). detailImage2 로 메운다
        const hero = place.firstimage || detail?.images[0]?.url || ''
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
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>
            {pet ? `입장 조건 체크리스트 — ${pet.name} 기준` : '동반 조건'}
          </span>
          {sel.j ? (
            sel.j.checks.map((ck, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                <span style={{ fontWeight: 700, color: ck.color }}>{ck.icon}</span>
                <span>{ck.text}</span>
              </div>
            ))
          ) : sel.state === 'info' ? (
            // 등록 전 — 판정 없이 원문 조건을 그대로 늘어놓는다. ✓/! 를 찍지 않는다
            <>
              {ruleLines(rules).map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                  <span style={{ color: '#B3A78F' }}>•</span>
                  <span>{line}</span>
                </div>
              ))}
              <div style={{ fontSize: 12.5, color: '#E85D3D', fontWeight: 700, marginTop: 2 }}>
                🐶 프로필을 등록하면 우리 아이가 갈 수 있는지 바로 판정해요
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
              <span style={{ fontWeight: 700, color: '#A08872' }}>!</span>
              <span>{b.text}</span>
            </div>
          )}
          <div style={{ borderTop: '1.5px dashed #E3D9C6', paddingTop: 7, fontSize: 11.5, color: '#A08872' }}>
            조건 정보 충실도 {rules?.completeness ?? '—'}등급 · 데이터/API 출처 ⓒ한국관광공사
          </div>
        </div>

        {rules && rules!.notes.length > 0 && (
          <div style={{ border: '1.5px solid #F0D9A0', background: '#FBF3DD', borderRadius: 12, padding: '10px 13px', fontSize: 12.5, color: '#8A6208', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <b>현장 규정</b>
            {rules!.notes.map((n, i) => <div key={i}>• {n}</div>)}
          </div>
        )}

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
                상대적인 정도라, 다른 장소와 비교하는 숫자는 아니에요 · 데이터/API 출처 ⓒ한국관광공사
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

        {/* 사진이 더 있으면 — Type3 은 변경 금지라 자르거나 덧씌우지 않는다 */}
        {detail && detail.images.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {detail.images.slice(0, 6).map((im) => (
              <img key={im.url} src={im.url} alt="" loading="lazy"
                style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 8, flex: 'none' }} />
            ))}
          </div>
        )}

        {/* 사용자 참여 — 관광공사 데이터가 아니라 우리 사용자가 남긴 것. 표제에 그렇게 적혀 있다 */}
        <PlaceReviews placeId={place.contentid} placeTitle={place.title} pet={pet} nickname={nickname} loggedIn={loggedIn} provider={provider} />
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

    </>
  )
}
