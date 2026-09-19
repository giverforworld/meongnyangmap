/**
 * 휴무일·영업시간 문장 해석.
 *
 * 실측(42종) 기준 restdate 는 "연중무휴"가 절반이고, "매주 월요일" 같은 요일 표현이
 * 그 다음이며, 나머지는 "매월 첫째 수요일", "체험 일정에 따라 상이" 같은 자유 텍스트다.
 *
 * 확실한 것만 판정한다 — 특히 "영업 중"이라고 단정하지 않는다. 틀린 '영업 중'은
 * 이 서비스가 막으려는 헛걸음을 오히려 만들기 때문이다. 애매하면 원문을 그대로 보여준다.
 */

const DAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 원문에 <br> 태그와 줄바꿈이 섞여 온다 */
export function clean(s?: string) {
  return (s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

/**
 * 영업시간·휴무 원문을 줄로 나눈다. 개행 없이 "[하절기]- 화~금 10:00~21:00- 주말 10:00~22:00※ 시설별 상이"
 * 처럼 글머리표·[머리]·※ 만으로 이어 붙인 원문(실측 9,376건 중 94건)도 그 자리에서 끊는다.
 * 시간 범위의 '-'("10:00-18:00")와 요일 범위("월-금")는 끊지 않는다 — 숫자·괄호 뒤에 오고 숫자가 따라오지 않는 '-'만 글머리표로 본다
 */
export function hourLines(text?: string): string[] {
  return clean(text)
    .replace(/\s*(?=\[[^\]\n]{1,20}\])/g, '\n')
    .replace(/\]\s*-\s+/g, '] ')
    .replace(/\](?=[^\s\]])/g, '] ')
    .replace(/(?<=[\d)\]])\s*-\s*(?=[^\d\s\-~])/g, '\n')
    .replace(/(?<=\d{2}:\d{2}\)?)-\s+(?=\d)/g, '\n')
    .replace(/\s*※\s*/g, '\n※ ')
    .split('\n')
    .map((l) => l.replace(/^[-*·•※]\s*/, '').trim())
    .filter(Boolean)
}

const TIMEISH = /\d{1,2}\s*:\s*\d{2}|\d{1,2}\s*시|상시\s*개방|24\s*시간|일몰|일출/

/**
 * 체크 첫 줄에 놓는 영업시간 한 줄 — 시간이 적힌 첫 줄을 고르고, 바로 앞 줄이 "[하절기(3월~10월)]" 같은 머리면 붙인다.
 * 시간이 어디에도 없으면 첫 줄.
 */
export function hoursSummary(usetime?: string): string {
  const ls = hourLines(usetime)
  const i = ls.findIndex((l) => TIMEISH.test(l))
  if (i < 0) return ls[0] ?? ''
  const head = i > 0 && /^\[[^\]]+\]$/.test(ls[i - 1]) ? ls[i - 1].slice(1, -1) + ' ' : ''
  return head + ls[i].replace(/^\[([^\]]+)\]\s*/, '$1 ')
}

/**
 * 글자 수로 자르되 낱말 중간("21:0…")에서는 자르지 않는다 — 공백·쉼표·빗금·괄호 뒤에서만.
 * 절반 안에 그런 자리가 없으면 자르지 않고 그대로 둔다(화면에서 줄바꿈된다)
 */
export function cutAtWord(v: string, max: number): string {
  if (v.length <= max) return v
  const head = v.slice(0, max)
  const at = Math.max(head.lastIndexOf(' '), head.lastIndexOf(','), head.lastIndexOf('/'), head.lastIndexOf('·'), head.lastIndexOf(')') + 1 || -1)
  if (at < max / 2) return v
  let out = head.slice(0, at)
  // 닫히지 않은 괄호 앞에서 끊는다 — "(점심…" 은 정보가 아니다
  const paren = out.lastIndexOf('(')
  if (paren >= 0 && out.indexOf(')', paren) < 0) {
    if (paren < 8) return v
    out = out.slice(0, paren)
  }
  return out.replace(/[\s,·/]+$/, '') + '…'
}

