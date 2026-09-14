# 카카오 로그인 — Supabase 커스텀 OIDC provider 로 붙이기

## 왜 내장 Kakao provider 를 안 쓰나

Supabase 내장 Kakao provider 는 항상 `account_email` 을 요청한다
(우리 프로젝트의 `/auth/v1/authorize?provider=kakao` 가 실제로
`scope=account_email profile_image profile_nickname` 으로 넘어가는 것을 확인함).
카카오는 이메일 동의항목을 **비즈 앱**(사업자 정보 심사, 영업일 3~5일)에서만 켤 수 있어
일반 앱은 `KOE205 (설정하지 않은 동의 항목: account_email)` 로 막힌다.

커스텀 OIDC provider 는 scope 를 우리가 정하므로 이메일 없이 닉네임·사진만 받는다.
서비스는 이메일을 쓰지 않는다 — `pets.user_id` 만 있으면 된다.

## 카카오 개발자 콘솔 (developers.kakao.com → 멍냥맵)

1. **카카오 로그인 → 일반**: 활성화 ON. **OpenID Connect 활성화 ON**.
2. **카카오 로그인 → 일반 → Redirect URI**:
   `https://yxipzdcyqzeuieisylgx.supabase.co/auth/v1/callback`
   (Supabase 에서 provider 만들 때 화면에 뜨는 Callback URL 과 같은지 확인)
3. **카카오 로그인 → 보안 → Client Secret**: 코드 발급, 활성화 ON. 이 값이 Client Secret.
4. **카카오 로그인 → 동의항목**: 닉네임 · 프로필 사진만 설정돼 있으면 됨. 이메일은 건드리지 않는다.

## Supabase 대시보드 (Authentication → Providers)

**New Provider** → 구성 방식 **Auto-discovery (OIDC)**

| 항목 | 값 |
|---|---|
| Identifier | `custom:kakao` (코드가 이 이름을 쓴다 — lib/usePets.ts) |
| Name | 카카오 |
| Client ID | 카카오 **REST API 키** |
| Client Secret | 위 3 의 Client Secret |
| Issuer URL | `https://kauth.kakao.com` |
| Scopes | `openid`, `profile_nickname`, `profile_image` — **account_email 넣지 않기** |
| Email optional | **ON** (이메일 없이 가입 허용) |

Create and enable provider.

대시보드에 Scopes · Email optional 칸이 안 보이면 provider 를 만든 뒤 ⋮ → Update 에서 찾거나,
관리 API 로 넣는다 (`supabase.auth.admin.customProviders.updateProvider`).

## 확인

```
curl -s -o /dev/null -w '%{redirect_url}\n' \
  'https://yxipzdcyqzeuieisylgx.supabase.co/auth/v1/authorize?provider=custom:kakao&redirect_to=https://meongnyangmap.vercel.app/auth/callback' \
  -H 'apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>'
```

`kauth.kakao.com/oauth/authorize?...&scope=openid profile_nickname profile_image` 로 가면 된 것.
`account_email` 이 보이면 아직 내장 provider 다.

## 기존 내장 Kakao provider

끄지 않아도 되지만 헷갈리니 Authentication → Providers → Kakao → Enabled OFF 권장.
