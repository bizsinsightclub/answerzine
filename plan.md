# 개발 계획 — 카테고리(그룹)별 해석 생성기 추가

## 배경 · 문제

보드에는 세 층위의 해석이 있(었)다.
- **항목별 이유** — `runCategory`(→`buildReasonPrompt`) 로 claude -p 실시간 생성 ✅
- **전체 해석(토플라인, "이번 주 한 줄")** — `makeTopline`(→`buildToplinePrompt`) 로 실시간 생성 ✅
- **카테고리(그룹)별 해석("카테고리 해석" 카드, `readsEl`/`GROUP_READS`)** — **원래부터 미리 써 둔 데모 텍스트였고 생성기가 없었다.** 2026-09-08 데모 텍스트를 비우면서(런타임 생성 구조로 전환) 이 카드가 사라졌다.

이 계획은 세 번째를 이유·토플라인과 **동일하게 구독제 `claude -p` 로 실시간 생성**하도록 되살린다.

## 목표

"분석하기" 로 항목 이유가 채워진 뒤, **그룹(음악/영화/OTT/유튜브/TV/공연·전시/출판·웹툰/앱·게임/패션)마다 "무엇이 돈이 되나"를 광고대행사(제일기획 기획자) 시점으로 쓴 해석**을 자동 생성해 `readsEl` 카드에 표시한다. 카드=헤드라인, 호버 시 팝업=요약·포인트·키워드.

## 데이터 계약 (기존 UI 필드 그대로 — `board.mjs` `readsEl`/`readPopEl` 이 읽는 형태)

```
GROUP_READS item = {
  group:    string,     // 그룹 이름 (예: "음악") — 코드가 채움
  headline: string,     // 카드용 짧은 명사구
  popHead:  string,     // 팝업 제목
  summary:  string,     // 팝업 2~3문장
  points:   string[],   // 팝업 "무엇이 돈이 되나" 실행 포인트 3~5개
  keywords: string[]    // 팝업 키워드
}
```

## 변경 파일 · 작업

### 1. `app/public/js/prompts.mjs` — 프롬프트 빌더 추가
`buildGroupReadsPrompt(week, groupLabel, cats, itemsByCat)` 신규 export.
- **입력**: 그룹 라벨, 그 그룹의 카테고리 목록, 각 카테고리 TOP10 항목 + (있으면) 이미 생성된 항목 이유의 headline·keywords.
- **지시**: 그룹 전체를 가로질러 "이번 주 이 판에서 무엇이 돈이 되나"를 읽는다. `headline`(카드용 명사구), `popHead`, `summary`(2~3문장), `points`(3~5개 실행 포인트), `keywords` 를 담은 **JSON 객체 하나만** 출력.
- **원칙 준수(CLAUDE.md)**: §2 태도의 이동을 읽음 / §8 상투어(진정성·공감·소통 등)·세대론·없는 수치·순위 재매김 금지 / §9 표현 경계. 순위·항목 텍스트 불변.
- 시스템 프롬프트(도구·웹검색 차단)는 `server.mjs` 가 이미 `--system-prompt` 로 붙이므로 여기선 사용자 프롬프트만.

### 2. `app/public/js/state.mjs` — 상태·리듀서
- `makeInitialState` 에 `groupReads: []`, `groupReadsStatus: "idle"` 추가. `loadPersisted` 로 복원, 저장 effect(현재 items/topline 저장하는 곳)에 `groupReads` 포함.
- 리듀서 액션:
  - `GROUP_READS_LOADING` → status "loading"
  - `GROUP_READS_APPLY {read}` → `groupReads` 에 해당 group 항목을 병합(있으면 교체), 마지막이면 status "done"
- 이미 생성된 group 해석은 다시 부르지 않는다(항목 이유 규칙과 동일).
- 데이터 스키마가 바뀌므로 `STORAGE_KEY` v20 → **v21**.

### 3. `app/public/js/board.mjs` (App) — 실행·배선
- `runGroupReads()`: `groupPlan.groups`(또는 `CATEGORY_GROUPS`) 순회 → 그룹마다 그 그룹 카테고리의 items(+reason) 모아 `buildGroupReadsPrompt` → `sampleFn.json(...)` → `GROUP_READS_APPLY` dispatch. 동시성은 서버 게이트(`TREND_CONCURRENCY`)가 처리.
- **트리거**: `runAnalysis` 가 항목 이유를 채운 뒤 `makeTopline` 과 함께 `runGroupReads` 를 자동 호출(별도 클릭 없이 파리티). 그룹 카드에 로딩 스켈레톤 표시.
- `readsEl` / `readPopG` 가 상수 `GROUP_READS` 대신 **`state.groupReads`** 를 읽도록 교체(길이 가드·`readPop.idx` 인덱싱 포함).

### 4. `app/public/js/data.mjs`
- `GROUP_READS = []` 유지(시드만). 실데이터는 `state.groupReads`.

## 검증 (end-to-end)
- 각 모듈 `node --check`.
- `cd app && node server.mjs` → `week37.xlsx` 업로드 → "분석하기" → 항목 이유 → 토플라인 → **그룹별 해석 순차 생성**. "카테고리 해석" 카드에 그룹 헤드라인, 호버 시 팝업(요약·포인트·키워드) 확인.
- Playwright: 렌더 0 에러, `/api/sample` 왕복, 라이트/다크.
- 순위·항목 텍스트 원본 대조(불변). 프롬프트에 §8 금지어·없는 수치 금지 명시했는지 확인.

## 비용 · 시간
- 그룹 ~9개 × `claude -p`(구독제) → 분석 시간 **+1~2분**. 부담되면 자동 호출 대신 **"카테고리 해석 생성" 버튼**으로 opt-in 전환(1줄 조건 변경).

## 범위 밖
- 그룹 하위의 개별 카테고리 단위까지 쪼갠 해석(지금은 상위 그룹 단위). 필요 시 후속.
- 생성 결과의 파일 영속화(현재는 브라우저 localStorage). 공유/호스팅과 함께 후속.
