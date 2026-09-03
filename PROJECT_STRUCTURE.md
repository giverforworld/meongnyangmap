# 멍냥맵 — 프로젝트 구조 분석

> 반려동물 동반 입장 가능 여부를 **우리 아이(반려동물 프로필) 기준으로 판정**해 헛걸음을 막아주는 지도 서비스.
> 2026 관광데이터 활용 공모전 웹·앱 구현 부문 · 지정과제 6번.
> 데이터 출처: ⓒ한국관광공사 (KorPetTourService2)

---

## 1. 한눈에 보기

| 항목 | 내용 |
|---|---|
| 프레임워크 | Next.js 14.2.35 (App Router) |
| 언어 | TypeScript 5 (`strict: true`) |
| UI | React 18 · 인라인 스타일 + `globals.css` (Tailwind는 설치돼 있으나 실질 미사용) |
| 지도 | Kakao Maps JavaScript SDK (`autoload=false` + `next/script`) |
| 외부 데이터 | 한국관광공사 `KorPetTourService2` (공공데이터포털) |
| 상태관리 | React `useState` / `useMemo` — 별도 라이브러리 없음 |
| DB | 없음 (전량 실시간 API 호출 + 서버 인메모리 캐시) |
| 코드 규모 | 소스 ~918 LOC (7개 파일) |

### 파일 트리

