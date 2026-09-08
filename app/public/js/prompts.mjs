// ====================================================================
// LLM 프롬프트 빌더 (어투·지시 편집은 여기)
// ====================================================================
import { WEEK, DEMO_MATRIX, GROUP_READS, CATEGORY_SOURCES, CATEGORY_GROUPS, PREFILLED, PREFILLED_VARIANTS, SAMPLE_PREV_IDS, PREFILLED_BUNDLES, TOPLINE_SAMPLE, CLIENTS, CC_RULES } from "./data.mjs";

export function buildReasonPrompt(week, category, items, moveOf) {
  // 지난 주 대비 순위 변동은 계산된 사실이다. AI가 추측하지 않도록 목록에 그대로 붙여 준다.
  const moveNote = (it) => {
    const m = moveOf && moveOf(it);
    if (!m) return "";
    if (m.kind === "new") return " [지난 주 차트에 없던 신규 진입]";
    if (m.kind === "same") return " [지난 주와 같은 " + it.rank + "위 유지]";
    return (
      " [지난 주 " +
      m.before +
      "위 → 이번 주 " +
      it.rank +
      "위, " +
      (m.kind === "up" ? "상승" : "하락") +
      "]"
    );
  };
  const hasMoves = items.some((it) => moveOf && moveOf(it));
  const list = items.map((it, i) => `${i + 1}. ${it.raw}${moveNote(it)}`).join("\n");
  return `너는 소비 트렌드 애널리스트다. 아래는 ${week.label}(${week.start}~${week.end}) '${category}' 카테고리 TOP ${items.length}이다. 이 목록은 '${category}' 카테고리에서 집계된 것이며, 원칙적으로 그 카테고리의 콘텐츠명이다.

[목록]
${list}

각 항목에 대해 다음을 수행하라.

0) itemType을 판별하라: "content"(작품\xB7상품) / "issue"(사건\xB7현상\xB7검색어) / "person"(인물). 먼저 '${category}' 카테고리 안에 그 이름의 콘텐츠가 실제로 존재하는지부터 확인하고, 존재하면 content로 분류한다. 존재하지 않을 때만 issue/person을 검토한다. 그래도 애매하면 content로 둔다. 판단이 서지 않으면 임의로 하나를 정해 진행한다.

1) 이번 주 이 항목이 상위권에 오른 이유를 3~10가지 찾아라. itemType에 따라 검토 축을 바꿔라.
   - content: 작품 자체 요인(작품성\xB7출연/제작진\xB7신작 여부) / 유통 요인(플랫폼 추천\xB7숏폼 확산\xB7커뮤니티) / 사회적 요인(시의성\xB7계절\xB7정서적 결핍)
   - issue: 사건 발생 시점과 규모 / 국내 연관성 / 확산 경로(알고리즘\xB7언론\xB7커뮤니티) / 검색을 유발한 감정(불안\xB7연민\xB7호기심)
   - person: 최근 발언\xB7성적\xB7논란 / 소속 조직 이슈 / 밈화 여부 / 인물에 투사되는 대중 정서
   이유는 반드시 중요도 내림차순으로 정렬하라. 각 이유는 제목 없이 그 자체로 완결된 한 문장(detail)으로 쓰고, anchorKeyword(대표 키워드 1개)를 달아라. 문장 앞에 짧은 소제목을 붙이지 마라 — "숏폼 재점화: 챌린지 영상이…"가 아니라 "발매 몇 달 뒤 숏폼 챌린지 영상이 확산되며 재조명됐다."처럼 바로 서술하라.

2) 표기만 다른 동일 대상이 목록에 여러 번 있으면 하나로 묶어 한 번만 설명하고, variantGroup에 같은 그룹에 속한 항목 번호(1부터, 자기 자신 포함)를 배열로 적어라. 속하지 않으면 null.

3) 관련 키워드를 넓게 추출하라(인물\xB7지명\xB7사건\xB7연관 IP\xB7현상어). 근거 없는 키워드는 만들지 마라.

4) headline은 단 하나의 강한 명사(또는 명사구)로 써라. "OO 아니면 OO" 같은 이중 대비 구조나 완결된 문장을 쓰지 마라 — 예: "언더독 서사", "심야 루틴", "희소성 목격"처럼 2~6자 내외 명사 하나로 못박는다. 콘텐츠 제목을 그대로 넣지 마라. 표면적 이유가 아니라 사람들이 채우려던 결핍이나 핵심 동인을 압축하라.

5) summary는 headline을 풀어주는 2~3문장.

6) 근거가 약하면 confidence를 low로 하고 summary에 그렇게 정직하게 밝혀라. 서사를 지어내지 마라.

7) 정상적 흥행 요인으로 설명 안 되는 급상승이면 조작\xB7사재기\xB7어뷰징 가능성도 검토해 하나의 이유로 포함하되, 단정하지 말고 confidence를 low로 낮춰라.

${hasMoves ? "\n괄호 안의 순위 변동은 지난 주 차트와 대조해 계산한 실측값이다. 추정하지 말고 그대로 사실로 다루라. 하락한 항목을 급상승으로 쓰거나 신규 진입을 장기 스테디로 쓰는 식으로 모순되게 쓰지 마라. 변동 폭이 큰 항목은 그 변화 자체를 이유의 출발점으로 삼아라.\n" : ""}
주의: 너는 실시간 웹 검색을 하지 않는다. 학습된 배경지식만으로 판단하고, 실존하지 않는 출처나 통계를 지어내지 마라. 확실하지 않으면 낮은 confidence와 함께 그렇게 서술하라.

정확히 ${items.length}개 원소를 가진 JSON 배열만 출력하라(목록 순서 그대로, 인덱스 1부터 대응). 각 원소 스키마:
{"itemType":"content|issue|person","headline":"string","summary":"string","reasons":[{"detail":"string","anchorKeyword":"string"}],"keywords":["string"],"variantGroup":[번호,...] 또는 null,"confidence":"high|medium|low"}

설명, 마크다운 코드펜스 없이 JSON 배열만 출력하라.`;
}