export type RestStatus =
  /** 오늘 확실히 쉰다 */
  | { kind: 'closed'; label: string }
  /**
   * 요일은 맞지만 원문에 예외 규정이 붙어 있다 — "단, 공휴일이면 개관" 같은 것.
   * 공휴일인지 우리는 알 수 없으므로 단정하지 않는다. 그렇다고 침묵하면
   * 평범한 월요일에 닫힌 곳을 모른 채 출발하게 되므로, 조건을 붙여 알린다.
   */
  | { kind: 'maybe'; label: string; note: string }
  /** 쉬는 날이 없다고 명시돼 있다 */
  | { kind: 'always'; label: string }
  /** 매주 쉬는 요일을 읽었고 오늘은 그 요일이 아니다 — '오늘 문 여는 날'이라고 말해도 된다 */
  | { kind: 'open'; label: string }
  /** 규칙을 읽어내지 못했다 — 원문을 보여주고 판단은 사용자에게 맡긴다 */
  | { kind: 'unknown' }

/**
 * 대한민국 공휴일 (대체공휴일 반영).
 *
 * "단, 월요일이 공휴일이면 개관" 같은 예외 규정을 읽으려면 그날이 공휴일인지 알아야 한다.
 * 설날·추석·부처님오신날은 음력이라 계산으로 얻을 수 없어 해마다 표를 갱신해야 한다.
 * 정확한 출처는 공공데이터포털의 '한국천문연구원 특일 정보' API 다 — 연도가 늘어나면
 * 그걸 붙이는 게 맞고, 지금은 심사 기간을 덮는 표로 둔다.
 *
 * 표가 없는 연도는 공휴일 여부를 모르는 것이므로 '휴무'로 단정하지 않는다(아래 참고).
 */
const HOLIDAYS: Record<number, string[]> = {
  2026: [
    '01-01',                          // 신정
    '02-16', '02-17', '02-18',        // 설날 연휴
    '03-01', '03-02',                 // 삼일절(일) + 대체
    '05-05',                          // 어린이날
    '05-24', '05-25',                 // 부처님오신날(일) + 대체
    '06-06',                          // 현충일
    '08-15', '08-17',                 // 광복절(토) + 대체
    '09-24', '09-25', '09-26',        // 추석 연휴
    '10-03', '10-05',                 // 개천절(토) + 대체
    '10-09',                          // 한글날
    '12-25',                          // 성탄절
  ],
}

/** null = 그 연도 표가 없어 판단 불가 */
function isHoliday(d: Date): boolean | null {
  const days = HOLIDAYS[d.getFullYear()]
  if (!days) return null
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return days.includes(md)
}

/** "매월 첫째 월요일", "매주 2번째 수요일" 처럼 몇째 주인지 붙은 것은 매주가 아니다 */
const NTH = /첫째|둘째|셋째|넷째|다섯째|마지막|\d+\s*번째|\d+\s*주차/

/**
 * "(단, 월요일이 공휴일인 경우 그 다음날)" 처럼 휴무 규칙을 뒤집는 단서.
 * "매주 월요일 / 공휴일" 은 휴무가 늘어나는 것이지 예외가 아니므로 걸리면 안 된다.
 */
const EXCEPTION = /단\s*[,、]|단서|다만/
/** "그 다음날 휴관", "익일 휴관", "다음 평일에 휴관", "공휴일 다음날" — 휴무일이 하루 밀리는 문구 */
const SHIFTED = /다음\s*날|익일|다음\s*(?:첫\s*(?:번째\s*)?)?(?:비공휴일|평일)|공휴일\s*다음/

/** "매주 월요일~금요일" 같은 요일 범위 */
const RANGE = /([월화수목금토일])요일?\s*[~\-–〜]\s*([월화수목금토일])요일?/g

/** 한 줄에서 휴무 요일 번호를 뽑는다. 범위는 펼치고, 주말은 토·일로 본다 */
function restDays(line: string): number[] {
  const out = new Set<number>()

  if (/주말/.test(line)) {
    out.add(0)
    out.add(6)
  }

  for (const m of line.matchAll(RANGE)) {
    const a = DAYS.indexOf(m[1] as (typeof DAYS)[number])
    const b = DAYS.indexOf(m[2] as (typeof DAYS)[number])
    // 토~월 처럼 주를 넘어가는 범위도 있으므로 순환으로 센다
    for (let i = a; ; i = (i + 1) % 7) {
      out.add(i)
      if (i === b) break
    }
  }

  for (const m of line.matchAll(/([월화수목금토일])요일/g)) {
    out.add(DAYS.indexOf(m[1] as (typeof DAYS)[number]))
  }

  return [...out]
}

