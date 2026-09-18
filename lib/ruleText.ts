import type { PetRules } from './types'

/**
 * 조건을 사람이 읽는 줄로 — 등록 전 상세 패널의 목록이자, 배치가 '무엇이 바뀌었는지'를 적을 때의 단위.
 * 화면(app/placeUi.ts)과 배치(scripts/collect.mts)가 같은 문장을 써야 변경 전후를 나란히 놓을 수 있다.
 */
export function ruleLines(r: PetRules | null): string[] {
  if (!r) return ['동반 조건 정보가 등록되지 않은 장소예요']
  const out: string[] = []
  if (r.noPets) out.push('반려동물 동반 불가')
  else if (r.serviceDogOnly) out.push('안내견만 동반 가능')
  else {
    if (r.zone === 'all') out.push('전 구역 동반 가능')
    else if (r.zone === 'partial') out.push(r.zoneHint ?? '일부 구역만 동반 가능')
    if (r.allowedSizes) out.push(`${r.allowedSizes.map((x) => ({ small: '소형견', medium: '중형견', large: '대형견' })[x]).join('·')}만 가능`)
    if (r.maxKg !== null) out.push(`${r.maxKg}kg ${r.maxKgInclusive === false ? '미만' : '이하'}`)
    if (r.excludeDangerous) out.push('맹견 동반 불가')
    if (r.needs.length) out.push(`준비물: ${r.needs.join(', ')}`)
  }
  if (out.length === 0) out.push('등록된 조건이 적어요 — 방문 전 확인을 권해요')
  return out
}



/** 화면에 보여줄 만큼 최근인 변경만 — 60일. 그 뒤로는 '바뀐 지 오래'라 표시가 오히려 헷갈린다 */
export function recentChange(r: PetRules | null, now = new Date()) {
  const c = r?.change
  if (!c) return null
  const at = Date.parse(c.at)
  if (!Number.isFinite(at) || now.getTime() - at > 60 * 24 * 60 * 60 * 1000) return null
  return c
}

/** '2026-09-15' → '9/15' */
export const shortDate = (ymd: string) => {
  const [, m, d] = ymd.split('-')
  return `${Number(m)}/${Number(d)}`
}
