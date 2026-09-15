import type { Check, Judgement, Pet, PetRules, PetSize, PetTourRaw } from './types'
import { lookupCpam } from './cpamMap'

const OK = '#2F8F4E'
const WARN = '#C98A12'
const NO = '#C0392B'

const has = (s?: string) => !!s && s.trim().length > 0

/** 준비물이 아닌 값 — '기타'는 버킷 라벨, '자유이용'은 '제약 없음'이라는 정책값이다 */
const NOT_A_NEED = /^(?:기타|자유\s*이용)$/

/** '전화문의'처럼 값 대신 '물어보라'만 적힌 필드 — 등록된 정보가 없는 것과 같다 */
const INQUIRY_ONLY = /^[\s\-·]*(?:전화|방문|사전|개별|현장)?\s*(?:문의|확인)\s*(?:요망|필요|바람|필수|주세요)?[\s.]*$/
const isInquiryOnly = (s: string) => s.length > 0 && INQUIRY_ONLY.test(s)

const BULLET = /^[-*·•※▶◆□○]/

/**
 * 기타 동반정보를 항목으로 나눈다. 항목은 "- " 로 나뉘는데 개행이 섞여 오고,
 * 글머리표 없이 개행만 된 줄은 앞 항목의 이어짐이다(경주읍성 · 선실 객실).
 * 반토막 난 문장이 그대로 구역 힌트로 화면에 뜨는 걸 막는다.
 */
function splitNotes(raw: string): string[] {
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  // 글머리표를 쓰는 원문에서만 '글머리표 없는 줄 = 이어짐'이 성립한다.
  // 글머리표가 아예 없으면 개행 자체가 구분자다 — 앞 줄이 쉼표로 끝날 때만 미완성으로 본다.
  const bulleted = lines.some((l) => l.startsWith('-'))
  const items: string[] = []
  for (const line of lines) {
    const prev = items[items.length - 1]
    const continues =
      prev !== undefined && !BULLET.test(line) && (bulleted || /[,·]$/.test(prev))
    if (continues) items[items.length - 1] = `${prev} ${line}`
    else items.push(line)
  }
  return items
    .flatMap((l) => l.split(/\s*-\s+/))
    .map((s) => s.trim().replace(/^-\s*/, ''))
    .filter((s) => s.length > 0)
}

/** 견종 조건은 구역 정보가 아니다 — excludeDangerous 가 따로 다룬다 */
const BREED_NOTE = /맹견/
/** 무엇이 막혔는지 말하는 문장. '제한 없음' 같은 부정형은 뒤집힌 뜻이라 제외한다 */
const RESTRICTION = /(?:불가|금지|제한)(?!\s*없)/
/** 드나드는 행위를 가리키는 말 — 이게 있어야 출입 규정이지, 음식물 반입 같은 딴 규정이 아니다 */
const ACCESS = /동반|입장|출입|입실|투숙|이용|이동|탑승|승선|진입|입수|보행|산책|관람/
/** 구역·시설을 지목하는 말 */
const PLACE =
  /구역|구간|시설|실내|야외|내부|테라스|객실|숙소|매장|가게|점포|건물|정원|잔디|데크|산책로|관람로|해변|해수욕장|계곡|전시관|미술관|박물관|수목원|식물원|놀이터|수영장|캠핑장|야영장|주차장|전망대|선실|카페|식당|공원|사찰|궁궐|펜션|호텔|공간|층/

/**
 * 구역 힌트는 '어디가 되고 어디가 안 되는지'를 말하는 문장만 골라야 한다.
 * 배변·목줄 안내가 '시설' 두 글자에 걸려 '일부 구역만 동반 가능' 경고를 덮어쓰던
 * 오탐(125555)을 막는다. 막힌 곳을 콕 집은 문장을 먼저 고르고,
 * 없으면 구역·시설을 지목해 되는지 여부·문의를 말한 문장을 쓴다.
 */
function pickZoneHint(notes: string[]): string | null {
  const cand = notes.filter((n) => !BREED_NOTE.test(n))
  return (
    cand.find((n) => RESTRICTION.test(n) && ACCESS.test(n)) ??
    cand.find((n) => PLACE.test(n) && (ACCESS.test(n) || /가능|허용|문의/.test(n))) ??
    null
  )
}

