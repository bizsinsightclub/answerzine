// ==================================================================
// 유틸 · 순수 헬퍼 · 제네릭 훅
// ==================================================================
import { CATEGORY_SOURCES, CATEGORY_GROUPS } from "./data.mjs";

const { useState, useEffect, useRef, useReducer, useLayoutEffect, useCallback, useMemo } = React;

export function csvCell(v) {
  return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
}

export function buildChartCsv(week, gridCats, groupOf, items, moveOf) {
  const head = [
    "주차",
    "상위 그룹",
    "카테고리",
    "출처",
    "순위",
    "항목",
    "부가 정보",
    "순위 변동",
    "지난 주 순위",
    "이유 제목",
    "요약",
    "이유",
    "키워드",
    "신뢰도",
  ];
  const rows = [head.map(csvCell).join(",")];
  for (let rank = 1; rank <= 10; rank++) {
    gridCats.forEach((cat) => {
      const it = items.find((x) => x.category === cat && x.rank === rank);
      if (!it || !it.raw) return;
      const mv = moveOf(it);
      const r = it.reason || {};
      rows.push(
        [
          week.label || "",
          groupOf[cat] || "",
          cat,
          CATEGORY_SOURCES[cat] || "",
          rank,
          it.title || "",
          it.artist || "",
          mv ? (mv.kind === "new" ? "NEW" : mv.kind === "same" ? "유지" : mv.label) : "",
          mv && mv.before != null ? mv.before : "",
          r.headline || "",
          r.summary || "",
          (r.reasons || []).map((x, i) => i + 1 + ") " + (x.detail || "")).join(" "),
          (r.keywords || []).join(", "),
          r.confidence || "",
        ]
          .map(csvCell)
          .join(","),
      );
    });
  }
  return "﻿" + rows.join("\r\n");
}

export function buildGroupPlan(categories) {
  const left = categories.slice();
  const groups = [],
    ordered = [];
  CATEGORY_GROUPS.forEach((g) => {
    const hit = g.cats.filter((c) => left.indexOf(c) !== -1);
    if (!hit.length) return;
    hit.forEach((c) => {
      ordered.push(c);
      left.splice(left.indexOf(c), 1);
    });
    groups.push({ label: g.label, count: hit.length });
  });
  if (left.length) {
    left.forEach((c) => ordered.push(c));
    groups.push({ label: groups.length ? "기타" : "", count: left.length });
  }
  return {
    ordered,
    groups,
    useGroups: groups.length > 1 && groups.some((g) => g.label && g.label !== "기타"),
  };
}

export function parseRawTitle(raw) {
  const m = String(raw)
    .trim()
    .match(/^(.*?)\s*[-–—]\s*(.+)$/);
  if (m) return { title: m[1].trim(), artist: m[2].trim() };
  return { title: String(raw).trim(), artist: null };
}

export function buildItemsFromMatrix(categories, rows) {
  const items = [];
  rows.slice(0, 10).forEach((row, ri) => {
    const rank = ri + 1;
    categories.forEach((cat, ci) => {
      const raw = row[ci];
      if (raw === void 0 || raw === null || String(raw).trim() === "") return;
      const rawStr = String(raw).trim();
      const { title, artist } = parseRawTitle(rawStr);
      items.push({
        id: `c${ci + 1}-${rank}`,
        category: cat,
        rank,
        title,
        artist,
        raw: rawStr,
        itemType: null,
        reason: null,
        status: "idle",
        variantGroup: null,
      });
    });
  });
  return items;
}

