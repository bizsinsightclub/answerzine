// ==================================================================
// 상태 · reducer · 저장소 (localStorage)
// ==================================================================
import { PREFILLED_VARIANTS, PREFILLED, SAMPLE_PREV_IDS, DEMO_MATRIX, PREFILLED_BUNDLES, WEEK, TOPLINE_SAMPLE } from "./data.mjs";
import { csvCell, buildChartCsv, buildGroupPlan, parseRawTitle, buildItemsFromMatrix, normTitleKey, normalizeIdeas, groupByCategory, useSectionOpen, computePopupPos, uidSeq, uid, asText, hlText, normalizeReason, KEYWORD_LIMIT, isTouchDevice, sampleWithTimeout, describeSampleError } from "./util.mjs";

const { useState, useEffect, useRef, useReducer, useLayoutEffect, useCallback, useMemo } = React;

export function attachPrefilled(items) {
  const groupOf = {};
  PREFILLED_VARIANTS.forEach((g) =>
    g.forEach((id) => {
      groupOf[id] = g;
    }),
  );
  return items.map((it) => {
    const p = PREFILLED[it.id];
    if (!p) return it;
    return {
      ...it,
      itemType: p[4] || "content",
      status: "ready",
      prefilled: true,
      variantGroup: groupOf[it.id] || null,
      reason: {
        headline: p[0],
        summary: p[1],
        reasons: (p[2] || []).map((d) => ({ detail: d, anchorKeyword: "" })),
        keywords: p[3] || [],
        confidence: p[5] || "medium",
      },
    };
  });
}

export const PREV_KEY = "trend-sensing:prev:v1";

export function makeSamplePrev() {
  // 지난주 스냅샷 데이터가 없으면 null — 없는 걸 NEW 로 속이지 않는다.
  if (!Object.keys(SAMPLE_PREV_IDS).length) return null;
  const map = {};
  DEMO_MATRIX.categories.forEach((cat) => {
    map[cat] = {};
  });
  return { map, ids: SAMPLE_PREV_IDS };
}

export function loadPrevChart() {
  try {
    const d = JSON.parse(localStorage.getItem(PREV_KEY));
    return d && d.map && typeof d.map === "object" ? d : null;
  } catch (e) {
    return null;
  }
}

export function snapshotChart(items) {
  const map = {};
  items.forEach((it) => {
    if (!it || !it.raw) return;
    if (!map[it.category]) map[it.category] = {};
    map[it.category][normTitleKey(it.title)] = it.rank;
  });
  return { map };
}

export function savePrevChart(snap) {
  try {
    localStorage.setItem(PREV_KEY, JSON.stringify(snap));
  } catch (e) {}
}

export function sameChart(a, b) {
  const flat = (items) =>
    items
      .filter((it) => it && it.raw)
      .map((it) => it.category + "|" + it.rank + "|" + normTitleKey(it.title))
      .sort()
      .join("~");
  return flat(a) === flat(b);
}

export const PREF_KEY = "trend-sensing:prefs:v1";

export const IDEA_PREF_KEY = "trend-sensing:ideaprefs:v1";

export function loadPrefs(key) {
  try {
    const raw = localStorage.getItem(key || PREF_KEY);
    if (!raw) return { liked: [], disliked: [] };
    const d = JSON.parse(raw);
    return {
      liked: Array.isArray(d && d.liked) ? d.liked : [],
      disliked: Array.isArray(d && d.disliked) ? d.disliked : [],
    };
  } catch (e) {
    return { liked: [], disliked: [] };
  }
}

export function savePrefs(p, key) {
  try {
    localStorage.setItem(key || PREF_KEY, JSON.stringify(p));
  } catch (e) {}
}

export function upsertPref(prefs, rating, record) {
  const strip = (arr) => arr.filter((x) => x.title !== record.title);
  const liked = strip(prefs.liked);
  const disliked = strip(prefs.disliked);
  if (rating === "up") liked.unshift(record);
  if (rating === "down") disliked.unshift(record);
  return { liked: liked.slice(0, 12), disliked: disliked.slice(0, 8) };
}

export function makePrefilledBundles() {
  return PREFILLED_BUNDLES.map((b, i) => ({
    bundleId: `seed-${i + 1}`,
    itemIds: b.itemIds.slice(),
    title: b.title,
    content: b.content,
    keywords: (b.keywords || []).slice(),
    auto: true,
  }));
}

