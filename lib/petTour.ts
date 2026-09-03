import type { Check, Judgement, Pet, PetRules, PetSize, PetTourRaw } from './types'

const OK = '#2F8F4E'
const WARN = '#C98A12'
const NO = '#C0392B'

const has = (s?: string) => !!s && s.trim().length > 0

/**
 * detailPetTour2 의 자연어 필드를 구조화한다.
 *
 * 실측(417건) 기준 채움률 — acmpyTypeCd 97% · acmpyPsblCpam 57%
 * · acmpyNeedMtr 52% · etcAcmpyInfo 51%. 나머지 5개 필드는 0~11%라 판정에 쓰지 않는다.
 */
export function parseRules(raw: PetTourRaw): PetRules {
  const cpam = (raw.acmpyPsblCpam ?? '').trim()
  const typeCd = (raw.acmpyTypeCd ?? '').trim()

  // ── 동반구분: 실데이터상 "전구역 동반가능" / "일부구역 동반가능" 2종뿐
  const zone: PetRules['zone'] = typeCd.includes('전구역')
    ? 'all'
    : typeCd.includes('일부구역')
      ? 'partial'
      : 'unknown'

  // ── 동반가능동물: 84종의 자유 텍스트
  const noPets = /^불가$|동반\s*불가|출입\s*불가/.test(cpam)
  const serviceDogOnly =
    /안내견/.test(cpam) && !/전\s*견종|모든\s*견종/.test(cpam)

  const kgMatch = cpam.match(/(\d+(?:\.\d+)?)\s*kg\s*(?:이하|미만)/)
  const maxKg = kgMatch ? parseFloat(kgMatch[1]) : null

  let allowedSizes: PetSize[] | null = null
  if (/중소형견|중·소형견|중,소형견/.test(cpam)) allowedSizes = ['small', 'medium']
  else if (/중형견/.test(cpam)) allowedSizes = ['small', 'medium']
  else if (/소형견/.test(cpam)) allowedSizes = ['small']

  // "맹견의 경우 입마개 착용 필수" 는 배제가 아니다. 제외/불가 표현만 잡는다
  const excludeDangerous = /맹견\s*(?:은|는)?\s*(?:제외|불가|출입\s*불가|동반\s*불가)/.test(
    cpam + ' ' + (raw.etcAcmpyInfo ?? '')
  )

  // ── 동반시 필요사항: 이미 콤마로 구조화돼 있다
  const needs = (raw.acmpyNeedMtr ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '기타')

  // ── 기타 동반정보: 개행 없이 "- " 만으로 이어지는 경우가 있다
  const notes = (raw.etcAcmpyInfo ?? '')
    .replace(/\r/g, '')
    .split(/\n|(?:\s*-\s+)/)
    .map((s) => s.trim().replace(/^-\s*/, ''))
    .filter((s) => s.length > 0)

  const zoneHint =
    notes.find((n) => /구역|시설|실내|야외|테라스|입장\s*가능|동반\s*불가/.test(n)) ?? null

  const filled = [typeCd, cpam, raw.acmpyNeedMtr, raw.etcAcmpyInfo].filter(has).length
  const completeness: PetRules['completeness'] =
    filled >= 4 ? 'A' : filled >= 2 ? 'B' : 'C'

  return {
    zone,
    noPets,
    serviceDogOnly,
    maxKg,
    allowedSizes,
    excludeDangerous,
    needs,
    notes,
    zoneHint,
    completeness,
    raw,
  }
}

const SIZE_LABEL: Record<PetSize, string> = {
  small: '소형견',
  medium: '중형견',
  large: '대형견',
}

/**
 * 프로필과 규정을 대조해 🟢 입장 가능 / 🟡 조건부 / 🔴 불가 를 판정한다.
 * 판정 근거는 반드시 원문에서 나온 것만 쓴다 — 없는 정보를 지어내지 않는다.
 */
export function judge(rules: PetRules | null, pet: Pet): Judgement {
  if (!rules) {
    return {
      status: 'cond',
      checks: [{ icon: '!', color: WARN, text: '동반 조건 정보가 등록되지 않은 장소예요' }],
    }
  }

  const checks: Check[] = []

  // ── 차단 조건
  if (rules.noPets) {
    return { status: 'no', why: '반려동물 동반 불가', checks: [] }
  }
  if (rules.serviceDogOnly) {
    return { status: 'no', why: '안내견만 동반 가능', checks: [] }
  }
  if (rules.maxKg !== null) {
    if (pet.kg <= rules.maxKg) {
      checks.push({ icon: '✓', color: OK, text: `${rules.maxKg}kg 이하 → ${pet.kg}kg 충족` })
    } else {
      return { status: 'no', why: `${rules.maxKg}kg 이하만 가능 (${pet.name} ${pet.kg}kg)`, checks: [] }
    }
  }
  if (rules.allowedSizes) {
    if (rules.allowedSizes.includes(pet.size)) {
      checks.push({
        icon: '✓',
        color: OK,
        text: `${rules.allowedSizes.map((s) => SIZE_LABEL[s]).join('·')} 가능 → ${pet.sizeLabel} 충족`,
      })
    } else {
      return {
        status: 'no',
        why: `${rules.allowedSizes.map((s) => SIZE_LABEL[s]).join('·')}만 가능 (${pet.sizeLabel})`,
        checks: [],
      }
    }
  }
  if (rules.excludeDangerous && pet.isDangerous) {
    return { status: 'no', why: '맹견 동반 불가', checks: [] }
  }

  // ── 조건부 요인
  let status: 'ok' | 'cond' = 'ok'
  const cond = () => {
    status = 'cond'
  }

  if (rules.zone === 'partial') {
    cond()
    checks.push({
      icon: '!',
      color: WARN,
      text: rules.zoneHint ?? '일부 구역만 동반 가능 — 공개된 구역 정보가 없어요',
    })
  } else if (rules.zone === 'all') {
    checks.push({ icon: '✓', color: OK, text: '전 구역 동반 가능' })
  }

  for (const need of rules.needs) {
    if (/입마개/.test(need)) {
      if (pet.hasMuzzle) checks.push({ icon: '✓', color: OK, text: `${need} → 보유 중` })
      else {
        cond()
        checks.push({ icon: '!', color: WARN, text: `${need} 필요 — 미보유` })
      }
    } else if (/케이지|이동장|가방/.test(need)) {
      if (pet.hasCage) checks.push({ icon: '✓', color: OK, text: `${need} → 보유 중` })
      else {
        cond()
        checks.push({ icon: '!', color: WARN, text: `${need} 필요 — 미보유` })
      }
    } else {
      checks.push({ icon: '✓', color: OK, text: need })
    }
  }

  if (rules.completeness === 'C') {
    cond()
    checks.push({
      icon: '!',
      color: WARN,
      text: '등록된 조건 정보가 적어요 — 방문 전 전화 확인을 권해요',
    })
  }

  if (checks.length === 0) {
    checks.push({ icon: '✓', color: OK, text: '별도 제한 조건이 등록돼 있지 않아요' })
  }

  return { status, checks }
}

/** 법정 맹견 5종 */
const DANGEROUS = ['도사', '핏불', '스태퍼드셔', '로트와일러', '아메리칸불리']

export function isDangerousBreed(breed: string) {
  return DANGEROUS.some((d) => breed.replace(/\s/g, '').includes(d))
}

export function sizeOf(kg: number): PetSize {
  if (kg < 10) return 'small'
  if (kg < 25) return 'medium'
  return 'large'
}