export function normTitleKey(v) {
  return String(v == null ? "" : v)
    .toLowerCase()
    .replace(/[\s\-_·,.'"()\[\]]/g, "");
}

export function normalizeIdeas(raw, fallbackClient) {
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.ideas) ? raw.ideas : [];
  return list
    .map((x) => ({
      client: asText((x && x.client) || fallbackClient || ""),
      insight: asText((x && x.insight) || ""),
      title: asText((x && x.title) || ""),
      now: asText((x && (x.now || x.what)) || ""),
      challenge: asText((x && x.challenge) || ""),
      redefine: asText((x && x.redefine) || ""),
      solution: asText((x && (x.solution || x.why)) || ""),
      actions: (x && Array.isArray(x.actions) ? x.actions : [])
        .map((a) => ({
          title: asText((a && a.title) || ""),
          detail: asText((a && a.detail) || ""),
        }))
        .filter((a) => a.title || a.detail)
        .slice(0, 3),
    }))
    .filter((x) => x.title && (x.now || x.challenge || x.redefine || x.solution))
    .slice(0, 3);
}

export function groupByCategory(items) {
  const m = new Map();
  items.forEach((it) => {
    if (!it.raw) return;
    if (!m.has(it.category)) m.set(it.category, []);
    m.get(it.category).push(it);
  });
  return m;
}

export function useSectionOpen(key) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== "closed";
    } catch (e) {
      return true;
    }
  });
  const toggle = () =>
    setOpen((v) => {
      const n = !v;
      try {
        localStorage.setItem(key, n ? "open" : "closed");
      } catch (e) {}
      return n;
    });
  return [open, toggle];
}

export function computePopupPos(rect, w, h) {
  const margin = 10;
  const vw = window.innerWidth,
    vh = window.innerHeight;
  let left = rect.right + margin;
  let top = rect.top;
  if (left + w > vw - margin) left = rect.left - w - margin;
  if (left < margin) left = margin;
  if (top + h > vh - margin) top = Math.max(margin, vh - margin - h);
  if (top < margin) top = margin;
  return { left, top };
}

export let uidSeq = 0;

export function uid(prefix) {
  uidSeq += 1;
  return `${prefix}-${Date.now()}-${uidSeq}`;
}

export function asText(v) {
  if (typeof v === "string") return v;
  if (v == null) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;
    if (typeof v.detail === "string") return v.detail;
    if (typeof v.label === "string") return v.label;
    if (typeof v.name === "string") return v.name;
    if (typeof v.keyword === "string") return v.keyword;
    try {
      return JSON.stringify(v).slice(0, 120);
    } catch (e) {
      return "";
    }
  }
  return String(v);
}

export function hlText(v) {
  const t = asText(v);
  if (t.indexOf("**") === -1) return t;
  return t
    .split("**")
    .map((seg, i) => (i % 2 ? React.createElement("mark", { className: "hl", key: i }, seg) : seg));
}

export function normalizeReason(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const reasons = (Array.isArray(src.reasons) ? src.reasons : [])
    .slice(0, 10)
    .map((x) => ({
      detail: asText(x && typeof x === "object" ? (x.detail != null ? x.detail : x.text) : x),
      anchorKeyword: asText(x && typeof x === "object" ? x.anchorKeyword : ""),
    }))
    .filter((x) => x.detail);
  const keywords = (Array.isArray(src.keywords) ? src.keywords : [])
    .map(asText)
    .filter(Boolean)
    .slice(0, 24);
  return {
    headline: asText(src.headline),
    summary: asText(src.summary),
    reasons,
    keywords,
    confidence: asText(src.confidence) || "medium",
  };
}

export const KEYWORD_LIMIT = 10;

export const isTouchDevice = () =>
  typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: none)").matches;

export function sampleWithTimeout(sampleFn, prompt, opts, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error("응답 대기 시간 초과");
      e.code = "cancelled";
      reject(e);
    }, timeoutMs);
  });
  return Promise.race([sampleFn.json(prompt, opts), timeout]).finally(() => clearTimeout(timer));
}

export function describeSampleError(e) {
  const code = e && typeof e === "object" ? e.code : void 0;
  let label;
  if (code === "cancelled") label = "응답 지연(시간 초과)";
  else if (code === "not_granted") label = "AI 사용 권한 없음";
  else if (code === "rate_limited") label = "요청 과다, 잠시 후 재시도";
  else if (code === "not_supported") label = "이 화면에서 미지원";
  else if (e && e.message) label = String(e.message).slice(0, 70);
  else if (code) label = String(code);
  else if (typeof e === "string" && e) label = e;
  else label = "원인 미상";
  // 번역한 라벨만으로는 부족할 수 있으니, 실제 원인 식별자(code/name)를 그대로 덧붙여
  // 다음에 이 화면을 보고 그대로 전달하면 정확한 진단이 가능하게 한다.
  const raw = code || (e && e.name) || "";
  return raw && label.indexOf(raw) === -1 ? `${label} [${raw}]` : label;
}
