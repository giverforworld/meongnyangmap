# 멍냥맵

우리 아이 기준으로 반려동물 동반 입장 가능 여부를 판정해 헛걸음을 막아주는 서비스.
2026 관광데이터 활용 공모전 웹·앱 구현 부문 · 지정과제 6번.

- 배포: https://meongnyangmap.vercel.app
- 전체 구조는 **[ARCHITECTURE.md](ARCHITECTURE.md)** 에 있다. 이 문서는 시작하는 데 필요한 것만 담는다.
- 작업 규칙은 [CLAUDE.md](CLAUDE.md).

출처: ⓒ한국관광공사

## 실행

```bash
npm install
npm run dev
```

`.env.local` 이 필요하다 — 아래 [환경변수](#환경변수) 참고.

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm test` | 판정 엔진 테스트 133개 |
| `npm run collect` | 데이터 수집 → `data/*.json` (GitHub Actions 가 매일 03:00 KST 자동 실행) |

## 구조

```
lib/
  kto.ts        한국관광공사 OpenAPI 클라이언트 (서버 전용)
  petTour.ts    자연어 조건 파서 + 판정 엔진   ← 서비스의 핵심
  camping.ts    캠핑장 판정 (animalCmgCl 기반)
  curate.ts     핫플레이스 선별 + 지역 방문자 순위
  catalog.ts    전국 장소 목록 (파일 우선, 사흘 넘으면 실시간)
  pets.ts       판정 기준이 되는 반려동물 프로필
app/
  page.tsx      멍냥맵 지도 (필터 / 목록 / 지도 / 상세 패널)
  hotplace/     핫플레이스 · 캠핑 (중메뉴)
  community/    커뮤니티 (Supabase)
  api/          서버 라우트 — 아래 표 참고
data/           배치가 받아둔 스냅샷. 빌드에 포함된다
scripts/
  collect.mts   일 배치 — data/*.json 을 채운다
  seed.mts      Supabase 적재용. 현재 서비스 경로와 무관한 보조 스크립트
```

## 판정 엔진

`detailPetTour2` 가 주는 조건은 코드가 아니라 **자연어 문장**이다.
이 모호함이 지정과제 6번이 지목한 문제의 원인이므로, 파싱해서 판정으로 바꾸는 것이 서비스의 핵심이다.

```
acmpyTypeCd    "일부구역 동반가능"
acmpyPsblCpam  "5kg 이하 동반 가능(이동장 이용 필수)"
acmpyNeedMtr   "목줄 착용,반려동물 유모차 탑승,이동장(켄넬)사용"
```

`parseRules()` 로 구조화하고 `judge()` 가 프로필과 대조해 세 색으로 답한다.
근거는 반드시 원문에서 나온 것만 쓴다 — 확인 못 한 것을 초록으로 찍으면
사용자가 준비 없이 출발한다.

| 판정 | 화면 |
|---|---|
| `ok` | ○ 입장 가능 |
| `cond` | ✓ 조건부 가능 |
| `no` | 목록에서 숨김 (숫자로만 알림) |

## 사용 API

**실제로 호출하는 것만 적는다.** 주최측이 인증키로 호출 내역을 검증한다.

### 화면이 직접 부르는 것 (`app/api/`)

| 오퍼레이션 | 서비스 | 어디서 | 캐시 |
|---|---|---|---|
| `ldongCode2` | KorPetTourService2 | `/api/regions` — 시도·시군구 | 1시간 |
| `lclsSystmCode2` | KorPetTourService2 | `/api/categories` — 분류체계 이름표 | 24시간 |
| `petTourSyncList2` | KorPetTourService2 | `/api/places` — 파일이 사흘 넘었을 때만 | 6시간 |
| `detailPetTour2` | KorPetTourService2 | `/api/pet-rules` — 파일에 없는 장소만 | 30분 |
| `detailCommon2` `detailIntro2` `detailInfo2` `detailImage2` | KorPetTourService2 | `/api/detail` — 파일에 없는 장소만 | 24시간 |

전량 수집이 끝난 뒤로 `detailPetTour2` 와 `detail*` 은 평소 호출이 없다. 파일에서 나온다.

### 일 배치가 부르는 것 (`scripts/collect.mts`)

| 오퍼레이션 | 서비스 | 받는 것 |
|---|---|---|
| `petTourSyncList2` | KorPetTourService2 | 전국 장소 9,690곳 (1콜) |
| `detailPetTour2` | KorPetTourService2 | 동반 조건 — 새 장소만 |
| `detailCommon2` `detailIntro2` `detailInfo2` `detailImage2` | KorPetTourService2 | 상세 — 새 장소만 (곳당 4콜) |
| `basedList` | GoCamping | 캠핑장 3,115곳 (1콜) |
| `locgoRegnVisitrDDList` | DataLabService | 시군구별 방문자 수 30일치 (1콜) |

### 쓰지 않는 것

`areaBasedList2` · `searchKeyword2` · `locationBasedList2` · `areaCode2` · `categoryCode2` 는
현재 서비스 경로에서 호출하지 않는다. (`areaCode2` · `categoryCode2` 는 `scripts/seed.mts`
에만 남아 있고, 이 스크립트는 화면·배치와 무관한 보조 도구다.)

## 데이터

`data/` 는 배치가 받아둔 스냅샷이고 빌드에 포함된다. 배포 후에는 서버에서 고칠 수 없어,
GitHub Actions 가 매일 새로 받아 커밋하고 그 커밋이 재배포를 부른다.
배치가 사흘 넘게 멈추면 `lib/catalog.ts` 가 실시간 조회로 넘어간다.

| 파일 | 건수 | 내용 |
|---|---:|---|
| `places.json` | 9,690 | 전국 장소 |
| `petRules.json` | 9,690 | 동반 조건 (조건 있는 곳 9,683) |
| `details.json` | 9,691 | 영업시간·휴무·전화·소개글·사진 |
| `camping.json` | 3,115 | 캠핑장 (반려동물 가능 1,128) |
| `visitors.json` | 269 | 시군구 방문자 순위 |

## 환경변수

`.env.local` — git 에 올라가지 않는다.

| 이름 | 쓰임 |
|---|---|
| `KTO_SERVICE_KEY` | 한국관광공사 OpenAPI 인증키(인코딩키). **서버 전용** |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오맵 JavaScript 키. 브라우저로 나간다 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 커뮤니티. RLS 우회 키라 **서버 전용** |

`KTO_MOBILE_APP` 은 선택 (기본값 `MeongNyangPass`).

배포 환경(Vercel)은 대시보드의 Environment Variables 에 같은 값을 넣어야 한다.
GitHub Actions 는 `KTO_SERVICE_KEY` 를 리포지토리 시크릿으로 읽는다.

## 지켜야 할 것

1. **사용자 위치를 서버로 보내지 않는다** — 전송 자체가 위치기반서비스사업자 신고 대상
2. **없는 데이터를 지어내지 않는다** — 방문자수·평점·리뷰는 이 API 에 없다
3. **출처 ⓒ한국관광공사 표기** — 화면·문서 양쪽. Type3 이미지는 변경 금지
4. **커밋은 `feature/kim`** — 자세한 것은 [CLAUDE.md](CLAUDE.md)
