import type { PetRules } from '@/lib/types'

/**
 * 장소 카드·상세가 같이 쓰는 표시 규칙 — 배지 색, 분류 이모지, 조건 문장.
 * 지도 화면과 상세 패널(PlaceDetail)이 같은 것을 봐야 같은 장소가 같게 보인다.
 */

export const BADGE = {
  ok: {
    text: '○ 입장 가능', border: '#2F8F4E', color: '#2F8F4E', bg: '#EAF6EA', checkBg: '#F2FAF2',
  },
  cond: {
    text: '✓ 조건부 가능', border: '#E8B400', color: '#9A7300', bg: '#FFF7D6', checkBg: '#FFFBEA',
  },
  loading: {
    text: '조건 확인 중…', border: '#E3DCCE', color: '#A08872', bg: '#F8F5EE', checkBg: '#FAF8F3',
  },
  failed: {
    text: '! 조건 확인 실패', border: '#E0A9A0', color: '#C0392B', bg: '#FBEDEA', checkBg: '#FDF5F3',
  },
  /** 프로필 등록 전 — 조건은 있지만 누구 기준으로도 재지 않았다. 핀과 같은 초록 */
  info: {
    text: '✓ 동반 조건 있음', border: '#2F8F4E', color: '#2F8F4E', bg: '#EAF6EA', checkBg: '#F2FAF2',
  },
  /** 이 아이는 못 들어가는 곳 — 지도 목록에선 숨기지만 핫플레이스에서 열면 그대로 말한다 */
  no: {
    text: '✕ 입장 불가', border: '#E0A9A0', color: '#C0392B', bg: '#FBEDEA', checkBg: '#FDF5F3',
  },
} as const

export const CAT_EMOJI: Record<string, string> = {
  관광지: '🏞', 문화시설: '🎨', 행사: '🎪', 레포츠: '⛰', 숙박: '🏡', 쇼핑: '🛍', 음식점: '🍽',
}

/** 버튼 순서. 목록에 실제로 있는 것만 그린다 — 행사는 현재 전 지역 0건이다 */

/**
 * 전화 필드는 "전통가옥 운영사무실 02-6358-5533" 처럼 이름과 번호가 한 덩어리로 온다.
 * 그대로 버튼에 넣으면 번호 중간에서 줄이 바뀌어 읽기 어렵다 — 갈라서 번호는 붙여 둔다.
 */
export function splitTel(raw: string) {
  const m = raw.match(/(0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}|1[35]\d{2}[-\s.]?\d{4})/)
  if (!m) return { label: '', num: raw.trim() }
  return {
    label: raw.slice(0, m.index).trim().replace(/[(,\/·]+$/, '').trim(),
    num: m[0],
  }
}


/**
 * 등록 전 카드 한 줄 — 판정 대신 동반구분만. 누구 기준으로도 재지 않은 상태라
 * "가능"이나 "불가" 같은 결론을 내지 않는다.
 */
export function describeRules(r: PetRules | null): string {
  if (!r) return '동반 조건 정보가 등록되지 않은 장소예요'
  if (r.noPets) return '반려동물 동반 불가로 등록돼 있어요'
  if (r.zone === 'all') return '전 구역 동반 가능'
  if (r.zone === 'partial') return r.zoneHint ?? '일부 구역만 동반 가능'
  return '동반 조건이 등록돼 있어요'
}

/** 등록 전 상세 패널 — 원문 조건을 줄로 늘어놓는다 */
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

