/**
 * 규정 파싱 (parseRules)
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


// 코퍼스 595/1000+ 로 압도적 1위. 어떤 정규식을 고치더라도 이 값이 흔들리면 전국 대부분의 장소가 잘못 막힌다. 모든 수정의 기준선.
test('\'전 견종 동반 가능\' — 제한 없음(전체의 60%)', () => {
  assert.deepEqual((r => ({ noPets: r.noPets, serviceDogOnly: r.serviceDogOnly, maxKg: r.maxKg, allowedSizes: r.allowedSizes, excludeDangerous: r.excludeDangerous }))(parseRules({ contentid: "1", acmpyPsblCpam: "전 견종 동반 가능" })), { noPets: false, serviceDogOnly: false, maxKg: null, allowedSizes: null, excludeDangerous: false })
})

// 빈 값 121건(2위). 필드 값 자체는 전부 기본값이 맞다. 다만 '미등록'과 '제한 없음'이 구분되지 않으므로, 나머지 3필드가 채워져 completeness 가 A/B 가 되면 judge 가 🟢 로 단정한다 — completeness 로만 방어되는 구조라는 점을 이 케이스로 고정한다.
test('빈 문자열 — 미등록은 \'제한 없음\'이 아니다', () => {
  assert.deepEqual((r => ({ noPets: r.noPets, serviceDogOnly: r.serviceDogOnly, maxKg: r.maxKg, allowedSizes: r.allowedSizes, excludeDangerous: r.excludeDangerous }))(parseRules({ contentid: "1", acmpyPsblCpam: "" })), { noPets: false, serviceDogOnly: false, maxKg: null, allowedSizes: null, excludeDangerous: false })
})

// kg 추출의 정상 경로(빈도 5). 3/4/6/8/10/12/15kg 동일 패턴까지 합치면 20건 이상으로 kg 표현의 다수파.
test('\'9kg 이하 동반 가능\' → maxKg 9', () => {
  assert.equal(parseRules({ contentid: "1", acmpyPsblCpam: "9kg 이하 동반 가능" }).maxKg, 9)
})

// 빈도 2. 정규식이 한 자리 수만 잡거나 앞자리만 끊어 '2kg'로 읽으면 24kg 개가 통째로 거부된다 — 실제로는 열려 있는 곳을 막는 반대 방향 오류.
test('\'24kg 이하 동반 가능\' → maxKg 24 (두 자리 큰 값)', () => {
  assert.equal(parseRules({ contentid: "1", acmpyPsblCpam: "24kg 이하 동반 가능" }).maxKg, 24)
})

// 코드 버그 의심. /(\d+)\s*kg\s*(?:이하|미만)/ 에 i 플래그가 없어 대문자 KG 를 놓쳐 maxKg=null → 30kg 대형견도 🟢 입장 가능으로 나온다(현장 거부 직결). 코퍼스의 '10KG 이하 반려견', '8KG 미만 반려견', '훈련된 5KG 이하 반려견' 이 모두 같은 이유로 새고 있다. 단, 
test('\'10KG 이하 반려견\' → maxKg 10 (대문자 KG)', () => {
  assert.equal(parseRules({ contentid: "1", acmpyPsblCpam: "소란하거나 사납지 않은 10KG 이하 반려견" }).maxKg, 10)
})

// 코드 버그 의심. 관광공사 원문에 조합형 단위 문자 '㎏'(U+339F)가 섞여 온다. 'kg' 두 글자만 보므로 maxKg=null → 무제한으로 판정. i 플래그만 추가하는 수정으로는 안 잡히는 별개의 결함이라 따로 둔다.
test('\'20㎏ 미만 동반 가능\' → maxKg 20 (단위 문자 ㎏ U+339F)', () => {
  assert.equal(parseRules({ contentid: "1", acmpyPsblCpam: "20㎏ 미만 동반 가능" }).maxKg, 20)
})

// 코드 버그 의심(maxKg). 공백 없이 붙은 '제외15Kg이하' + 혼합 대소문자. excludeDangerous 는 현재도 true 로 맞지만 maxKg 는 null 로 새서 15kg 제한이 사라진다. 실제 API 값 그대로.
test('\'맹견 제외15Kg이하 동반 가능\' → maxKg 15 + excludeDangerous true', () => {
  assert.deepEqual((r => ({ maxKg: r.maxKg, excludeDangerous: r.excludeDangerous }))(parseRules({ contentid: "1", acmpyPsblCpam: "맹견 제외15Kg이하 동반 가능" })), { maxKg: 15, excludeDangerous: true })
})

// 빈도 6. 중소형견 매핑의 정상 경로. '중소형견 동반 가능(이동장 이용 필수)', '중소형견 동반 가능(상세 기준 사전 확인 필요)' 도 같은 분기를 탄다.
test('\'중소형견 동반 가능\' → [\'small\',\'medium\']', () => {
  assert.deepEqual(parseRules({ contentid: "1", acmpyPsblCpam: "중소형견 동반 가능" }).allowedSizes, ["small", "medium"])
})

// 코드 버그 의심. 정규식이 /중,소형견/ 으로 공백 없는 형태만 봐서 '중, 소형견'(빈도 2)이 마지막 /소형견/ 분기로 떨어져 ['small'] 이 된다. 원문은 명백히 중형견도 허용. 같은 결함이 '8kg 미만의 중, 소형견', '중/소형견 10kg 미만만 입실 가능'(슬래시 구분자)에도 있다. 구분자를 [\s,·/
test('\'중, 소형견 (10kg 이하)\' — 쉼표 뒤 공백이면 중형견이 사라진다', () => {
  assert.deepEqual(parseRules({ contentid: "1", acmpyPsblCpam: "중, 소형견 (10kg 이하)" }).allowedSizes, ["small", "medium"])
})

// '중형견 → [small, medium]' 이 옳은지에 대한 실데이터 근거. 원문이 '소형견~중형견' 이라 소형 포함이 맞고, 15kg 상한과 함께 걸리므로 현재 매핑이 이 케이스에선 정답이다. 반면 excludeDangerous 는 코드 버그 의심 — '맹견,' 뒤에 쉼표가 끼어 /맹견\s*(?:은|는)?\s*(?:제외
test('\'소형견~중형견(15kg 이하) … 맹견 … 불가\' — 중형견 매핑은 맞고 맹견 배제는 새는 복합문', () => {
  assert.deepEqual((r => ({ maxKg: r.maxKg, allowedSizes: r.allowedSizes, excludeDangerous: r.excludeDangerous, noPets: r.noPets }))(parseRules({ contentid: "1", acmpyPsblCpam: "소형견~중형견(15kg 이하) 가능, 대형견(15kg 이상)은 사전 문의 필수* 맹견, 털이 많이 빠지는견은 불가" })), { maxKg: 15, allowedSizes: ["small", "medium"], excludeDangerous: true, noPets: false })
})

// 코드 버그 의심. allowedSizes 는 '소형견/중형견'이 적힌 경우만 보고 '대형견 제외' 서술은 전혀 읽지 않아 null → 40kg 개가 🟢. 크기 제한이 명시된 곳에서 대형견을 그대로 통과시키는 가장 직접적인 헛걸음 경로.
test('\'대형견 제외 전 견종 동반 가능\' → 대형견 배제가 반영돼야 한다', () => {
  assert.deepEqual(parseRules({ contentid: "1", acmpyPsblCpam: "대형견 제외 전 견종 동반 가능" }).allowedSizes, ["small", "medium"])
})

// 빈도 3(+ '시각 장애인 안내견' 3, '안내견' 2, '안내견만 가' 1). 반려견을 데려가면 못 들어가는 곳이므로 serviceDogOnly 가 참이어야 judge 가 🔴 '안내견만 동반 가능'을 낸다. 정상 경로 고정.
test('\'맹인 안내견\' → serviceDogOnly true', () => {
  assert.deepEqual((r => ({ serviceDogOnly: r.serviceDogOnly, noPets: r.noPets }))(parseRules({ contentid: "1", acmpyPsblCpam: "맹인 안내견" })), { serviceDogOnly: true, noPets: false })
})

// 코드 버그 의심. 정규식이 '안내견'만 보고 '보조견'을 몰라 serviceDogOnly=false → 일반 반려견도 🟢 입장 가능으로 표시된다. 빈도 2, 여기에 '보조견 동반 입장 가능. 야외 좌석과 내부 1층만 허용됨.' 1건 추가. '반려견 / 보조견 동반 가능'(반려견도 허용)과는 반드시 구분돼야 하므로 '보조견
test('\'보조견 동반 입장 가능\' — 보조견도 안내견 취급해야 한다', () => {
  assert.equal(parseRules({ contentid: "1", acmpyPsblCpam: "보조견 동반 입장 가능" }).serviceDogOnly, true)
})

// 코드 버그 의심. 원문은 '중·소형견 입장 가능' + '안내견도 입장 가능'인데, /안내견/ 이 있고 '전 견종'이 없다는 이유로 serviceDogOnly=true → judge 가 🔴 '안내견만 동반 가능'을 반환해 실제로는 들어갈 수 있는 15kg 미만 반려견을 통째로 막는다. 예외 목록에 '전 견종/모든 견종'만 
test('\'중·소형견 입장 가능 … 시각장애인 안내견 …\' — 안내견 언급 하나로 전체가 막힌다', () => {
  assert.deepEqual((r => ({ serviceDogOnly: r.serviceDogOnly, maxKg: r.maxKg }))(parseRules({ contentid: "1", acmpyPsblCpam: "대형견 제외 15kg 미만의 중, 소형견 입장 가능케이지나 반려견 유모차 이용배변봉투 지참 및 배변처리 필수시각장애인 안내견, 청각장애인 도우미견 입장 가능" })), { serviceDogOnly: false, maxKg: 15 })
})

// 빈도 6. 입마개는 '조건'이지 '배제'가 아니다. 여기서 excludeDangerous 를 참으로 만들면 맹견 보호자가 갈 수 있는 곳을 🔴 로 막는다. 아래 맹견 배제 케이스들을 고치다가 이 케이스를 함께 깨뜨리기 쉬우므로 회귀 방지선으로 반드시 유지. 같은 성격: '전 견종 동반가능(맹견 입마개 착용 시 입장 가능)
test('\'전 견종 출입 가능(맹견의 경우, 입마개 착용 필수)\' → excludeDangerous false', () => {
  assert.equal(parseRules({ contentid: "1", acmpyPsblCpam: "전 견종 출입 가능(맹견의 경우, 입마개 착용 필수)" }).excludeDangerous, false)
})

// 빈도 14 로 맹견 배제 표현 중 최다. 접두형('맹견 제외 …') 정상 경로.
test('\'맹견 제외 전 견종 동반 가능\' → excludeDangerous true', () => {
  assert.equal(parseRules({ contentid: "1", acmpyPsblCpam: "맹견 제외 전 견종 동반 가능" }).excludeDangerous, true)
})

// 빈도 3(+ 오타본 '전 견동 동반가능(맹견 제외)' 1). 괄호 후치형도 잡히는지 확인. '전 견종'이 함께 있어도 맹견 배제는 살아 있어야 한다는 점이 요지.
test('\'전 견종 동반가능(맹견 제외)\' → excludeDangerous true', () => {
  assert.equal(parseRules({ contentid: "1", acmpyPsblCpam: "전 견종 동반가능(맹견 제외)" }).excludeDangerous, true)
})

// 코드 버그 의심(두 필드 모두). '맹견' 바로 뒤에 '및'이 끼어 정규식이 불발 → excludeDangerous=false 로 맹견이 🟢, 게다가 '대형견 제외'도 안 읽어 대형견까지 🟢. 빈도 2. 같은 접속사 패턴: '맹견 및 가축 전염병에 … 제외 전 견종 동반 가능', '15kg 미만 중소형견만 입장 가능(맹견
test('\'맹견 및 대형견 제외 동반 가능\' — 접속사가 끼면 맹견 배제가 증발', () => {
  assert.deepEqual((r => ({ excludeDangerous: r.excludeDangerous, allowedSizes: r.allowedSizes }))(parseRules({ contentid: "1", acmpyPsblCpam: "맹견 및 대형견 제외 동반 가능" })), { excludeDangerous: true, allowedSizes: ["small", "medium"] })
})

// 코드 버그 의심. '맹견은'까지는 정규식이 따라가지만 뒤가 '입장제한'이라 배제 어휘 목록(제외|불가|출입 불가|동반 불가)에 걸리지 않아 false. 빈도 2 + 괄호 안 공백 없는 변형 1. 배제 어휘에 입장제한/입장 불가/출입 제한/품종 제외/맹견 X 등을 넓혀야 한다.
test('\'… (단, 맹견은 입장제한 )\' — \'입장제한\' 어휘를 모른다', () => {
  assert.equal(parseRules({ contentid: "1", acmpyPsblCpam: "최근 1년이내 광견병 접종(증빙서류 필요) 을 완료한 등록된 반려견만 입장 가능(단, 맹견은 입장제한 )" }).excludeDangerous, true)
})

// 코드 버그 의심(noPets). noPets 정규식의 /동반\s*불가/ 가 주어를 보지 않아 noPets=true → judge 가 즉시 🔴 '반려동물 동반 불가'를 반환하고, 실제로는 맹견이 아닌 모든 반려견이 입장 가능한 장소가 지도에서 통째로 닫힌다. noPets 는 주어가 없거나 '반려동물/반려견'일 때만 참이어야
test('\'맹견 동반 불가\' — 맹견만 막아야 하는데 전면 금지로 읽힌다', () => {
  assert.deepEqual((r => ({ noPets: r.noPets, excludeDangerous: r.excludeDangerous }))(parseRules({ contentid: "1", acmpyPsblCpam: "맹견 동반 불가" })), { noPets: false, excludeDangerous: true })
})

// 빈도 3. ^불가$ 정상 경로. 위의 '맹견 동반 불가' 를 고칠 때 이 한 단어짜리 전면 금지는 계속 잡혀야 한다.
test('\'불가\' → noPets true', () => {
  assert.equal(parseRules({ contentid: "1", acmpyPsblCpam: "불가" }).noPets, true)
})

// 빈도 2. 맹견 배제 + 체중 상한 + 접종 조건 + 전 견종이 한 문장에 겹친 대표형이고 현재 코드가 유일하게 전부 맞히는 복합 케이스. 위 수정들이 서로 간섭하지 않는지 검증하는 종합 회귀선. 유사형: '맹견 제외 14kg 이하 예방접종 및 동물등록 완료한 전 견종 동반 가능', '맹견 제외 24kg 이하 동반 가능'
test('\'맹견 제외 15kg 이하 예방 접종 완료한 전 견종 동반 가능\' — 복합 문장 전 필드', () => {
  assert.deepEqual((r => ({ noPets: r.noPets, serviceDogOnly: r.serviceDogOnly, maxKg: r.maxKg, allowedSizes: r.allowedSizes, excludeDangerous: r.excludeDangerous }))(parseRules({ contentid: "1", acmpyPsblCpam: "맹견 제외 15kg 이하 예방 접종 완료한 전 견종 동반 가능" })), { noPets: false, serviceDogOnly: false, maxKg: 15, allowedSizes: null, excludeDangerous: true })
})

// 빈도 12 로 비어 있지 않은 값 중 2위. 필드 값 자체는 현재 코드와 같지만(그래서 지금은 통과) '켄넬에 들어가야 한다'는 사실상의 크기 제한이 PetRules 어디에도 남지 않아 40kg 개도 🟢 로 나온다 — 설계 공백. 같은 부류: '몸 전체가 유모차 및 이동장(켄넬) 안에 들어가는 전 견종 동반 가능', '반
test('\'이동장(켄넬)에 들어가는 전 견종 동반 가능\' — 크기 제한이 전혀 남지 않는다', () => {
  assert.deepEqual((r => ({ maxKg: r.maxKg, allowedSizes: r.allowedSizes, noPets: r.noPets }))(parseRules({ contentid: "1", acmpyPsblCpam: "이동장(켄넬)에 들어가는 전 견종 동반 가능" })), { maxKg: null, allowedSizes: null, noPets: false })
})

// 코드 버그 의심. '전화문의'(빈도 3) · '문의요망' 은 판정 불가 신호인데 parseRules 가 아무 제약도 만들지 않고, 나머지 3필드가 채워져 completeness='A' 가 되면 judge 가 32kg 대형견에게 🟢 '전 구역 동반 가능'을 단정한다. completeness 가 C 일 때만 우연히 🟡 로 막
test('\'전화문의\' 인데 다른 필드가 다 차 있으면 🟢 입장 가능이 된다', () => {
  assert.equal(judge(parseRules({ contentid: "1", acmpyTypeCd: "전구역 동반가능", acmpyPsblCpam: "전화문의", acmpyNeedMtr: "목줄, 배변봉투", etcAcmpyInfo: "- 실내 동반 가능" }), { key: "p", name: "콩", breed: "골든리트리버", kg: 32, emoji: "🐶", size: "large", sizeLabel: "대형견", hasCage: false, hasMuzzle: false, isDangerous: false }).status, "cond")
})

// corpus_need.tsv 26건 · 실레코드 contentid 125653. '기타'는 실제 준비물이 아니라 '자세한 건 etcAcmpyInfo 참조'라는 버킷 라벨이라 체크리스트에 '✓ 기타'로 뜨면 안 된다. 현재 코드 동작과 일치 — 회귀 방지용 고정.
test('필요사항 \'입마개 착용,목줄 착용,기타\' → \'기타\'는 항목에서 빠진다', () => {
  assert.deepEqual(parseRules({ contentid: "125653", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "전 견종 동반 가능", acmpyNeedMtr: "입마개 착용,목줄 착용,기타", etcAcmpyInfo: "- 주상절리길, 계곡입수 불가\n- 맹견의 경우, 입마개 착용 필수\n- 배변봉투 지참 및 배변처리 필수" }).needs, ["입마개 착용", "목줄 착용"])
})

// 코드 버그 의심. corpus_need.tsv 17건('자유이용' 원자값은 전체 21건) · 실레코드 129438. 현재 needs=['자유이용']이 되어 judge 가 '✓ 자유이용'을 '동반시 필요사항' 체크리스트에 초록 체크로 찍는다. '자유이용'은 준비물이 아니라 '제약 없음'이라는 정책값이라 needs 에 들어가
test('필요사항 \'자유이용\' 단독 → 준비물 목록은 비어야 한다', () => {
  assert.deepEqual(parseRules({ contentid: "129438", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "전 견종 동반 가능", acmpyNeedMtr: "자유이용", etcAcmpyInfo: "- 맹견의 경우, 입마개 착용 필수- 숙박시설, 출렁다리, 스카이 타워는 동반 불가- 배변 봉투 지참 및 배변 처리 필수" }).needs, [])
})

// 코드 버그 의심. corpus_need.tsv 2건 · 실레코드 3022888. '자유이용'과 '목줄 착용'이 같이 온 모순 케이스인데, 현재는 둘 다 needs 에 들어가 체크리스트에 '✓ 자유이용'과 '✓ 목줄 착용'이 나란히 뜬다. 실제 준비물은 목줄 하나뿐이다.
test('필요사항 \'자유이용,목줄 착용\' → 목줄만 남는다', () => {
  assert.deepEqual(parseRules({ contentid: "3022888", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "- 맹견 제외 전 견종 동반가능", acmpyNeedMtr: "자유이용,목줄 착용", etcAcmpyInfo: "- 펫파크만 동반 가능하며 리조트 동반 입실 불가- (월~수) 대형견 입장 가능_40cm, 10kg 이상- (목~일) 소형견 입장 가능_40cm, 10kg 미만" }).needs, ["목줄 착용"])
})

// 코드 버그 의심. corpus_need.tsv 1건 · 실레코드 3444764. '기타'는 걸러지는데 '자유이용'은 안 걸러진다 — 같은 성격(비준비물)인데 처리가 갈린다. 현재 needs=['자유이용','이동장(켄넬)사용'].
test('필요사항 \'자유이용,이동장(켄넬)사용,기타\' → 켄넬만 남는다', () => {
  assert.deepEqual(parseRules({ contentid: "3444764", acmpyTypeCd: "전구역 동반가능", acmpyPsblCpam: "", acmpyNeedMtr: "자유이용,이동장(켄넬)사용,기타", etcAcmpyInfo: "" }).needs, ["이동장(켄넬)사용"])
})

// corpus_need.tsv 3건('기타' 원자값 54건) · 실레코드 126730(순천만습지). 필터 후 빈 배열이 되어도 터지지 않아야 한다. 현재 동작과 일치 — 회귀 방지.
test('필요사항 \'기타\' 단독 → 항목 0개', () => {
  assert.deepEqual(parseRules({ contentid: "126730", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "전 견종 동반 가능", acmpyNeedMtr: "기타", etcAcmpyInfo: "- 순천만습지는 동반 불가- 주차장 인근 반려견 놀이터 동반 가능" }).needs, [])
})

// 코드 버그 의심. 실레코드 3444764 + app/page.tsx 의 실제 프로필 '초코'. 현재 checks 는 ['✓ 전 구역 동반 가능','✓ 자유이용','✓ 이동장(켄넬)사용 → 보유 중'] 이라 사용자가 '자유이용'을 준비해야 할 무언가로 읽는다.
test('통합: \'자유이용\'이 입장 조건 체크리스트에 초록 체크로 뜨지 않는다', () => {
  assert.equal(judge(parseRules({ contentid: "3444764", acmpyTypeCd: "전구역 동반가능", acmpyPsblCpam: "", acmpyNeedMtr: "자유이용,이동장(켄넬)사용,기타", etcAcmpyInfo: "" }), { key: "choco", name: "초코", breed: "말티즈", kg: 3.2, emoji: "🐶", size: "small", sizeLabel: "소형견", hasCage: true, hasMuzzle: false, isDangerous: false }).checks.some((c) => c.text.includes("자유이용")), false)
})

// 실레코드 3114506. 개행이 전혀 없고 ' - '(앞뒤 공백)과 '착용- '(앞 공백 없음) 두 형태가 한 문자열에 섞여 있는 유일한 실데이터 패턴. 항목 안의 쉼표('입,퇴장', '맹견, 발정이 심한 개')로 잘리면 안 된다는 것도 같이 고정한다. 현재 동작과 일치 — 회귀 방지.
test('기타정보가 개행 없이 \'- A - B\' 로 이어질 때 5개 항목으로 분리된다', () => {
  assert.deepEqual(parseRules({ contentid: "3114506", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "일부 견종 동반 가능", acmpyNeedMtr: "목줄 착용", etcAcmpyInfo: "- 동물 인식표 착용 필수 - 13세 이상의 보호자 동반 시 반려동물 놀이터 입장 가능 - 입,퇴장 시 리드줄 필수 착용- 맹견, 발정이 심한 개, 미등록 개, 전염성 질병이 있는 개, 상해를 입힐 수 있는 개 동반 불가 - 배변봉투 지참 및 배변처리 필수" }).notes, ["동물 인식표 착용 필수", "13세 이상의 보호자 동반 시 반려동물 놀이터 입장 가능", "입,퇴장 시 리드줄 필수 착용", "맹견, 발정이 심한 개, 미등록 개, 전염성 질병이 있는 개, 상해를 입힐 수 있는 개 동반 불가", "배변봉투 지참 및 배변처리 필수"])
})

// 코드 버그 의심. 실레코드 2756611. '-' 없이 개행만 된 줄은 앞 항목의 연속인데 현재는 무조건 분리돼 notes[0]='경주읍성 성곽 위 관람로는 반려견 동반 불가,'(쉼표로 끝남)가 된다. 이 반토막이 그대로 zoneHint 가 되어 체크리스트에는 '관람로 동반 불가'만 뜨고 '성벽 아래 산책로는 이용 가능'
test('개행으로 이어지는 한 문장이 두 항목으로 찢기지 않는다 (경주읍성)', () => {
  assert.equal(parseRules({ contentid: "2756611", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "전 견종 동반 가능", acmpyNeedMtr: "목줄 착용", etcAcmpyInfo: "- 경주읍성 성곽 위 관람로는 반려견 동반 불가,\n성벽 아래 산책로 이용 가능\n- 잔디밭 진입 금지\n- 2m 내외 목줄 착용\n- 맹견의 경우, 입마개 착용 필수\n- 배변봉투 지참 및 배변처리 필수" }).notes[0], "경주읍성 성곽 위 관람로는 반려견 동반 불가, 성벽 아래 산책로 이용 가능")
})

// 실레코드 742972. 개행·하이픈이 없는 단문이 통째로 1개 항목으로 남아야 한다. 향후 분리자를 늘릴 때(쉼표·문장부호) 이 문장이 쪼개지지 않는지 잡는 가드.
test('괄호·쉼표가 든 단문은 오분할되지 않는다', () => {
  assert.deepEqual(parseRules({ contentid: "742972", acmpyTypeCd: "", acmpyPsblCpam: "", acmpyNeedMtr: "", etcAcmpyInfo: "보호 장구(목줄 등) 및 배설물 처리용기(비닐봉투, 집게 등) 지참" }).notes, ["보호 장구(목줄 등) 및 배설물 처리용기(비닐봉투, 집게 등) 지참"])
})

// 실레코드 2042995. '입장 가능' 키워드가 있어 정상적으로 잡히는 문장. 아래 2402981 케이스와 짝을 이루는 대조군이다 — 의미는 사실상 같은데 한쪽만 잡힌다는 걸 드러낸다. 현재 동작과 일치.
test('zoneHint — \'매장 입장 가능 여부 개별 문의 필요\'는 잡힌다 (양성 대조군)', () => {
  assert.equal(parseRules({ contentid: "2042995", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "전 견종 동반 가능", acmpyNeedMtr: "목줄 착용", etcAcmpyInfo: "- 매장 입장 가능 여부 개별 문의 필요\n- 맹견의 경우, 입마개 착용 필수\n- 배변봉투 지참 및 배변처리 필수" }).zoneHint, "매장 입장 가능 여부 개별 문의 필요")
})

// 코드 버그 의심. 실레코드 2402981(2647847 등 동일 문구 다수). 2042995 와 뜻이 같은데 '입장 가능'이라는 표현이 없어 정규식에 안 걸려 zoneHint=null. judge 는 대신 '일부 구역만 동반 가능 — 공개된 구역 정보가 없어요'를 띄운다. 정보가 있는데 없다고 말하는 셈.
test('zoneHint — \'매장별 정책이 상이하므로 개별 문의 필요\'도 잡혀야 한다', () => {
  assert.equal(parseRules({ contentid: "2402981", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "전 견종 동반 가능", acmpyNeedMtr: "목줄 착용", etcAcmpyInfo: "- 매장별 정책이 상이하므로 개별 문의 필요\n- 맹견의 경우, 입마개 착용 필수\n- 배변봉투 지참 및 배변처리 필수" }).zoneHint, "매장별 정책이 상이하므로 개별 문의 필요")
})

// 코드 버그 의심. 실레코드 125653. 금지 구역을 콕 집은 문장인데 '동반 불가'가 아니라 그냥 '불가'라서 정규식(/동반\s*불가/)에 안 걸려 zoneHint=null. 일부구역 장소(462건 중 zoneHint 가 null 인 게 320건)에서 가장 흔한 누락 유형이다.
test('zoneHint — \'주상절리길, 계곡입수 불가\'처럼 구역명을 지목한 문장이 잡혀야 한다', () => {
  assert.equal(parseRules({ contentid: "125653", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "전 견종 동반 가능", acmpyNeedMtr: "입마개 착용,목줄 착용,기타", etcAcmpyInfo: "- 주상절리길, 계곡입수 불가\n- 맹견의 경우, 입마개 착용 필수\n- 배변봉투 지참 및 배변처리 필수" }).zoneHint, "주상절리길, 계곡입수 불가")
})

// 코드 버그 의심. 실레코드 126720. 현재 zoneHint='선실 객실은 동반불가, 승선 시 가급적' — '가급적' 뒤가 잘린 비문이 화면에 그대로 뜬다. 같은 레코드의 '032-886-7813~4'는 하이픈 뒤에 공백이 없어 안 잘리는데(정상), 개행 연속 줄은 잘린다는 비대칭도 함께 드러난다.
test('zoneHint — 개행 연속 문장이 잘린 채 힌트로 쓰이면 안 된다 (선실 객실)', () => {
  assert.equal(parseRules({ contentid: "126720", acmpyTypeCd: "전구역 동반가능", acmpyPsblCpam: "전 견종 동반 가능", acmpyNeedMtr: "목줄 착용,이동장(켄넬)사용", etcAcmpyInfo: "- 선실 객실은 동반불가, 승선 시 가급적\n 이동장(켄넬) 사용 \n- 선착장 전화번호 : 032-886-7813~4\n- 맹견의 경우, 입마개 착용 필수 \n- 배변봉투 지참 및 배변처리 필수" }).zoneHint, "선실 객실은 동반불가, 승선 시 가급적 이동장(켄넬) 사용")
})

// 실레코드 125419. data/petRules.json 952건 중 acmpyTypeCd 는 '전구역 동반가능' 472 · '일부구역 동반가능' 462 · '' 18 세 가지뿐이고, 빈 값은 'all'로도 'partial'로도 넘어가면 안 된다. 현재 동작과 일치 — 회귀 방지.
test('zone — acmpyTypeCd 가 빈 문자열이면 \'unknown\'', () => {
  assert.equal(parseRules({ contentid: "125419", acmpyTypeCd: "", acmpyPsblCpam: "", acmpyNeedMtr: "목줄 착용", etcAcmpyInfo: "반려견(15kg 이하)" }).zone, "unknown")
})

// 코드 버그 의심. 실레코드 3378995(zone='all'인데 기타정보가 실내 불가를 명시한 레코드가 472건 중 13건). judge 의 zone==='all' 분기는 zoneHint 를 아예 쓰지 않아 checks 가 ['✓ 전 구역 동반 가능','✓ 목줄 착용']로 끝난다. 원문이 '실내 동반불가'라고 적어둔 곳에
test('통합: \'전구역 동반가능\'이어도 기타정보의 \'실내는 동반불가\'가 체크리스트에 남아야 한다', () => {
  assert.equal(judge(parseRules({ contentid: "3378995", acmpyTypeCd: "전구역 동반가능", acmpyPsblCpam: "전 견종 동반 가능", acmpyNeedMtr: "목줄 착용", etcAcmpyInfo: "- 실내는 동반불가- 맹견의 경우, 입마개 착용 필수- 배변봉투 지참 및 배변처리 필수" }), { key: "choco", name: "초코", breed: "말티즈", kg: 3.2, emoji: "🐶", size: "small", sizeLabel: "소형견", hasCage: true, hasMuzzle: false, isDangerous: false }).checks.some((c) => c.text.includes("실내")), true)
})

// 실레코드 2042995. filled=4 → A 경계(실데이터 733건). 현재 동작과 일치 — 회귀 방지.
test('completeness — 4개 필드가 모두 차면 \'A\'', () => {
  assert.equal(parseRules({ contentid: "2042995", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "전 견종 동반 가능", acmpyNeedMtr: "목줄 착용", etcAcmpyInfo: "- 매장 입장 가능 여부 개별 문의 필요\n- 맹견의 경우, 입마개 착용 필수\n- 배변봉투 지참 및 배변처리 필수" }).completeness, "A")
})

// 실레코드 2665662. filled=3 → A/B 경계(실데이터 81건). acmpyPsblCpam 만 비어도 A 로 새면 안 된다. 현재 동작과 일치 — 회귀 방지.
test('completeness — 필드 3개(동반가능동물 결손)면 \'B\'', () => {
  assert.equal(parseRules({ contentid: "2665662", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "", acmpyNeedMtr: "목줄 착용", etcAcmpyInfo: "사니다카페는 반려동물 동반 가능한 카페로 야외 공간만 이용 가능합니다. 반려견은 카페 실내 공간 및 레스토랑 실내 출입 어려운 점 양해 부탁드립니다. 이용 시 리드줄을 반드시 착용해주셔야 하며, 배변을 깨끗이 처리해 주셔야 합니다. 사니다카페는 애견 카페가 아닌 애견 동반 카페로 모두에게 안전하고 쾌적한 환경을 위해 에티켓을 지켜주시길 바랍니다.\n*반려견 동반 운영 정책은 현지 사정에 따라 변동 될 수 있습니다." }).completeness, "B")
})

// 실레코드 742972. filled=1 → B/C 경계(실데이터 75건, 실제로 0개인 레코드는 952건 중 없다). C 여야 judge 가 '등록된 조건 정보가 적어요 — 방문 전 전화 확인을 권해요'를 붙인다. 현재 동작과 일치 — 회귀 방지.
test('completeness — 필드 1개면 \'C\'', () => {
  assert.equal(parseRules({ contentid: "742972", acmpyTypeCd: "", acmpyPsblCpam: "", acmpyNeedMtr: "", etcAcmpyInfo: "보호 장구(목줄 등) 및 배설물 처리용기(비닐봉투, 집게 등) 지참" }).completeness, "C")
})

// 코드 버그 의심(현재 'B'). 실레코드 3443614. filled 계산이 '값이 있냐'만 보기 때문에 정보량 0인 '기타' 한 글자가 한 칸을 채워 B 가 된다. types.ts 주석은 C 를 '동반구분만'이라고 정의하는데 이 레코드는 실질적으로 동반구분만 있는 상태다. B 가 되면 judge 의 '정보가 적어요' 경
test('completeness — 동반구분 + \'기타\'뿐이면 실질 정보가 0이므로 \'C\'', () => {
  assert.equal(parseRules({ contentid: "3443614", acmpyTypeCd: "전구역 동반가능", acmpyPsblCpam: "", acmpyNeedMtr: "기타", etcAcmpyInfo: "" }).completeness, "C")
})

// 코드 버그 의심(현재 'ok'). 실레코드 3443614. 위 completeness B 오판의 실제 피해: 등록된 정보가 동반구분 코드 하나뿐인데 checks=['✓ 전 구역 동반 가능']만 달고 초록 '입장 가능' 배지가 뜬다. 확인할 근거가 없을수록 단정하지 않는다는 이 서비스의 원칙(openHours.ts 주석)과
test('통합: 동반구분 + \'기타\'뿐인 장소는 초록 \'입장 가능\'이 아니라 조건부여야 한다', () => {
  assert.equal(judge(parseRules({ contentid: "3443614", acmpyTypeCd: "전구역 동반가능", acmpyPsblCpam: "", acmpyNeedMtr: "기타", etcAcmpyInfo: "" }), { key: "choco", name: "초코", breed: "말티즈", kg: 3.2, emoji: "🐶", size: "small", sizeLabel: "소형견", hasCage: true, hasMuzzle: false, isDangerous: false }).status, "cond")
})

// 코드 버그 의심(현재 false). 실레코드 127487. 정규식이 /맹견\s*(은|는)?\s*(제외|불가|출입\s*불가|동반\s*불가)/ 라 '맹견 입장 불가'는 '맹견' 뒤에 '입장'이 끼어 매칭에 실패한다. 같은 유형으로 2749989('맹견은 입장 불가능합니다'), 3114506('맹견, 발정이 심한 개 … 동반 
test('기타정보의 \'맹견 입장 불가\'가 맹견 배제로 읽혀야 한다', () => {
  assert.equal(parseRules({ contentid: "127487", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "일부 견종 동반 가능", acmpyNeedMtr: "목줄 착용", etcAcmpyInfo: "- 맹견 입장 불가\n- 공원 내 실내 시설 및 야간 입장 불가\n- 인식표 필수 착용\n- 배변봉투 지참 및 배변처리 필수" }).excludeDangerous, true)
})

// 코드 버그 의심(현재 'cond'). 실레코드 127487 + isDangerousBreed('핏불테리어')===true 인 프로필. 원문에 '맹견 입장 불가'라고 대놓고 적힌 공원에서 맹견 보호자가 '조건부 입장 가능'을 보고 출발하게 된다 — 이 서비스가 막으려는 현장 입장 거부 그 자체.
test('통합: \'맹견 입장 불가\' 장소에 맹견 프로필은 \'불가\' 판정이어야 한다', () => {
  assert.equal(judge(parseRules({ contentid: "127487", acmpyTypeCd: "일부구역 동반가능", acmpyPsblCpam: "일부 견종 동반 가능", acmpyNeedMtr: "목줄 착용", etcAcmpyInfo: "- 맹견 입장 불가\n- 공원 내 실내 시설 및 야간 입장 불가\n- 인식표 필수 착용\n- 배변봉투 지참 및 배변처리 필수" }), { key: "mungchi", name: "뭉치", breed: "핏불테리어", kg: 24, emoji: "🐕", size: "medium", sizeLabel: "중형견", hasCage: false, hasMuzzle: true, isDangerous: true }).status, "no")
})

// 코드 버그 의심(현재 'ok'). 실레코드 125419 + app/page.tsx 의 실제 프로필 '보리'(28kg). 체중 제한을 acmpyPsblCpam 에서만 읽기 때문에 etcAcmpyInfo 에만 '15kg 이하'가 적힌 이 레코드는 maxKg=null 이 된다. 게다가 zone='unknown'(체크 없음) +
test('통합: 기타정보의 \'반려견(15kg 이하)\'가 28kg 대형견에게 적용되어야 한다', () => {
  assert.equal(judge(parseRules({ contentid: "125419", acmpyTypeCd: "", acmpyPsblCpam: "", acmpyNeedMtr: "목줄 착용", etcAcmpyInfo: "반려견(15kg 이하)" }), { key: "bori", name: "보리", breed: "리트리버", kg: 28, emoji: "🦮", size: "large", sizeLabel: "대형견", hasCage: false, hasMuzzle: true, isDangerous: false }).status, "no")
})
