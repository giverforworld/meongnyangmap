/**
 * 관광지 혼잡 예보 — 관광지 집중률(TatsCnctrRateService).
 *
 * ㈜케이티 이동통신 데이터로 향후 30일을 예측한 값이다. **방문자 수가 아니라
 * 상대값이다** — 그 관광지가 가장 붐비는 시기를 100 으로 놓고 환산한 것이라,
 * 두 장소의 숫자를 서로 비교하면 안 된다. 같은 장소의 날짜끼리만 견줄 수 있다.
 *
 * 반려동물 동반에서 이 정보가 특히 쓸모 있는 이유가 있다. 붐비는 곳은 리드줄이
 * 엉키고, 개가 스트레스를 받고, 주변 눈치를 보느라 정작 즐기지 못한다.
 * "갈 수 있나"에 더해 "언제 가면 좋나"까지 답하려고 붙였다.
 *
 * **이 파일은 data/crowd.json 을 import 하지 않는다.** 화면에서 쓰는 코드라
 * 끌어오면 378KB 가 브라우저 번들에 실린다. 파일은 app/api/detail 이 읽는다.
 */

/** 하루치 예측. ymd 는 YYYYMMDD */
export interface CrowdDay {
  ymd: string
  rate: number
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'] as const

const parse = (ymd: string) =>
  new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)))

export const dowOf = (ymd: string) => DOW[parse(ymd).getDay()]

/** 오늘 이후만, 최대 n일 */
export function upcoming(days: CrowdDay[], n = 7, now = new Date()): CrowdDay[] {
  const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`
  return days.filter((d) => d.ymd >= today).slice(0, n)
}

export interface CrowdHint {
  days: CrowdDay[]
  /** 이 구간에서 가장 한산한 날 */
  best: CrowdDay
  /** 이 구간에서 가장 붐비는 날 */
  worst: CrowdDay
  /** 막대 높이를 맞추는 기준. 구간 최댓값이 아니라 100 을 쓴다 —
   *  구간이 전부 한산할 때 그중 하나를 '붐빔'처럼 보이게 하면 안 된다 */
  scale: 100
}

export function crowdHint(days: CrowdDay[], n = 7, now = new Date()): CrowdHint | null {
  const win = upcoming(days, n, now)
  // 이틀로는 '언제 가면 좋나'를 말할 수 없다
  if (win.length < 3) return null
  let best = win[0]
  let worst = win[0]
  for (const d of win) {
    if (d.rate < best.rate) best = d
    if (d.rate > worst.rate) worst = d
  }
  // 구간 내 차이가 거의 없으면 추천할 것이 없다
  if (worst.rate - best.rate < 8) return null
  return { days: win, best, worst, scale: 100 }
}

/** 집중률 한 칸을 어떤 색으로 볼지. 화면 세 색과 같은 어휘를 쓴다 */
export function crowdLevel(rate: number): 'quiet' | 'normal' | 'busy' {
  if (rate < 40) return 'quiet'
  if (rate < 70) return 'normal'
  return 'busy'
}