export function buildBundlePrompt(week, picks) {
  const list = picks
    .map(
      (p) =>
        `- ${p.category}/${p.rank}위 ${p.title} — 헤드라인: ${p.reason.headline} — 키워드: ${p.reason.keywords.slice(0, 8).join(", ")}`,
    )
    .join("\n");
  return `아래는 ${week.label} 기준 사용자가 고른 ${picks.length}개 항목과 각 항목의 이유\xB7키워드다.

[선택 항목]
${list}

다음 절차로 생각하되 사고 과정 자체는 출력하지 마라. 최종 결과만 낸다.
1. 이 카테고리들에서 통상 벌어지는 일과 비교해, 각 대상이 어떻게 벗어났는지 보라.
2. 공통 속성을 추상 개념 하나로 압축하라. 서로 다른 맥락이라도 억지로 연결하라.
3. 그 개념을 제목 한 줄로 패키징하라.

출력은 다음 두 필드만 낸다.
title: 단 하나의 강한 명사(또는 명사구) 한 줄. "OO 아니면 OO" 같은 이중 대비 구조나 완결된 문장을 쓰지 마라 — 2~8자 내외 명사 하나로 못박아라. "이번 한 주는 OO 때문에 시간을 썼습니다" 같은 고정 문장도 쓰지 마라. 콘텐츠 제목을 그대로 넣지 마라.
content: 4~6문장. 제목을 왜 그렇게 지었는지 논리적으로 설명한다. 반드시 아래 순서를 지켜라.\n  (1) 관찰: 선택된 항목들에서 실제로 확인되는 공통 사실을 먼저 적는다. 항목명을 직접 들어, 각각이 그 카테고리의 통상 경로에서 어느 지점을 벗어났는지 짚는다.\n  (2) 메커니즘: 그 사실들을 관통하는 소비자 행동의 원리를 설명한다. 사람들이 무엇을 아끼려 했는지(시간·탐색 비용·실패 위험), 무엇을 확인하려 했는지, 어떤 판단을 대신 맡겼는지를 짚는다.\n  (3) 명명: 그래서 이 묶음을 왜 그 제목으로 부르는지 한 문장으로 못박는다.\n  - 어투는 소비 트렌드 분석서에 가깝게 쓴다: 현상에 이름을 붙이고, 구체적 사례로 근거를 대고, 소비자 행동의 원리로 설명하는 방식. 단정적이되 과장하지 않는다.\n  - 추상적 수사로 분량을 채우지 마라. "경계가 무너진다", "새로운 흐름이 시작됐다", "구조가 재편된다" 같은 문장은 근거 없이 쓰면 금지다. 검증 가능한 관찰과 그 해석만 쓴다.\n  - "개념적 추상화", "강제 연결", "프레임화" 같은 절차 용어를 쓰지 마라.

출력은 JSON만. {"title":"...", "content":"...", "keywords":["브랜드가 마케팅에 바로 써볼 수 있는 키워드 3~6개. 고유명사 금지, 소비자의 행동\xB7정서\xB7상황을 가리키는 개념어로. 공백 없이 2~7자, # 기호 제외"]} 세 키만.`;
}