export const STORAGE_KEY = "trend-sensing:v20";

export function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (
      !data ||
      !Array.isArray(data.items) ||
      !Array.isArray(data.categories) ||
      data.items.length === 0
    )
      return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function makeInitialState() {
  const persisted = loadPersisted();
  if (persisted) {
    const bundles = Array.isArray(persisted.bundles) ? persisted.bundles : [];
    return {
      week: persisted.week || WEEK,
      categories: persisted.categories,
      items: persisted.items,
      isSample: false,
      mode: "grid",
      manualDraft: null,
      selected: [],
      bundles,
      activeBundleId: bundles[0] ? bundles[0].bundleId : null,
      autoStatus: bundles.length ? "done" : "idle",
      analysisState: persisted.items.some(
        (it) => it.raw && it.status !== "ready" && it.status !== "failed",
      )
        ? "idle"
        : "done",
      topline: persisted.topline && persisted.topline.headline ? persisted.topline : null,
      toplineArchive: Array.isArray(persisted.toplineArchive) ? persisted.toplineArchive : [],
      feedback:
        persisted.feedback && typeof persisted.feedback === "object" ? persisted.feedback : {},
      toast: null,
    };
  }
  return {
    week: WEEK,
    categories: DEMO_MATRIX.categories,
    items: attachPrefilled(buildItemsFromMatrix(DEMO_MATRIX.categories, DEMO_MATRIX.rows)),
    isSample: true,
    mode: "grid",
    // grid | manual-edit
    manualDraft: null,
    selected: [],
    bundles: makePrefilledBundles(),
    activeBundleId: "seed-1",
    autoStatus: "done",
    // idle | loading | done | error — 첫 화면부터 읽을 5편이 이미 붙어 있다
    analysisState: "done",
    // 사전 작성된 기본 분석이 이미 붙어 있으므로 완료 상태로 연다. AI 재분석은 "분석하기" CTA로만 시작한다.
    topline: TOPLINE_SAMPLE,
    toplineArchive: [],
    feedback: {},
    toast: null,
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case "SET_DATA":
      return {
        ...state,
        week: action.week || state.week,
        categories: action.categories,
        items: action.items,
        isSample: false,
        mode: "grid",
        selected: [],
        bundles: [],
        activeBundleId: null,
        autoStatus: "idle",
        topline: null,
        toplineArchive: [],
        analysisState: "idle",
      };
    case "SET_TOPLINE":
      return { ...state, topline: action.topline || null };
    // 새 인사이트를 찾으면 지금 것은 아카이브로 내려간다
    case "PUSH_TOPLINE": {
      if (!action.topline) return state;
      const archive = state.topline
        ? [state.topline].concat(state.toplineArchive || [])
        : state.toplineArchive || [];
      return { ...state, topline: action.topline, toplineArchive: archive.slice(0, 12) };
    }
    case "RESET_FOR_REANALYSIS":
      return {
        ...state,
        items: state.items.map((it) =>
          it.raw ? { ...it, status: "idle", reason: null, itemType: null, variantGroup: null } : it,
        ),
        selected: [],
        bundles: [],
        activeBundleId: null,
        autoStatus: "idle",
        analysisState: "idle",
      };
    case "START_MANUAL_EDIT":
      return { ...state, mode: "manual-edit", manualDraft: action.draft };
    case "CANCEL_MANUAL_EDIT":
      return { ...state, mode: "grid" };
    case "UPDATE_MANUAL_DRAFT":
      return { ...state, manualDraft: action.draft };
    case "ANALYSIS_START":
      return {
        ...state,
        analysisState: "running",
        items: state.items.map((it) => (it.raw && !it.reason ? { ...it, status: "loading" } : it)),
      };
    // 요청 5: 분석 실패는 실패한 콘텐츠 개별 항목만 표시한다 — 배치 호출 중 일부만
    // 잘못 와도 나머지 성공한 항목의 분석은 그대로 살리고, 그 카테고리(행) 전체를
    // 멈추거나 실패로 되돌리지 않는다.
    case "ITEMS_LOADING": {
      const ids = new Set(action.ids);
      const items = state.items.map((it) => (ids.has(it.id) ? { ...it, status: "loading" } : it));
      return { ...state, items, analysisState: "running" };
    }
    case "CATEGORY_REASONS_READY": {
      const map = new Map(action.updates.map((u) => [u.id, u]));
      const items = state.items.map((it) =>
        map.has(it.id) ? { ...it, ...map.get(it.id), status: "ready" } : it,
      );
      const stillLoading = items.some((it) => it.status === "loading");
      return { ...state, items, analysisState: stillLoading ? "running" : "done" };
    }
    case "ITEMS_FAILED": {
      const ids = new Set(action.ids);
      const items = state.items.map((it) =>
        ids.has(it.id) ? { ...it, status: "failed", errorReason: action.reason || null } : it,
      );
      const stillLoading = items.some((it) => it.status === "loading");
      return { ...state, items, analysisState: stillLoading ? "running" : "done" };
    }
    case "TOGGLE_SELECT": {
      const exists = state.selected.includes(action.id);
      if (exists) return { ...state, selected: state.selected.filter((id) => id !== action.id) };
      if (state.selected.length >= 10) return state;
      return { ...state, selected: [...state.selected, action.id] };
    }
    case "CLEAR_SELECTION":
      return { ...state, selected: [] };
    case "BUNDLE_CREATED":
      return {
        ...state,
        bundles: [action.bundle, ...state.bundles],
        activeBundleId: action.bundle.bundleId,
        selected: [],
      };
    case "RESTORE_BUNDLE": {
      const b = state.bundles.find((x) => x.bundleId === action.id);
      if (!b) return state;
      return { ...state, activeBundleId: action.id, selected: b.itemIds };
    }
    case "SET_ACTIVE_BUNDLE":
      return { ...state, activeBundleId: action.id };
    case "AUTO_LOADING":
      return { ...state, autoStatus: "loading" };
    // 요청 6: 묶음 5개를 한 번에 발행한다(1개 노출 + 대기열로 하나씩 더 보여주는 방식 아님).
    case "AUTO_READY": {
      const withIds = action.bundles.map((b, i) => ({
        ...b,
        bundleId: `auto-${Date.now()}-${i}`,
        auto: true,
      }));
      if (withIds.length === 0) return { ...state, autoStatus: "done" };
      // 평가를 남긴 글은 좋아요/별로 각각의 아카이브로 내려간다.
      const prev = state.bundles.map((b) =>
        state.feedback[b.bundleId]
          ? { ...b, archived: true, archivedRating: state.feedback[b.bundleId] }
          : b,
      );
      return {
        ...state,
        autoStatus: "done",
        bundles: [...withIds, ...prev],
        activeBundleId: withIds[0].bundleId,
      };
    }
    case "RATE_BUNDLE": {
      const fb = { ...state.feedback };
      if (fb[action.id] === action.rating) delete fb[action.id];
      else fb[action.id] = action.rating;
      // 평가를 남기면 아직 평가하지 않은 다음 글로 자동으로 넘어간다.
      let nextActive = state.activeBundleId;
      if (fb[action.id]) {
        const list = state.bundles.filter((b) => !b.archived);
        const i = list.findIndex((b) => b.bundleId === action.id);
        const next =
          list.slice(i + 1).find((b) => !fb[b.bundleId]) || list.find((b) => !fb[b.bundleId]);
        nextActive = next ? next.bundleId : null;
      }
      return { ...state, feedback: fb, activeBundleId: nextActive };
    }
    case "DELETE_BUNDLE": {
      const bundles = state.bundles.filter((b) => b.bundleId !== action.id);
      const fb = { ...state.feedback };
      delete fb[action.id];
      const nextActive =
        state.activeBundleId === action.id
          ? (bundles.find((b) => !b.archived) || {}).bundleId || null
          : state.activeBundleId;
      return { ...state, bundles, feedback: fb, activeBundleId: nextActive };
    }
    case "AUTO_FAILED":
      return { ...state, autoStatus: "error", autoError: action.reason || null };
    case "SET_TOAST":
      return { ...state, toast: { message: action.message, id: action.id } };
    case "CLEAR_TOAST":
      return state.toast && state.toast.id === action.id ? { ...state, toast: null } : state;
    default:
      return state;
  }
}