```
meongnyang-map/
├── app/                          ← 프론트엔드 + 백엔드(Route Handler)
│   ├── layout.tsx                 루트 레이아웃 · 메타데이터 · 웹폰트
│   ├── page.tsx                   메인 화면 (Client Component) — 265줄, 사실상 유일한 페이지
│   ├── KakaoMap.tsx               카카오맵 래퍼 (Client Component)
│   ├── globals.css                전역 스타일 · 지도 핀 CSS · 애니메이션
│   ├── favicon.ico / fonts/
│   └── api/
│       ├── regions/route.ts       [백엔드] 시도·시군구 목록
│       └── places/route.ts        [백엔드] 장소 목록 + 동반조건 판정 데이터
├── lib/                          ← 서버·클라이언트 공용 도메인 로직
│   ├── kto.ts                     KTO API 클라이언트 (서버 전용)
│   ├── petTour.ts                 ★ 자연어 파서 + 판정 엔진 (서비스 핵심)
│   └── types.ts                   전 계층 공용 타입 정의
├── .env.local                    KTO_SERVICE_KEY / KTO_MOBILE_APP / NEXT_PUBLIC_KAKAO_MAP_KEY
├── .claude/launch.json           dev 서버 실행 설정 (npm run dev, port 3000)
├── next.config.mjs               빈 설정
├── tailwind.config.ts            설정만 존재
└── tsconfig.json                 경로 별칭 `@/*` → 프로젝트 루트
```

---

## 2. 전체 동작 흐름

```
[브라우저]                    [Next.js 서버]                   [외부 API]
    │                              │                              │
    │ ① 페이지 로드                │                              │
    │─────────────────────────────>│  layout.tsx → page.tsx       │
    │                              │                              │
    │ ② GET /api/regions           │                              │
    │─────────────────────────────>│──── ldongCode2 (1콜) ───────>│ 공공데이터포털
    │<──── 시도/시군구 269건 ──────│<──── (1h 메모리 캐시) ───────│
    │                              │                              │
    │ ③ GET /api/places?regnCd=11  │                              │
    │─────────────────────────────>│──── areaBasedList2 ×5 ──────>│ (타입별 병렬)
    │                              │──── detailPetTour2 ×N ──────>│ (동시 8개씩)
    │                              │     parseRules() 로 구조화    │
    │<──── Place[] (rules 포함) ───│<──── (5m 메모리 캐시) ───────│
    │                              │                              │
    │ ④ judge(rules, pet)          │                              │
    │    ─ 클라이언트에서 판정      │                              │
    │    ─ 🔴 불가는 지도에서 제외  │                              │
    │                              │                              │
    │ ⑤ Kakao Maps SDK 로드 ───────┼─────────────────────────────>│ dapi.kakao.com
    │    핀 렌더 · bounds 자동조정  │                              │
```

### 핵심 설계 결정

**판정은 클라이언트에서 한다.**
서버(`/api/places`)는 `parseRules()`까지만 수행해 **펫 프로필과 무관한 규칙 구조체(`PetRules`)** 를 내려주고,
`judge(rules, pet)`는 브라우저에서 실행된다.
덕분에 **프로필 전환(초코 ↔ 보리) 시 네트워크 호출 없이 즉시 전체 재판정**이 일어나며, `/api/places` 캐시 키도 지역 단위 하나로 단순해진다.

---

## 3. 백엔드

Next.js App Router의 **Route Handler**만 사용한다. 별도 서버 프로세스·DB·인증 없음.

### 3.1 `lib/kto.ts` — KTO API 클라이언트 (서버 전용)

`KorPetTourService2`의 모든 오퍼레이션을 감싸는 단일 `call()` 함수.

```
BASE = https://apis.data.go.kr/B551011/KorPetTourService2
```

| 처리 | 내용 |
|---|---|
| 인증키 | `decodeURIComponent(KTO_SERVICE_KEY)` — 포털 발급 키가 URL 인코딩 형태라 디코딩 필수 |
| 공통 파라미터 | `MobileOS=ETC`, `MobileApp`(운영계정 승인 요건이라 전 호출 고정), `_type=json` |
| 캐시 | `fetch(..., { cache: 'no-store' })` — Next fetch 캐시 우회, 캐싱은 라우트에서 직접 |
| 에러 처리 | 인증 실패·한도 초과는 JSON이 아닌 **XML**로 오므로 `<`로 시작하면 `<returnAuthMsg>`를 파싱해 throw |
| 빈 결과 | 0건일 때 `items`가 빈 문자열로 오는 케이스 방어 |
| 단일/배열 | `items.item`이 1건이면 객체, N건이면 배열 → 항상 배열로 정규화 |
| `ALL = 99999` | `numOfRows` 상한이 없어 타입당 1콜로 전량 수집 |

`CONTENT_TYPES`로 **12(관광지) · 14(문화시설) · 28(레포츠) · 32(숙박) · 39(음식점)** 5종만 다룬다.
15(행사)는 실데이터 0건, 38(쇼핑)은 8,647건이 약국·안경원 등 노이즈이고 조건 데이터가 0%라 제외.

### 3.2 `app/api/regions/route.ts` — 지역 목록

- `ldongCode2` + `lDongListYn=Y` → **시도·시군구 전체 조합 269건을 1콜**로 수신
- `lDongRegnCd` 기준으로 그룹핑해 `{ regions: [{ code, name, sigungu[] }] }` 형태로 반환
- **1시간 인메모리 memo** (모듈 스코프 단일 변수)
- 시도 목록은 개편되므로(예: 시도 12 = 전남광주통합특별시) **하드코딩하지 않는다**
- `dynamic = 'force-dynamic'`

### 3.3 `app/api/places/route.ts` — 장소 + 동반조건

가장 무거운 라우트. 쿼리: `?regnCd=<시도>&signguCd=<시군구, 선택>` (기본 `11` = 서울)

```
① areaBasedList2 × 5   콘텐츠 타입별 병렬 (Promise.all) — numOfRows=ALL 로 타입당 1콜
   └ 결과에 __cat(카테고리 한글명) 부착
② contenttypeid !== '38' 필터 (areaBasedList2는 쇼핑을 걸러주지 않음)
③ detailPetTour2 × N   장소별 상세 — pooled(rows, 8, …) 로 동시 8개 제한
   └ 개별 실패는 try/catch로 삼켜 null 처리 (한 곳 실패가 전체를 죽이지 않게)
④ parseRules(raw) 로 자연어 → PetRules 구조화
⑤ Place[] 로 정규화해 반환
```

| 요소 | 설명 |
|---|---|
| 캐시 | `Map<string, {at, data}>`, 키 `places:{regnCd}:{signguCd}`, **TTL 5분** — 개발 중 일 1,000건 한도 절약용. 짧게 두어 실시간 호출 원칙 유지 |
| 동시성 제어 | `pooled()` — 배치 8개씩 순차 `Promise.all` (외부 API 부하·한도 보호) |
| 응답 | `{ places: Place[], cached: boolean }` / 실패 시 `{ error, places: [] }` + 500 |

> ⚠️ 캐시는 프로세스 메모리라 서버리스 다중 인스턴스·재시작 시 유실된다. 또한 `detailPetTour2`가 장소 수만큼 호출되므로 **호출량이 지역 규모에 비례**한다(서울 전체 선택 시 수백~1,000+ 콜).

---

## 4. 판정 엔진 — `lib/petTour.ts` (서비스 핵심)

지정과제 6번이 지목한 문제의 원인은 **`detailPetTour2`가 주는 조건이 코드가 아니라 자연어 문장**이라는 점이다.
이 모듈이 그 모호함을 파싱해 판정으로 바꾼다. 서버·클라이언트 양쪽에서 쓰이며 함수 2개로 나뉜다.

### 4.1 `parseRules(raw: PetTourRaw) → PetRules` — 서버에서 실행

실측(417건) 채움률 기준으로 **상위 4개 필드만** 사용한다. 나머지 5개는 0~11%라 판정에 쓰지 않는다.

| 원본 필드 | 채움률 | 파싱 결과 |
|---|---:|---|
| `acmpyTypeCd` 동반구분 | 97% | `zone`: `'all'`(전구역) / `'partial'`(일부구역) / `'unknown'` |
| `acmpyPsblCpam` 동반가능동물 | 57% | `noPets`, `serviceDogOnly`, `maxKg`(정규식 `N kg 이하/미만`), `allowedSizes`(중소형견/중형견/소형견) |
| `acmpyNeedMtr` 동반시 필요사항 | 52% | `needs[]` — 콤마 split, `'기타'` 제거 |
| `etcAcmpyInfo` 기타 동반정보 | 51% | `notes[]` — 개행 또는 `- `로 split · 여기서 `zoneHint` 추출 |

파싱상 유의점:
- **`serviceDogOnly`**: `안내견` 포함 && `전 견종`/`모든 견종` 미포함일 때만 성립
- **`excludeDangerous`**: `"맹견의 경우 입마개 착용 필수"`는 배제가 아니므로, `맹견 … 제외/불가` 형태만 잡는다 (`acmpyPsblCpam` + `etcAcmpyInfo` 합쳐서 검사)
- **`notes` split**: 개행 없이 `- `만으로 이어지는 원문 대응
- **`completeness`**: 위 4필드 중 채워진 개수 → `4개 = A` / `2~3개 = B` / `0~1개 = C`

### 4.2 `judge(rules, pet) → Judgement` — 클라이언트에서 실행

```
rules 없음 → 🟡 cond ("동반 조건 정보가 등록되지 않은 장소예요")

[차단 조건 — 즉시 🔴 no 반환]
  noPets                        → "반려동물 동반 불가"
  serviceDogOnly                → "안내견만 동반 가능"
  maxKg 초과                    → "N kg 이하만 가능 (이름 Nkg)"
  allowedSizes 불일치           → "소형견만 가능 (대형견)"
  excludeDangerous && 맹견      → "맹견 동반 불가"

[조건부 요인 — 🟢 ok 에서 🟡 cond 로 강등]
  zone === 'partial'            → zoneHint 있으면 그 문장, 없으면 "공개된 구역 정보가 없어요"
  needs 중 입마개 → hasMuzzle 미보유 시 강등
  needs 중 케이지/이동장/가방 → hasCage 미보유 시 강등
  completeness === 'C'          → "등록된 조건 정보가 적어요 — 방문 전 전화 확인을 권해요"

체크가 하나도 없으면 → "별도 제한 조건이 등록돼 있지 않아요" (🟢)
```

**설계 원칙: 없는 정보를 지어내지 않는다.**
정보가 부족하면 판정을 추정하지 않고 `조건 정보 충실도 C등급`으로 표시한다.
(예: 광안리해수욕장은 `일부구역 동반가능`이지만 어느 구역인지 API에 없음 → 🟡)

### 4.3 보조 유틸

| 함수 | 역할 |
|---|---|
| `isDangerousBreed(breed)` | 법정 맹견 5종(도사·핏불·스태퍼드셔·로트와일러·아메리칸불리) 매칭, 공백 제거 후 부분일치 |
| `sizeOf(kg)` | `<10kg` 소형 / `<25kg` 중형 / 그 이상 대형 |

> 참고: 현재 `PETS` 상수가 하드코딩돼 있어 이 두 유틸은 정의만 되고 `page.tsx`에서 실호출되지 않는다. 사용자 프로필 입력 기능이 붙는 시점의 진입점이다.

---

## 5. 프론트엔드

### 5.1 `app/layout.tsx` — 서버 컴포넌트

메타데이터(`title`/`description`), `lang="ko"`, Google Fonts 프리커넥트 + **IBM Plex Sans KR**(본문) · **Jua**(로고·제목) 로드.

### 5.2 `app/page.tsx` — 메인 화면 (`'use client'`)

애플리케이션의 유일한 페이지이자 상태 소유자.

**상태**

| 그룹 | state |
|---|---|
| 데이터 | `regions`, `places`, `loading`, `error` |
| 필터 | `regnCd`(기본 `'11'`), `signguCd`, `cat`(기본 `'전체'`) |
| 사용자 | `petKey` — `'choco'`(말티즈 3.2kg, 케이지 O·입마개 X) ↔ `'bori'`(리트리버 28kg, 케이지 X·입마개 O) 토글 |
| 선택 | `selectedId` |

**데이터 흐름 (useEffect 2개)**
- 마운트 시 → `/api/regions`
- `[regnCd, signguCd]` 변경 시 → `/api/places` 재조회 + `selectedId` 초기화

**파생 데이터 (useMemo 체인)**
```
places
  └ judged   = places.map(p => ({...p, j: judge(p.rules, pet)}))   ← 판정 지점
      └ visible = judged.filter(j.status !== 'no')                  ← 🔴 제외
          └ inCat  = visible.filter(카테고리)                       → 지도로 전달
              └ sorted = inCat 정렬 (ok 우선)                       → 리스트로 전달
hiddenCount = judged.length - visible.length
okCount / condCount = visible 내 상태별 집계
```

> 지도는 `inCat`(미정렬), 리스트는 `sorted`(가능 순)를 받는다. `sel`(상세 패널 대상)은 `sorted`에서 찾으므로 리스트에 없는 항목은 상세가 열리지 않는다.

**레이아웃 (4영역, `height: 100vh` · `minWidth: 1100` 고정 — 데스크톱 전용)**

```
┌──────────────────────────────────────────────────────┐
│ header  로고 · 지역 select ×2 · 펫 프로필 토글 버튼    │
├──────────────────────────────────────────────────────┤
│ 필터바  카테고리 칩 6개 · "불가 N곳 숨김" 안내         │
├───────────────┬──────────────────────────────────────┤
│ aside 312px   │ 지도 (flex:1, position:relative)      │
│  결과 리스트   │  ├ <KakaoMap />                      │
│  · 카드마다    │  ├ 좌상단 판정 기준 배지              │
│    판정 배지   │  ├ 우하단 범례 (가능/조건부/불가)      │
│    + 대표 사유 │  └ 상세 패널 (선택 시, 330px, 슬라이드)│
└───────────────┴──────────────────────────────────────┘
```

**상세 패널 구성**: 대표 이미지(없으면 카테고리 이모지) → 제목 + 판정 배지 → 주소 → **입장 조건 체크리스트(펫 이름 기준, `✓/!/✕` + 색상)** → 충실도 등급 + 출처 → 현장 규정(`notes`) → 길찾기(`map.kakao.com/link/to/…`) · 전화 확인(미구현).

**스타일링 방식**: Tailwind 클래스가 아니라 **인라인 `style` 객체**를 쓰고, hover·애니메이션·지도 핀만 `globals.css`의 유틸 클래스(`.hov-accent`, `.hov-card`, `.btn-primary`, `.jua`, `.map-pin*`)로 처리한다.

### 5.3 `app/KakaoMap.tsx` — 지도 래퍼 (`'use client'`)

SDK를 `next/script`로 `afterInteractive` 로드 + `autoload=false` → `onLoad`에서 `kakao.maps.load()` 호출 후 `ready` 플래그.

| useEffect | 트리거 | 동작 |
|---|---|---|
| 지도 생성 | `[ready]` | 서울 중심(37.5665, 126.978) · level 8, `mapRef` 있으면 재생성 안 함 |
| 핀 렌더 | `[places, ready]` | 기존 오버레이 전부 `setMap(null)` → 좌표 있는 항목만 `CustomOverlay` 생성 → `map.setBounds(bounds, 60,60,60,360)`(좌측 패널 폭만큼 패딩) · 1건이면 level 5 |
| 선택 반영 | `[selectedId, places, ready]` | 핀에 `.on` 토글 · zIndex 20/1 · `panTo` |

**구현 디테일**
- 핀은 React가 아닌 **DOM 직접 생성**(`buildPin`) — 카카오 `CustomOverlay`가 DOM 엘리먼트를 요구
- 엘리먼트에 `_overlay`를 프로퍼티로 매달아 `pinsRef: Map<contentid, HTMLElement>`로 관리
- `selectRef`로 `onSelect`를 최신화해 **핀 재생성 없이 콜백만 갱신** (핀 렌더 effect의 의존성 오염 방지)
- 지도 컨테이너 `zIndex: 0` — 핀 z-index를 지도 안에 가둬 범례·상세 패널이 항상 위에 오게 함
- 핀 라벨은 평소 숨김, hover/선택 시에만 펼쳐 겹침 방지 (CSS `.map-pin-label`)

**폴백 2종**
- `NEXT_PUBLIC_KAKAO_MAP_KEY` 없음 → 키 설정 안내
- `Script onError` → 카카오 개발자센터에 현재 `origin` 도메인 등록 안내 (`origin`은 hydration 불일치를 피하려 `useEffect`에서 주입)

---

## 6. 타입 계약 — `lib/types.ts`

전 계층이 공유하는 단일 타입 소스.

```
PetTourRaw   detailPetTour2 원본 9필드 (contentid + 8개 자연어 필드)
     │ parseRules()  [서버]
     ▼
PetRules     zone · noPets · serviceDogOnly · maxKg · allowedSizes ·
             excludeDangerous · needs[] · notes[] · zoneHint · completeness · raw
     │ judge(rules, pet)  [클라이언트]
     ▼
Judgement    status('ok'|'cond'|'no') · why? · checks: Check[]{icon,color,text}

Place        contentid · contenttypeid · title · addr1 · mapx · mapy ·
             firstimage · cat · rules(PetRules|null)     ← API 응답 단위
Pet          key · name · breed · kg · emoji · size · sizeLabel ·
             hasCage · hasMuzzle · isDangerous            ← 판정 입력
```

`raw`를 `PetRules`에 그대로 보존해 두어 판정 근거를 원문까지 되짚을 수 있다.

---

## 7. 환경변수

| 변수 | 노출 | 용도 |
|---|---|---|
| `KTO_SERVICE_KEY` | 서버 전용 | 공공데이터포털 일반 인증키. URL 인코딩된 값 그대로 넣고 코드에서 디코딩 |
| `KTO_MOBILE_APP` | 서버 전용 | `MobileApp` 값. 전 호출 동일 유지 — 활용 통계 집계 기준이자 운영계정 승인 요건 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | **클라이언트 노출** | 카카오 JavaScript 키. 개발자센터에 서비스 도메인 등록 필요 |

`.env.local`은 `.gitignore`(`.env*.local`)로 제외된다.

---

## 8. 데이터 특성 요약

전체 9,693건 중 **실사용 1,046건**.

- 쇼핑(38) 8,647건은 약국·안경원·의원 등 노이즈 → 제외
- 행사(15)는 0건
- `locationBasedList2`는 서버가 쇼핑을 이미 제외하지만, `areaBasedList2`·`searchKeyword2`는 포함 → 코드에서 직접 필터링

---

## 9. 미구현 / 알려진 제약

| 구분 | 내용 |
|---|---|
| 기능 | 전화 확인 버튼 — 핸들러 없음 (`detailIntro2`의 타입별 `infocenter*` 연결 예정) |
| 기능 | 펫 프로필이 `PETS` 상수 2종 하드코딩 — 사용자 입력 미지원. 그로 인해 `isDangerousBreed()`·`sizeOf()`가 정의만 되고 미사용 |
| 기능 | 리뷰(Supabase) · 멍냥 커뮤니티 — README 로드맵 상 미착수 |
| UI | `minWidth: 1100` 고정 — 반응형/모바일 미대응 |
| 성능 | `/api/places`가 `detailPetTour2`를 장소 수만큼 호출 → 광역 지역 선택 시 응답 지연 + 일 1,000건 한도 압박 |
| 인프라 | 캐시가 프로세스 인메모리 → 서버리스 다중 인스턴스/재시작 시 유실 |
| 인프라 | 배포 및 운영계정 신청(일 1,000 → 100,000건) 미완 |
| 문서 | README가 참조하는 `../PET_API_GUIDE.md`, `../API USING GUIDE.md`, `../PET API 실행결과.md` 는 현재 리포지토리에 존재하지 않음 |
| 환경 | 이 머신에서 Next.js 첫 부팅이 매우 느림(수 분). `lsof -nP -iTCP:3000 -sTCP:LISTEN` 으로 포트 확인 |

---

## 10. 실행

```bash
npm run dev
```

| 스크립트 | 동작 |
|---|---|
| `npm run dev` | 개발 서버 (port 3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 프로덕션 서버 |
| `npm run lint` | `next lint` |
