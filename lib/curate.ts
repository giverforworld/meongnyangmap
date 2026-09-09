import placesFile from '../data/places.json'
import rulesFile from '../data/petRules.json'
import detailsFile from '../data/details.json'
import visitorsFile from '../data/visitors.json'
import { CONTENT_TYPES, type ContentTypeId } from './kto'

/**
 * 배치가 받아둔 세 파일을 엮어 화면용 목록을 만든다.
 *
 * 멍냥맵(지도)은 "이 장소, 갈 수 있나?"에 답한다. 여기서 만드는 목록은 반대 방향이다 —
 * "뭐 하고 놀지?"에 답하려면 우리가 먼저 골라 줘야 한다. 그 기준을 데이터로 세운다.
 */

const PLACES = (placesFile as { places?: any[] }).places ?? []
const RULES = (rulesFile as { rules?: Record<string, any> }).rules ?? {}
const DETAILS = (detailsFile as { details?: Record<string, any> }).details ?? {}

const BY_ID = new Map(PLACES.map((p) => [String(p.contentid), p]))

/**
 * 시군구별 외지인 방문자 수 순위 — 관광 빅데이터(DataLabService).
 *
 * **지역 순위지 장소 순위가 아니다.** "강남구에 사람이 많이 온다"는 알 수 있어도
 * "이 카페에 사람이 많이 온다"는 이 데이터로 말할 수 없다. 화면 문구가 그 선을 지켜야 한다.
 * 반려동물 동반 여부도 구분돼 있지 않다 — 전체 방문자다.
 */
const VIS = visitorsFile as {
  from?: string
  to?: string
  regions?: { code: string; name: string; visitors: number; rank: number }[]
}
const VISIT_BY_CODE = new Map((VIS.regions ?? []).map((r) => [r.code, r]))

/** 집계 기간 — 화면에 "언제 기준인지"를 밝히는 데 쓴다 */
export const VISIT_PERIOD = { from: VIS.from ?? '', to: VIS.to ?? '' }

/** 방문자 데이터는 시도+시군구를 붙인 5자리를 쓴다. 우리 목록은 둘로 쪼개져 있다 */
const visitOf = (p: any) =>
  VISIT_BY_CODE.get(`${String(p.regnCd ?? '')}${String(p.signguCd ?? '')}`) ?? null

export interface Curated {
  contentid: string
  title: string
  addr1: string
  cat: string
  firstimage: string
  mapx: number
  mapy: number
  regnCd: string
  /** 왜 이 목록에 올랐는지 — 근거 없이 추천하지 않는다 */
  reasons: string[]
  summary: string
  needs: string[]
  usetime: string
  restdate: string
  /** 이 장소가 속한 시군구 이름. 방문자 순위를 말할 때 주어가 된다 */
  regionName: string
  /** 그 시군구의 외지인 방문 순위(전국). 집계에 없으면 null */
  regionRank: number | null
}

function toCurated(id: string, reasons: string[]): Curated {
  const p = BY_ID.get(id)!
  const r = RULES[id] ?? {}
  const d = DETAILS[id] ?? {}
  const v = visitOf(p)
  return {
    regionName: v?.name ?? '',
    regionRank: v?.rank ?? null,
    contentid: id,
    title: p.title ?? '',
    addr1: p.addr1 ?? '',
    cat: CONTENT_TYPES[Number(p.contenttypeid) as ContentTypeId] ?? '기타',
    firstimage: p.firstimage ?? '',
    mapx: Number(p.mapx) || 0,
    mapy: Number(p.mapy) || 0,
    regnCd: String(p.lDongRegnCd ?? p.regnCd ?? ''),
    reasons,
    summary: (d.overview ?? '').slice(0, 110),
    needs: r.needs ?? [],
    usetime: d.usetime ?? '',
    restdate: d.restdate ?? '',
  }
}

/**
 * 핫플레이스 — "확실히 갈 수 있고, 가 볼 만한 곳".
 *
 * 방문수 데이터가 없으니 인기순은 만들 수 없다. 대신 우리가 아는 것으로 고른다:
 * 조건이 빠짐없이 등록됐고(A등급), 구역 제한이 없고(전 구역 동반가능),
 * 보여줄 사진과 소개글이 있는 곳. 셋을 다 갖춘 곳은 338곳이다.
 */
export function hotplaces(regnCd?: string, sort: 'default' | 'visitors' = 'default'): Curated[] {
  const out: Curated[] = []
  for (const [id, r] of Object.entries(RULES)) {
    if (!r || !BY_ID.has(id)) continue
    if (r.completeness !== 'A' || r.zone !== 'all' || r.noPets) continue
    const p = BY_ID.get(id)!
    if (!p.firstimage) continue
    const d = DETAILS[id]
    if (!d?.overview) continue
    // 배치가 저장한 파일은 lDongRegnCd 를 regnCd 로 바꿔 담는다.
    // API 원본 키만 보면 지역 필터가 전부 0건이 된다
    if (regnCd && String(p.regnCd ?? p.lDongRegnCd ?? '') !== regnCd) continue

    const reasons = ['전 구역 동반 가능', '조건 정보 완전']
    if (d.restdate && /연중\s*무휴/.test(d.restdate)) reasons.push('연중무휴')
    if (r.needs?.length === 1 && /목줄/.test(r.needs[0])) reasons.push('목줄만 있으면 됨')
    out.push(toCurated(id, reasons))
  }

  // 방문자 순: 요즘 사람이 몰리는 지역의 장소를 앞으로. 집계에 없는 곳은 뒤로 보낸다 —
  // 순위가 없다고 인기가 없는 게 아니라 우리가 모르는 것이므로 0위로 취급하지 않는다
  if (sort === 'visitors') {
    return out.sort(
      (a, b) =>
        (a.regionRank ?? Infinity) - (b.regionRank ?? Infinity) ||
        b.reasons.length - a.reasons.length ||
        a.title.localeCompare(b.title, 'ko')
    )
  }

  return out.sort((a, b) => b.reasons.length - a.reasons.length || a.title.localeCompare(b.title, 'ko'))
}

/**
 * 제보가 필요한 곳 — 조건 정보가 부족해 판정을 못 해주는 장소.
 *
 * 공공데이터의 빈틈을 그대로 두는 대신 목록으로 드러낸다. 다녀온 사람이 한 줄만
 * 남겨도 다음 사람이 헛걸음을 피한다.
 */
export function needsReport(): (Curated & { missing: string[] })[] {
  const out: (Curated & { missing: string[] })[] = []
  for (const [id, r] of Object.entries(RULES)) {
    if (!BY_ID.has(id)) continue
    const missing: string[] = []
    if (!r) missing.push('동반 조건 자체가 등록되지 않음')
    else {
      if (r.completeness !== 'C') continue
      if (!r.raw?.acmpyPsblCpam?.trim()) missing.push('어떤 아이가 가능한지')
      if (!r.raw?.acmpyNeedMtr?.trim()) missing.push('무엇을 챙겨야 하는지')
      if (!r.raw?.etcAcmpyInfo?.trim()) missing.push('현장 규정')
      if (r.zone === 'unknown') missing.push('전 구역인지 일부인지')
    }
    out.push({ ...toCurated(id, []), missing })
  }
  return out.sort((a, b) => b.missing.length - a.missing.length || a.title.localeCompare(b.title, 'ko'))
}