/**
 * 크기 배제형 표기 — "대형견 제외" · "대형견 입장 불가" 처럼 대형견을 빼는 서술만 잡는다.
 * "대형견 4~5마리까지 가능" · "17kg 이하 또는 6개월 미만 대형견 동반 가능" 은 허용 서술이라 걸리면 안 된다.
 * 괄호·개행·하이픈은 옆 항목의 '불가'를 끌어오지 않도록 경계로 쓴다.
 */
const LARGE_EXCLUDED =
  /대형견(?:(?!입마개|착용|가능)[^\n()\/-]){0,6}?\s*(?:제외|금지|(?:입장|출입|동반)?\s*(?:불가|제한(?!\s*없)))/

/**
 * 맹견 배제형 표기 — "맹견 및 대형견 입장 불가", "(단, 맹견은 입장제한)", "맹견 X" 처럼
 * 사이에 다른 목적어·조사가 끼어도 잡는다.
 * 단 사이에 '입마개/착용/가능' 이 들어가면 조건부 허용이지 배제가 아니다
 * — "전 견종 출입 가능(맹견의 경우, 입마개 착용 필수)"(빈도 6)를 🔴 로 막으면 안 된다.
 */
const DANGEROUS_EXCLUDED =
  /맹견(?:(?!입마개|착용|가능)[^\n()\/-]){0,20}?\s*(?:제외|금지|(?:입장|출입|동반|탑승|승선)?\s*(?:불가|제한(?!\s*없)))|맹견\s*[Xx](?![A-Za-z가-힣])/

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
  // 전면 금지는 주어가 반려동물 전체일 때만이다. '맹견 동반 불가'·'대형견 불가'처럼
  // 특정 견종만 빼는 문장을 전면 금지로 읽으면 실제로는 갈 수 있는 장소가 통째로 닫힌다
  // (맹견 배제는 아래 excludeDangerous 가 따로 맡는다)
  const noPets =
    // 주어 없이 첫머리에서 못 박은 경우 — '불가', '불가(보조견만 가능)', '동반 불가'
    /^\s*[-·*]?\s*(?:동반|출입|입장)?\s*(?:불가|금지)/.test(cpam) ||
    // 주어가 반려동물 전체인 경우 — '반려동물 동반 불가', '전 견종 출입 금지'
    /(?:반려\s*동물|반려\s*견|애완\s*동물|애완\s*견|애견|모든\s*동물|전\s*견종|모든\s*견종)\s*(?:은|는|이|가)?\s*(?:동반|출입|입장)\s*(?:은|는|이|가)?\s*(?:불가|금지)/.test(
      cpam
    )

  // 안내견·보조견·도우미견은 한 부류로 다룬다. 다만 '안내견도 가능'을 '안내견만 가능'으로
  // 읽으면 들어갈 수 있는 곳이 빨간불이 되므로, 다른 개를 받는다는 표현이
  // 하나라도 있으면 전용으로 보지 않는다
  const serviceDogOnly =
    /안내견|보조견|도우미견/.test(cpam) &&
    !/전\s*견종|모든\s*견종|전\s*견동|소형견|중형견|대형견|반려\s*견|반려\s*동물|애견|강아지|\d+\s*(?:kg|㎏)/i.test(
      cpam
    )

  // ── 무게 상한. 실데이터에 대문자 'KG'/'Kg', 합자 문자 '㎏'(U+338F), 공백이 아예 없는
  //    '제외15Kg이하' 표기가 모두 섞여 온다. '이상'은 하한이라 절대 잡으면 안 된다.
  //    cpam 에 없으면 etcAcmpyInfo 로 넘어간다 — excludeDangerous 와 스캔 범위를 맞춘다.
  const KG_LIMIT = /(\d+(?:\.\d+)?)\s*(?:kg|㎏)\s*(이하|미만|이내)/i
  const kgMatch = cpam.match(KG_LIMIT) ?? (raw.etcAcmpyInfo ?? '').match(KG_LIMIT)
  const maxKg = kgMatch ? parseFloat(kgMatch[1]) : null
  /** '미만'은 경계 배타 — 정확히 그 무게인 아이는 불가다. '이하'·'이내'는 경계 포함 */
  const maxKgInclusive = kgMatch ? kgMatch[2] !== '미만' : null

  // ── 견종 크기. 허용형("중·소형견만")과 배제형("대형견 제외") 둘 다 읽는다.
  //    구분자는 실데이터에 '중소형견'·'중, 소형견'·'중·소형견'·'중/소형견' 이 섞여 오고,
  //    '소형견~중형견' 범위 표기는 '중형견' 분기가 받는다.
  let allowedSizes: PetSize[] | null = null
  if (/중\s*[,、·ㆍ\/]?\s*소형견|중형견/.test(cpam)) allowedSizes = ['small', 'medium']
  else if (/소형견/.test(cpam)) allowedSizes = ['small']
  // 허용형이 하나도 없을 때만 배제형을 본다 — '소형견 전용 … 대형견 불가'를 ['small'] 로 유지
  else if (LARGE_EXCLUDED.test(cpam)) allowedSizes = ['small', 'medium']

  // "맹견의 경우 입마개 착용 필수" 는 배제가 아니다. 제외/불가/제한/금지 표현만 잡는다.
  // 두 필드는 개행으로 잇는다 — 앞 필드의 '맹견'이 뒤 필드의 '불가'와 붙는 오탐을 막는다
  const excludeDangerous = DANGEROUS_EXCLUDED.test(cpam + '\n' + (raw.etcAcmpyInfo ?? ''))

  // ── 매핑표가 있으면 그쪽이 정확하다.
  //    148종이 실데이터 전부를 덮고, 각 항목은 사람이 원문과 대조해 옮긴 값이다.
  //    표에 없는(새로 생긴) 값만 위의 정규식 결과를 쓴다.
  const mapped = lookupCpam(cpam)

  // ── 동반시 필요사항: 이미 콤마로 구조화돼 있다. 준비물이 아닌 값은 걸러낸다
  const needs = (raw.acmpyNeedMtr ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !NOT_A_NEED.test(s))

  // ── 기타 동반정보: 개행 없이 "- " 만으로 이어지는 경우가 있다
  const notes = splitNotes(raw.etcAcmpyInfo ?? '')

  const zoneHint = pickZoneHint(notes)

  // ── 충실도: '값이 있냐'가 아니라 '실질 정보가 있냐'로 센다.
  // '기타'만 든 필요사항이나 '전화문의'뿐인 동반가능동물은 채워진 걸로 치지 않는다.
  const filled = [has(typeCd), has(cpam) && !isInquiryOnly(cpam), needs.length > 0, notes.length > 0]
    .filter(Boolean).length
  // 어떤 아이가 들어갈 수 있는지 자체를 '전화로 물어보라'고 한 곳은
  // 다른 필드가 아무리 차 있어도 단정할 근거가 없다 — 가장 낮은 등급으로 둔다.
  const completeness: PetRules['completeness'] = isInquiryOnly(cpam)
    ? 'C'
    : filled >= 4
      ? 'A'
      : filled >= 2
        ? 'B'
        : 'C'

  return {
    zone,
    // 표에 명시된 것만 덮어쓴다. 표가 생략한 필드(false 를 적지 않는다는 원칙)는
    // 정규식 결과를 그대로 둔다 — 특히 excludeDangerous 는 기타정보에도 근거가 있다
    noPets: mapped?.noPets ?? noPets,
    serviceDogOnly: mapped?.serviceDogOnly ?? serviceDogOnly,
    maxKg: mapped?.maxKg ?? maxKg,
    maxKgInclusive: mapped?.maxKg !== undefined ? (mapped.maxKgInclusive ?? true) : maxKgInclusive,
    allowedSizes: mapped?.allowedSizes ?? allowedSizes,
    excludeDangerous: mapped?.excludeDangerous || excludeDangerous,
    needs,
    notes,
    zoneHint,
    completeness: mapped?.inquiryOnly ? 'C' : completeness,
    /** 표가 구조로 옮기지 못한 조건 — 화면에서 "직접 확인"을 권한다 */
    attention: mapped?.needsAttention ? (mapped.note || '추가 조건이 있어요') : null,
    raw,
  }
}