export function restStatus(restdate?: string, now = new Date()): RestStatus {
  const t = clean(restdate)
  if (!t) return { kind: 'unknown' }

  // 연중무휴라도 "(명절 당일 휴무)" 처럼 쉬는 날이 함께 적혀 있으면 단정할 수 없다.
  // 시설별로 나뉜 문구("- 본관 연중무휴 - 박물관 매주 월요일 / 설·추석")는 '휴무' 단어 없이
  // 요일·명절만 적히기도 하므로 그 토큰들도 예외로 본다
  if (/연중\s*무휴|휴무일?\s*없음|연중\s*개방|상시\s*개방/.test(t)) {
    const rest = t.replace(/연중\s*무휴|휴무일?\s*없음|연중\s*개방|상시\s*개방/g, '')
    const hasExceptionDay = /휴무|휴관|휴점|휴원|쉼|정기\s*휴|매주|매월|요일|공휴일|명절|설\s*[·,/]|추석|\d+\s*월\s*\d+\s*일/.test(rest)
    return hasExceptionDay ? { kind: 'unknown' } : { kind: 'always', label: '연중무휴' }
  }

  const weekly = (t.match(/매주[^\n]*/g) ?? []).filter((line) => !NTH.test(line))
  const today = now.getDay()

  for (const line of weekly) {
    if (!restDays(line).includes(today)) continue

    const label = /주말/.test(line) && (today === 0 || today === 6)
      ? '매주 주말 휴무'
      : `매주 ${DAYS[today]}요일 휴무`

    // 예외 규정("단, 공휴일이면 개관")이 붙어 있으면 오늘이 그 예외에 걸리는지 따진다.
    // 공휴일에 여는 곳을 '오늘 휴무'로 막으면 열린 장소를 놓치게 되고,
    // 평범한 평일까지 얼버무리면 닫힌 곳을 모른 채 출발하게 된다 — 둘 다 헛걸음이다
    if (EXCEPTION.test(line)) {
      const holiday = isHoliday(now)
      // 공휴일이거나, 표가 없어 알 수 없으면 단정하지 않는다
      if (holiday !== false) return { kind: 'maybe', label, note: line }
    }
    return { kind: 'closed', label }
  }

  // 매주 규칙이 있고 오늘이 거기 없다 — 격주·n째주 규칙(NTH)은 걸러냈으므로 단정해도 된다.
  // 단정하지 않는 경우 셋: ① 매주 줄 자체에 요일 말고 다른 휴무일이 덧붙어 있다("매주 월요일 / 1월 1일 / 설·추석")
  // ② 휴무일이 하루 밀리는 문구("공휴일이면 그 다음날 휴관")가 있고 어제가 공휴일이다 ③ 매주 줄 밖에 다른 휴무 문구가 있다.
  // 그리고 요일을 하나도 못 읽은 매주 줄("매주 월,화 미운영")은 읽은 게 아니다 — unknown 으로 둔다
  if (weekly.length > 0) {
    // 예외 절("(단, 월요일이 공휴일이면 익일 휴관)")은 SHIFTED 가 따로 보므로 여기선 걷어낸 뒤 남는 것을 본다
    const tail = weekly.join('\n').replace(/\(?\s*(?:단\s*[,、]?|단서|다만)[^)\n]*\)?/g, '').replace(/매주|주말|[월화수목금토일]요일?/g, '')
    const extraDay = /공휴일|휴일|명절|설|추석|\d+\s*월\s*\d+\s*일|다음\s*날|익일|전날|당일|연휴|우천|임시|촬영|휴무|휴관|휴점|휴원|쉼|미운영/.test(tail)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const shifted = SHIFTED.test(t) && isHoliday(yesterday) !== false
    const rest = t.replace(/매주[^\n]*/g, '')
    if (!extraDay && !shifted && !/휴무|휴관|휴점|휴원|쉼/.test(rest)) {
      const set = new Set(weekly.flatMap(restDays))
      const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => set.has(d))
      const weekend = ordered.length === 2 && set.has(6) && set.has(0)
      if (ordered.length > 0) {
        return { kind: 'open', label: weekend ? '매주 주말 휴무' : `매주 ${ordered.map((d) => DAYS[d]).join('·')}요일 휴무` }
      }
    }
  }

  return { kind: 'unknown' }
}

/** 오늘 요일 — "오늘(수) 휴무" 처럼 쓴다 */
export function todayLabel(now = new Date()) {
  return DAYS[now.getDay()]
}
