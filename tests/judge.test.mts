/**
 * 판정 (judge)
 *
 * 케이스는 한국관광공사 API 실측값에서 뽑았다(코퍼스 149종 / 휴무일 42종).
 * 기대값은 두 명의 검증자가 소스를 독립적으로 따라가 동의한 것만 남겼다.
 * 판정이 틀리면 현장 입장 거부(헛걸음)로 이어지므로, 여기 실패는 곧 사용자 피해다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judge, parseRules, isDangerousBreed, sizeOf } from '../lib/petTour'
import { restStatus, clean, todayLabel } from '../lib/openHours'
import type { Pet, PetRules, PetTourRaw } from '../lib/types'
import { readFileSync } from 'node:fs'

/** 실제 수집된 958곳의 원본 — 코퍼스 전체를 훑는 회귀 검사에 쓴다 */
const RULES: Record<string, { raw: PetTourRaw } | null> = JSON.parse(
  readFileSync(new URL('../data/petRules.json', import.meta.url), 'utf8')
).rules



// data/petRules.json 958건 중 6건(127713, 2605236, 2616104, 2702470, 2710820 등)이 rules:null 로 저장돼 있다. '조회했는데 미등록'을 'ok'로 흘리면 헛걸음이 되므로 cond 로 남아야 한다. 현재 코드는 통과.
test('rules 가 null 이면 조건부(미등록) 안내로 떨어진다', () => {
  assert.deepEqual(judge(null, { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }), { status: 'cond', checks: [{ icon: '!', color: '#C98A12', text: '동반 조건 정보가 등록되지 않은 장소예요' }] })
})

