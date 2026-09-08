// ==================================================================
// App — 루트 컴포넌트 + 마운트
// ==================================================================
import { WEEK, DEMO_MATRIX, GROUP_READS, CATEGORY_SOURCES, CATEGORY_GROUPS, PREFILLED, PREFILLED_VARIANTS, SAMPLE_PREV_IDS, PREFILLED_BUNDLES, TOPLINE_SAMPLE, CLIENTS, CC_RULES } from "./data.mjs";
import { buildReasonPrompt, buildBundlePrompt, buildAutoPrompt, buildClientPrompt, buildAutoClientPrompt, buildToplinePrompt, likedBlockFor, ideaPrefBlock } from "./prompts.mjs";
import { csvCell, buildChartCsv, buildGroupPlan, parseRawTitle, buildItemsFromMatrix, normTitleKey, normalizeIdeas, groupByCategory, useSectionOpen, computePopupPos, uidSeq, uid, asText, hlText, normalizeReason, KEYWORD_LIMIT, isTouchDevice, sampleWithTimeout, describeSampleError } from "./util.mjs";
import { attachPrefilled, PREV_KEY, makeSamplePrev, loadPrevChart, snapshotChart, savePrevChart, sameChart, PREF_KEY, IDEA_PREF_KEY, loadPrefs, savePrefs, upsertPref, makePrefilledBundles, STORAGE_KEY, loadPersisted, makeInitialState, reducer } from "./state.mjs";
import { ErrorBoundary, ReasonPopup, Cell, ManualEditor } from "./components.mjs";

const { useState, useEffect, useRef, useReducer, useLayoutEffect, useCallback, useMemo } = React;

