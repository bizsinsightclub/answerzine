// ==================================================================
// 상태 · reducer · 저장소 (localStorage)
// ==================================================================
import { DEMO_MATRIX, WEEK } from "./data.mjs";
import { buildItemsFromMatrix, normTitleKey } from "./util.mjs";

// v2: 키를 제목이 아니라 원문(raw)으로. "MONCLER - 26FW Bady…" 처럼 제목이 같고 부제만 다른
// 항목들이 한 순위로 뭉개지던 것을 막는다.
export const PREV_KEY = "trend-sensing:prev:v2";

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
    map[it.category][normTitleKey(it.raw)] = it.rank;
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
      .map((it) => it.category + "|" + it.rank + "|" + normTitleKey(it.raw))
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

export const STORAGE_KEY = "trend-sensing:v21";

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

// 새 업로드마다 새 기록 id — "WEEK37-202609081302"
export const newRunId = (week) =>
  String((week && week.label) || "week").replace(/[^A-Za-z0-9]/g, "") +
  "-" +
  new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

// 저장 스냅숏(localStorage 또는 서버 data/runs/*.json) → 상태. 둘 다 같은 모양이다.
// runId 가 없는 옛 로컬 저장은 여기서 id 를 받아 서버 기록으로 올라간다.
export function fromPersisted(persisted, runId) {
  const bundles = Array.isArray(persisted.bundles) ? persisted.bundles : [];
  const reads = Array.isArray(persisted.groupReads) ? persisted.groupReads : [];
  return {
    runId: runId || persisted.runId || newRunId(persisted.week),
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
    groupReads: reads,
    analysisState: reads.length ? "done" : "idle",
    topline: persisted.topline && persisted.topline.headline ? persisted.topline : null,
    toplineArchive: Array.isArray(persisted.toplineArchive) ? persisted.toplineArchive : [],
    feedback:
      persisted.feedback && typeof persisted.feedback === "object" ? persisted.feedback : {},
    toast: null,
  };
}

export function makeInitialState() {
  // 내보낸 한 파일(HTML)은 기록을 안에 품고 있다 — 서버·localStorage 를 보지 않는다
  if (typeof window !== "undefined" && window.__RUN__ && Array.isArray(window.__RUN__.items))
    return fromPersisted(window.__RUN__);
  const persisted = loadPersisted();
  if (persisted) return fromPersisted(persisted);
  // 아무 기록도 없으면 코드에 박힌 기본 차트(해석 없음)
  return {
    runId: null,
    week: WEEK,
    categories: DEMO_MATRIX.categories,
    items: buildItemsFromMatrix(DEMO_MATRIX.categories, DEMO_MATRIX.rows),
    isSample: true,
    mode: "grid", // grid | manual-edit
    manualDraft: null,
    selected: [],
    bundles: [],
    activeBundleId: null,
    autoStatus: "idle",
    groupReads: [],
    analysisState: "idle", // idle | running | done — 그룹 해석(분석하기) 진행 상태
    topline: null,
    toplineArchive: [],
    feedback: {},
    toast: null,
  };
}

export function reducer(state, action) {
  switch (action.type) {
    // 서버 기록(data/runs) 하나를 통째로 연다
    case "LOAD_RUN":
      return fromPersisted(action.run, action.id);
    case "SET_DATA":
      return {
        ...state,
        runId: action.runId || null,
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
        groupReads: [],
        analysisState: "idle",
      };
    // 그룹 해석 하나 도착 — 같은 그룹이 있으면 교체
    case "GROUP_READ_APPLY": {
      const rest = state.groupReads.filter((r) => r.group !== action.read.group);
      return { ...state, groupReads: [...rest, action.read] };
    }
    case "ANALYSIS_DONE":
      return { ...state, analysisState: "done" };
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
    // 그룹 해석·한 줄·묶음을 비운다.
    case "RESET_FOR_REANALYSIS":
      return {
        ...state,
        selected: [],
        bundles: [],
        activeBundleId: null,
        autoStatus: "idle",
        groupReads: [],
        topline: null,
        analysisState: "idle",
      };
    case "START_MANUAL_EDIT":
      return { ...state, mode: "manual-edit", manualDraft: action.draft };
    case "CANCEL_MANUAL_EDIT":
      return { ...state, mode: "grid" };
    case "UPDATE_MANUAL_DRAFT":
      return { ...state, manualDraft: action.draft };
    case "ANALYSIS_START":
      return { ...state, analysisState: "running" };
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
    case "SET_ACTIVE_BUNDLE":
      return { ...state, activeBundleId: action.id };
    case "AUTO_LOADING":
      return { ...state, autoStatus: "loading" };
    // 묶음 5개를 한 번에 발행한다.
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
