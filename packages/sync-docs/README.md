# sync-docs

문서를 일일이 복사-붙여넣기 하는 대신, `.claude/docs/`를 항상 최신 원본
(FastAPI OpenAPI + 공개 Notion 페이지)과 동기화된 상태로 유지합니다. 원본이
바뀌면 이 폴더의 내용도 따라서 갱신됩니다. Claude Code 세션 시작 시 자동으로
실행되며(분리 실행, 스로틀 적용), `/sync-docs`로 필요할 때 직접 실행할 수도
있습니다.

| 소스 | 대상 | 방식 |
|---|---|---|
| FastAPI OpenAPI | `.claude/docs/api.json` | `<base>/openapi.json` 가져오기 |
| 공개 Notion 페이지 | `.claude/docs/*.md` | `notion-client`(토큰 불필요) → 마크다운 |

## 실행 시점

- **자동** — Claude Code 세션 시작 시. `SessionStart` 훅이
  `sync-docs-hook.mjs`를 호출하고, 이 훅은 동기화를 **분리(detached)** 상태로
  실행한 뒤 즉시 반환합니다 — 세션이 절대 차단되지 않습니다. 백그라운드 작업은
  `DOCS_SYNC_INTERVAL_HOURS`(기본값 `6`)마다 한 번씩만 실행되도록 스스로
  스로틀하며, `.claude/.docs-sync.log`에 로그를 남깁니다.
- **수동 실행**(포그라운드, 전체 보고서): `/sync-docs` 슬래시 명령 또는
  `npm run sync:docs:force`. `--force`는 스로틀을 무시합니다.

## 설치

Claude Code를 사용하는 프로젝트에 파일을 넣으세요.

```
your-project/
├── .claude/
│   ├── commands/sync-docs.md       ← commands/ 에서
│   └── settings.local.json         ← examples/settings.snippet.json 병합
└── scripts/                        ← scripts/ 에서
    ├── sync-docs.mjs
    ├── sync-docs-hook.mjs
    ├── sync-api-docs.mjs
    ├── sync-notion-docs.mjs
    ├── notion-md.mjs
    └── lib.mjs
```

1. [commands/sync-docs.md](commands/sync-docs.md) → `<project>/.claude/commands/sync-docs.md` 복사
2. [scripts/](scripts/) 안의 모든 파일 → `<project>/scripts/` 복사
3. [examples/settings.snippet.json](examples/settings.snippet.json)을
   `<project>/.claude/settings.local.json`에 병합( `hooks.SessionStart` 블록만).
4. [examples/package.snippet.json](examples/package.snippet.json)을 프로젝트의
   `package.json`에 병합(devDependencies + npm 스크립트)한 뒤 `npm install`.
5. 환경 변수 설정 — [examples/env.example](examples/env.example)의 값을
   `.env` / `.env.local`에 복사.
6. (Notion만 해당) [examples/notion-docs.config.example.json](examples/notion-docs.config.example.json)
   → `<project>/scripts/notion-docs.config.json`으로 복사하고 페이지 ID를 채웁니다.

두 동기화 모두 설정되지 않은 경우 **깔끔하게 건너뜁니다** — API 쪽만, Notion
쪽만, 또는 둘 다 설치할 수 있습니다.

## 설정

### API 동기화

스펙 URL은 다음 순서로 결정됩니다:

1. `API_DOCS_URL` — OpenAPI JSON의 전체 URL(설정되어 있으면 우선).
2. `API_BASE_URL` — `<base>/openapi.json`.
3. `REACT_APP_BASE_URL` — 동일하게 처리, 기존 `.env`에서 가져옴.

아무것도 설정되지 않으면 API 단계는 건너뜁니다(오류 아님). 백엔드가 LAN 전용
IP에 있는 경우, 네트워크 밖에 있을 때는 기존 `api.json`을 그대로 유지합니다.

### Notion 동기화

토큰이 필요 없습니다 — `notion-client`가 익명으로 읽을 수 있도록 페이지가
**웹에 게시(published to web)**되어 있어야 합니다.

`scripts/notion-docs.config.json`은 페이지 ID → 출력 파일명을 매핑합니다:

```json
{
  "pages": [
    { "pageId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "output": "구독 관리 화면.md" },
    { "pageId": "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy", "output": "결제 화면.md" }
  ]
}
```

`pageId`는 페이지 URL에 있는 32자리 16진수 id입니다(Notion에서 페이지 열기 →
링크 복사). `output`은 `.claude/docs/` 아래에 기록되는 파일명입니다.

### 튜닝

- `DOCS_SYNC_INTERVAL_HOURS`(기본값 `6`) — 백그라운드 스로틀 윈도우.

## 동작 / 주의사항

- **비공식 Notion API + 속도 제한.** 재시도 + 지수 백오프로 직렬 동기화합니다.
  그래도 Notion은 전체 실행마다 임의의 페이지 1개 정도에서 429를 반환하며,
  해당 페이지는 다음 주기에 처리됩니다(최종 일관성).
- 본문 텍스트가 없는 **컨테이너 페이지**는 오류가 아니라
  `skipped (no body)`로 보고됩니다.
- 변환기(`notion-md.mjs`)는 헤더, 리스트, 할 일, 토글, 인용구, 콜아웃, 코드,
  구분선, 이미지, 컬럼을 지원합니다. 특수 블록(테이블, 임베드, 하위 DB)은 일반
  텍스트로 격하되거나 건너뜁니다 — 이런 블록에 의존하는 페이지는 직접
  확인하세요.
- 모든 스크립트는 항상 `0`으로 종료합니다. 동기화 실패가 Claude 세션을 절대
  차단해서는 안 됩니다.

## 파일

| 파일 | 용도 |
|---|---|
| `scripts/sync-docs.mjs` | 오케스트레이터. 스로틀 상태를 읽고 API + Notion을 병렬 실행. |
| `scripts/sync-docs-hook.mjs` | `SessionStart` 진입점. `sync-docs.mjs`를 분리 실행으로 띄움. |
| `scripts/sync-api-docs.mjs` | OpenAPI 스펙 가져오기 → `.claude/docs/api.json`. |
| `scripts/sync-notion-docs.mjs` | `notion-docs.config.json`을 읽어 `.claude/docs/*.md` 작성. |
| `scripts/notion-md.mjs` | Notion recordMap → 마크다운 변환기. |
| `scripts/lib.mjs` | 공용 헬퍼(env 로드, 스로틀 상태, 변경 시에만 쓰기). |
| `commands/sync-docs.md` | `/sync-docs` 슬래시 명령(포그라운드 전체 보고서 실행). |
