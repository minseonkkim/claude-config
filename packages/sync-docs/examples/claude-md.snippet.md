<!--
  Merge into <project>/CLAUDE.md. Without this guidance, Claude has no idea
  the synced docs exist or how to use them efficiently — and will try to read
  the full (very large) OpenAPI spec into context.

  Fill in the placeholders marked {{...}} for your project. Delete sections
  you don't use (e.g. drop "화면 명세" if you only sync API).
-->

## 백엔드 API 스펙

백엔드 API는 **OpenAPI 3.1 스펙**으로 관리됨: `.claude/docs/api.json`
({{프레임워크 예: FastAPI}}, 큰 파일)

> ⚠️ 파일이 크므로 전체를 읽지 말 것. API 연동/호출 작업 시 아래 태그로 해당
> 엔드포인트를 `grep`(예: `"tags": ["{{TagName}}"]`)으로 찾은 뒤, 그 주변
> `paths`/`schemas` 블록만 부분적으로 읽어서 확인할 것.

사용 가능한 API 태그(도메인):

| 태그 | 영역 |
|---|---|
| {{Tag1, Tag2}} | {{도메인 설명}} |
| {{Tag3}} | {{도메인 설명}} |

## 화면 명세 문서

각 화면 명세는 `.claude/docs/*.md` 참고 (예: `{{예시 파일명.md}}`).
