# runs/ — 에이전트가 남기는 작업 기록

에이전트가 이번 주에 뭘 했는지 적어두는 곳입니다. **한 주에 파일 하나** (`YYYY-wNN.json`).

`tools/dashboard.html`이 이 파일들을 읽어서 진행 상황을 그려줍니다.

`issues/`가 **완성된 결과물**이라면 여기는 **과정**입니다.
떨어뜨린 후보와 그 이유가 여기 남습니다.

---

## 파일 생김새

```json
{
  "week": "2026-w32",
  "range": "2026.08.04 – 08.10",
  "status": "in_progress",
  "candidates": [ ],
  "verdicts": [ ],
  "stages": [ ]
}
```

| 항목 | 무엇인가요 |
|---|---|
| `week` | 몇 년 몇 주차인지. 파일 이름과 같아야 합니다 |
| `status` | `in_progress`(진행 중) / `done`(완료) / `blocked`(막힘) |
| `candidates` | `az-scout`이 찾은 후보들과 점수 |
| `verdicts` | `az-verify`의 통과·탈락 판정 |
| `stages` | 에이전트 다섯이 각자 남기는 작업 기록 |

---

## 세 배열이 각각 담는 것

### `candidates` — az-scout이 채웁니다

찾은 후보와 3조건 점수가 들어갑니다.

```json
{
  "domain": "book",
  "title": "후보 이름",
  "metric": { "label": "주간 판매량 지수", "value": "+326.5%", "trend": [98,101,100,426] },
  "sourceUrl": "https://…",
  "anchorDate": "2026-07-23",
  "anchorSourceUrl": "https://…",
  "cause": "왜 팔렸는지 한 문장",
  "score": { "anomaly": 2, "cause": 2, "verify": 2, "total": 6 },
  "scoreReason": "이 점수를 준 근거",
  "recommended": true
}
```

떨어뜨린 후보도 같은 배열에 넣되 `"recommended": false`와 `"rejectReason"`을 함께 적습니다.
**왜 버렸는지가 다음 주에 쓸모 있는 자산이 됩니다.**

### `verdicts` — az-verify가 채웁니다

```json
{
  "domain": "book",
  "candidate": "후보 이름",
  "verdict": "pass",
  "checks": { "sourceTier": {"ok":true,"detail":"…"}, "…": {} },
  "failedOn": [],
  "rebuttalAttempted": "뭘로 떨어뜨려 보려 했고 왜 실패했는지"
}
```

판정은 `pass` 아니면 `fail` 둘뿐입니다. **"아마도"나 "조건부" 같은 중간값은 없습니다.**

### `stages` — 에이전트 다섯이 모두 남깁니다

```json
{
  "stage": "S1+S2",
  "agent": "az-scout",
  "domain": "book",
  "at": "2026-08-04T09:12:00+09:00",
  "status": "done",
  "summary": "한 문단 요약",
  "lessonsApplied": ["L-001", "L-007"],
  "needsHuman": false,
  "humanNote": ""
}
```

| 항목 | 규칙 |
|---|---|
| `stage` | `S1+S2` / `S3` / `S4+S5` / `S6+S7` / `retro` 중 하나 |
| `status` | `done`(완료) / `blocked`(막힘) / `skipped`(건너뜀) |
| `lessonsApplied` | **꼭 채웁니다.** 참고한 교훈이 없어도 빈 배열로 남깁니다 |
| `needsHuman` | 사람 판단이 필요하면 `true`. 대시보드에 눈에 띄게 표시됩니다 |
| `humanNote` | 뭘 물어보는지 한 줄로 |

---

## `lessonsApplied`를 왜 꼭 적나요

이 시스템의 목표는 `LESSONS.md`에 쌓인 교훈을 **자동 검사로 바꾸는 것**입니다.

그런데 어떤 교훈이 실제로 몇 번이나 쓰였는지 모르면
**무엇부터 자동화해야 할지 정할 수가 없습니다.**

`az-retro`는 이 숫자를 세서 우선순위를 정합니다.
3주 연속 참고된 항목이면 자동화할 가치가 크다는 뜻입니다.
기록이 없으면 회고가 그냥 추측이 됩니다.

그래서 자동 검사도 이 항목이 빠지면 실패로 잡습니다.

---

## 관리

- **지우지 마세요.** 떨어뜨린 이유가 쌓이면 그 카테고리에서 뭐가 헷갈리는지 패턴이 보입니다
- 분기에 한 번 `az-retro`가 전체를 훑어 반복되는 문제를 찾습니다
- 개인정보나 비공개 자료는 넣지 마세요. 이 폴더는 저장소에 그대로 올라갑니다

`index.json`은 `tools/qa.mjs`가 자동으로 만드는 목록 파일입니다.
대시보드가 어떤 주차가 있는지 알아내는 데 씁니다. 직접 고치실 필요 없습니다.