export function buildAutoPrompt(week, allItems, prefs) {
  // 사용자가 카드에 남긴 좋아요/싫어요를 그대로 프롬프트에 넣어, 다음 묶음이 그 취향을
  // 따라가게 한다. 같은 조합을 반복하지 말라고 못박아 취향만 이어받게 한다.
  const p = prefs || { liked: [], disliked: [] };
  const likedBlock = p.liked.length
    ? "\n\n[사용자가 좋아한 묶음 — 이 관점·추상화 수준·문장 방식을 이어가라. 단, 같은 항목 조합을 다시 제안하지는 마라.]\n" +
      p.liked
        .slice(0, 6)
        .map((x) => "- 제목: " + x.title + " / 항목: " + x.items + " / 요지: " + x.gist)
        .join("\n")
    : "";
  const dislikedBlock = p.disliked.length
    ? "\n\n[사용자가 싫어한 묶음 — 이런 방향과 어투는 피하라.]\n" +
      p.disliked
        .slice(0, 4)
        .map((x) => "- 제목: " + x.title + " / 항목: " + x.items + " / 요지: " + x.gist)
        .join("\n")
    : "";
  const list = allItems
    .map(
      (it) =>
        `- id:${it.id} ${it.category}/${it.rank}위 ${it.title}${it.artist ? " \xB7 " + it.artist : ""} — 헤드라인: ${(it.reason && it.reason.headline) || ""} — 키워드: ${((it.reason && it.reason.keywords) || []).slice(0, 6).join(", ")}`,
    )
    .join("\n");
  return (
    `아래는 ${week.label} 전체 5개 카테고리 TOP 항목과 각 항목의 이유\xB7키워드다.

[전체 항목]
${list}

너의 임무는 서로 다른 카테고리를 가로지르는 조합을 스스로 5개 찾아 추천하는 것이다. 각 조합은 다음 기준을 따른다.
1. 서로 다른 카테고리를 최소 2개 이상 가로지를 것
2. 표면적 공통점(같은 IP, 같은 인물)이 아니라 개념적 공통점일 것
3. 카테고리 상식으로 예측 가능한 뻔한 묶음은 배제할 것
4. 조합당 항목 2~10개. 같은 패턴이 여러 카테고리에 걸쳐 있으면 둘에서 멈추지 말고 근거가 되는 항목을 전부 넣어라. 다만 근거가 약한 항목을 수를 채우려고 넣지는 마라
5. 5개 조합은 서로 겹치지 않는 다른 개념을 다룰 것

각 조합에 대해 다음 절차로 생각하되 사고 과정은 출력하지 마라: (1) 각 대상이 카테고리 통상 경로에서 어떻게 벗어났는지 보라 (2) 공통 속성을 추상 개념으로 압축하라 (3) 제목 한 줄로 패키징하라.

정확히 5개의 조합을 JSON 배열로 출력하라. 각 원소 스키마:
{"itemIds":["존재하는 id만"],"title":"단 하나의 강한 명사(또는 명사구), 2~8자 내외, 콘텐츠 제목 그대로 넣지 않기","keywords":["키워드 3~6개 — 브랜드가 마케팅에 바로 쓸 수 있는 개념어. 고유명사 금지, 공백 없이 2~7자, # 기호 제외"],"content":"4~6문장. 가장 핵심적인 구절 1~2개를 **양쪽에 별표 두 개**로 감싸 강조하라. 문단당 최대 2개만, 문장 전체가 아니라 구절 단위로. 너무 많이 칠하면 강조가 사라진다. (1) 선택한 항목명을 직접 들어 각각이 통상 경로에서 벗어난 지점을 관찰로 적고 (2) 그것들을 관통하는 소비자 행동의 원리를 설명하고 (3) 그래서 이 제목으로 부른다고 한 문장으로 못박는다. 소비 트렌드 분석서 어투로, 추상적 수사 대신 사례와 해석으로 채운다. 절차 용어 금지"}

itemIds는 위 목록의 id 값만 정확히 그대로 사용하라. 설명이나 코드펜스 없이 JSON 배열만 출력하라.` +
    likedBlock +
    dislikedBlock
  );
}

export function likedBlockFor(liked) {
  return liked
    .slice(0, 8)
    .map((x, i) => `${i + 1}) 제목: ${x.title}\n   요지: ${x.gist}\n   묶인 항목: ${x.items}`)
    .join("\n");
}

export function ideaPrefBlock(ip) {
  const p = ip || { liked: [], disliked: [] };
  const up = p.liked.length
    ? "\n\n[사용자가 좋아한 실행 아이디어 — 이 결의 구체성\xB7형식감을 이어가라. 같은 아이디어를 다시 내지는 마라.]\n" +
      p.liked
        .slice(0, 6)
        .map((x) => "- " + x.title + " (" + x.items + ") : " + x.gist)
        .join("\n")
    : "";
  const down = p.disliked.length
    ? "\n\n[사용자가 별로라고 한 아이디어 — 이런 방향은 피하라.]\n" +
      p.disliked
        .slice(0, 4)
        .map((x) => "- " + x.title + " (" + x.items + ") : " + x.gist)
        .join("\n")
    : "";
  return up + down;
}