function App() {
  const [state, dispatch] = useReducer(reducer, void 0, makeInitialState);
  const [sampleFn, setSampleFn] = useState(void 0);
  const [popup, setPopup] = useState({
    item: null,
    pos: { left: 0, top: 0 },
    open: false,
    pinned: false,
  });
  const [hoveredEcho, setHoveredEcho] = useState(null);
  const [hoveredBundleId, setHoveredBundleId] = useState(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [prefs, setPrefs] = useState(loadPrefs);
  // 엑셀 업로드는 평소 감춰두고 "설정"을 눌러야 열린다
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 좋아요/별로 아카이브는 각각 따로 펼친다 (null | "up" | "down")
  const [archiveView, setArchiveView] = useState(null);
  // Client Connect — 좋아요한 인사이트 x 광고주
  const [ccOpen, setCcOpen] = useState(false);
  const [ccPick, setCcPick] = useState(null);
  const [ccStatus, setCcStatus] = useState("idle");
  // 지난 제안은 화면을 떠나도 남는다. 새로 돌리면 아카이브로 내려간다.
  const [ccRuns, setCcRuns] = useState([]);
  const [ccArchiveOpen, setCcArchiveOpen] = useState(false);
  const [ccOpenIdea, setCcOpenIdea] = useState(null);
  // 매니페스토 한 편씩 손으로 아카이브한다. 키는 run.id|index.
  const [ccFiled, setCcFiled] = useState({});
  const fileIdea = (run, i) => {
    const k = run.id + "|" + i;
    setCcFiled((m) =>
      Object.assign({}, m, {
        [k]: { runId: run.id, label: run.label, idea: run.ideas[i], at: Date.now() },
      }),
    );
    if (ccOpenIdea === k) {
      const next = run.ideas.findIndex((_, n) => n !== i && !ccFiled[run.id + "|" + n]);
      setCcOpenIdea(next >= 0 ? run.id + "|" + next : null);
    }
  };
  const unfileIdea = (k) =>
    setCcFiled((m) => {
      const n = Object.assign({}, m);
      delete n[k];
      return n;
    });
  const [ccError, setCcError] = useState(null);
  const [ccLabel, setCcLabel] = useState("");
  const [ccSec, setCcSec] = useState(0);
  const [ccQuery, setCcQuery] = useState("");
  const [ccBrand, setCcBrand] = useState(null);
  const [prevChart, setPrevChart] = useState(
    () => loadPrevChart() || (state.isSample ? makeSamplePrev() : null),
  );
  const [toplineLoading, setToplineLoading] = useState(false);
  const [toplineArchiveOpen, setToplineArchiveOpen] = useState(false);
  const [dlFn, setDlFn] = useState(null);
  const [topOpen, toggleTop] = useSectionOpen("trend-sensing:sec:topline");
  const [chartOpen, toggleChart] = useSectionOpen("trend-sensing:sec:chart");
  // 랭킹 표가 화면보다 넓어 일부만 보이므로, 섹션(그룹) 단위로 천천히 팬하며 반복한다.
  // 마우스를 올리거나 직접 스크롤하면 멈추고, 모션 최소화 설정이면 아예 안 움직인다.
  const chartScrollRef = useRef(null);
  const chartHover = useRef(false);
  const chartGesture = useRef(0);
  useEffect(() => {
    const el = chartScrollRef.current;
    if (!chartOpen || !el) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gesture = () => (chartGesture.current = Date.now());
    const enter = () => (chartHover.current = true);
    const leave = () => (chartHover.current = false);
    el.addEventListener("wheel", gesture, { passive: true });
    el.addEventListener("touchstart", gesture, { passive: true });
    el.addEventListener("pointerdown", gesture, { passive: true });
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    const id = setInterval(() => {
      const c = chartScrollRef.current;
      if (!c || chartHover.current || Date.now() - chartGesture.current < 5000) return;
      const max = c.scrollWidth - c.clientWidth;
      if (max <= 4) return; // 다 보이면 팬하지 않는다
      const sel = c.querySelector(".grid-group-cell") ? ".grid-group-cell" : ".grid-head-cell";
      const base = c.getBoundingClientRect().left;
      const marks = Array.from(c.querySelectorAll(sel))
        .map((g) => c.scrollLeft + (g.getBoundingClientRect().left - base) - 56)
        .filter((x) => x > 1);
      const next = marks.find((x) => x > c.scrollLeft + 6);
      const to = next != null && c.scrollLeft < max - 6 ? Math.min(next, max) : 0;
      c.scrollTo({ left: to, behavior: "smooth" });
    }, 5000);
    return () => {
      clearInterval(id);
      el.removeEventListener("wheel", gesture);
      el.removeEventListener("touchstart", gesture);
      el.removeEventListener("pointerdown", gesture);
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
    };
  }, [chartOpen, state.categories.length]);
  const [bundOpen, toggleBund] = useSectionOpen("trend-sensing:sec:bundles");
  const READS_KEY = "trend-sensing:reads:v1";
  const [readsOpen, setReadsOpen] = useState(() => {
    try {
      return localStorage.getItem(READS_KEY) !== "closed";
    } catch (e) {
      return true;
    }
  });
  const toggleReads = () =>
    setReadsOpen((v) => {
      const n = !v;
      try {
        localStorage.setItem(READS_KEY, n ? "open" : "closed");
      } catch (e) {}
      return n;
    });
  const [readPop, setReadPop] = useState({
    idx: null,
    pos: { left: 0, top: 0 },
    open: false,
    pinned: false,
  });
  const readPopTimer = useRef(null);
  const openReadPop = (gi, rect, pinned) => {
    clearTimeout(readPopTimer.current);
    const m = 10,
      w = 344,
      hh = 360;
    let left = rect.left,
      top = rect.bottom + 8;
    if (left + w > window.innerWidth - m) left = Math.max(m, window.innerWidth - m - w);
    if (top + hh > window.innerHeight - m) top = Math.max(m, rect.top - hh - 8);
    if (top < m) top = m;
    setReadPop({ idx: gi, pos: { left, top }, open: true, pinned: !!pinned });
  };
  const closeReadPop = () => {
    clearTimeout(readPopTimer.current);
    setReadPop((p2) => ({ ...p2, open: false, pinned: false }));
  };
  const GUIDE_KEY = "trend-sensing:guide:v1";
  const [guideOpen, setGuideOpen] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_KEY) !== "done";
    } catch (e) {
      return true;
    }
  });
  const closeGuide = () => {
    setGuideOpen(false);
    try {
      localStorage.setItem(GUIDE_KEY, "done");
    } catch (e) {}
  };
  useEffect(() => {
    let alive = true;
    (async () => {
      // 로컬 앱: 브라우저 Blob 다운로드로 파일 저장(Artifact downloads 런타임 대체).
      const local = {
        save: ({ filename, data }) => {
          const blob = new Blob([data], { type: "text/csv;charset=utf-8" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(a.href);
        },
      };
      if (alive) setDlFn(local);
    })();
    return () => {
      alive = false;
    };
  }, []);
  const downloadChart = async () => {
    if (!dlFn) return;
    const groupOf = {};
    let at = 0;
    groupPlan.groups.forEach((g) => {
      for (let i = 0; i < g.count; i++) groupOf[groupPlan.ordered[at++]] = g.label;
    });
    const csv = buildChartCsv(state.week, groupPlan.ordered, groupOf, items, moveOf);
    const name = String(state.week.label || "chart").replace(/\s+/g, "") + "-소비트렌드보드.csv";
    setSettingsOpen(false);
    try {
      await dlFn.save({ filename: name, data: csv });
      dispatch({ type: "SET_TOAST", message: "차트를 CSV로 저장했어요", id: Date.now() });
    } catch (e) {
      if (e && e.code === "declined") return;
      dispatch({
        type: "SET_TOAST",
        message: "저장하지 못했어요 (" + describeSampleError(e) + ")",
        id: Date.now(),
      });
    }
  };
  const nextTopline = () => {
    if (!sampleFn || toplineLoading) return;
    const ready = items.filter((it) => it.status === "ready" && it.reason);
    if (ready.length < 4) return;
    makeTopline(ready, true);
  };
  // 지난 주 스냅숏이 있을 때만 배지를 붙인다. 없으면 아무것도 그리지 않는다 — 없는 걸 NEW로 속이지 않는다.
  const moveOf = (item) => {
    if (!prevChart || !prevChart.map) return null;
    const col = prevChart.map[item.category];
    if (!col) return null;
    const has = prevChart.ids && Object.prototype.hasOwnProperty.call(prevChart.ids, item.id);
    const before = has ? prevChart.ids[item.id] : col[normTitleKey(item.title)];
    if (before === "?") return null;
    if (before == null) return { kind: "new", label: "NEW", title: "지난 주 차트에 없던 항목" };
    const diff = before - item.rank;
    if (diff === 0) return { kind: "same", before, label: "–", title: before + "위 유지" };
    if (diff > 0)
      return { kind: "up", before, label: "▲" + diff, title: before + "위 → " + item.rank + "위" };
    return { kind: "down", before, label: "▼" + -diff, title: before + "위 → " + item.rank + "위" };
  };
  // 새 차트를 올리는 순간, 지금 보고 있던 차트가 지난 주가 된다
  const rememberCurrentChart = (nextItems) => {
    toplineTried.current = false;
    if (sameChart(items, nextItems)) return;
    const snap = snapshotChart(items);
    savePrevChart(snap);
    setPrevChart(snap);
  };
  const [ideaPrefs, setIdeaPrefs] = useState(() => loadPrefs(IDEA_PREF_KEY));
  const [ideaFeedback, setIdeaFeedback] = useState({});
  const ideaKey = (idea, i, runId) => (runId || "") + "|" + i + "|" + idea.title;
  const rateIdea = (idea, i, rating, runId) => {
    const k = ideaKey(idea, i, runId);
    const already = ideaFeedback[k] === rating;
    setIdeaFeedback((m) => {
      const n = { ...m };
      if (already) delete n[k];
      else n[k] = rating;
      return n;
    });
    if (already) return;
    const next = upsertPref(ideaPrefs, rating, {
      title: idea.title,
      gist: String(idea.redefine || idea.solution || idea.challenge || "").slice(0, 160),
      items: (idea.client || "") + " / " + (idea.insight || ""),
    });
    setIdeaPrefs(next);
    savePrefs(next, IDEA_PREF_KEY);
  };
  const clearIdeaPrefs = () => {
    const empty = { liked: [], disliked: [] };
    setIdeaPrefs(empty);
    savePrefs(empty, IDEA_PREF_KEY);
  };
  // 카드에 남긴 좋아요/싫어요를 이 브라우저에 쌓아 다음 묶음 생성 프롬프트에 넣는다
  const rateBundle = (b, rating) => {
    const already = state.feedback[b.bundleId] === rating;
    dispatch({ type: "RATE_BUNDLE", id: b.bundleId, rating });
    if (already) return;
    const labels = (b.itemIds || [])
      .map((id) => {
        const it = byId.get(id);
        return it ? it.category + "·" + it.rank + "위 " + it.title : id;
      })
      .join(", ");
    const next = upsertPref(prefs, rating, {
      title: b.title,
      gist: String(b.content || "").slice(0, 160),
      items: labels,
    });
    setPrefs(next);
    savePrefs(next);
  };
  const clearPrefs = () => {
    const empty = { liked: [], disliked: [] };
    setPrefs(empty);
    savePrefs(empty);
  };
  const popupCloseTimer = useRef(null);
  const autoTriggered = useRef(false);
  const fileInputRef = useRef(null);
  const settingsRef = useRef(null);
  const wantAutoScroll = useRef(false);
  // 설정 드롭다운은 바깥 아무 데나 누르면 닫힌다
  useEffect(() => {
    if (!settingsOpen) return;
    const onDoc = (e) => {
      if (!settingsRef.current || !settingsRef.current.contains(e.target)) setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [settingsOpen]);
  useEffect(() => {
    let alive = true;
    (async () => {
      // 로컬 서버 프록시(/api/sample) → 구독제 claude -p. window.claude 대신 사용.
      const local = {
        json: async (prompt, opts) => {
          const r = await fetch("/api/sample", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt, opts }),
          });
          const d = await r.json();
          if (d && d.error) throw new Error(d.error);
          return d;
        },
      };
      if (alive) setSampleFn(() => local);
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!state.toast) return;
    const id = state.toast.id;
    const t = setTimeout(() => dispatch({ type: "CLEAR_TOAST", id }), 2400);
    return () => clearTimeout(t);
  }, [state.toast]);
  const items = state.items;
  const byId = useMemo(() => {
    const m = new Map();
    items.forEach((it) => m.set(it.id, it));
    return m;
  }, [items]);
  useEffect(() => {
    if (state.isSample || state.mode !== "grid") return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          week: state.week,
          categories: state.categories,
          items: state.items,
          bundles: state.bundles,
          feedback: state.feedback,
          topline: state.topline,
          toplineArchive: state.toplineArchive,
        }),
      );
    } catch (e) {}
  }, [state.isSample, state.mode, state.week, state.categories, state.items, state.bundles]);
  const openPopup = (item, rect, pinned) => {
    clearTimeout(popupCloseTimer.current);
    const pos = computePopupPos(rect, 340, 420);
    setPopup({ item, pos, open: true, pinned: !!pinned });
  };
  const closePopup = () => {
    setPopup((p) => ({ ...p, open: false }));
  };
  // 차트 위 캡션은 주차 라벨 하나로 끝낸다 ("WEEK 36" -> "Week36 TOP 10")
  // 좋아요/별로를 매긴 묶음은 목록에서 접어 아카이브로 보낸다
  const ratingOf = (b) => b.archivedRating || state.feedback[b.bundleId] || null;
  const likedArchive = state.bundles.filter((b) => b.archived && ratingOf(b) === "up");
  const dislikedArchive = state.bundles.filter((b) => b.archived && ratingOf(b) === "down");
  // 요청 5: Client Connect 화면에 있는 동안에는 묶음 추론 결과를 감춘다.
  const ccActive = ccOpen;
  const visibleBundles = ccActive
    ? []
    : state.bundles.filter((b) => !b.archived || (archiveView && ratingOf(b) === archiveView));
  const chartCaption =
    String(state.week.label || "")
      .replace(/\s+/g, "")
      .replace(/^WEEK/i, "Week") + " TOP 10";
  const closePopupOutside = () => {
    setSettingsOpen(false);
    setPopup((p) => (p.pinned ? { ...p, open: false, pinned: false } : p));
  };
  const toggleSelect = (id) => {
    if (state.selected.length >= 10 && !state.selected.includes(id)) {
      dispatch({ type: "SET_TOAST", message: "최대 10개까지 선택할 수 있어요", id: Date.now() });
      return;
    }
    const willAdd = !state.selected.includes(id);
    if (willAdd) {
      const item = byId.get(id);
      if (item && item.variantGroup) {
        const dup = state.selected.some((sid) => item.variantGroup.includes(sid));
        if (dup)
          dispatch({
            type: "SET_TOAST",
            message: "같은 대상이에요. 다른 항목을 고르면 추론이 넓어져요",
            id: Date.now(),
          });
      }
    }
    dispatch({ type: "TOGGLE_SELECT", id });
  };
  const handleFile = async (file) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (!matrix || matrix.length < 2) throw new Error("empty");
      const headerRow = matrix[0];
      const categories = headerRow
        .slice(1)
        .map((c) => String(c || "").trim())
        .filter(Boolean);
      if (categories.length === 0) throw new Error("no categories");
      const dataRows = matrix
        .slice(1, 11)
        .map((row) => categories.map((_, ci) => (row[ci + 1] != null ? row[ci + 1] : "")));
      const items2 = buildItemsFromMatrix(categories, dataRows);
      if (items2.length === 0) throw new Error("no items");
      rememberCurrentChart(items2);
      dispatch({ type: "SET_DATA", categories, items: items2, week: state.week });
    } catch (e) {
      const categories = state.categories.length
        ? state.categories
        : ["카테고리 1", "카테고리 2", "카테고리 3", "카테고리 4", "카테고리 5"];
      const rows = Array.from({ length: 10 }, () => categories.map(() => ""));
      dispatch({ type: "START_MANUAL_EDIT", draft: { categories, rows } });
    }
  };
  const confirmManual = () => {
    const { categories, rows } = state.manualDraft;
    const cats = categories.filter((c) => c.trim());
    const items2 = buildItemsFromMatrix(
      cats.length ? cats : categories,
      rows.map((r) => r.slice(0, cats.length ? cats.length : categories.length)),
    );
    rememberCurrentChart(items2);
    dispatch({
      type: "SET_DATA",
      categories: cats.length ? cats : categories,
      items: items2,
      week: state.week,
    });
  };
  const runAnalysis = async () => {
    if (!sampleFn) return;
    dispatch({ type: "ANALYSIS_START" });
    // 이유가 이미 발행된 항목은 건드리지 않는다. 비어 있는 카테고리만 부른다.
    const entries = Array.from(groupByCategory(items).entries())
      .map(([category, list]) => [category, list.filter((it) => !it.reason)])
      .filter((e) => e[1].length > 0);
    if (entries.length === 0) {
      dispatch({ type: "ITEMS_FAILED", ids: [] });
      return;
    }
    setAnalysisProgress({ done: 0, total: entries.length });
    // 5개 카테고리를 동시에 부른다 — 예전 CTA 버전(느리지만 성공)과 같은 방식이다.
    // 순서대로 하나씩 부르면 안전할 거라 생각해 한동안 순차 호출로 바꿨었지만, 실제
    // 회귀 원인은 따로(있던 signal 옵션) 있었다. 순차 호출은 필요도 없이 전체 대기
    // 시간만 최대 5배로 늘렸을 뿐이라 다시 병렬로 되돌린다.
    await Promise.all(
      entries.map(([category, catItems]) =>
        runCategory(category, catItems).then(() => {
          setAnalysisProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
        }),
      ),
    );
    setAnalysisProgress(null);
  };
  // 분석이 끝난 뒤(=최신 items가 리듀서에 반영된 뒤) 한 번만 뽑는다. 실패해도 나머지 화면에는 영향이 없다.
  const toplineTried = useRef(false);
  useEffect(() => {
    if (!sampleFn || state.topline || toplineTried.current) return;
    if (state.analysisState !== "done") return;
    const ready = items.filter((it) => it.status === "ready" && it.reason);
    if (ready.length < 4) return;
    toplineTried.current = true;
    makeTopline(ready);
  }, [state.analysisState, state.topline, items, sampleFn]);
  const makeTopline = async (ready, replace) => {
    if (!sampleFn || !ready || ready.length < 4) return;
    setToplineLoading(true);
    try {
      const seen = (state.topline ? [state.topline] : [])
        .concat(state.toplineArchive || [])
        .map((x) => x.headline)
        .filter(Boolean);
      const r = await sampleWithTimeout(
        sampleFn,
        buildToplinePrompt(state.week, ready, replace ? seen : null),
        { modelTier: "complex" },
        9e4,
      );
      const headline = asText((r && r.headline) || "");
      const kws = (r && Array.isArray(r.keywords) ? r.keywords : [])
        .map(asText)
        .map((k) => k.replace(/^#+/, "").trim())
        .filter(Boolean)
        .slice(0, 8);
      const brand = (r && Array.isArray(r.brand) ? r.brand : [])
        .map(asText)
        .filter(Boolean)
        .slice(0, 2);
      if (headline)
        dispatch({
          type: replace ? "PUSH_TOPLINE" : "SET_TOPLINE",
          topline: { headline, note: asText((r && r.note) || ""), keywords: kws, brand },
        });
    } catch (e) {
    } finally {
      setToplineLoading(false);
    }
  };
  const runCategory = async (category, catItems) => {
    try {
      const prompt = buildReasonPrompt(state.week, category, catItems, moveOf);
      const result = await sampleWithTimeout(sampleFn, prompt, { modelTier: "complex" }, 150e3);
      if (!Array.isArray(result)) throw new Error("shape mismatch");
      const updates = [];
      const failedIds = [];
      catItems.forEach((it, i) => {
        const r = result[i];
        if (!r || !r.headline) {
          failedIds.push(it.id);
          return;
        }
        const vg = Array.isArray(r.variantGroup)
          ? r.variantGroup.map((n) => catItems[n - 1] && catItems[n - 1].id).filter(Boolean)
          : null;
        updates.push({
          id: it.id,
          itemType: r.itemType || "content",
          reason: normalizeReason(r),
          variantGroup: vg && vg.length > 1 ? vg : null,
        });
      });
      if (updates.length) dispatch({ type: "CATEGORY_REASONS_READY", updates });
      if (failedIds.length)
        dispatch({ type: "ITEMS_FAILED", ids: failedIds, reason: "응답에 헤드라인 없음" });
    } catch (e) {
      dispatch({
        type: "ITEMS_FAILED",
        ids: catItems.map((it) => it.id),
        reason: describeSampleError(e),
      });
    }
  };
  const runSingleItem = async (item) => {
    if (!sampleFn) return;
    dispatch({ type: "ITEMS_LOADING", ids: [item.id] });
    try {
      const prompt = buildReasonPrompt(state.week, item.category, [item], moveOf);
      const result = await sampleWithTimeout(sampleFn, prompt, { modelTier: "complex" }, 6e4);
      const r = Array.isArray(result) ? result[0] : null;
      if (!r || !r.headline) throw new Error("empty");
      dispatch({
        type: "CATEGORY_REASONS_READY",
        updates: [
          {
            id: item.id,
            itemType: r.itemType || "content",
            reason: normalizeReason(r),
            variantGroup: null,
          },
        ],
      });
    } catch (e) {
      dispatch({ type: "ITEMS_FAILED", ids: [item.id], reason: describeSampleError(e) });
    }
  };
  // 켜자마자 도는 자동 분석은 없다. 화면은 사전 작성된 기본 분석으로 이미 완성돼 있고,
  // AI 재분석은 "분석하기" CTA를 눌렀을 때만 시작된다. 묶음 추론 5개 자동 생성도
  // 지금은 켜지 않는다(사용자 요청: 나중에).
  useEffect(() => {
    if (state.analysisState !== "running") {
      setElapsedSec(0);
      return;
    }
    const started = Date.now();
    const t = setInterval(() => setElapsedSec(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [state.analysisState]);
  const regenerateAll = () => {
    if (!sampleFn || state.analysisState === "running") return;
    autoTriggered.current = false;
    dispatch({ type: "RESET_FOR_REANALYSIS" });
  };
  // 묶음 실패 사유는 코드가 아니라 사람이 읽고 그대로 전달할 수 있는 한국어로 남긴다.
  const autoFail = (msg) => {
    const e = new Error(msg);
    e.name = "";
    return e;
  };
  React.useEffect(() => {
    if (!wantAutoScroll.current) return;
    if (state.autoStatus !== "done" && state.autoStatus !== "error") return;
    wantAutoScroll.current = false;
    const el = document.getElementById(
      state.autoStatus === "error" ? "bundle-error" : "bundle-list",
    );
    if (el && el.scrollIntoView) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_) {
        el.scrollIntoView();
      }
    }
  }, [state.autoStatus, state.bundles.length]);
  useEffect(() => {
    if (ccStatus !== "loading") return;
    setCcSec(0);
    const t = setInterval(() => setCcSec((v) => v + 1), 1e3);
    return () => clearInterval(t);
  }, [ccStatus]);
  const runClientConnect = async (client, brand) => {
    if (!sampleFn || !prefs.liked.length) return;
    const label = client ? client.name + (brand ? " · " + brand : "") : "AI 자동 선택";
    setCcError(null);
    setCcLabel(label);
    setCcStatus("loading");
    // 새로 돌리는 순간 지난 제안은 아카이브로 내려간다
    setCcRuns((rs) => rs.map((r) => ({ ...r, archived: true })));
    setCcArchiveOpen(false);
    try {
      const prompt = client
        ? buildClientPrompt(client, prefs.liked, ideaPrefs, brand)
        : buildAutoClientPrompt(CLIENTS, prefs.liked, ideaPrefs);
      const result = await sampleWithTimeout(sampleFn, prompt, { modelTier: "complex" }, 12e4);
      const ideas = normalizeIdeas(result, client ? label : "");
      const runId = "cc-" + Date.now();
      setCcRuns((rs) => [{ id: runId, label, ideas, archived: false }].concat(rs));
      setCcOpenIdea(runId + "|0");
      setCcStatus("done");
    } catch (e) {
      setCcError(describeSampleError(e));
      setCcStatus("error");
    }
  };
  const runAuto = async () => {
    wantAutoScroll.current = true;
    dispatch({ type: "AUTO_LOADING" });
    try {
      const readyItems = items.filter((it) => it.status === "ready" && it.reason);
      if (readyItems.length < 4)
        throw autoFail("이유 분석이 끝난 항목이 너무 적어요. 먼저 항목 이유 분석을 끝내주세요.");
      const prompt = buildAutoPrompt(state.week, readyItems, prefs);
      const result = await sampleWithTimeout(sampleFn, prompt, { modelTier: "complex" }, 150e3);
      const rawList = Array.isArray(result)
        ? result
        : result && Array.isArray(result.bundles)
          ? result.bundles
          : null;
      if (!rawList || rawList.length === 0)
        throw autoFail("AI 응답에 묶음이 하나도 없었어요. 다시 시도해 주세요.");
      // AI가 id 대신 항목명을 돌려주는 경우가 있어, id → 정확한 제목 → 부분 일치 순으로 되찾는다.
      const idSet = new Set(readyItems.map((i) => i.id));
      const norm = (v) =>
        asText(v)
          .toLowerCase()
          .replace(/[\s\-_·,.'"()\[\]]/g, "");
      const titleMap = new Map();
      readyItems.forEach((it) => {
        const k = norm(it.title);
        if (k) titleMap.set(k, it.id);
      });
      const resolveId = (v) => {
        const raw = asText(v);
        if (idSet.has(raw)) return raw;
        const k = norm(raw);
        if (!k) return null;
        if (titleMap.has(k)) return titleMap.get(k);
        for (const [tk, tid] of titleMap) if (tk.includes(k) || k.includes(tk)) return tid;
        return null;
      };
      const bundles = rawList
        .map((b) => ({
          itemIds: Array.from(
            new Set(((b && (b.itemIds || b.items || b.ids)) || []).map(resolveId).filter(Boolean)),
          ),
          title: asText((b && b.title) || ""),
          content: asText((b && b.content) || ""),
          keywords: (b && Array.isArray(b.keywords) ? b.keywords : [])
            .map(asText)
            .map((k) => k.replace(/^#+/, "").trim())
            .filter(Boolean)
            .slice(0, 6),
        }))
        .filter((b) => b.itemIds.length >= 2 && b.title && b.content);
      if (bundles.length === 0)
        throw autoFail("AI가 고른 항목을 이번 주 차트에서 찾지 못했어요. 다시 시도해 주세요.");
      dispatch({ type: "AUTO_READY", bundles });
    } catch (e) {
      dispatch({ type: "AUTO_FAILED", reason: describeSampleError(e) });
    }
  };
  const createBundle = async () => {
    if (state.selected.length < 2 || !sampleFn) return;
    const picks = state.selected.map((id) => byId.get(id)).filter((it) => it && it.reason);
    if (picks.length < 2) return;
    setBundleLoading(true);
    try {
      const prompt = buildBundlePrompt(state.week, picks);
      const result = await sampleWithTimeout(sampleFn, prompt, { modelTier: "complex" }, 6e4);
      dispatch({
        type: "BUNDLE_CREATED",
        bundle: {
          bundleId: uid("b"),
          itemIds: [...state.selected],
          title: asText((result && result.title) || ""),
          content: asText((result && result.content) || ""),
          keywords: (result && Array.isArray(result.keywords) ? result.keywords : [])
            .map(asText)
            .map((k) => k.replace(/^#+/, "").trim())
            .filter(Boolean)
            .slice(0, 6),
        },
      });
    } catch (e) {
      dispatch({
        type: "SET_TOAST",
        message: `묶음을 만들지 못했어요 (${describeSampleError(e)})`,
        id: Date.now(),
      });
    } finally {
      setBundleLoading(false);
    }
  };
  const dimmedSet = useMemo(() => {
    if (!hoveredBundleId) return null;
    const b = state.bundles.find((x) => x.bundleId === hoveredBundleId);
    return b ? new Set(b.itemIds) : null;
  }, [hoveredBundleId, state.bundles]);
  const echoSet = useMemo(() => (hoveredEcho ? new Set(hoveredEcho) : null), [hoveredEcho]);
  const analysisDone = state.analysisState === "done";
  const analysisPct =
    analysisProgress && analysisProgress.total
      ? Math.round((analysisProgress.done / analysisProgress.total) * 100)
      : 0;
  const hasRealAnalysis = items.some((it) => it.reason && !it.prefilled);
  const missingReasonCount = items.filter((it) => it.raw && !it.reason).length;
  const needsReasons = missingReasonCount > 0;
  const h = React.createElement;
  const groupPlan = buildGroupPlan(state.categories);
  const gridCats = groupPlan.ordered;
  const ccGrey = {
    fontSize: 11.5,
    fontWeight: 700,
    color: "var(--ink-soft)",
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    borderRadius: 999,
    padding: "5px 11px",
    cursor: "pointer",
  };
  const ccLink = {
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 11.5,
    color: "var(--ink-faint)",
    textDecoration: "underline",
    cursor: "pointer",
  };
  const ccTag = {
    fontSize: 11,
    fontWeight: 700,
    color: "#fff",
    background: "var(--accent)",
    borderRadius: 999,
    padding: "3px 9px",
  };
  const ccTagSoft = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--ink-soft)",
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    borderRadius: 999,
    padding: "3px 9px",
  };
  const ccReady = !!sampleFn && prefs.liked.length > 0 && ccStatus !== "loading";
  const ccPickObj = CLIENTS.find((x) => x.id === ccPick) || null;
  const ccQ = ccQuery.trim().toLowerCase();
  const ccClients = ccQ
    ? CLIENTS.filter((c) =>
        (c.name + " " + c.note + " " + (c.brands || []).join(" ")).toLowerCase().includes(ccQ),
      )
    : CLIENTS;
  const hasLiveBundles = state.bundles.some((b) => !b.archived);
  const ccCurrent = ccRuns.find((r) => !r.archived) || null;
  const ccArchived = ccRuns.filter((r) => r.archived);
  const ccShownRuns = ccCurrent ? [ccCurrent] : [];
  const ccFiledList = Object.keys(ccFiled)
    .sort((a, b) => ccFiled[b].at - ccFiled[a].at)
    .map((k) => [k, ccFiled[k]]);
  const ccArchiveCount = ccFiledList.length + ccArchived.reduce((n, r) => n + r.ideas.length, 0);
  const guideEl =
    guideOpen && state.mode === "grid"
      ? h(
          "div",
          {
            className: "card",
            style: { padding: "20px 24px", marginBottom: 18, background: "var(--surface-2)" },
          },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
              },
            },
            h("div", { style: { fontSize: 14, fontWeight: 800 } }, "이 보드를 쓰는 법"),
            h("button", { onClick: closeGuide, style: ccGrey }, "알겠어요"),
          ),
          h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
                gap: 14,
              },
            },
            [
              [
                "차트의 칸에 커서를 올린다",
                "그 항목이 왜 상위에 올랐는지, 이유와 키워드가 바로 뜬다. 엑셀을 올리고 분석하면 칸마다 채워진다.",
              ],
              [
                "트렌드 합성하기",
                "카테고리를 가로지르는 묶음 추론을 만든다. 카드에 좋아요를 남기면 다음 세트가 그 취향을 따라간다.",
              ],
              [
                "Client Connect",
                "좋아요한 인사이트를 광고주 과제와 엮어 매니페스토와 실행 아이디어를 만든다.",
              ],
            ].map((g, gi) =>
              h(
                "div",
                { key: gi },
                h(
                  "div",
                  { style: { display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 } },
                  h(
                    "span",
                    {
                      className: "mono",
                      style: { fontSize: 11, fontWeight: 800, color: "var(--accent-ink)" },
                    },
                    gi + 1,
                  ),
                  h(
                    "div",
                    { style: { fontSize: 13.5, fontWeight: 800, wordBreak: "keep-all" } },
                    g[0],
                  ),
                ),
                h(
                  "p",
                  {
                    style: {
                      fontSize: 12.5,
                      lineHeight: 1.65,
                      color: "var(--ink-soft)",
                      margin: 0,
                      wordBreak: "keep-all",
                    },
                  },
                  g[1],
                ),
              ),
            ),
          ),
          h(
            "p",
            {
              style: {
                fontSize: 11.5,
                color: "var(--ink-faint)",
                margin: "14px 0 0",
                lineHeight: 1.6,
              },
            },
            "AI 기능은 처음 누를 때 사용 동의를 한 번 묻는다. 업로드한 차트와 평가 기록은 각자의 브라우저에만 남고 다른 사람에게 보이지 않는다.",
          ),
        )
      : null;
  const readsEl =
    state.mode === "grid" && GROUP_READS.length
      ? h(
          "div",
          { style: { marginBottom: 18 } },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: readsOpen ? 10 : 0,
              },
            },
            h(
              "div",
              {
                style: {
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "var(--ink-faint)",
                  letterSpacing: ".01em",
                },
              },
              "카테고리 해석",
            ),
            h(
              "button",
              { onClick: toggleReads, style: ccGrey },
              readsOpen ? "숨기기" : "펼치기 " + GROUP_READS.length,
            ),
          ),
          readsOpen
            ? h(
                "div",
                { className: "read-grid" },
                GROUP_READS.map((g, gi) =>
                  h(
                    "div",
                    {
                      key: gi,
                      className:
                        "read-card" + (readPop.open && readPop.idx === gi ? " is-flipped" : ""),
                      onMouseEnter: (e) => {
                        if (!isTouchDevice())
                          openReadPop(gi, e.currentTarget.getBoundingClientRect(), false);
                      },
                      onMouseLeave: () => {
                        if (!isTouchDevice()) {
                          clearTimeout(readPopTimer.current);
                          readPopTimer.current = setTimeout(
                            () => setReadPop((p2) => (p2.pinned ? p2 : { ...p2, open: false })),
                            140,
                          );
                        }
                      },
                      onClick: (e) => {
                        if (readPop.open && readPop.idx === gi) {
                          closeReadPop();
                        } else {
                          openReadPop(gi, e.currentTarget.getBoundingClientRect(), true);
                        }
                      },
                    },
                    h(
                      "div",
                      {
                        style: {
                          fontSize: 12,
                          fontWeight: 800,
                          color: "var(--accent-ink)",
                          marginBottom: 8,
                        },
                      },
                      g.group,
                    ),
                    h(
                      "div",
                      {
                        style: {
                          fontSize: 14.5,
                          fontWeight: 800,
                          lineHeight: 1.45,
                          letterSpacing: "-.01em",
                          wordBreak: "keep-all",
                        },
                      },
                      g.headline,
                    ),
                    h(
                      "div",
                      { style: { fontSize: 11.5, color: "var(--ink-faint)", marginTop: 10 } },
                      "커서를 올리면 자세히 →",
                    ),
                  ),
                ),
              )
            : null,
        )
      : null;
  const readPopG = readPop.idx == null ? null : GROUP_READS[readPop.idx];
  const readPopEl = h(
    "div",
    {
      className: "reason-pop read-pop" + (readPop.open && readPopG ? " is-open" : ""),
      style: { left: readPop.pos.left, top: readPop.pos.top },
      onMouseEnter: () => {
        if (!isTouchDevice()) clearTimeout(readPopTimer.current);
      },
      onMouseLeave: () => {
        if (!isTouchDevice() && !readPop.pinned) {
          readPopTimer.current = setTimeout(
            () => setReadPop((p2) => ({ ...p2, open: false })),
            140,
          );
        }
      },
    },
    readPopG
      ? h(
          React.Fragment,
          null,
          h(
            "div",
            {
              className: "mono",
              style: {
                fontSize: 11,
                fontWeight: 600,
                color: "var(--ink-faint)",
                marginBottom: 6,
                letterSpacing: ".02em",
              },
            },
            readPopG.group,
          ),
          h(
            "div",
            {
              className: "balance",
              style: {
                fontSize: 19,
                fontWeight: 900,
                lineHeight: 1.28,
                letterSpacing: "-.01em",
                marginBottom: 8,
                wordBreak: "keep-all",
              },
            },
            readPopG.popHead,
          ),
          h(
            "p",
            {
              style: {
                fontSize: 13,
                color: "var(--ink-soft)",
                lineHeight: 1.6,
                margin: "0 0 10px",
                wordBreak: "keep-all",
              },
            },
            readPopG.summary,
          ),
          h(
            "div",
            { style: { marginBottom: 8 } },
            readPopG.points.map((pt, pi) =>
              h(
                "div",
                { className: "reason-row", key: pi },
                h("span", { className: "reason-rank mono" }, pi + 1),
                h(
                  "div",
                  {
                    style: {
                      fontSize: 12.5,
                      color: "var(--ink)",
                      lineHeight: 1.55,
                      wordBreak: "keep-all",
                    },
                  },
                  pt,
                ),
              ),
            ),
          ),
          h(
            "div",
            { style: { paddingTop: 8, borderTop: "1px solid var(--line)" } },
            readPopG.keywords.map((k, ki) => h("span", { className: "chip", key: ki }, k)),
          ),
        )
      : null,
  );
  const toplineEl =
    state.mode === "grid" && (state.topline || toplineLoading)
      ? h(
          "div",
          { style: { marginBottom: 18 } },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: topOpen ? 10 : 0,
              },
            },
            h(
              "div",
              {
                style: {
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "var(--ink-faint)",
                  letterSpacing: ".01em",
                },
              },
              "이번 주 해석",
            ),
            h("button", { onClick: toggleTop, style: ccGrey }, topOpen ? "숨기기" : "펼치기"),
          ),
          topOpen &&
            h(
              "div",
              { className: "card topline-card", style: { borderTop: "3px solid var(--accent)" } },
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  },
                },
                h(
                  "div",
                  {
                    className: "mono",
                    style: {
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: ".09em",
                      color: "var(--accent-ink)",
                    },
                  },
                  "THIS WEEK — ONE LINE",
                ),
                h(
                  "div",
                  { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
                  (state.toplineArchive || []).length
                    ? h(
                        "button",
                        { onClick: () => setToplineArchiveOpen((v) => !v), style: ccGrey },
                        toplineArchiveOpen
                          ? "아카이브 닫기"
                          : "아카이브 다시보기 " + state.toplineArchive.length,
                      )
                    : null,
                  h(
                    "button",
                    {
                      onClick: nextTopline,
                      disabled: !sampleFn || toplineLoading,
                      style: Object.assign({}, ccGrey, {
                        opacity: !sampleFn || toplineLoading ? 0.5 : 1,
                      }),
                    },
                    toplineLoading ? "찾는 중…" : "다른 인사이트 찾아보기",
                  ),
                ),
              ),
              toplineLoading && !state.topline
                ? h(
                    React.Fragment,
                    null,
                    h("div", {
                      className: "shimmer",
                      style: { height: 22, borderRadius: 6, width: "68%" },
                    }),
                    h("div", {
                      className: "shimmer",
                      style: { height: 14, borderRadius: 6, width: "88%", marginTop: 12 },
                    }),
                  )
                : h(
                    "div",
                    { className: "topline-grid" },
                    h(
                      "div",
                      { className: "topline-col topline-col-a" },
                      h("div", { className: "topline-head" }, state.topline.headline),
                      state.topline.keywords && state.topline.keywords.length
                        ? h(
                            "div",
                            { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 18 } },
                            state.topline.keywords.map((k, ki) =>
                              h(
                                "span",
                                {
                                  key: ki,
                                  style: {
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "var(--accent-ink)",
                                    background: "var(--accent-soft)",
                                    borderRadius: 999,
                                    padding: "6px 12px",
                                  },
                                },
                                "#" + k,
                              ),
                            ),
                          )
                        : null,
                    ),
                    h(
                      "div",
                      { className: "topline-col topline-col-b" },
                      state.topline.note
                        ? h(
                            React.Fragment,
                            null,
                            h(
                              "div",
                              {
                                className: "mono",
                                style: {
                                  fontSize: 12,
                                  fontWeight: 800,
                                  letterSpacing: ".06em",
                                  color: "var(--accent-ink)",
                                  marginBottom: 10,
                                },
                              },
                              "WHY NOW",
                            ),
                            h("p", { className: "topline-body" }, hlText(state.topline.note)),
                          )
                        : null,
                      state.topline.brand && state.topline.brand.length
                        ? h(
                            "div",
                            {
                              style: {
                                marginTop: 18,
                                paddingTop: 16,
                                borderTop: "1px solid var(--line)",
                              },
                            },
                            h(
                              "div",
                              {
                                className: "mono",
                                style: {
                                  fontSize: 12,
                                  fontWeight: 800,
                                  letterSpacing: ".04em",
                                  color: "var(--accent-ink)",
                                  marginBottom: 10,
                                },
                              },
                              "To. 브랜드",
                            ),
                            state.topline.brand.map((para, pi) =>
                              h(
                                "p",
                                {
                                  key: pi,
                                  className: "topline-body",
                                  style: { marginTop: pi ? 10 : 0 },
                                },
                                hlText(para),
                              ),
                            ),
                          )
                        : null,
                    ),
                  ),
            ),
        )
      : null;
  const toplineArchiveEl =
    state.mode === "grid" && toplineArchiveOpen && (state.toplineArchive || []).length
      ? h(
          "div",
          { style: { marginBottom: 18, display: "flex", flexDirection: "column", gap: 10 } },
          state.toplineArchive.map((tl, i) =>
            h(
              "div",
              { key: i, className: "card", style: { padding: "18px 22px", opacity: 0.82 } },
              h(
                "div",
                {
                  className: "mono",
                  style: {
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: ".08em",
                    color: "var(--ink-faint)",
                    marginBottom: 8,
                  },
                },
                "ARCHIVED #" + (state.toplineArchive.length - i),
              ),
              h(
                "div",
                {
                  style: {
                    fontSize: 17,
                    fontWeight: 800,
                    lineHeight: 1.35,
                    letterSpacing: "-.01em",
                    wordBreak: "keep-all",
                  },
                },
                tl.headline,
              ),
              tl.note
                ? h("p", { className: "topline-body", style: { marginTop: 8 } }, hlText(tl.note))
                : null,
              tl.keywords && tl.keywords.length
                ? h(
                    "div",
                    { style: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 } },
                    tl.keywords.map((k, ki) =>
                      h(
                        "span",
                        {
                          key: ki,
                          style: {
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: "var(--ink-soft)",
                            background: "var(--surface-2)",
                            borderRadius: 999,
                            padding: "4px 9px",
                          },
                        },
                        "#" + k,
                      ),
                    ),
                  )
                : null,
            ),
          ),
        )
      : null;
  const ccPanelEl = ccOpen
    ? h(
        "div",
        {
          className: "card",
          style: { marginTop: 16, padding: 20, width: "100%", maxWidth: 560, textAlign: "left" },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
            },
          },
          h("div", { style: { fontSize: 15, fontWeight: 800 } }, "Client Connect"),
          h("button", { onClick: () => setCcOpen(false), style: ccLink }, "닫기"),
        ),
        h(
          "p",
          {
            style: {
              fontSize: 12.5,
              color: "var(--ink-soft)",
              margin: "6px 0 14px",
              lineHeight: 1.55,
            },
          },
          prefs.liked.length
            ? "좋아요한 인사이트 " +
                prefs.liked.length +
                "편을 광고주 과제와 엮어 실행 아이디어를 최대 3개 만듭니다. 억지로 엮이는 건 내지 않습니다."
            : "좋아요한 글이 아직 없습니다. 묶음 추론 카드에 좋아요를 남기면 그 글로 아이디어를 만듭니다.",
        ),
        h(
          "button",
          {
            className: "btn btn-ghost",
            style: { width: "100%" },
            disabled: !ccReady,
            onClick: () => runClientConnect(null),
          },
          "Auto Select",
        ),
        h("div", { style: { height: 1, background: "var(--line)", margin: "16px 0 12px" } }),
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 8,
            },
          },
          h(
            "div",
            { style: { fontSize: 11.5, fontWeight: 700, color: "var(--ink-faint)" } },
            "광고주 선택 (1개)",
          ),
          h("input", {
            className: "manual-input",
            value: ccQuery,
            onChange: (e) => setCcQuery(e.target.value),
            placeholder: "이름으로 찾기",
            style: { width: 130, fontSize: 12, padding: "6px 8px" },
          }),
        ),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(158px,1fr))",
              gap: 8,
              maxHeight: 264,
              overflowY: "auto",
              paddingRight: 2,
            },
          },
          ccClients.length === 0
            ? h(
                "div",
                { style: { fontSize: 12.5, color: "var(--ink-faint)", padding: "8px 2px" } },
                "찾는 광고주가 없어요",
              )
            : ccClients.map((c) =>
                h(
                  "button",
                  {
                    key: c.id,
                    "aria-pressed": ccPick === c.id,
                    onClick: () => {
                      setCcPick(c.id);
                      setCcBrand(null);
                    },
                    style: {
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 12,
                      cursor: "pointer",
                      border: "1px solid " + (ccPick === c.id ? "var(--accent)" : "var(--line)"),
                      background: ccPick === c.id ? "rgba(49,130,246,.08)" : "transparent",
                    },
                  },
                  h(
                    "div",
                    { style: { fontSize: 13, fontWeight: 700, color: "var(--ink)" } },
                    c.name,
                  ),
                  h(
                    "div",
                    { style: { fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2 } },
                    c.note,
                  ),
                ),
              ),
        ),
        ccPickObj && ccPickObj.brands
          ? h(
              "div",
              { style: { marginTop: 14 } },
              h(
                "div",
                {
                  style: {
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "var(--ink-faint)",
                    marginBottom: 8,
                  },
                },
                ccPickObj.name + " 하위 브랜드 (선택)",
              ),
              h(
                "div",
                { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                [null]
                  .concat(ccPickObj.brands)
                  .map((b, i) =>
                    h(
                      "button",
                      {
                        key: i,
                        onClick: () => setCcBrand(b),
                        style: {
                          fontSize: 12.5,
                          fontWeight: 600,
                          padding: "6px 11px",
                          borderRadius: 999,
                          cursor: "pointer",
                          color: ccBrand === b ? "#fff" : "var(--ink)",
                          background: ccBrand === b ? "var(--accent)" : "transparent",
                          border: "1px solid " + (ccBrand === b ? "var(--accent)" : "var(--line)"),
                        },
                      },
                      b || "모기업 전체",
                    ),
                  ),
              ),
            )
          : null,
        h(
          "button",
          {
            className: "btn btn-primary",
            style: { width: "100%", marginTop: 14 },
            disabled: !ccReady || !ccPick,
            onClick: () => {
              if (ccPickObj) runClientConnect(ccPickObj, ccBrand);
            },
          },
          ccStatus === "loading"
            ? "만드는 중 · " + ccSec + "초"
            : ccPickObj
              ? (ccBrand || ccPickObj.name) + " 아이디어 만들기"
              : "실행하기",
        ),
      )
    : null;
  const ideaCard = (run) => (idea, i) => {
    const k = run.id + "|" + i;
    const open = ccOpenIdea === k;
    const fb = ideaFeedback[ideaKey(idea, i, run.id)];
    return h(
      "div",
      {
        key: k,
        className: "card idea-card" + (open ? " is-open" : ""),
        style: { marginBottom: 12, opacity: run.archived ? 0.72 : 1 },
        onClick: () => setCcOpenIdea(k),
      },
      open
        ? h(
            "div",
            { style: { padding: 22 } },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 10,
                },
              },
              idea.client ? h("span", { style: ccTag }, idea.client) : h("span"),
              h(
                "button",
                {
                  style: ccGrey,
                  onClick: (e) => {
                    e.stopPropagation();
                    fileIdea(run, i);
                  },
                },
                "아카이브 하기",
              ),
            ),
            h(
              "div",
              {
                className: "mono",
                style: {
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  color: "var(--ink-faint)",
                  marginBottom: 6,
                },
              },
              "MANIFESTO",
            ),
            h(
              "h3",
              {
                style: {
                  fontSize: 19,
                  fontWeight: 900,
                  margin: "0 0 16px",
                  letterSpacing: "-.02em",
                  wordBreak: "keep-all",
                },
              },
              idea.title,
            ),
            [idea.now, idea.challenge, idea.redefine, idea.solution]
              .filter(Boolean)
              .map((para, pi) =>
                h(
                  "p",
                  { key: pi, className: "topline-body verse", style: { marginTop: pi ? 16 : 0 } },
                  hlText(para),
                ),
              ),
            idea.actions && idea.actions.length
              ? h(
                  "div",
                  { style: { marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" } },
                  h(
                    "div",
                    {
                      className: "mono",
                      style: {
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: ".1em",
                        color: "var(--ink-faint)",
                        marginBottom: 12,
                      },
                    },
                    "ACTIONS",
                  ),
                  idea.actions.map((a, ai) =>
                    h(
                      "div",
                      { key: ai, style: { display: "flex", gap: 10, marginTop: ai ? 12 : 0 } },
                      h(
                        "span",
                        {
                          className: "mono",
                          style: {
                            flexShrink: 0,
                            fontSize: 11,
                            fontWeight: 800,
                            color: "var(--accent-ink)",
                            background: "var(--accent-soft)",
                            borderRadius: 999,
                            width: 20,
                            height: 20,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginTop: 2,
                          },
                        },
                        ai + 1,
                      ),
                      h(
                        "div",
                        { style: { minWidth: 0 } },
                        a.title
                          ? h(
                              "div",
                              {
                                style: {
                                  fontSize: 14,
                                  fontWeight: 800,
                                  lineHeight: 1.45,
                                  wordBreak: "keep-all",
                                },
                              },
                              a.title,
                            )
                          : null,
                        a.detail
                          ? h(
                              "p",
                              { className: "topline-body", style: { marginTop: 3 } },
                              hlText(a.detail),
                            )
                          : null,
                      ),
                    ),
                  ),
                )
              : null,
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid var(--line)",
                  flexWrap: "wrap",
                },
                onClick: (e) => e.stopPropagation(),
              },
              h(
                "span",
                { style: { fontSize: 12, color: "var(--ink-faint)", marginRight: 2 } },
                "이 아이디어 어때요?",
              ),
              h(
                "button",
                {
                  className: "btn",
                  style: {
                    fontSize: 13,
                    padding: "7px 14px",
                    background: fb === "up" ? "var(--accent)" : "var(--surface-2)",
                    color: fb === "up" ? "#fff" : "var(--ink)",
                  },
                  onClick: () => rateIdea(idea, i, "up", run.id),
                },
                "좋아요",
              ),
              h(
                "button",
                {
                  className: "btn",
                  style: {
                    fontSize: 13,
                    padding: "7px 14px",
                    background: fb === "down" ? "var(--ink)" : "var(--surface-2)",
                    color: fb === "down" ? "#fff" : "var(--ink)",
                  },
                  onClick: () => rateIdea(idea, i, "down", run.id),
                },
                "별로예요",
              ),
              fb
                ? h(
                    "span",
                    { style: { fontSize: 11.5, color: "var(--ink-faint)" } },
                    "다음 실행 아이디어에 반영됩니다",
                  )
                : null,
            ),
          )
        : h(
            "div",
            { className: "idea-collapsed-row" },
            idea.client
              ? h("span", { style: Object.assign({}, ccTag, { flexShrink: 0 }) }, idea.client)
              : null,
            h(
              "div",
              {
                style: {
                  fontSize: 14.5,
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              },
              idea.title,
            ),
            fb
              ? h(
                  "span",
                  {
                    style: {
                      marginLeft: "auto",
                      flexShrink: 0,
                      fontSize: 11,
                      fontWeight: 700,
                      color: fb === "up" ? "var(--accent-ink)" : "var(--ink-faint)",
                    },
                  },
                  fb === "up" ? "좋아요" : "별로",
                )
              : null,
          ),
    );
  };
  const runBlock = (run) =>
    h(
      "div",
      { key: run.id, style: { marginTop: 20 } },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 10,
            flexWrap: "wrap",
          },
        },
        h(
          "div",
          {
            style: {
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink-faint)",
              letterSpacing: ".01em",
            },
          },
          "Client Connect \xB7 " + run.label,
        ),
        run.archived
          ? h(
              "span",
              { style: { fontSize: 11, fontWeight: 700, color: "var(--ink-faint)" } },
              "지난 제안",
            )
          : null,
      ),
      run.ideas.length === 0
        ? h(
            "div",
            { className: "card", style: { padding: 22 } },
            h(
              "div",
              { style: { fontSize: 14, fontWeight: 700, marginBottom: 6 } },
              "억지로 엮지 않았습니다",
            ),
            h(
              "p",
              { style: { fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.65 } },
              "이 광고주와 자연스럽게 이어지는 아이디어를 찾지 못했어요. 다른 광고주를 고르거나, 좋아요한 글을 더 쌓은 뒤 다시 실행해 주세요.",
            ),
          )
        : run.ideas.map((idea, i) => (ccFiled[run.id + "|" + i] ? null : ideaCard(run)(idea, i))),
    );
  const ccResultsEl = ccOpen
    ? h(
        "div",
        { id: "cc-results", style: { marginTop: 8 } },
        ccStatus === "loading"
          ? h(
              "div",
              { className: "card", style: { padding: 22, marginTop: 20 } },
              h("div", {
                className: "shimmer",
                style: { height: 14, borderRadius: 6, width: "72%" },
              }),
              h("div", {
                className: "shimmer",
                style: { height: 14, borderRadius: 6, width: "48%", marginTop: 10 },
              }),
              h(
                "div",
                { style: { fontSize: 12.5, color: "var(--ink-faint)", marginTop: 14 } },
                ccLabel + " 과제와 엮는 중 \xB7 " + ccSec + "초 (보통 30~60초)",
              ),
            )
          : null,
        ccStatus === "error"
          ? h(
              "div",
              { className: "card", style: { padding: 22, marginTop: 20 } },
              h(
                "div",
                {
                  style: { fontSize: 14, fontWeight: 700, color: "var(--danger)", marginBottom: 6 },
                },
                "아이디어를 만들지 못했어요",
              ),
              h(
                "p",
                { style: { fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px" } },
                ccError || "",
              ),
              h(
                "button",
                { className: "btn btn-line", onClick: () => setCcStatus("idle") },
                "확인",
              ),
            )
          : null,
        ccArchiveCount
          ? h(
              "div",
              { style: { display: "flex", justifyContent: "flex-end", marginTop: 18 } },
              h(
                "button",
                { onClick: () => setCcArchiveOpen((v) => !v), style: ccGrey },
                ccArchiveOpen ? "아카이브 닫기" : "아카이브 보기 " + ccArchiveCount,
              ),
            )
          : null,
        ccArchiveOpen
          ? h(
              "div",
              { style: { marginTop: 14 } },
              ccFiledList.length
                ? h(
                    "div",
                    null,
                    h(
                      "div",
                      {
                        style: {
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--ink-faint)",
                          marginBottom: 10,
                        },
                      },
                      "보관한 매니페스토",
                    ),
                    ccFiledList.map(([k, rec]) =>
                      h(
                        "div",
                        {
                          key: k,
                          className: "card",
                          style: { padding: "16px 20px", marginBottom: 10, opacity: 0.9 },
                        },
                        h(
                          "div",
                          {
                            style: {
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              marginBottom: 8,
                            },
                          },
                          h(
                            "span",
                            {
                              style: { fontSize: 11.5, fontWeight: 700, color: "var(--ink-faint)" },
                            },
                            rec.label,
                          ),
                          h("button", { style: ccGrey, onClick: () => unfileIdea(k) }, "되돌리기"),
                        ),
                        h(
                          "div",
                          {
                            style: {
                              fontSize: 16,
                              fontWeight: 800,
                              marginBottom: 8,
                              wordBreak: "keep-all",
                            },
                          },
                          rec.idea.title,
                        ),
                        [rec.idea.now, rec.idea.challenge, rec.idea.redefine, rec.idea.solution]
                          .filter(Boolean)
                          .map((para, pi) =>
                            h(
                              "p",
                              {
                                key: pi,
                                className: "topline-body verse",
                                style: { marginTop: pi ? 12 : 0 },
                              },
                              hlText(para),
                            ),
                          ),
                        rec.idea.actions && rec.idea.actions.length
                          ? h(
                              "div",
                              {
                                style: {
                                  marginTop: 14,
                                  paddingTop: 12,
                                  borderTop: "1px solid var(--line)",
                                },
                              },
                              rec.idea.actions.map((a, ai) =>
                                h(
                                  "div",
                                  { key: ai, style: { marginTop: ai ? 8 : 0 } },
                                  h(
                                    "span",
                                    { style: { fontSize: 13, fontWeight: 800 } },
                                    ai + 1 + ". " + a.title,
                                  ),
                                  a.detail
                                    ? h("span", { className: "topline-body" }, " " + a.detail)
                                    : null,
                                ),
                              ),
                            )
                          : null,
                      ),
                    ),
                  )
                : null,
              ccArchived.length
                ? h(
                    "div",
                    null,
                    h(
                      "div",
                      {
                        style: {
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--ink-faint)",
                          margin: "18px 0 0",
                        },
                      },
                      "지난 세트",
                    ),
                    ccArchived.map(runBlock),
                  )
                : null,
            )
          : null,
        ccShownRuns.map(runBlock),
        ideaPrefs.liked.length || ideaPrefs.disliked.length
          ? h(
              "div",
              { style: { display: "flex", justifyContent: "center", gap: 12, marginTop: 10 } },
              h(
                "span",
                { style: { fontSize: 11.5, color: "var(--ink-faint)" } },
                "아이디어 취향 — 좋아요 " +
                  ideaPrefs.liked.length +
                  " \xB7 별로 " +
                  ideaPrefs.disliked.length,
              ),
              h("button", { onClick: clearIdeaPrefs, style: ccLink }, "초기화"),
            )
          : null,
      )
    : null;
  return React.createElement(
    "div",
    { onClick: () => closePopupOutside() },
    React.createElement(
      "div",
      { className: "masthead" },
      React.createElement(
        "div",
        {
          style: {
            maxWidth: 1120,
            margin: "0 auto",
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          },
        },
        React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            {
              className: "mono",
              style: {
                fontSize: 11,
                fontWeight: 600,
                color: "var(--accent-ink)",
                letterSpacing: ".08em",
                marginBottom: 4,
              },
            },
            "CONSUMER TREND SENSING",
          ),
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
            React.createElement(
              "h1",
              { className: "wordmark", style: { margin: 0 } },
              "대한민국 소비 트렌드 보드",
            ),
            React.createElement(
              "span",
              {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--ink-soft)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 999,
                  padding: "5px 11px",
                  whiteSpace: "nowrap",
                },
              },
              React.createElement("span", {
                style: { width: 6, height: 6, borderRadius: 999, background: "var(--accent)" },
              }),
              chartCaption,
            ),
          ),
        ),
        React.createElement(
          "div",
          {
            style: { display: "flex", alignItems: "center", gap: 10 },
            onClick: (e) => e.stopPropagation(),
          },
          React.createElement("input", {
            ref: fileInputRef,
            type: "file",
            accept: ".xlsx,.xls,.csv",
            style: { display: "none" },
            onChange: (e) => {
              if (e.target.files[0]) handleFile(e.target.files[0]);
              e.target.value = "";
            },
          }),
          React.createElement(
            "div",
            { ref: settingsRef, style: { position: "relative" } },
            React.createElement(
              "button",
              {
                className: "btn btn-line",
                "aria-expanded": settingsOpen,
                onClick: () => setSettingsOpen((v) => !v),
              },
              "설정",
            ),
            settingsOpen &&
              React.createElement(
                "div",
                {
                  className: "card",
                  style: {
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    width: 250,
                    padding: 14,
                    zIndex: 80,
                    textAlign: "left",
                    boxShadow: "0 12px 32px rgba(0,0,0,.14)",
                  },
                },
                React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--ink-faint)",
                      letterSpacing: ".02em",
                      marginBottom: 10,
                    },
                  },
                  "아티팩트 설정",
                ),
                React.createElement(
                  "button",
                  {
                    className: "btn btn-line",
                    style: { width: "100%" },
                    onClick: () => {
                      setSettingsOpen(false);
                      fileInputRef.current.click();
                    },
                  },
                  "엑셀 업로드",
                ),
                React.createElement(
                  "p",
                  {
                    style: {
                      fontSize: 11.5,
                      color: "var(--ink-faint)",
                      margin: "10px 0 0",
                      lineHeight: 1.5,
                    },
                  },
                  "다른 주차 엑셀을 올리면 이번 주 차트가 교체됩니다.",
                ),
                React.createElement("div", {
                  style: { height: 1, background: "var(--line)", margin: "14px 0" },
                }),
                React.createElement(
                  "button",
                  {
                    className: "btn btn-line",
                    style: { width: "100%" },
                    disabled: !dlFn,
                    onClick: downloadChart,
                  },
                  "차트 다운로드 (CSV)",
                ),
                React.createElement(
                  "p",
                  {
                    style: {
                      fontSize: 11.5,
                      color: "var(--ink-faint)",
                      margin: "10px 0 0",
                      lineHeight: 1.5,
                    },
                  },
                  dlFn
                    ? "순위·항목·변동·이유·키워드를 한 장의 표로 내려받습니다."
                    : "이 화면에서는 파일 저장을 지원하지 않아요.",
                ),
              ),
          ),
          sampleFn === null &&
            React.createElement(
              "span",
              { className: "mono", style: { fontSize: 12, color: "var(--ink-faint)" } },
              "AI 분석 사용 불가",
            ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { style: { maxWidth: 1120, margin: "0 auto", padding: "28px 24px 140px" } },
      guideEl,
      toplineEl,
      toplineArchiveEl,
      readsEl,
      sampleFn === null &&
        React.createElement(
          "div",
          { style: { fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 14 } },
          "이 화면에서는 AI 생성 기능이 켜지지 않았습니다. 차트와 이유, 이미 발행된 묶음 추론은 그대로 보실 수 있고, 엑셀 업로드와 열람도 됩니다. 아티팩트 링크(claude.ai)로 여시면 AI 기능이 함께 켜집니다.",
        ),
      state.analysisState === "running" &&
        React.createElement(
          "div",
          { className: "card progress-sticky", style: { padding: "16px 18px", marginBottom: 14 } },
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
                marginBottom: 8,
                flexWrap: "wrap",
              },
            },
            React.createElement(
              "span",
              { style: { fontSize: 14, fontWeight: 700 } },
              "AI가 이유를 다시 만드는 중",
            ),
            React.createElement(
              "span",
              { className: "mono", style: { fontSize: 12, color: "var(--ink-soft)" } },
              analysisPct +
                "% · " +
                (analysisProgress ? analysisProgress.done : 0) +
                "/" +
                (analysisProgress ? analysisProgress.total : 5) +
                " 카테고리 · " +
                elapsedSec +
                "초 경과",
            ),
          ),
          React.createElement(
            "div",
            {
              style: {
                height: 6,
                borderRadius: 999,
                background: "var(--surface-2)",
                overflow: "hidden",
              },
            },
            React.createElement("div", {
              className: "progress-fill",
              style: {
                height: "100%",
                width: Math.max(analysisPct, 6) + "%",
                background: "var(--accent)",
                transition: "width .3s ease",
              },
            }),
          ),
          React.createElement(
            "div",
            { style: { fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8 } },
            "보통 1~3분 걸려요. 먼저 끝난 카테고리부터 화면에 채워집니다. 기다리는 동안 기존 분석은 그대로 보실 수 있어요.",
          ),
        ),
      state.mode === "manual-edit"
        ? React.createElement(ManualEditor, {
            draft: state.manualDraft,
            onChange: (d) => dispatch({ type: "UPDATE_MANUAL_DRAFT", draft: d }),
            onCancel: () => dispatch({ type: "CANCEL_MANUAL_EDIT" }),
            onConfirm: confirmManual,
          })
        : React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: chartOpen ? 10 : 0,
                },
              },
              React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--ink-faint)",
                    letterSpacing: ".01em",
                  },
                },
                "주간 차트 - TOP 10",
              ),
              React.createElement(
                "button",
                { onClick: toggleChart, style: ccGrey },
                chartOpen ? "숨기기" : "펼치기",
              ),
            ),
            chartOpen &&
              React.createElement(
                "div",
                { className: "card chart-bleed", style: { overflow: "hidden" } },
                React.createElement(
                  "div",
                  { ref: chartScrollRef, style: { overflowX: "auto" } },
                  React.createElement(
                    "div",
                    {
                      className: "rank-grid",
                      style: {
                        gridTemplateColumns: `56px repeat(${gridCats.length}, minmax(150px,1fr))`,
                        minWidth: 56 + gridCats.length * 150,
                      },
                    },
                    groupPlan.useGroups
                      ? React.createElement("div", { className: "grid-group-corner" })
                      : null,
                    groupPlan.useGroups
                      ? groupPlan.groups.map((g, gi) =>
                          React.createElement(
                            "div",
                            {
                              className: "grid-group-cell",
                              key: gi,
                              style: { gridColumn: "span " + g.count },
                              title: g.label,
                            },
                            g.label,
                          ),
                        )
                      : null,
                    React.createElement("div", { className: "grid-corner" }),
                    gridCats.map((c) =>
                      React.createElement(
                        "div",
                        {
                          className: "grid-head-cell",
                          key: c,
                          title: CATEGORY_SOURCES[c] ? "출처 · " + CATEGORY_SOURCES[c] : void 0,
                        },
                        c,
                        React.createElement(
                          "div",
                          { className: "grid-head-src" },
                          CATEGORY_SOURCES[c] || "",
                        ),
                      ),
                    ),
                    Array.from({ length: 10 }, (_, ri) => ri + 1).map((rank) =>
                      React.createElement(
                        React.Fragment,
                        { key: rank },
                        React.createElement(
                          "div",
                          { className: "rank-cell mono" },
                          String(rank).padStart(2, "0"),
                        ),
                        gridCats.map((cat) => {
                          const item = items.find((it) => it.category === cat && it.rank === rank);
                          if (!item)
                            return React.createElement(
                              "div",
                              { className: "grid-cell is-empty", key: cat },
                              "—",
                            );
                          const selIdx = state.selected.indexOf(item.id);
                          return React.createElement(Cell, {
                            key: item.id,
                            item,
                            move: moveOf(item),
                            selIndex: selIdx >= 0 ? selIdx : null,
                            dimmed: !!(dimmedSet && !dimmedSet.has(item.id)),
                            echo: !!(echoSet && echoSet.has(item.id)),
                            canInteract: item.status === "ready",
                            onOpen: openPopup,
                            onClose: closePopup,
                            onToggleSelect: toggleSelect,
                            onEchoEnter: (it) => it.variantGroup && setHoveredEcho(it.variantGroup),
                            onEchoLeave: () => setHoveredEcho(null),
                            onRetry: runSingleItem,
                          });
                        }),
                      ),
                    ),
                  ),
                ),
              ),
            state.mode === "grid" &&
              chartOpen &&
              React.createElement(
                "div",
                {
                  style: {
                    marginTop: 18,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  },
                },
                React.createElement(
                  "div",
                  {
                    style: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" },
                  },
                  ccOpen || ccActive
                    ? React.createElement(
                        "button",
                        { className: "btn btn-ghost", onClick: () => setCcOpen(false) },
                        "묶음 추론 보기",
                      )
                    : React.createElement(
                        "button",
                        {
                          className: "btn btn-primary",
                          onClick: runAuto,
                          disabled: !sampleFn || state.autoStatus === "loading",
                        },
                        state.autoStatus === "loading"
                          ? "묶음 추론 만드는 중…"
                          : hasLiveBundles
                            ? "다음 세트 생성하기"
                            : "트렌드 합성하기",
                      ),
                  React.createElement(
                    "button",
                    {
                      className: "btn " + (ccOpen || ccActive ? "btn-primary" : "btn-line"),
                      onClick: () => setCcOpen((v) => !v),
                      disabled: !sampleFn || ccStatus === "loading",
                    },
                    "Client Connect",
                  ),
                ),
                needsReasons && !ccOpen
                  ? React.createElement(
                      "button",
                      {
                        className: "btn btn-line",
                        style: { fontSize: 13, padding: "8px 14px" },
                        onClick: runAnalysis,
                        disabled: !sampleFn || state.analysisState === "running",
                      },
                      state.analysisState === "running"
                        ? "이유 분석 중 " + analysisPct + "%"
                        : "이유 없는 항목 " + missingReasonCount + "개 분석하기",
                    )
                  : null,
                React.createElement(
                  "p",
                  {
                    style: {
                      fontSize: 12,
                      color: "var(--ink-faint)",
                      margin: 0,
                      textAlign: "center",
                    },
                  },
                  needsReasons
                    ? "이유가 아직 없는 항목이 " +
                        missingReasonCount +
                        "개 있습니다. 한 번만 분석하면 그대로 확정되고, 이미 발행된 이유는 건드리지 않습니다."
                    : prefs.liked.length || prefs.disliked.length
                      ? "좋아요 " +
                        prefs.liked.length +
                        "개, 별로 " +
                        prefs.disliked.length +
                        "개를 반영해 취향에 가까운 묶음을 만듭니다."
                      : "이번 주 묶음 추론 5편은 이미 발행돼 있습니다. 카드에 좋아요를 남기면 다음 세트가 그 취향을 따라갑니다.",
                ),
                !ccActive &&
                  (prefs.liked.length ||
                    prefs.disliked.length ||
                    likedArchive.length ||
                    dislikedArchive.length)
                  ? React.createElement(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                          justifyContent: "center",
                        },
                      },
                      likedArchive.length
                        ? React.createElement(
                            "button",
                            {
                              onClick: () => setArchiveView((v) => (v === "up" ? null : "up")),
                              style: {
                                background: "none",
                                border: "none",
                                padding: 0,
                                fontSize: 11.5,
                                color: "var(--ink-faint)",
                                textDecoration: "underline",
                                cursor: "pointer",
                              },
                            },
                            archiveView === "up"
                              ? "좋아요 아카이브 닫기"
                              : "좋아요 아카이브 " + likedArchive.length + "개",
                          )
                        : null,
                      dislikedArchive.length
                        ? React.createElement(
                            "button",
                            {
                              onClick: () => setArchiveView((v) => (v === "down" ? null : "down")),
                              style: {
                                background: "none",
                                border: "none",
                                padding: 0,
                                fontSize: 11.5,
                                color: "var(--ink-faint)",
                                textDecoration: "underline",
                                cursor: "pointer",
                              },
                            },
                            archiveView === "down"
                              ? "별로예요 아카이브 닫기"
                              : "별로예요 아카이브 " + dislikedArchive.length + "개",
                          )
                        : null,
                      prefs.liked.length || prefs.disliked.length
                        ? React.createElement(
                            "button",
                            {
                              onClick: clearPrefs,
                              style: {
                                background: "none",
                                border: "none",
                                padding: 0,
                                fontSize: 11.5,
                                color: "var(--ink-faint)",
                                textDecoration: "underline",
                                cursor: "pointer",
                              },
                            },
                            "학습한 취향 초기화",
                          )
                        : null,
                    )
                  : null,
                ccPanelEl,
              ),
            isTouchDevice() &&
              React.createElement(
                "p",
                { style: { fontSize: 12, color: "var(--ink-faint)", marginTop: 10 } },
                "선택하고 묶어보기는 데스크톱에서 이용해 주세요. 이 화면에서는 항목을 눌러 이유만 볼 수 있어요.",
              ),
            ccResultsEl,
            visibleBundles.length > 0 &&
              React.createElement(
                "div",
                { id: "bundle-list", style: { marginTop: 28 } },
                React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: bundOpen ? 10 : 0,
                    },
                  },
                  React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--ink-faint)",
                        letterSpacing: ".01em",
                      },
                    },
                    archiveView === "up"
                      ? "묶음 추론 · 좋아요 아카이브"
                      : archiveView === "down"
                        ? "묶음 추론 · 별로예요 아카이브"
                        : "묶음 추론",
                  ),
                  React.createElement(
                    "button",
                    { onClick: toggleBund, style: ccGrey },
                    bundOpen ? "숨기기" : "펼치기 " + visibleBundles.length,
                  ),
                ),
                bundOpen &&
                  visibleBundles.map((b) => {
                    const active = state.activeBundleId === b.bundleId;
                    const picks = b.itemIds.map((id) => byId.get(id)).filter(Boolean);
                    return React.createElement(
                      "div",
                      {
                        key: b.bundleId,
                        className: "bundle-card" + (active ? " is-active" : ""),
                        onMouseEnter: () => setHoveredBundleId(b.bundleId),
                        onMouseLeave: () => setHoveredBundleId(null),
                        onClick: (e) => {
                          e.stopPropagation();
                          dispatch({ type: "RESTORE_BUNDLE", id: b.bundleId });
                        },
                      },
                      active
                        ? React.createElement(
                            "div",
                            { style: { padding: "22px 24px 20px" } },
                            React.createElement(
                              "div",
                              {
                                style: {
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  marginBottom: 10,
                                },
                              },
                              b.auto &&
                                React.createElement(
                                  "span",
                                  {
                                    className: "chip",
                                    style: {
                                      margin: 0,
                                      background: "var(--accent-soft)",
                                      color: "var(--accent-ink)",
                                      fontWeight: 700,
                                    },
                                  },
                                  "AUTO 추천",
                                ),
                              React.createElement(
                                "button",
                                {
                                  className: "bundle-x",
                                  title: "이 묶음 삭제",
                                  "aria-label": "이 묶음 삭제",
                                  onClick: (e) => {
                                    e.stopPropagation();
                                    dispatch({ type: "DELETE_BUNDLE", id: b.bundleId });
                                  },
                                },
                                "×",
                              ),
                            ),
                            React.createElement(
                              "div",
                              {
                                style: {
                                  fontSize: 26,
                                  fontWeight: 900,
                                  lineHeight: 1.2,
                                  marginBottom: 12,
                                  letterSpacing: "-.01em",
                                },
                                className: "balance",
                              },
                              b.title,
                            ),
                            React.createElement(
                              "div",
                              {
                                style: {
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 8,
                                  marginBottom: 14,
                                },
                              },
                              picks.map((p) =>
                                React.createElement(
                                  "div",
                                  { className: "bundle-item-chip", key: p.id },
                                  React.createElement(
                                    "span",
                                    {
                                      className: "mono",
                                      style: { color: "var(--ink-faint)", fontSize: 11 },
                                    },
                                    p.category,
                                    " \xB7 ",
                                    p.rank,
                                    "위",
                                  ),
                                  React.createElement(
                                    "span",
                                    { style: { fontWeight: 600 } },
                                    p.title,
                                  ),
                                ),
                              ),
                            ),
                            React.createElement(
                              "p",
                              {
                                style: {
                                  fontSize: 14.5,
                                  color: "var(--ink-soft)",
                                  lineHeight: 1.7,
                                  margin: 0,
                                },
                              },
                              hlText(b.content),
                            ),
                            b.keywords && b.keywords.length
                              ? React.createElement(
                                  "div",
                                  {
                                    style: {
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: 6,
                                      marginTop: 16,
                                    },
                                  },
                                  b.keywords.map((k, ki) =>
                                    React.createElement(
                                      "span",
                                      {
                                        key: ki,
                                        style: {
                                          fontSize: 12.5,
                                          fontWeight: 700,
                                          color: "var(--accent-ink)",
                                          background: "var(--accent-soft)",
                                          borderRadius: 999,
                                          padding: "5px 11px",
                                        },
                                      },
                                      "#" + k,
                                    ),
                                  ),
                                )
                              : null,
                            React.createElement(
                              "div",
                              {
                                style: {
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  marginTop: 16,
                                  paddingTop: 14,
                                  borderTop: "1px solid var(--line)",
                                  flexWrap: "wrap",
                                },
                              },
                              React.createElement(
                                "span",
                                {
                                  style: {
                                    fontSize: 12,
                                    color: "var(--ink-faint)",
                                    marginRight: 2,
                                  },
                                },
                                "이 추론 어때요?",
                              ),
                              React.createElement(
                                "button",
                                {
                                  className: "btn",
                                  style: {
                                    fontSize: 13,
                                    padding: "7px 14px",
                                    background:
                                      state.feedback[b.bundleId] === "up"
                                        ? "var(--accent)"
                                        : "var(--surface-2)",
                                    color:
                                      state.feedback[b.bundleId] === "up" ? "#fff" : "var(--ink)",
                                  },
                                  onClick: (e) => {
                                    e.stopPropagation();
                                    rateBundle(b, "up");
                                  },
                                },
                                "좋아요",
                              ),
                              React.createElement(
                                "button",
                                {
                                  className: "btn",
                                  style: {
                                    fontSize: 13,
                                    padding: "7px 14px",
                                    background:
                                      state.feedback[b.bundleId] === "down"
                                        ? "var(--ink)"
                                        : "var(--surface-2)",
                                    color:
                                      state.feedback[b.bundleId] === "down" ? "#fff" : "var(--ink)",
                                  },
                                  onClick: (e) => {
                                    e.stopPropagation();
                                    rateBundle(b, "down");
                                  },
                                },
                                "별로예요",
                              ),
                              state.feedback[b.bundleId] &&
                                React.createElement(
                                  "span",
                                  { style: { fontSize: 11.5, color: "var(--ink-faint)" } },
                                  "다음 묶음에 반영됩니다",
                                ),
                            ),
                          )
                        : React.createElement(
                            "div",
                            { className: "bundle-collapsed-row" },
                            b.auto &&
                              React.createElement(
                                "span",
                                {
                                  className: "chip",
                                  style: {
                                    margin: 0,
                                    flexShrink: 0,
                                    background: "var(--accent-soft)",
                                    color: "var(--accent-ink)",
                                    fontWeight: 700,
                                  },
                                },
                                "AUTO",
                              ),
                            React.createElement(
                              "div",
                              {
                                style: {
                                  fontSize: 14.5,
                                  fontWeight: 700,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                },
                              },
                              b.title,
                            ),
                            state.feedback[b.bundleId] &&
                              React.createElement(
                                "span",
                                {
                                  style: {
                                    flexShrink: 0,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color:
                                      state.feedback[b.bundleId] === "up"
                                        ? "var(--accent-ink)"
                                        : "var(--ink-faint)",
                                  },
                                },
                                state.feedback[b.bundleId] === "up" ? "좋아요" : "별로",
                              ),
                            React.createElement(
                              "button",
                              {
                                className: "bundle-x",
                                title: "이 묶음 삭제",
                                "aria-label": "이 묶음 삭제",
                                onClick: (e) => {
                                  e.stopPropagation();
                                  dispatch({ type: "DELETE_BUNDLE", id: b.bundleId });
                                },
                              },
                              "×",
                            ),
                          ),
                    );
                  }),
              ),
            state.autoStatus === "loading" &&
              React.createElement(
                "div",
                { className: "card", style: { marginTop: 28, padding: 22 } },
                React.createElement("div", {
                  className: "shimmer",
                  style: { width: 220, height: 18, marginBottom: 10 },
                }),
                React.createElement("div", { className: "shimmer", style: { width: "90%" } }),
                React.createElement(
                  "div",
                  { style: { fontSize: 12.5, color: "var(--ink-faint)", marginTop: 10 } },
                  "이번 주를 읽는 중",
                ),
              ),
            state.autoStatus === "error" &&
              React.createElement(
                "div",
                { id: "bundle-error", className: "card", style: { marginTop: 28, padding: 22 } },
                React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--danger)",
                      marginBottom: 6,
                    },
                  },
                  "묶음 추론을 만들지 못했어요",
                ),
                state.autoError &&
                  React.createElement(
                    "div",
                    { style: { fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 12 } },
                    state.autoError,
                  ),
                React.createElement(
                  "button",
                  {
                    className: "btn btn-ghost",
                    onClick: () => {
                      autoTriggered.current = false;
                      runAuto();
                    },
                  },
                  "다시 시도",
                ),
              ),
          ),
    ),
    state.mode === "grid" &&
      !ccActive &&
      React.createElement(
        "div",
        { style: { position: "sticky", bottom: 0, zIndex: 35 } },
        React.createElement(
          "div",
          { style: { maxWidth: 1120, margin: "0 auto", padding: "0 24px 20px" } },
          React.createElement(
            "div",
            {
              className: "selection-bar" + (state.selected.length === 0 ? " is-hidden" : ""),
              onClick: (e) => e.stopPropagation(),
            },
            React.createElement(
              "div",
              { style: { fontWeight: 700, fontSize: 14.5 }, className: "mono" },
              "선택 ",
              state.selected.length,
              "/10",
            ),
            React.createElement(
              "div",
              { style: { display: "flex", gap: 8, flex: 1, overflow: "hidden" } },
              state.selected.map((id) => {
                const it = byId.get(id);
                return it
                  ? React.createElement(
                      "span",
                      {
                        key: id,
                        className: "chip",
                        style: { background: "rgba(255,255,255,.12)", color: "inherit", margin: 0 },
                      },
                      it.title,
                    )
                  : null;
              }),
            ),
            React.createElement(
              "div",
              { style: { display: "flex", gap: 8, flexShrink: 0 } },
              React.createElement(
                "button",
                {
                  className: "btn btn-pill-white",
                  disabled: state.selected.length < 1,
                  onClick: () => dispatch({ type: "CLEAR_SELECTION" }),
                },
                "해제",
              ),
              React.createElement(
                "button",
                {
                  className: "btn btn-primary",
                  disabled: state.selected.length < 2 || bundleLoading,
                  onClick: createBundle,
                },
                bundleLoading ? "묶는 중…" : "묶어보기",
              ),
            ),
          ),
        ),
      ),
    React.createElement(ReasonPopup, {
      item: popup.item,
      pos: popup.pos,
      open: popup.open,
      onMouseEnter: () => {
        if (!isTouchDevice()) clearTimeout(popupCloseTimer.current);
      },
      onMouseLeave: () => {
        if (!isTouchDevice()) popupCloseTimer.current = setTimeout(closePopup, 100);
      },
    }),
    readPopEl,
    React.createElement(
      "div",
      { className: "toast" + (state.toast ? " is-shown" : "") },
      state.toast ? state.toast.message : "",
    ),
    React.createElement(
      "div",
      { style: { maxWidth: 1120, margin: "0 auto", padding: "0 24px 40px", textAlign: "center" } },
      React.createElement(
        "p",
        {
          className: "mono",
          style: { fontSize: 11, color: "var(--ink-faint)", letterSpacing: ".03em" },
        },
        "v0.6 PROTOTYPE \xB7 서버 저장 없음 \xB7 ",
        state.isSample
          ? "새로고침하면 이번 주 기본 차트로 돌아갑니다"
          : "업로드한 데이터는 이 브라우저에 남습니다",
      ),
    ),
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  React.createElement(ErrorBoundary, null, React.createElement(App, null)),
);