const SIZE_LABEL: Record<PetSize, string> = {
  small: '소형견',
  medium: '중형견',
  large: '대형견',
}

/**
 * 원문이 특정 구역·시설의 출입을 막는 문장. '전구역 동반가능'을 정면으로 반박한다.
 * '동반 가능'·'주의 필요' 같은 문장을 끌어오지 않도록
 * (동반|출입|입장|입실) + (불가|제한|금지) 조합만 본다.
 */
const AREA_LIMIT = /(?:동반|출입|입장|입실)\s*(?:불가|제한|금지)/

/**
 * '맹견의 경우, 입마개 착용 필수' 처럼 대상과 준비물이 한 문장에 붙어 오는 표기.
 * 이 조건은 acmpyNeedMtr(needs)이 아니라 etcAcmpyInfo 에만 적히는 게 표준이라
 * needs 만 보면 입마개 없는 맹견이 초록불이 된다(958건 중 547건이 이 표기).
 * [^\n] 로 줄을 넘지 않게 막아 옆 항목의 '입마개'를 끌어오지 않는다.
 */
const MUZZLE_FOR_DANGEROUS = /맹견[^\n]{0,20}입마개|입마개[^\n]{0,20}맹견/
const MUZZLE_FOR_LARGE = /대형견[^\n]{0,20}입마개|입마개[^\n]{0,20}대형견/