export function buildClientPrompt(client, liked, ideaPrefs, brand) {
  return (
    `너는 제일기획의 크리에이티브 플래너다. 아래 한 광고주에게 제안할 실행 아이디어를 최대 3개 만들어라.

[광고주]
${brand ? client.name + " — 브랜드: " + brand + " (이 브랜드 하나만 겨냥합니다. 모기업 일반이 아니라 이 제품\xB7서비스의 과제로 쓴다)" : client.name}${brand ? "" : " — " + client.note}${!brand && client.brands ? " (하위 브랜드: " + client.brands.join(", ") + " — 필요하면 특정 브랜드를 골라 써도 된다)" : ""}

[사용자가 좋아한 소비 인사이트]
${likedBlockFor(liked)}

${CC_RULES}` + ideaPrefBlock(ideaPrefs)
  );
}

export function buildAutoClientPrompt(clients, liked, ideaPrefs) {
  return (
    `너는 제일기획의 크리에이티브 플래너다. 아래 광고주 목록과 인사이트 중에서 가장 잘 엮히는 짝을 스스로 골라, 실행 아이디어를 최대 3개 만들어라. 한 광고주당 3개를 넘지 않는다.

[광고주 목록]
${clients.map((c) => `- ${c.name} — ${c.note}${c.brands ? " / 브랜드: " + c.brands.join(", ") : ""}`).join("\n")}

[사용자가 좋아한 소비 인사이트]
${likedBlockFor(liked)}

${CC_RULES}` + ideaPrefBlock(ideaPrefs)
  );
}

export function buildToplinePrompt(week, items, exclude) {
  const list = items
    .map(
      (it) =>
        `- ${it.category}/${it.rank}위 ${it.title}${it.reason && it.reason.headline ? " — " + it.reason.headline : ""}`,
    )
    .join("\n");
  return `너는 소비 트렌드 애널리스트다. 아래는 ${week.label} 5개 카테고리 TOP 항목과 각 항목의 이유 헤드라인이다.

[전체 항목]
${list}

${exclude && exclude.length ? "\n[이미 발행한 명제 — 이것과 겹치지 않는, 그 다음으로 강한 명제를 내라. 같은 말을 표현만 바꾸지 마라.]\n" + exclude.map((x) => "- " + x).join("\n") + "\n" : ""}
임무: 이 한 주를 관통하는 가장 강한 명제 하나만 내라.
1. 두 개 이상의 카테고리에서 동시에 확인되는 것만 쓴다. 한 항목에만 해당하는 건 제외한다.
2. 크고 추상한 선언("경계가 무너진다" 같은)이 아니라, 작지만 의외인 관찰을 정밀하게 쓴다.
3. headline은 한 문장, 30자 내외. 물음표\xB7느낌표는 쓰지 않는다.
4. note는 그 명제가 이번 주 어디서 확인되는지를 항목명을 직접 들어 2~3문장으로 설명한다. 가장 핵심적인 구절 1~2개를 **양쪽에 별표 두 개**로 감싸 강조하라. 문단당 최대 2개만, 문장 전체가 아니라 구절 단위로. 너무 많이 칠하면 강조가 사라진다.
5. brand는 정확히 2문단이고, 다른 필드와 달리 반드시 구어체 해요체로 쓴다. 분석 문장이 아니라 마케터 옆자리에서 말해주는 투다.
   - 첫 문단: 지금 무슨 일이 벌어지고 있는지를 2문장으로 쉽게 설명한다. "~하고 있어요", "~빨라요"처럼 끝낸다.
   - note와 같이 가장 핵심적인 구절 1~2개를 **양쪽에 별표 두 개**로 감싸 강조하라. 문단당 최대 2개만, 문장 전체가 아니라 구절 단위로. 너무 많이 칠하면 강조가 사라진다.\n   - 둘째 문단: 구체적으로 뭐를 해보라는 권유로 쓴다. "~해보세요", "~확인해 보세요", "~올려보시는 걸 추천드려요" 같은 종결을 쓴다. 실행 후보를 예로 들고, 특정 광고주를 지목하지 말고 어느 브랜드에나 대입되게 쓴다.
6. keywords는 5~8개. 마케터가 기획서에 그대로 옮겨 쓸 만한 개념어로 쓴다. 콘텐츠 제목\xB7브랜드명 같은 고유명사는 금지하고, 소비자의 행동\xB7동기\xB7시장 구조를 가리키는 말로. 공백 없이 3~8자, # 기호 제외.

설명이나 코드펜스 없이 JSON 객체 하나만 출력하라: {"headline":"string","note":"string","keywords":["string"],"brand":["string","string"]}`;
}
