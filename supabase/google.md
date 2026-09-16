# 구글 로그인 — Supabase 내장 Google provider

카카오와 달리 우회가 필요 없다. 내장 provider 가 요청하는 `openid email profile` 은
구글에서 민감하지 않은 범위라 앱 검수 없이 쓴다. 코드는 `signIn('google')` →
`signInWithOAuth({ provider: 'google' })` (lib/usePets.ts) 이며 콜백·작성자 표시는 카카오와 같은 길을 탄다.
서비스는 이메일을 쓰지 않는다 — 이름·사진만 스냅샷한다.

## Google Cloud Console (console.cloud.google.com)

프로젝트 `meongnyangmap` (동의 화면의 앱 이름이 프로젝트 단위라 따로 만든다).

1. **API 및 서비스 → OAuth 동의 화면** (새 UI: Google 인증 플랫폼 → 시작하기)
   - 앱 이름 `멍냥맵`, 사용자 지원 이메일, 대상 **외부**, 연락처 이메일
   - **브랜딩 → 승인된 도메인**: `yxipzdcyqzeuieisylgx.supabase.co` (리디렉션 URI 의 도메인이라 필수)
   - **대상 → 앱 게시** → 프로덕션. 테스트 상태로 두면 등록한 테스트 사용자만 로그인된다
2. **클라이언트 → 클라이언트 만들기** — 유형 **웹 애플리케이션**
   - 승인된 JavaScript 원본: `https://meongnyangmap.vercel.app`, `http://localhost:3000`
   - 승인된 리디렉션 URI: `https://yxipzdcyqzeuieisylgx.supabase.co/auth/v1/callback`
   - 만들기 직후 뜨는 **클라이언트 ID · 클라이언트 보안 비밀**을 복사 (보안 비밀은 창을 닫으면 다시 못 본다)

## Supabase 대시보드 (Authentication → Providers → Google)

Enable ON → Client IDs 에 클라이언트 ID, Client Secret 에 보안 비밀 → Save.
Skip nonce check 는 끈 채로 둔다.

**URL Configuration → Redirect URLs** 에 `https://meongnyangmap.vercel.app/auth/callback`,
`http://localhost:3000/auth/callback` 이 있어야 한다 (카카오 때 넣은 것과 같다).

## 확인

로컬에서 로그인 → 구글 → 계정 선택창(`prompt=select_account`) → `/auth/callback` → 헤더에 이름과 G 마크.
댓글·리뷰를 쓰면 작성자 줄에 "구글 계정" 마크가 붙는다. 그다음 라이브에서 같은 순서로.

동의 화면에는 "yxipzdcyqzeuieisylgx.supabase.co(으)로 이동"이라고 Supabase 주소가 보인다.
카카오도 같은 구조다. 바꾸려면 Supabase 커스텀 도메인(유료)이 필요하다.

키(클라이언트 ID·보안 비밀)는 저장소·문서에 적지 않는다 — Supabase 대시보드에만 있다.
