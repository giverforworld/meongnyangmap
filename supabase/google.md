# 구글 로그인 — GIS 버튼 + Supabase signInWithIdToken

## 흐름

구글이 그리는 "Google 계정으로 로그인" 버튼(Google Identity Services)을 우리 페이지에 놓고,
팝업에서 계정을 고르면 받은 **ID 토큰**을 `supabase.auth.signInWithIdToken({ provider: 'google' })`
에 넘겨 세션을 만든다 (app/GoogleButton.tsx · lib/googleSignIn.ts). 페이지를 떠나지 않는다.

리디렉션 방식(`signInWithOAuth`)을 안 쓰는 이유: 구글은 브랜드 인증을 받지 않은 앱엔
동의 화면에 앱 이름 대신 **리디렉션 도메인**을 보여줘서
"yxipzdcyqzeuieisylgx.supabase.co(으)로 이동"이라고 Supabase 주소가 떴다.
GIS 팝업은 우리 페이지에서 열리므로 `meongnyangmap.vercel.app` 이 뜬다.
리디렉션 방식은 `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 가 없을 때의 대체 경로로만 남아 있다.

nonce: 브라우저가 난수를 만들어 **SHA-256 해시를 구글에**, **원문을 Supabase 에** 준다.
Supabase 가 원문을 해시해 토큰 안의 값과 맞춰 본다 — 가로챈 토큰을 못 쓴다.

내장 provider 가 요청하는 `openid email profile` 은 민감하지 않은 범위라 앱 검수 없이 쓴다.
서비스는 이메일을 쓰지 않는다 — 이름·사진만 스냅샷한다.

## 환경변수

| 이름 | 어디에 | 값 |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `.env.local` · Vercel(Production·Preview·Development) | 아래 2 의 **클라이언트 ID** (`…apps.googleusercontent.com`) |

클라이언트 ID 는 공개값이다 — 모든 브라우저에 그대로 내려간다. **클라이언트 보안 비밀은 넣지 않는다**
(그건 Supabase 대시보드에만). Vercel 에 넣은 뒤엔 재배포가 필요하다.

## Google Cloud Console (console.cloud.google.com)

프로젝트 `meongnyangmap` (동의 화면의 앱 이름이 프로젝트 단위라 따로 만든다).

1. **API 및 서비스 → OAuth 동의 화면** (새 UI: Google 인증 플랫폼 → 시작하기)
   - 앱 이름 `멍냥맵`, 사용자 지원 이메일, 대상 **외부**, 연락처 이메일
   - **브랜딩 → 승인된 도메인**: `yxipzdcyqzeuieisylgx.supabase.co` (리디렉션 URI 의 도메인이라 필수)
   - **대상 → 앱 게시** → 프로덕션. 테스트 상태로 두면 등록한 테스트 사용자만 로그인된다
2. **클라이언트 → 클라이언트 만들기** — 유형 **웹 애플리케이션**
   - 승인된 JavaScript 원본: `https://meongnyangmap.vercel.app`, `http://localhost:3000`, `http://localhost`
     (GIS 버튼은 이 원본 목록으로 페이지를 검사한다. 로컬은 포트 있는 것과 없는 것 둘 다 넣으라는 게 구글 안내)
   - 승인된 리디렉션 URI: `https://yxipzdcyqzeuieisylgx.supabase.co/auth/v1/callback`
   - 만들기 직후 뜨는 **클라이언트 ID · 클라이언트 보안 비밀**을 복사 (보안 비밀은 창을 닫으면 다시 못 본다)

## Supabase 대시보드 (Authentication → Providers → Google)

Enable ON → Client IDs 에 클라이언트 ID, Client Secret 에 보안 비밀 → Save.
Skip nonce check 는 끈 채로 둔다.

**URL Configuration → Redirect URLs** 에 `https://meongnyangmap.vercel.app/auth/callback`,
`http://localhost:3000/auth/callback` 이 있어야 한다 (카카오 때 넣은 것과 같다).

## 확인

로컬에서 로그인 → "Google 계정으로 로그인" → 팝업에서 계정 선택 → 팝업이 닫히고 헤더에 이름과 G 마크.
댓글·리뷰를 쓰면 작성자 줄에 "구글 계정" 마크가 붙는다. 그다음 라이브에서 같은 순서로.

앱 게시 상태가 "테스트 중"이면 **테스트 사용자로 등록한 계정만** 로그인된다. 심사 전에 대상 → 앱 게시.
동의 화면에 "멍냥맵"이라는 이름까지 띄우려면 구글 브랜드 인증(홈페이지·개인정보처리방침·Search Console)이 따로 필요하다.

키(클라이언트 ID·보안 비밀)는 저장소·문서에 적지 않는다 — Supabase 대시보드에만 있다.