// contentid 3049858 실데이터. cpam='불가' 3건. noPets 차단 분기의 정상 경로 회귀 기준선. 현재 코드 통과.
test('acmpyPsblCpam 이 \'불가\' 면 무조건 불가', () => {
  assert.deepEqual(judge(parseRules({ contentid: '3049858', acmpyTypeCd: '', acmpyPsblCpam: '불가', acmpyNeedMtr: '', etcAcmpyInfo: '' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }), { status: 'no', why: '반려동물 동반 불가', checks: [] })
})

// 코드 버그 의심. contentid 130833 실데이터. noPets 정규식이 /^불가$|동반\s*불가|출입\s*불가/ 라 '불가(...)' 처럼 뒤에 괄호가 붙으면 ^불가$ 앵커에 걸리지 않는다. serviceDogOnly 도 '보조견'은 /안내견/ 에 안 잡혀 false. 현재 실제 출력은 completeness '
test('\'불가(보조견만 가능)\' 은 불가로 판정돼야 하는데 조건부로 샌다', () => {
  assert.equal(judge(parseRules({ contentid: '130833', acmpyTypeCd: '', acmpyPsblCpam: '불가(보조견만 가능)', acmpyNeedMtr: '', etcAcmpyInfo: '' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).status, 'no')
})

// contentid 1972030 실데이터. acmpyTypeCd 가 '전구역 동반가능'이라 zone 분기만 보면 초록불이 될 수 있는 함정. serviceDogOnly 차단이 zone 분기보다 먼저 와야 함을 고정한다. 현재 코드 통과.
test('\'맹인 안내견\' 은 안내견 전용이므로 불가', () => {
  assert.deepEqual(judge(parseRules({ contentid: '1972030', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '맹인 안내견', acmpyNeedMtr: '', etcAcmpyInfo: '' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }), { status: 'no', why: '안내견만 동반 가능', checks: [] })
})

// contentid 2939800 실데이터. 관광공사 원문이 '안내견만 가' 로 잘려 들어온다. completeness 'C' 로 cond 가 되기 전에 serviceDogOnly 가 먼저 차단해야 한다. 현재 코드 통과.
test('\'안내견만 가\' 처럼 잘린 원문도 안내견 전용으로 차단된다', () => {
  assert.equal(judge(parseRules({ contentid: '2939800', acmpyTypeCd: '', acmpyPsblCpam: '안내견만 가', acmpyNeedMtr: '', etcAcmpyInfo: '' }), { key: 'bori', name: '보리', breed: '골든리트리버', kg: 28, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).status, 'no')
})

// 코드 버그 의심. contentid 3446579·3450526, 그리고 3444152('보조견 동반 입장 가능. 야외 좌석과 내부 1층만 허용됨.') 실데이터. serviceDogOnly 정규식이 '안내견'만 보고 '보조견/도우미견'을 놓친다. 현재 출력은 'cond' + '일부 구역만 동반 가능'. 반려견 데리고 가면
test('\'보조견 동반 입장 가능\' 은 보조견 전용인데 조건부로 통과한다', () => {
  assert.equal(judge(parseRules({ contentid: '3446579', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '보조견 동반 입장 가능', acmpyNeedMtr: '', etcAcmpyInfo: '' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).status, 'no')
})

// 코드 버그 의심. contentid 128202 실데이터. /동반\s*불가/ 가 '맹견 동반 불가' 에도 걸려 noPets=true 가 되고, 맹견이 아닌 3.2kg 푸들까지 'no'(반려동물 동반 불가) 로 나온다. 원문은 맹견만 배제하고 나머지는 입마개·켄넬 조건부 허용. 옳은 답은 입마개 미보유 + 일부구역 → 'c
test('\'맹견 동반 불가\' 를 전면 동반불가로 오독해 일반견까지 막는다', () => {
  assert.equal(judge(parseRules({ contentid: '128202', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '맹견 동반 불가', acmpyNeedMtr: '입마개 착용,목줄 착용,이동장(켄넬)사용', etcAcmpyInfo: '- 맹견은 불가, 대형견 입마개 착용 필수\n- 관람차의 경우 이동가방(켄넬) 필수\n- 배변봉투 지참 및 배변처리 필수' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).status, 'cond')
})

// contentid 2774566 실데이터('10kg 이하 동반 가능' 4건). '이하'는 경계 포함이므로 정확히 10kg 은 통과가 옳다. 현재 pet.kg <= maxKg 로 통과. 이 경계를 < 로 바꾸면 정상 입장 가능한 곳이 빨간불이 되므로 회귀 방지용으로 고정한다.
test('maxKg \'이하\' 경계 — pet.kg 가 maxKg 와 같으면 통과한다', () => {
  assert.deepEqual(judge(parseRules({ contentid: '2774566', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '10kg 이하 동반 가능', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '카누 탑승 시 별도의 안전장치가 없으므로 보호자 주의 필요' }), { key: 'dubu', name: '두부', breed: '시바', kg: 10, emoji: '🐕', size: 'medium', sizeLabel: '중형견', hasCage: false, hasMuzzle: false, isDangerous: false }), { status: 'ok', checks: [{ icon: '✓', color: '#2F8F4E', text: '10kg 이하 → 10kg 충족' }, { icon: '✓', color: '#2F8F4E', text: '전 구역 동반 가능' }, { icon: '✓', color: '#2F8F4E', text: '목줄 착용' }] })
})

// 코드 버그 의심. contentid 2701396 실데이터. parseRules 가 '이하'와 '미만'을 같은 캡처로 뭉개 maxKg=10 만 남기고, judge 는 항상 <= 로 비교한다. 현재 출력은 'ok' + 체크 문구도 '10kg 이하 → 10kg 충족' 으로 원문('미만')을 왜곡한다. 코퍼스에 '10kg 미만
test('maxKg \'미만\' 경계 — pet.kg 가 maxKg 와 같으면 불가여야 한다', () => {
  assert.equal(judge(parseRules({ contentid: '2701396', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '10kg 미만', acmpyNeedMtr: '목줄 착용,매너벨트 착용', etcAcmpyInfo: '' }), { key: 'dubu', name: '두부', breed: '시바', kg: 10, emoji: '🐕', size: 'medium', sizeLabel: '중형견', hasCage: false, hasMuzzle: false, isDangerous: false }).status, 'no')
})

// 코드 버그 의심. contentid 2518166 실데이터. kgMatch 정규식 /(\d+(?:\.\d+)?)\s*kg\s*(?:이하|미만)/ 에 i 플래그가 없어 'Kg'/'KG' 를 놓친다. maxKg=null → 무게 분기 자체를 건너뛰고 현재 'cond' 로 나온다. 9kg 제한 장소에 28kg 대형견이 노란불(
test('대문자 \'Kg\' 무게 제한이 파싱되지 않아 28kg 이 걸러지지 않는다', () => {
  assert.equal(judge(parseRules({ contentid: '2518166', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '9Kg 이하 동반 가능', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '- 맹견의 경우, 입마개 착용 필수- 배변봉투 지참 및 배변처리 필수' }), { key: 'bori', name: '보리', breed: '골든리트리버', kg: 28, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).status, 'no')
})

// 코드 버그 의심 — 가장 위험한 오판. contentid 2626972 실데이터. 현재 출력은 status 'ok' 에 체크가 '전 구역 동반 가능', '매너벨트 착용' 뿐이라 무게 제한 존재 자체가 화면에서 사라진다. 10kg 제한 장소를 28kg 견주에게 🟢 입장 가능으로 보여준다. 같은 유형 실값: '10KG 이하 
test('대문자 \'KG\' + 전구역이면 28kg 대형견이 초록불로 나온다', () => {
  assert.equal(judge(parseRules({ contentid: '2626972', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '10KG 이하 반려견', acmpyNeedMtr: '매너벨트 착용', etcAcmpyInfo: '' }), { key: 'bori', name: '보리', breed: '골든리트리버', kg: 28, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).status, 'no')
})

// 코드 버그 의심. contentid 128019 실데이터. '㎏' 는 'kg' 두 글자가 아니라 단일 합자 문자라 정규식에 안 걸린다. maxKg=null → 현재 'cond'. 20kg 미만 장소인데 28kg 이 노란불이다.
test('유니코드 ㎏(U+338F) 무게 제한이 파싱되지 않는다', () => {
  assert.equal(judge(parseRules({ contentid: '128019', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '20㎏ 미만 동반 가능', acmpyNeedMtr: '목줄 착용,반려동물 유모차 탑승,이동장(켄넬)사용', etcAcmpyInfo: '투개더파크(반려견놀이터)는 15㎏ 미만 반려견에 한하여 입장 가능※ 무인·무료·자율 이용시설' }), { key: 'bori', name: '보리', breed: '골든리트리버', kg: 28, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).status, 'no')
})

// contentid 2569003 실데이터(cpam='소형견' 7건). 크기 차단 분기의 정상 경로 + why 문구 포맷 고정. 현재 코드 통과.
test('allowedSizes [\'small\'] 불일치 → 불가, 사유에 크기가 남는다', () => {
  assert.deepEqual(judge(parseRules({ contentid: '2569003', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '소형견', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '' }), { key: 'bori', name: '보리', breed: '골든리트리버', kg: 28, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }), { status: 'no', why: '소형견만 가능 (대형견)', checks: [] })
})

// contentid 128699 실데이터('중소형견 동반 가능' 6건). SIZE_LABEL 조인('·')과 why 포맷까지 고정. 현재 코드 통과.
test('\'중소형견 동반 가능\' 에 대형견이면 불가', () => {
  assert.deepEqual(judge(parseRules({ contentid: '128699', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '중소형견 동반 가능', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '- 5Kg이하 소형견 동반캠핑 가능\n- 수영장 등 실내시설은 동반 불가\n- 그외지역은 자유롭게 산책가능\n- 맹견의 경우, 입마개 착용 필수\n- 배변봉투 지참 및 배변처리 필수' }), { key: 'bori', name: '보리', breed: '골든리트리버', kg: 28, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }), { status: 'no', why: '소형견·중형견만 가능 (대형견)', checks: [] })
})

// 코드 버그 의심. contentid 2854437 실데이터. parseRules 의 allowedSizes 는 '소형견/중형견/중소형견' 포함 표현만 보고 '대형견 제외' 같은 배제 표현을 전혀 안 읽는다. 현재 'cond'.
test('\'대형견 제외 전 견종 동반 가능\' 에서 대형견이 걸러지지 않는다', () => {
  assert.equal(judge(parseRules({ contentid: '2854437', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '대형견 제외 전 견종 동반 가능', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '- 맹견의 경우, 입마개 착용 필수- 배변봉투 지참 및 배변처리 필수' }), { key: 'bori', name: '보리', breed: '골든리트리버', kg: 28, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).status, 'no')
})

// 코드 버그 의심 — 위험한 오판. contentid 1350823 실데이터('맹견 및 대형견 제외 동반 가능' 2건). 현재 status 'ok' 에 체크는 '전 구역 동반 가능', '목줄 착용' 뿐. 원문에 명시된 대형견 배제가 화면 어디에도 안 남는다. 참고로 이 문장은 excludeDangerous 정규식(/맹견\s
test('\'맹견 및 대형견 제외 동반 가능\' + 전구역 → 대형견이 초록불', () => {
  assert.equal(judge(parseRules({ contentid: '1350823', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '맹견 및 대형견 제외 동반 가능', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '배변봉투 지참 및 배변처리 필수' }), { key: 'bori', name: '보리', breed: '골든리트리버', kg: 28, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).status, 'no')
})

// contentid 126010 실데이터('맹견 제외 전 견종 동반 가능' 14건). isDangerous 는 isDangerousBreed('아메리칸 핏불테리어') 로 참이 되는 법정 맹견. 차단 분기 정상 경로. 현재 코드 통과.
test('excludeDangerous 이고 맹견이면 불가', () => {
  assert.deepEqual(judge(parseRules({ contentid: '126010', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '맹견 제외 전 견종 동반 가능', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '- 맹견과 대형견의 경우, 입마개 착용 필수- 배변봉투 지참 및 배변처리 필수' }), { key: 'tyson', name: '타이슨', breed: '아메리칸 핏불테리어', kg: 26, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: false, isDangerous: true }), { status: 'no', why: '맹견 동반 불가', checks: [] })
})

// 코드 버그 의심. 같은 contentid 126010. 맹견이 아니므로 excludeDangerous 차단은 안 되는 게 맞다(과차단 방지 기준선). 다만 원문 etcAcmpyInfo 가 '맹견과 대형견의 경우, 입마개 착용 필수' 인데 acmpyNeedMtr 에는 입마개가 없어, 입마개 미보유 30kg 대형견이 현재 '
test('\'맹견 제외\' 장소라도 맹견이 아니면 차단되지 않는다', () => {
  assert.equal(judge(parseRules({ contentid: '126010', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '맹견 제외 전 견종 동반 가능', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '- 맹견과 대형견의 경우, 입마개 착용 필수- 배변봉투 지참 및 배변처리 필수' }), { key: 'bangul', name: '방울', breed: '골든리트리버', kg: 30, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: false, isDangerous: false }).status, 'cond')
})

// 코드 버그 의심 — 규모가 가장 큰 위험 오판. contentid 125445 실데이터이고, etcAcmpyInfo 에 '맹견의 경우, 입마개 착용 필수' 가 있으면서 acmpyNeedMtr 에는 입마개가 없는 레코드가 958건 중 547건이다. judge 는 needs 만 보고 notes 는 안 봐서 현재 status 
test('원문이 맹견 입마개를 요구하는데 입마개 없는 맹견이 초록불로 나온다', () => {
  assert.equal(judge(parseRules({ contentid: '125445', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '전 견종 동반 가능', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '- 맹견의 경우, 입마개 착용 필수- 배변봉투 지참 및 배변처리 필수' }), { key: 'tyson', name: '타이슨', breed: '아메리칸 핏불테리어', kg: 26, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: false, isDangerous: true }).status, 'cond')
})

// contentid 125720 실데이터('입마개 착용,목줄 착용' 27건). 준비물 미보유 → cond 정상 경로와 체크 순서(zone → needs 순)를 고정. 현재 코드 통과.
test('needs 에 입마개가 있고 미보유면 조건부 + 미보유 문구', () => {
  assert.deepEqual(judge(parseRules({ contentid: '125720', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '전 견종 동반 가능', acmpyNeedMtr: '입마개 착용,목줄 착용', etcAcmpyInfo: '해수욕장 개장 외 기간에만 반려견 동반 가능\n반려견 인식표 필수\n 배변봉투 지참 및 배변처리 필수\n맹견의 경우, 입마개 착용 필수' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }), { status: 'cond', checks: [{ icon: '✓', color: '#2F8F4E', text: '전 구역 동반 가능' }, { icon: '!', color: '#C98A12', text: '입마개 착용 필요 — 미보유' }, { icon: '✓', color: '#2F8F4E', text: '목줄 착용' }] })
})

// contentid 126701 실데이터('이동장(켄넬)사용' 단독 24건). /케이지|이동장|가방/ 매칭이 실제 API 표기 '이동장(켄넬)사용' 을 잡는지 확인. 현재 코드 통과. (다만 28kg 대형견이 켄넬에 들어갈 리 없다는 원문 취지는 여전히 판정에 반영되지 않는다.)
test('needs 에 이동장(켄넬)이 있고 미보유면 조건부', () => {
  assert.ok(judge(parseRules({ contentid: '126701', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '이동장(켄넬)에 들어가는 전 견종 동반 가능', acmpyNeedMtr: '이동장(켄넬)사용', etcAcmpyInfo: '이동장(켄넬) 안에 반려동물 몸 전체가 모두 들어가야 동반 가능' }), { key: 'bori', name: '보리', breed: '골든리트리버', kg: 28, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).checks.some(c => c.icon === '!' && c.text === '이동장(켄넬)사용 필요 — 미보유'))
})

// 같은 contentid 126701, hasCage:true 인 초코. 준비물은 충족했지만 zone 'partial' 단독으로 cond 가 유지되는지(그리고 zoneHint 가 null 이면 기본 문구가 쓰이는지) 고정. 현재 코드 통과.
test('이동장 보유 시 초록 체크로 남고, 일부구역 때문만으로 조건부가 된다', () => {
  assert.deepEqual(judge(parseRules({ contentid: '126701', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '이동장(켄넬)에 들어가는 전 견종 동반 가능', acmpyNeedMtr: '이동장(켄넬)사용', etcAcmpyInfo: '이동장(켄넬) 안에 반려동물 몸 전체가 모두 들어가야 동반 가능' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }), { status: 'cond', checks: [{ icon: '!', color: '#C98A12', text: '일부 구역만 동반 가능 — 공개된 구역 정보가 없어요' }, { icon: '✓', color: '#2F8F4E', text: '이동장(켄넬)사용 → 보유 중' }] })
})

// contentid 125804 실데이터. etcAcmpyInfo 가 개행 없이 '- ' 로만 이어지는 실제 포맷이라, notes 분리와 zoneHint 선택이 함께 검증된다. 현재 코드 통과.
test('zone \'partial\' 이고 zoneHint 가 있으면 그 문장을 경고로 쓴다', () => {
  assert.deepEqual(judge(parseRules({ contentid: '125804', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '전 견종 동반 가능', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '- 실내 시설은 동반 불가- 맹견의 경우, 입마개 착용 필수- 배변봉투 지참 및 배변처리 필수' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).checks[0], { icon: '!', color: '#C98A12', text: '실내 시설은 동반 불가' })
})

// 코드 버그 의심. contentid 125555 실데이터. zoneHint 정규식이 /구역|시설|.../ 라 '쓰레기 처리 시설이 없으므로...' 문장의 '시설' 두 글자에 걸린다. 그 결과 partial 경고 자리에 배변 안내가 들어가고, '일부 구역만 동반 가능' 이라는 핵심 정보가 화면에서 통째로 사라진다(현재 결과
test('partial 인데 zoneHint 오탐으로 \'일부구역\' 경고가 배변 안내로 바뀐다', () => {
  assert.ok(judge(parseRules({ contentid: '125555', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '전 견종 출입 가능(맹견의 경우, 입마개 착용 필수)', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '별도의 쓰레기 처리 시설이 없으므로 배변봉투 지참 및 수거 필수' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).checks.some(c => /구역/.test(c.text)))
})

// contentid 1845517 실데이터. 동반구분 하나뿐이면 zone 이 'all' 이어도 초록불이 되면 안 된다(정보 부족 → 조건부). completeness 'C' 는 코퍼스 958건 중 75건. 현재 코드 통과.
test('completeness \'C\' 면 조건부 + 전화 확인 권유', () => {
  assert.deepEqual(judge(parseRules({ contentid: '1845517', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '', acmpyNeedMtr: '', etcAcmpyInfo: '' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }), { status: 'cond', checks: [{ icon: '✓', color: '#2F8F4E', text: '전 구역 동반 가능' }, { icon: '!', color: '#C98A12', text: '등록된 조건 정보가 적어요 — 방문 전 전화 확인을 권해요' }] })
})

// 코드 버그 의심. contentid 3443614 실데이터. 실제 정보는 바로 위 1845517 과 똑같이 동반구분 하나뿐인데, acmpyNeedMtr 값이 '기타' 라서 completeness 가 'C' 가 아닌 'B' 로 올라가고 C 분기를 건너뛴다. needs 는 '기타'를 걸러 빈 배열이라 체크에 아무 근거도 없이
test('내용 없는 \'기타\'가 completeness 를 부풀려 초록불이 된다', () => {
  assert.equal(judge(parseRules({ contentid: '3443614', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '', acmpyNeedMtr: '기타', etcAcmpyInfo: '' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).status, 'cond')
})

// 코드 버그 의심. contentid 2607706·2620236·2699326('전화문의' 3건), 2604533('문의요망'). 원문이 '전화로 물어보라'인데 completeness 가 'B' 라 C 분기를 안 타고 status 'ok' + 체크는 '전 구역 동반 가능' 하나뿐이다. 동반가능동물이 확정되지 않았으니 조건
test('\'전화문의\' 라고만 적힌 곳이 초록불로 나온다', () => {
  assert.equal(judge(parseRules({ contentid: '2607706', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '전화문의', acmpyNeedMtr: '', etcAcmpyInfo: '' }), { key: 'bori', name: '보리', breed: '골든리트리버', kg: 28, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).status, 'cond')
})

// 코드 버그 의심 — 위험한 오판. contentid 125419 실데이터(코퍼스 첫 레코드). kgMatch 는 acmpyPsblCpam 만 훑고 etcAcmpyInfo 는 안 본다. zone 도 unknown(체크 없음)이라 현재 결과는 status 'ok' 에 체크가 '목줄 착용' 하나뿐. 15kg 제한 장소를 28k
test('무게 제한이 etcAcmpyInfo 에만 적히면 무시돼 28kg 이 초록불', () => {
  assert.equal(judge(parseRules({ contentid: '125419', acmpyTypeCd: '', acmpyPsblCpam: '', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '반려견(15kg 이하)' }), { key: 'bori', name: '보리', breed: '골든리트리버', kg: 28, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).status, 'no')
})

// 코드 버그 의심. 03_조사기록/probe/pettour_sample.json 의 '개항장 거리'(contentid 947611) 실데이터. acmpyTypeCd 는 '전구역 동반가능' 이지만 기타동반정보가 '실내 전시관, 체험시설 등은 반려동물 출입 제한' 이라고 정면으로 반박한다. judge 는 zone==='all'
test('전구역이라도 원문에 실내 출입 제한이 있으면 조건부여야 한다', () => {
  assert.equal(judge(parseRules({ contentid: '947611', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '전 견종 동반 가능', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '- 배변봉투 지참 및 배변처리 필수- 실내 전시관, 체험시설 등은 반려동물 출입 제한' }), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).status, 'cond')
})

// 코드 버그 의심 — 단일 최대 규모의 위험 오판. 현재 315건이 걸린다. judge 는 acmpyNeedMtr(needs)만 보고 etcAcmpyInfo(notes)의 조건은 판정에 전혀 안 쓰는데, '맹견의 경우 입마개 착용 필수' 는 needs 가 아니라 notes 에만 적히는 게 표준 표기다(958건 중 547건)
test('[통합] 맹견 입마개 필수 원문에서 입마개 없는 맹견이 초록불이면 안 된다', () => {
  assert.equal(Object.values(RULES).filter(Boolean).filter(r => /맹견[^\n]{0,20}입마개/.test((r.raw.etcAcmpyInfo ?? '') + ' ' + (r.raw.acmpyPsblCpam ?? '')) && judge(parseRules(r.raw), { key: 'tyson', name: '타이슨', breed: '아메리칸 핏불테리어', kg: 26, emoji: '🐕', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: false, isDangerous: true }).status === 'ok').length, 0)
})

// petTour.ts:176-178 의 checks.length===0 기본 문구에 도달하려면 zone 'unknown' + needs 빈 배열 + completeness!=='C' 가 동시에 성립해야 하는데, 그러려면 acmpyTypeCd 와 acmpyNeedMtr 이 비고 acmpyPsblCpam·etcAcmpyInfo
test('[통합] checks 기본 문구는 실데이터에서 도달 불가능한 죽은 분기다', () => {
  assert.equal(Object.values(RULES).filter(Boolean).filter(r => judge(parseRules(r.raw), { key: 'choco', name: '초코', breed: '푸들', kg: 3.2, emoji: '🐩', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).checks.some(c => c.text === '별도 제한 조건이 등록돼 있지 않아요')).length, 0)
})