/** 프로필로 보유를 확인할 수 있는 준비물 — 이 셋만 초록 ✓ 를 줄 자격이 있다 */
const NEED_MUZZLE = /입마개/
const NEED_CAGE = /케이지|이동장|켄넬|가방/
/** 목줄은 동물보호법상 외출 시 의무라 모든 보호자가 갖춘 것으로 본다 */
const NEED_LEASH = /목줄|리드줄|하네스/

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
  // 크기 분류를 무게 상한보다 먼저 본다. 동반가능동물(acmpyPsblCpam)이 '중소형견'처럼
  // 견종 크기를 못 박은 곳은 그게 그 장소의 대표 규정이고, 무게 숫자는 기타정보의
  // 부속 조건('5Kg이하 소형견 동반캠핑 가능')에서 딸려오는 경우가 있어 사유가 뒤바뀐다
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
  if (rules.maxKg !== null) {
    // '미만'은 경계 배타 — '8kg 미만' 장소에 정확히 8kg 인 아이는 불가다.
    // 스냅샷(data/petRules.json)처럼 maxKgInclusive 가 없는 값은 종전대로 '이하'로 읽는다
    const bound = rules.maxKgInclusive === false ? '미만' : '이하'
    const fits = rules.maxKgInclusive === false ? pet.kg < rules.maxKg : pet.kg <= rules.maxKg
    if (fits) {
      checks.push({ icon: '✓', color: OK, text: `${rules.maxKg}kg ${bound} → ${pet.kg}kg 충족` })
    } else {
      return {
        status: 'no',
        why: `${rules.maxKg}kg ${bound} 반려동물만 가능 (${pet.name} ${pet.kg}kg)`,
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
    // 동반구분이 '전구역'이어도 기타정보가 실내·특정 시설 출입을 막으면 그쪽이 실제 규정이다.
    // 원문이 스스로를 반박하는 장소를 초록불로 두면 현장에서 되돌아 나오게 된다
    const limit = rules.notes.find((n) => AREA_LIMIT.test(n))
    if (limit) {
      cond()
      checks.push({ icon: '!', color: WARN, text: limit })
    }
  }

  for (const need of rules.needs) {
    if (NEED_MUZZLE.test(need)) {
      if (pet.hasMuzzle) checks.push({ icon: '✓', color: OK, text: `${need} → 보유 중` })
      else {
        cond()
        checks.push({ icon: '!', color: WARN, text: `${need} 필요 — 미보유` })
      }
    } else if (NEED_CAGE.test(need)) {
      if (pet.hasCage) checks.push({ icon: '✓', color: OK, text: `${need} → 보유 중` })
      else {
        cond()
        checks.push({ icon: '!', color: WARN, text: `${need} 필요 — 미보유` })
      }
    } else if (NEED_LEASH.test(need)) {
      checks.push({ icon: '✓', color: OK, text: need })
    } else {
      // 매너벨트·반려동물 유모차처럼 프로필에 없는 준비물은 보유 여부를 확인할 방법이 없다.
      // 확인 못 한 것을 초록 ✓ 로 찍으면 '이미 갖췄다'로 읽혀 준비 없이 출발하게 된다
      cond()
      checks.push({ icon: '!', color: WARN, text: `${need} — 준비 확인 필요` })
    }
  }

  // ── needs 에 없고 원문에만 적힌 준비물. '맹견/대형견의 경우 입마개 필수'가 대표 사례로,
  //    우리 아이가 그 대상일 때만 적용한다(소형견에게 맹견 조항을 씌우지 않는다).
  //    맹견 조항은 놓치는 순간 입마개 없는 맹견이 초록불이 되므로 원문 전체에서 보고,
  //    대형견 조항은 항목 단위로만 본다 — '…대형견 입장 제한 - 맹견의 경우, 입마개 필수'처럼
  //    옆 항목의 입마개를 끌어오는 오탐(952건 중 2건)을 없애기 위해서다
  const cpamText = rules.raw.acmpyPsblCpam ?? ''
  const muzzleApplies =
    (pet.isDangerous &&
      MUZZLE_FOR_DANGEROUS.test(cpamText + '\n' + (rules.raw.etcAcmpyInfo ?? ''))) ||
    (pet.size === 'large' && [cpamText, ...rules.notes].some((n) => MUZZLE_FOR_LARGE.test(n)))
  if (muzzleApplies && !rules.needs.some((n) => NEED_MUZZLE.test(n))) {
    const subject = pet.isDangerous ? '맹견' : '대형견'
    if (pet.hasMuzzle) {
      checks.push({ icon: '✓', color: OK, text: `${subject}은 입마개 필수 → 보유 중` })
    } else {
      cond()
      checks.push({ icon: '!', color: WARN, text: `${subject}은 입마개 필수 — 미보유` })
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

  // 여기까지 근거가 하나도 안 쌓였다는 건 '제한이 없다'가 아니라 '아무것도 확인 못 했다'다.
  // 기존 초록 문구('별도 제한 조건이 등록돼 있지 않아요')는 실데이터 952건에서 한 번도
  // 도달하지 않는 죽은 분기였고, 도달했다면 미확인을 초록으로 찍는 오판이었다
  if (checks.length === 0) {
    cond()
    checks.push({
      icon: '!',
      color: WARN,
      text: '등록된 조건 정보가 적어요 — 방문 전 전화 확인을 권해요',
    })
  }

  return { status, checks }
}

/**
 * 동물보호법 시행규칙 [별표 2] 맹견 5종 — 도사견 · 아메리칸 핏불테리어 ·
 * 아메리칸 스태퍼드셔 테리어 · 스태퍼드셔 불테리어 · 로트와일러 (와 그 잡종의 개).
 * Pet.breed 는 사용자 자유 입력이라 한글·영문·대소문자·띄어쓰기가 제각각으로 온다.
 *
 * 'bull' 단독은 절대 넣지 않는다 — 불독(bulldog) · 불테리어(bull terrier) ·
 * 불마스티프(bullmastiff)처럼 맹견이 아닌 견종이 통째로 걸린다.
 * 'pit bull' · 'american bully' 같은 결합형으로만 본다.
 */
const DANGEROUS: RegExp[] = [
  /도사/, // 도사견 · 재패니즈 도사
  /\btosa\b/, // Tosa · Tosa Inu · Japanese Tosa — 네 글자뿐이라 단어 경계가 필수
  /핏\s*불|피트\s*불|pit\s*bull/, // 핏불테리어 · 핏 불 테리어 · (American) Pit Bull Terrier
  /스[태탠][퍼포]드\s*셔?|stafford|\bam\s*staff\b|\bstaff(?:y|ie)\b/, // 스태퍼드셔/스태포드셔 표기 혼용 · AmStaff · Staffy
  /(?:로트|롯트)\s*[와바]일러|rott?weiler/, // 로트와일러 · 로트바일러 · Rottweiler
  /아메리칸\s*불리|american\s*bully/, // 법정 5종은 아니나 핏불 계열로 흔히 혼용돼 보수적으로 유지
]

export function isDangerousBreed(breed: string) {
  // 대소문자를 내리고 하이픈·가운뎃점 등 구분자를 공백으로 되돌린 뒤 공백 1칸으로 정규화한다.
  // 공백을 아예 지우지 않는 이유는 'Japanese Tosa' 처럼 짧은 영문 토큰에 단어 경계가 필요해서다.
  const s = breed.toLowerCase().replace(/[-_.\/·・]/g, ' ').replace(/\s+/g, ' ').trim()
  return DANGEROUS.some((re) => re.test(s))
}

export function sizeOf(kg: number): PetSize {
  if (kg < 10) return 'small'
  if (kg < 25) return 'medium'
  return 'large'
}
