/**
 * 원본 → 파싱 → 판정 통합
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


// 실데이터 contentid 128202(태화강 국가정원). 코드 버그 의심 — noPets 정규식 /동반\s*불가/ 가 '맹견 동반 불가'의 뒷부분만 보고 true 를 낸다. 실제 의미는 '맹견만' 불가이고 excludeDangerous 가 이미 true 로 잡히므로 noPets 는 false 여야 한다. 현재는 초코(말
test('\'맹견 동반 불가\'(태화강 국가정원)를 전면 동반불가로 읽지 않는다', () => {
  assert.equal(parseRules({ contentid: '128202', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '맹견 동반 불가', acmpyNeedMtr: '입마개 착용,목줄 착용,이동장(켄넬)사용', etcAcmpyInfo: '- 맹견은 불가, 대형견 입마개 착용 필수\n- 관람차의 경우 이동가방(켄넬) 필수\n- 배변봉투 지참 및 배변처리 필수' }).noPets, false)
})

// 실데이터 contentid 130833(춘천시립도서관 장난감도서관). 코드 버그 의심 — noPets 의 /^불가$/ 는 문자열 전체가 '불가'일 때만 맞아서 괄호 주석이 붙는 순간 빠져나간다. serviceDogOnly 도 '보조견'은 안 잡고 '안내견'만 잡으므로 이중으로 놓친다. 결과적으로 명시적 '불가' 장소가 조
test('\'불가(보조견만 가능)\'(춘천시립도서관)는 동반 불가로 읽어야 한다', () => {
  assert.equal(parseRules({ contentid: '130833', acmpyTypeCd: '', acmpyPsblCpam: '불가(보조견만 가능)', acmpyNeedMtr: '', etcAcmpyInfo: '' }).noPets, true)
})

// 실데이터 contentid 1329201(메이즈랜드). 코드 버그 의심 — serviceDogOnly 는 '안내견' 포함 && '전 견종/모든 견종' 미포함이면 true 다. 이 원문은 '중, 소형견 입장 가능'이라고 먼저 말한 뒤 안내견도 된다고 덧붙인 것인데, '전 견종'이라는 단어가 없다는 이유만으로 안내견 전용으로
test('안내견 \'도\' 가능하다는 문장을 안내견 \'만\' 가능으로 읽지 않는다', () => {
  assert.equal(parseRules({ contentid: '1329201', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '대형견 제외 15kg 미만의 중, 소형견 입장 가능케이지나 반려견 유모차 이용배변봉투 지참 및 배변처리 필수시각장애인 안내견, 청각장애인 도우미견 입장 가능', acmpyNeedMtr: '', etcAcmpyInfo: '' }).serviceDogOnly, false)
})

// 실데이터 contentid 1329201. 코드 버그 의심 — 중소형견 패턴이 /중소형견|중·소형견|중,소형견/ 뿐이라 실제로 흔한 '중, 소형견'(콤마+공백)을 놓치고, 이어서 /소형견/ 에만 걸려 allowedSizes 가 ['small'] 로 좁아진다. 10~15kg 중형견이 명시적으로 허용된 장소에서 '소형견만 가
test('\'중, 소형견\'(콤마 뒤 공백)도 중형견까지 허용으로 파싱한다', () => {
  assert.deepEqual(parseRules({ contentid: '1329201', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '대형견 제외 15kg 미만의 중, 소형견 입장 가능케이지나 반려견 유모차 이용배변봉투 지참 및 배변처리 필수시각장애인 안내견, 청각장애인 도우미견 입장 가능', acmpyNeedMtr: '', etcAcmpyInfo: '' }).allowedSizes, ['small', 'medium'])
})

// 실데이터 contentid 662268(피나클랜드 수목원). 코드 버그 의심 — excludeDangerous 정규식이 '맹견' 바로 뒤에 제외/불가가 오는 형태만 허용해서 '맹견 및 대형견 입장 불가'처럼 목적어가 하나 더 끼면 놓친다. 맹견 프로필 사용자에게 잘못된 통과 신호가 나간다(안전 방향의 반대). 다만 여기서
test('\'맹견 및 대형견 입장 불가\'(피나클랜드)에서 맹견 배제를 인식한다', () => {
  assert.equal(parseRules({ contentid: '662268', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '15kg 미만 중소형견만 입장 가능(맹견 및 대형견 입장 불가)', acmpyNeedMtr: '반려동물 유모차 탑승,이동장(켄넬)사용', etcAcmpyInfo: '반려동물 동반여행지 시범운영 중으로 주중 및 주말 입장 여부 상의(입장 전 문의 필요) / 현재, 여름 비수기는 주중, 주말 모두 입장 가능 / 봄, 가을 축제 기간에는 주중에만 입장 가능 / 이동 시, 이동가방 및 유모차 필수 (사진 촬영 및 배변 시에는 잠시 외출 가능) / 내부 실내 시설 입장 불가 / 야외 좌석 착석은 가능(잔디 진입 불가) / 배변봉투 지참 및 수거 필수' }).excludeDangerous, true)
})

// 실데이터 contentid 2700223(블루오션펜션). 코드 버그 의심 — kg 추출 정규식 /(\d+(?:\.\d+)?)\s*kg\s*(?:이하|미만)/ 에 i 플래그가 없어 대문자 표기를 전부 흘린다. 코퍼스에 '8KG 미만 반려견', '10KG 이하 반려견', '9Kg 이하 동반 가능', '훈련된 5KG 이하 반려
test('\'8KG 미만\'(대문자)에서도 무게 상한을 뽑아낸다', () => {
  assert.equal(parseRules({ contentid: '2700223', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '8KG 미만 반려견', acmpyNeedMtr: '입마개 착용,목줄 착용', etcAcmpyInfo: '' }).maxKg, 8)
})

// 실데이터 contentid 125419. 코드 버그 의심 — maxKg 는 acmpyPsblCpam 만 스캔하는데 이 레코드는 cpam·typeCd 가 비어 있고 유일한 제한이 etcAcmpyInfo 의 '반려견(15kg 이하)'다. excludeDangerous 는 이미 cpam+etc 를 함께 보므로 maxKg 만 일
test('무게 제한이 etcAcmpyInfo 에만 적힌 경우도 놓치지 않는다', () => {
  assert.equal(parseRules({ contentid: '125419', acmpyTypeCd: '', acmpyPsblCpam: '', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '반려견(15kg 이하)' }).maxKg, 15)
})

// 실데이터 contentid 126375. 이 레코드는 개행 없이 '- ' 만으로 3개 항목이 붙어 오는 실제 포맷이고, notes 분리 정규식 /\n|(?:\s*-\s+)/ 가 이걸 정확히 쪼개 사용자에게 '실내는 안 됨'이라는 가장 중요한 문장을 보여준다. 현재 동작이 옳으므로 회귀 방어용 — 이 분리 로직을 건드리면 
test('개행 없이 \'- \'로만 이어진 etcAcmpyInfo 에서 구역 힌트를 뽑는다', () => {
  assert.equal(parseRules({ contentid: '126375', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '전 견종 출입 가능(맹견의 경우, 입마개 착용 필수)', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '- 실내 미술관은 동반 불가- 맹견의 경우, 입마개 착용 필수- 배변봉투 지참 및 배변처리 필수' }).zoneHint, '실내 미술관은 동반 불가')
})

// 실데이터 contentid 2700223(블루오션펜션). 코드 버그 의심 — 대문자 KG 미매칭(maxKg=null)이 판정까지 그대로 흘러가, 8kg 미만만 받는 숙소에 28kg 리트리버가 status 'ok'(초록 '입장 가능')로 표시된다. 숙박은 예약·이동 비용이 커서 이 오판의 피해가 가장 크다. parseRul
test('통합: 8kg 미만 펜션에 28kg 보리는 입장 불가여야 한다', () => {
  assert.equal(judge(parseRules({ contentid: '2700223', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '8KG 미만 반려견', acmpyNeedMtr: '입마개 착용,목줄 착용', etcAcmpyInfo: '' }), { key: 'bori', name: '보리', breed: '리트리버', kg: 28, emoji: '🦮', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).status, 'no')
})

// 같은 원본(2700223)에서 두 프로필이 갈리는지 보는 짝 케이스. 초코는 3.2kg 라 무게는 통과하지만 hasMuzzle=false 이므로 '입마개 착용 필요 — 미보유'로 cond 여야 한다. 현재 동작이 옳다. 앞 케이스와 묶어두면 'maxKg 를 고쳤더니 초코까지 no 로 막혔다' 같은 과교정을 잡아낸다.
test('통합: 같은 펜션에서 입마개 미보유 초코는 조건부', () => {
  assert.equal(judge(parseRules({ contentid: '2700223', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '8KG 미만 반려견', acmpyNeedMtr: '입마개 착용,목줄 착용', etcAcmpyInfo: '' }), { key: 'choco', name: '초코', breed: '말티즈', kg: 3.2, emoji: '🐶', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).status, 'cond')
})

// 실데이터 contentid 130833(춘천시립도서관). 코드 버그 의심 — 현재는 status 'cond' + '등록된 조건 정보가 적어요' 로 나온다. 원문이 '불가'라고 첫 두 글자에 못 박은 장소를 노란 조건부로 보여주면 사용자는 '전화해보고 가면 되겠네'로 읽고 출발한다. 명시적 거부는 절대 cond 로 흘리면 
test('통합: \'불가(보조견만 가능)\' 도서관은 초코도 입장 불가', () => {
  assert.equal(judge(parseRules({ contentid: '130833', acmpyTypeCd: '', acmpyPsblCpam: '불가(보조견만 가능)', acmpyNeedMtr: '', etcAcmpyInfo: '' }), { key: 'choco', name: '초코', breed: '말티즈', kg: 3.2, emoji: '🐶', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).status, 'no')
})

// 실데이터 contentid 1329201(메이즈랜드). 코드 버그 의심 — 현재 status 'no' / why '안내견만 동반 가능'. 원문은 15kg 미만 중·소형견 입장 가능이라 3.2kg 말티즈는 명백히 통과여야 하고 전구역 동반가능이라 ok 다. serviceDogOnly 오판이 '갈 수 있는 곳을 빨간색으로 지
test('통합: 메이즈랜드에서 초코는 입장 가능', () => {
  assert.equal(judge(parseRules({ contentid: '1329201', acmpyTypeCd: '전구역 동반가능', acmpyPsblCpam: '대형견 제외 15kg 미만의 중, 소형견 입장 가능케이지나 반려견 유모차 이용배변봉투 지참 및 배변처리 필수시각장애인 안내견, 청각장애인 도우미견 입장 가능', acmpyNeedMtr: '', etcAcmpyInfo: '' }), { key: 'choco', name: '초코', breed: '말티즈', kg: 3.2, emoji: '🐶', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).status, 'ok')
})

// 실데이터 contentid 126701. 코퍼스에 '이동장(켄넬)에 들어가는 전 견종 동반 가능' 형태가 12건 있다. judge 의 /케이지|이동장|가방/ 분기가 pet.hasCage 로 갈리는지 확인 — 현재 동작이 옳다. 참고로 두 프로필 모두 최종 status 는 cond 라서 status 만 보면 차이가 안 드러
test('통합: 켄넬 필수 장소에서 초코(보유)와 보리(미보유)의 체크가 갈린다', () => {
  assert.ok([judge(parseRules({ contentid: '126701', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '이동장(켄넬)에 들어가는 전 견종 동반 가능', acmpyNeedMtr: '이동장(켄넬)사용', etcAcmpyInfo: '이동장(켄넬) 안에 반려동물 몸 전체가 모두 들어가야 동반 가능' }), { key: 'choco', name: '초코', breed: '말티즈', kg: 3.2, emoji: '🐶', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).checks.some(c => c.icon === '✓' && /이동장/.test(c.text)), judge(parseRules({ contentid: '126701', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '이동장(켄넬)에 들어가는 전 견종 동반 가능', acmpyNeedMtr: '이동장(켄넬)사용', etcAcmpyInfo: '이동장(켄넬) 안에 반려동물 몸 전체가 모두 들어가야 동반 가능' }), { key: 'bori', name: '보리', breed: '리트리버', kg: 28, emoji: '🦮', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).checks.some(c => c.icon === '!' && /이동장/.test(c.text))].every(Boolean))
})

// 실데이터 contentid 138900(숙박). 코드 버그 의심 — 현재 'cond'. acmpyPsblCpam 이 비어 있고 제한이 전부 etcAcmpyInfo 에 있어 maxKg/allowedSizes 가 둘 다 null 이 된다. 게다가 이 notes 는 '/' 로만 이어져 있어 분리도 안 되고, /구역|시설|실내|
test('통합: 5kg 미만 소형견만 받는 숙소에 보리는 입장 불가', () => {
  assert.equal(judge(parseRules({ contentid: '138900', acmpyTypeCd: '일부구역 동반가능', acmpyPsblCpam: '', acmpyNeedMtr: '목줄 착용', etcAcmpyInfo: '반려견 동반 가능하나 사전 문의 필요합니다. / 소형견(5kg미만) 1마리만 동반 가능합니다. / 5kg 이상 중,대형견은 입실 제한됩니다. / 닥스훈트, 불독, 웰시코기 등 은 입실 불가합니다. / 배변패드, 반려견 식기는 제공되며, 이외 기타 용품은 직접 가지고 오셔야 합니다. / 체크인 시 반려 동물 확인 필수, 산책 시 리드줄 착용 필수 및 관리 필수입니다. / 반려동물에 의한 침구류 세탁이 필요한 경우 세탁 비용이 청구 될 수 있습니다. \n*반려견 동반 운영 정책은 현지 사정에 따라 변동 될 수 있습니다.' }), { key: 'bori', name: '보리', breed: '리트리버', kg: 28, emoji: '🦮', size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false }).status, 'no')
})

// 실데이터에 근거한 경로 — data/petRules.json 의 .rules 958건 중 6건(예: '127713')이 값 자체가 null 이다(조회는 성공했으나 API 에 조건이 미등록). 정보가 없을 때 ok(초록)로 밀지 않고 cond 로 두는 현재 동작이 옳다. 이 서비스의 기본 안전 방향을 잠그는 케이스.
test('통합: 동반 조건 미등록(rules=null) 장소는 조건부로 안내한다', () => {
  assert.equal(judge(null, { key: 'choco', name: '초코', breed: '말티즈', kg: 3.2, emoji: '🐶', size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false }).status, 'cond')
})

// 법정 맹견 5종의 대표 케이스. DANGEROUS 목록이 '도사' 부분 문자열로 매칭하므로 '도사견'/'도사'/'재패니즈 도사' 모두 잡혀야 한다. 현재 동작이 옳다.
test('isDangerousBreed: 도사견은 맹견', () => {
  assert.equal(isDangerousBreed('도사견'), true)
})

// 프로필 견종은 자유 입력이라 공백 표기가 제각각이다. breed.replace(/\s/g,'') 로 공백을 지운 뒤 매칭하는 현재 구현이 옳다 — '핏 불 테리어', '스태퍼드셔 불테리어'도 같은 경로로 통과한다. 이 정규화를 지우면 맹견이 조용히 통과한다.
test('isDangerousBreed: 공백이 섞인 \'아메리칸 스태퍼드셔 테리어\'도 맹견', () => {
  assert.equal(isDangerousBreed('아메리칸 스태퍼드셔 테리어'), true)
})

// 기본 프로필 초코의 견종. 부분 문자열 매칭은 오탐이 나기 쉬운 방식이라(예: 목록에 '불'만 넣었다면 '불독'·'화이트불테리어'가 걸린다) 대표적 비맹견이 false 로 남는지 잠근다. excludeDangerous 장소에서 초코가 억울하게 차단되는 걸 막는다. 현재 동작이 옳다.
test('isDangerousBreed: 말티즈는 맹견이 아니다', () => {
  assert.equal(isDangerousBreed('말티즈'), false)
})

// 코드 버그 의심 — DANGEROUS 가 한글 토큰만 담고 있고 대소문자 정규화도 없어 영문 표기는 전부 false 다. Pet.breed 는 사용자가 직접 적는 자유 텍스트고 견종명은 영문으로 쓰는 사람이 흔하다. 이 방향의 오판(맹견을 아님으로)은 현장 입장 거부를 넘어 안전 사고로 이어질 수 있어 가장 보수적으로 처
test('isDangerousBreed: 영문/대문자 표기 \'American Pit Bull Terrier\'도 맹견', () => {
  assert.equal(isDangerousBreed('American Pit Bull Terrier'), true)
})

// 소형/중형 경계 바로 아래. 10kg 미만 = 소형견 관례에 맞다. 코퍼스에 '9kg 이하 동반 가능'(5건), '소형견 10kg 미만' 등 9~10kg 근처를 기준으로 삼는 장소가 실제로 몰려 있어, 이 경계가 1kg만 밀려도 판정이 뒤집히는 아이가 많다. 현재 동작이 옳다.
test('sizeOf: 9.9kg 은 소형견', () => {
  assert.equal(sizeOf(9.9), 'small')
})

// 경계값 포함/미포함. kg < 10 이므로 10.0 은 medium 이다. '10kg 이하 동반 가능'(4건)처럼 이하/미만이 섞여 오는 원문과 맞물리는 지점 — 여기서 <= 로 바꾸면 소형견 전용 장소에 10kg 아이가 통과한다. 현재 동작이 옳다.
test('sizeOf: 10kg 정확히는 중형견', () => {
  assert.equal(sizeOf(10), 'medium')
})

// 중형/대형 경계 바로 아래. 코퍼스에 '24kg 이하 동반 가능'(2건), '맹견 제외 24kg 이하 동반 가능', '맹견 제외 30kg 이하 최대 1마리' 같이 20kg대를 상한으로 두는 장소가 실재해 이 경계가 실제로 쓰인다. 현재 동작이 옳다.
test('sizeOf: 24.9kg 은 중형견', () => {
  assert.equal(sizeOf(24.9), 'medium')
})

// 대형견 진입 경계값. kg < 25 가 아니므로 large. 대형견으로 분류되는 순간 allowedSizes=['small','medium'] 장소에서 전부 no 로 바뀌므로 판정을 가장 크게 뒤흔드는 한 점이다. 현재 동작이 옳다.
test('sizeOf: 25kg 정확히는 대형견', () => {
  assert.equal(sizeOf(25), 'large')
})
