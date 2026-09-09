// ==================================================================
// App — 루트 컴포넌트 + 마운트
// ==================================================================
import { CATEGORY_SOURCES, CLIENTS } from "./data.mjs";
import { buildGroupReadPrompt, buildBundlePrompt, buildAutoPrompt, buildClientPrompt, buildAutoClientPrompt, buildToplinePrompt, likedBlockFor, ideaPrefBlock } from "./prompts.mjs";
import { csvCell, buildChartCsv, buildGroupPlan, parseRawTitle, buildItemsFromMatrix, normTitleKey, normalizeIdeas, groupByCategory, useSectionOpen, computePopupPos, uidSeq, uid, asText, hlText, isTouchDevice, sampleWithTimeout, describeSampleError, computeFacts } from "./util.mjs";
import { loadPrevChart, snapshotChart, savePrevChart, sameChart, IDEA_PREF_KEY, loadPrefs, savePrefs, upsertPref, STORAGE_KEY, makeInitialState, reducer, newRunId } from "./state.mjs";
// 내보낸 한 파일(HTML)로 열렸는가 — 서버가 없으니 AI·기록 동기화는 끈다
const EXPORTED = typeof window !== "undefined" && !!window.__RUN__;
// 마퀴 빨리감기 배속 — 우상단 버튼을 누르고 있는 동안만 적용된다
const MARQUEE_FF_RATE = 6;
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
  const [prevChart, setPrevChart] = useState(() => loadPrevChart());
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
  // 첫 방문 안내 모달 — × 를 누르면 GUIDE_KEY 에 남겨 다시 안 뜬다
  const GUIDE_KEY = "trend-sensing:guide:v1";
  const [guideOpen, setGuideOpen] = useState(() => {
    // 내보낸 한 파일은 업로드·분석이 없다 — 쓰는 법 안내를 띄우지 않는다
    if (EXPORTED) return false;
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
  // 그룹 해석 전문은 표 헤더를 클릭했을 때 가운데 모달로 연다(호버 팝업은 잘려서 폐기).
  const [readModal, setReadModal] = useState(null);
  // 좁은 화면: 18열 표 대신 카테고리 탭 + 세로 한 열
  const [isNarrow, setIsNarrow] = useState(
    () => !!(window.matchMedia && window.matchMedia("(max-width: 720px)").matches),
  );
  const [mobileCatPick, setMobileCatPick] = useState(null);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 720px)");
    const on = () => setIsNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  // 묶음 카드(손패)를 누르면 뒤집힌 뒤 모달로 내용이 뜬다
  const [bundleOpen, setBundleOpen] = useState(false);
  const openBundle = (id) => {
    dispatch({ type: "SET_ACTIVE_BUNDLE", id });
    setTimeout(() => setBundleOpen(true), 260); // 뒤집히는 걸 보고 연다
  };
  const closeBundle = () => setBundleOpen(false);
  useEffect(() => {
    if (readModal == null && !bundleOpen && !guideOpen) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setReadModal(null);
      setBundleOpen(false);
      if (guideOpen) closeGuide();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [readModal, bundleOpen, guideOpen]);
  // 전광판: 다섯 칸이 2.6초마다 다음 항목으로 함께 굴러간다. 커서를 올리면 멈춘다.
  const [tick, setTick] = useState(0);
  const tickerPause = useRef(false);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (!tickerPause.current) setTick((t) => t + 1);
    }, 2600);
    return () => clearInterval(id);
  }, []);
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
    if (state.groupReads.length < 3) return;
    makeTopline(state.groupReads, true);
  };
  // 지난 주 스냅숏이 있을 때만 배지를 붙인다. 없으면 아무것도 그리지 않는다 — 없는 걸 NEW로 속이지 않는다.
  const moveOf = (item) => {
    if (!prevChart || !prevChart.map) return null;
    const col = prevChart.map[item.category];
    if (!col) return null;
    const has = prevChart.ids && Object.prototype.hasOwnProperty.call(prevChart.ids, item.id);
    const before = has ? prevChart.ids[item.id] : col[normTitleKey(item.raw)];
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
    autoTriggered.current = false;
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
      if (alive) setSampleFn(() => (EXPORTED ? null : local));
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
  // 코드가 계산한 사실(변동·복수 진입·교차 등장). 프롬프트와 칸 팝업이 같이 쓴다.
  const facts = useMemo(() => computeFacts(items, moveOf), [items, prevChart]);
  // 그룹 해석이 지목한 특이점 → 항목 id 별 한 줄
  const anomalyNote = (id) => {
    for (const r of state.groupReads) {
      const a = (r.anomalies || []).find((x) => x.itemId === id);
      if (a) return a.note;
    }
    return "";
  };
  // 기록(data/runs): 업로드 한 번 = 파일 하나. 목록은 헤더 아래 탭으로, 누르면 그대로 연다.
  const [runs, setRuns] = useState([]);
  const refreshRuns = () =>
    fetch("/api/runs")
      .then((r) => r.json())
      .then((list) => Array.isArray(list) && setRuns(list))
      .catch(() => {});
  const loadRun = async (id) => {
    try {
      const r = await fetch("/api/runs/" + encodeURIComponent(id));
      const run = await r.json();
      if (!run || run.error || !Array.isArray(run.items)) throw new Error((run && run.error) || "빈 기록");
      toplineTried.current = false;
      autoTriggered.current = false;
      dispatch({ type: "LOAD_RUN", run, id });
    } catch (e) {
      dispatch({ type: "SET_TOAST", message: "기록을 열지 못했어요 (" + describeSampleError(e) + ")", id: Date.now() });
    }
  };
  useEffect(() => {
    if (EXPORTED) return;
    // 켰을 때 로컬 저장이 없으면 가장 최근 기록을 연다 — 결과가 날아가지 않게
    fetch("/api/runs")
      .then((r) => r.json())
      .then((list) => {
        if (!Array.isArray(list)) return;
        setRuns(list);
        if (state.isSample && list[0]) loadRun(list[0].id);
      })
      .catch(() => {});
  }, []);
  const saveTimer = useRef(null);
  useEffect(() => {
    if (EXPORTED || state.isSample || state.mode !== "grid") return;
    const snap = {
      runId: state.runId,
      savedAt: new Date().toISOString(),
      week: state.week,
      categories: state.categories,
      items: state.items,
      bundles: state.bundles,
      feedback: state.feedback,
      topline: state.topline,
      toplineArchive: state.toplineArchive,
      groupReads: state.groupReads,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    } catch (e) {}
    if (!state.runId) return;
    // 서버에도 같은 스냅숏을. 잦은 갱신은 1초 묶어서.
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/runs/" + encodeURIComponent(state.runId), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(snap),
      })
        .then(refreshRuns)
        .catch(() => {});
    }, 1000);
  }, [state.isSample, state.mode, state.week, state.categories, state.items, state.bundles, state.groupReads, state.topline, state.feedback]);
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
  const activeBundle = state.bundles.find((b) => b.bundleId === state.activeBundleId) || null;
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
      dispatch({ type: "SET_DATA", categories, items: items2, week: state.week, runId: newRunId(state.week) });
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
      runId: newRunId(state.week),
    });
  };
  // "분석하기" = 그룹(음악/영화/OTT/…)별 해석. 이미 있는 그룹은 다시 부르지 않는다.
  // 그룹끼리 동시에 부른다(서버가 TREND_CONCURRENCY 로 게이트).
  const runAnalysis = async () => {
    if (!sampleFn) return;
    const byCat = groupByCategory(items);
    const have = new Set(state.groupReads.map((r) => r.group));
    const todo = groupPlan.groups.filter((g) => g.label && !have.has(g.label));
    if (!todo.length) return;
    dispatch({ type: "ANALYSIS_START" });
    setAnalysisProgress({ done: 0, total: todo.length });
    let at = 0;
    const catsOf = {};
    groupPlan.groups.forEach((g) => {
      catsOf[g.label] = groupPlan.ordered.slice(at, at + g.count);
      at += g.count;
    });
    await Promise.all(
      todo.map((g) =>
        runGroupRead(g.label, catsOf[g.label], byCat).then(() => {
          setAnalysisProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
        }),
      ),
    );
    setAnalysisProgress(null);
    dispatch({ type: "ANALYSIS_DONE" });
  };
  const runGroupRead = async (label, cats, byCat) => {
    try {
      const prompt = buildGroupReadPrompt(state.week, label, cats, byCat, facts.tag);
      // 서버가 3개씩 게이트하므로 대기열까지 포함한 시간이다(그룹당 ~2분 × 3라운드)
      const r = await sampleWithTimeout(sampleFn, prompt, { modelTier: "complex" }, 600e3);
      const headline = asText(r && r.headline);
      if (!headline) throw new Error("응답에 헤드라인 없음");
      const anomalies = (r && Array.isArray(r.anomalies) ? r.anomalies : [])
        .map((a) => ({ itemId: asText(a && a.itemId), note: asText(a && a.note) }))
        .filter((a) => a.note && byId.has(a.itemId))
        .map((a) => ({ ...a, title: byId.get(a.itemId).title }))
        .slice(0, 3);
      dispatch({
        type: "GROUP_READ_APPLY",
        read: {
          group: label,
          headline,
          summary: asText(r.summary),
          points: (Array.isArray(r.points) ? r.points : []).map(asText).filter(Boolean).slice(0, 5),
          keywords: (Array.isArray(r.keywords) ? r.keywords : []).map(asText).map((k) => k.replace(/^#+/, "").trim()).filter(Boolean).slice(0, 6),
          anomalies,
        },
      });
    } catch (e) {
      dispatch({ type: "SET_TOAST", message: `${label} 해석 실패 (${describeSampleError(e)})`, id: Date.now() });
    }
  };
  // 그룹 해석이 끝나면 한 줄을 한 번만 뽑는다. 실패해도 나머지 화면에는 영향이 없다.
  const toplineTried = useRef(false);
  useEffect(() => {
    if (!sampleFn || state.topline || toplineTried.current) return;
    if (state.analysisState !== "done" || state.groupReads.length < 3) return;
    toplineTried.current = true;
    makeTopline(state.groupReads);
  }, [state.analysisState, state.topline, state.groupReads, sampleFn]);
  // 한 줄이 나오면 연관 신호 Auto 를 한 번 자동으로 돌린다(사용자 결정 2026-09-08).
  useEffect(() => {
    if (!sampleFn || !state.topline || autoTriggered.current) return;
    if (state.autoStatus !== "idle" || state.bundles.length) return;
    autoTriggered.current = true;
    runAuto();
    wantAutoScroll.current = false; // 자동 실행은 화면을 끌어내리지 않는다
  }, [state.topline, state.autoStatus, sampleFn]);
  const makeTopline = async (reads, replace) => {
    if (!sampleFn || !reads || reads.length < 3) return;
    setToplineLoading(true);
    try {
      const seen = (state.topline ? [state.topline] : [])
        .concat(state.toplineArchive || [])
        .map((x) => x.headline)
        .filter(Boolean);
      const r = await sampleWithTimeout(
        sampleFn,
        buildToplinePrompt(state.week, reads, replace ? seen : null),
        { modelTier: "complex" },
        240e3,
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
      const readyItems = items.filter((it) => it.raw);
      if (readyItems.length < 4) throw autoFail("차트 항목이 너무 적어요.");
      const prompt = buildAutoPrompt(state.week, readyItems, prefs, facts, state.groupReads);
      // 180개 항목 전체가 들어가는 가장 큰 프롬프트 — 실측 5분 초과
      const result = await sampleWithTimeout(sampleFn, prompt, { modelTier: "complex" }, 600e3);
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
    const picks = state.selected.map((id) => byId.get(id)).filter((it) => it && it.raw);
    if (picks.length < 2) return;
    setBundleLoading(true);
    try {
      const prompt = buildBundlePrompt(state.week, picks, facts.tag);
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
  const analysisPct =
    analysisProgress && analysisProgress.total
      ? Math.round((analysisProgress.done / analysisProgress.total) * 100)
      : 0;
  const h = React.createElement;
  const groupPlan = buildGroupPlan(state.categories);
  // 아직 해석이 없는 그룹 수 — "분석하기" CTA 의 기준
  const missingReadCount = groupPlan.groups.filter(
    (g) => g.label && !state.groupReads.some((r) => r.group === g.label),
  ).length;
  const needsReads = missingReadCount > 0;
  const gridCats = groupPlan.ordered;
  const ccGrey = {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--ink)",
    background: "transparent",
    border: "1px solid var(--ink)",
    borderRadius: 0,
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
    borderRadius: 0,
    padding: "3px 9px",
  };
  const ccTagSoft = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--ink-soft)",
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    borderRadius: 0,
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
  // 첫 방문에 한 번만 모달로. × 를 누르면 다시 안 뜬다(GUIDE_KEY).
  const guideEl =
    guideOpen && state.mode === "grid"
      ? h(
          "div",
          { className: "read-modal-backdrop", onClick: closeGuide },
          h(
          "div",
          {
            className: "read-modal card",
            onClick: (e) => e.stopPropagation(),
            style: { padding: "22px 26px 24px" },
          },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
              },
            },
            h("div", { style: { fontSize: 18, fontWeight: 700, letterSpacing: "-.02em" } }, "이 보드를 쓰는 법"),
            h("button", { className: "bundle-x", onClick: closeGuide, "aria-label": "닫기", title: "닫기" }, "×"),
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
                "지난 주 대비 변동과 다른 차트 교차 등장이 뜬다. 표 위 그룹 이름(음악·OTT…)에 커서를 올리면 해석이 짚은 특이점 칸이 밝아지고, 클릭하면 그 그룹 해석 전문이 열린다.",
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
            "차트와 해석은 data/runs 에 기록으로 남고, 위 '기록' 탭에서 다시 연다. 좋아요·별로 평가는 이 브라우저에만 남는다.",
          ),
          ),
        )
      : null;
  // 기록 탭 — 서버 data/runs 목록. 현재 열린 기록은 강조, 누르면 그 기록으로 바꾼다.
  // 라벨 시각은 id 에 박힌 생성 시각(UTC) — savedAt 은 열 때마다 갱신돼 라벨로 못 쓴다
  const fmtRun = (r) => {
    const m = /-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(r.id || "");
    const d = m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])) : new Date(r.savedAt);
    return isNaN(d) ? "" : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const runsEl =
    state.mode === "grid" && runs.length
      ? h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 18 } },
          h("span", { style: { fontSize: 12.5, fontWeight: 700, color: "var(--ink-faint)" } }, "기록"),
          runs.map((r) => {
            const active = r.id === state.runId;
            return h(
              "button",
              {
                key: r.id,
                onClick: () => !active && loadRun(r.id),
                title: r.id,
                style: Object.assign({}, ccGrey, active ? { color: "var(--bg)", background: "var(--ink)" } : {}),
              },
              `${r.week || "차트"} · ${fmtRun(r)}`,
              h(
                "span",
                { className: "mono", style: { marginLeft: 6, fontWeight: 600, opacity: 0.75 } },
                `해석 ${r.groups}${r.topline ? " · 한줄" : ""}${r.bundles ? " · 묶음 " + r.bundles : ""}`,
              ),
            );
          }),
        )
      : null;
  const groupReads = state.groupReads;
  // 그룹 해석 모달 — 표 헤더 클릭. 제목은 헤더에 붙은 헤드라인 그대로(말이 달라지지 않게).
  const readModalG = readModal == null ? null : groupReads[readModal];
  const readModalEl = readModalG
    ? h(
        "div",
        { className: "read-modal-backdrop", onClick: () => setReadModal(null) },
        h(
          "div",
          { className: "read-modal card", onClick: (e) => e.stopPropagation() },
          h(
            "div",
            { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 } },
            h(
              "div",
              null,
              h(
                "div",
                { className: "mono", style: { fontSize: 11, fontWeight: 700, color: "var(--accent-ink)", letterSpacing: ".06em", marginBottom: 6 } },
                readModalG.group,
              ),
              h(
                "div",
                { className: "balance", style: { fontSize: 22, fontWeight: 900, lineHeight: 1.25, letterSpacing: "-.01em", wordBreak: "keep-all" } },
                readModalG.headline,
              ),
            ),
            h("button", { onClick: () => setReadModal(null), style: ccGrey, "aria-label": "닫기" }, "닫기"),
          ),
          h(
            "p",
            { style: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.65, margin: "12px 0 14px", wordBreak: "keep-all" } },
            readModalG.summary,
          ),
          h(
            "div",
            { style: { marginBottom: 12 } },
            readModalG.points.map((pt, pi) =>
              h(
                "div",
                { className: "reason-row", key: pi },
                h("span", { className: "reason-rank mono" }, pi + 1),
                h("div", { style: { fontSize: 13.5, color: "var(--ink)", lineHeight: 1.6, wordBreak: "keep-all" } }, pt),
              ),
            ),
          ),
          (readModalG.anomalies || []).length
            ? h(
                "div",
                { style: { paddingTop: 12, borderTop: "1px solid var(--line)", marginBottom: 12 } },
                h(
                  "div",
                  { className: "mono", style: { fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--accent-ink)", marginBottom: 8 } },
                  "특이점 — 표에서 밝게 표시된 칸",
                ),
                readModalG.anomalies.map((a, ai) =>
                  h(
                    "div",
                    { key: ai, style: { fontSize: 13, lineHeight: 1.6, color: "var(--ink-soft)", wordBreak: "keep-all", marginTop: ai ? 6 : 0 } },
                    h("b", { style: { color: "var(--ink)" } }, a.title),
                    " — ",
                    a.note,
                  ),
                ),
              )
            : null,
          h(
            "div",
            { style: { paddingTop: 12, borderTop: "1px solid var(--line)" } },
            readModalG.keywords.map((k, ki) => h("span", { className: "chip", key: ki }, k)),
          ),
        ),
      )
    : null;
  // 전광판 — 한 페이지 = 한 카테고리의 다섯 칸. 카테고리는 위 가운데 한 번만.
  const SLOTS = 5;
  const tickerPages = [];
  groupPlan.ordered.forEach((c) => {
    const list = items.filter((it) => it.category === c && it.raw).sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < list.length; i += SLOTS) tickerPages.push({ cat: c, items: list.slice(i, i + SLOTS) });
  });
  const tickerPage = tickerPages.length ? tickerPages[tick % tickerPages.length] : null;
  const tickerEl =
    state.mode === "grid" && tickerPage
      ? h(
          "div",
          {
            className: "ticker",
            onMouseEnter: () => (tickerPause.current = true),
            onMouseLeave: () => (tickerPause.current = false),
          },
          h(
            "div",
            { className: "ticker-head", key: tickerPage.cat + tick },
            tickerPage.cat,
            h("span", { className: "ticker-src" }, CATEGORY_SOURCES[tickerPage.cat] ? " · " + CATEGORY_SOURCES[tickerPage.cat] : ""),
          ),
          h(
            "div",
            { className: "ticker-row" },
            Array.from({ length: SLOTS }, (_, k) => {
              const it = tickerPage.items[k];
              const mv = it && moveOf(it);
              return h(
                "div",
                { className: "ticker-slot", key: k },
                it
                  ? h(
                      "div",
                      { className: "ticker-item", key: it.id, title: it.raw },
                      h("span", { className: "ticker-rank mono" }, String(it.rank).padStart(2, "0")),
                      h("span", { className: "ticker-title" }, it.title),
                      mv ? h("span", { className: "ticker-move mono is-" + mv.kind }, mv.label) : null,
                    )
                  : null,
              );
            }),
          ),
        )
      : null;
  // 카테고리 해석 마퀴 — 표 바로 위 한 줄. 9개 헤드라인이 오른쪽에서 들어와 왼쪽으로 흐른다(CSS 애니메이션).
  // 이어 붙이려고 같은 목록을 두 번 그린다. 커서를 올리면 멈춘다.
  const readsOrdered = groupPlan.groups
    .map((g) => groupReads.findIndex((r) => r.group === g.label))
    .filter((i) => i >= 0);
  const marqueeItem = (ri, dup) => {
    const r = groupReads[ri];
    return h(
      "button",
      {
        key: r.group + dup,
        className: "marquee-item",
        tabIndex: dup ? -1 : 0,
        "aria-hidden": dup ? "true" : void 0,
        onClick: () => setReadModal(ri),
        onMouseEnter: () => setHoveredEcho((r.anomalies || []).map((a) => a.itemId)),
        onMouseLeave: () => setHoveredEcho(null),
      },
      h("b", null, r.group),
      h("span", null, r.headline),
    );
  };
  // 빨리감기 — 우상단 버튼을 누르고 있는 동안만 흐름이 빨라진다.
  // CSS animation-duration 을 바꾸면 진행률이 튀므로 Web Animations 의 playbackRate 로 건드린다.
  const marqueeWrapRef = useRef(null);
  const [marqueeFF, setMarqueeFF] = useState(false);
  useEffect(() => {
    const track = marqueeWrapRef.current && marqueeWrapRef.current.querySelector(".marquee-track");
    if (!track || !track.getAnimations) return;
    track.getAnimations().forEach((a) => {
      a.playbackRate = marqueeFF ? MARQUEE_FF_RATE : 1;
    });
  }, [marqueeFF, readsOrdered.length]);
  const ffOn = (e) => {
    if (e.currentTarget.setPointerCapture && e.pointerId != null) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
    setMarqueeFF(true);
  };
  const ffOff = () => setMarqueeFF(false);
  const readsMarqueeEl = readsOrdered.length
    ? h(
        "div",
        { className: "marquee-wrap" + (marqueeFF ? " is-ff" : ""), ref: marqueeWrapRef },
        h(
          "div",
          { className: "marquee", style: { "--n": readsOrdered.length } },
          h(
            "div",
            { className: "marquee-track" },
            readsOrdered.map((ri) => marqueeItem(ri, "")),
            readsOrdered.map((ri) => marqueeItem(ri, "-dup")),
          ),
        ),
        h(
          "button",
          {
            className: "marquee-ff",
            type: "button",
            "aria-label": "빨리 감기 — 누르고 있는 동안",
            title: "누르고 있으면 빨리 넘어갑니다",
            onPointerDown: ffOn,
            onPointerUp: ffOff,
            onPointerCancel: ffOff,
            onLostPointerCapture: ffOff,
            onBlur: ffOff,
            onKeyDown: (e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setMarqueeFF(true);
              }
            },
            onKeyUp: (e) => {
              if (e.key === " " || e.key === "Enter") ffOff();
            },
          },
          h(
            "svg",
            { width: 18, height: 13, viewBox: "0 0 18 13", "aria-hidden": "true", focusable: "false" },
            h("path", { d: "M0 0 L8 6.5 L0 13 Z", fill: "currentColor" }),
            h("path", { d: "M10 0 L18 6.5 L10 13 Z", fill: "currentColor" }),
          ),
        ),
      )
    : null;
  // 좁은 화면용 표 — 카테고리 탭 하나 고르면 그 TOP10 이 세로 한 열. 칸은 데스크톱과 같은 Cell.
  const mobileCat = gridCats.includes(mobileCatPick) ? mobileCatPick : gridCats[0];
  const groupOfCat = {};
  {
    let at = 0;
    groupPlan.groups.forEach((g) => {
      for (let i = 0; i < g.count; i++) groupOfCat[groupPlan.ordered[at++]] = g.label;
    });
  }
  const mobileReadIdx = groupReads.findIndex((r) => r.group === groupOfCat[mobileCat]);
  const mobileRead = mobileReadIdx >= 0 ? groupReads[mobileReadIdx] : null;
  const mobileChartEl = h(
    "div",
    { className: "card mobile-chart" },
    h(
      "div",
      { className: "cat-strip" },
      gridCats.map((c) =>
        h(
          "button",
          { key: c, className: "cat-chip" + (c === mobileCat ? " is-on" : ""), onClick: () => setMobileCatPick(c) },
          c,
        ),
      ),
    ),
    mobileRead
      ? h(
          "button",
          {
            className: "mobile-read",
            onClick: () => setReadModal(mobileReadIdx),
            onMouseEnter: () => setHoveredEcho((mobileRead.anomalies || []).map((a) => a.itemId)),
            onMouseLeave: () => setHoveredEcho(null),
          },
          h("span", { className: "mobile-read-group" }, groupOfCat[mobileCat]),
          mobileRead.headline,
        )
      : null,
    Array.from({ length: 10 }, (_, i) => {
      const item = items.find((it) => it.category === mobileCat && it.rank === i + 1);
      const selIdx = item ? state.selected.indexOf(item.id) : -1;
      return h(
        "div",
        { className: "mobile-row", key: i },
        h("div", { className: "rank-cell" }, String(i + 1).padStart(2, "0")),
        item
          ? h(Cell, {
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
            })
          : h("div", { className: "grid-cell is-empty" }, "—"),
      );
    }),
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
              { className: "card topline-card" },
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
                  "이번 주 한 줄",
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
                                    borderRadius: 0,
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
                              "어디서 보이나",
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
                            borderRadius: 0,
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
                      borderRadius: 0,
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
                          borderRadius: 0,
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
              "매니페스토",
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
                    "실행안",
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
                            borderRadius: 0,
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
            "주간 소비 트렌드",
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
                  borderRadius: 0,
                  padding: "5px 11px",
                  whiteSpace: "nowrap",
                },
              },
              React.createElement("span", {
                style: { width: 6, height: 6, borderRadius: 0, background: "var(--accent)" },
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
                  "설정",
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
                // 지금 보는 기록(차트 + 해석 전부)을 서버 없이 열리는 HTML 한 파일로
                state.runId && !EXPORTED
                  ? React.createElement(
                      "a",
                      {
                        className: "btn btn-line",
                        style: { width: "100%", display: "block", textAlign: "center", marginTop: 8, textDecoration: "none" },
                        href: "/export/" + encodeURIComponent(state.runId) + ".html",
                        download: state.runId + ".html",
                        onClick: () => setSettingsOpen(false),
                      },
                      "HTML로 내보내기",
                    )
                  : null,
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
    tickerEl,
    React.createElement(
      "div",
      { style: { maxWidth: 1120, margin: "0 auto", padding: "28px 24px 140px" } },
      runsEl,
      guideEl,
      toplineEl,
      toplineArchiveEl,
      sampleFn === null &&
        React.createElement(
          "div",
          { style: { fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 14 } },
          "내보낸 파일이라 AI 기능은 꺼져 있습니다. 차트·해석·묶음은 그대로 볼 수 있습니다.",
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
              "AI가 그룹별 해석을 만드는 중",
            ),
            React.createElement(
              "span",
              { className: "mono", style: { fontSize: 12, color: "var(--ink-soft)" } },
              analysisPct +
                "% · " +
                (analysisProgress ? analysisProgress.done : 0) +
                "/" +
                (analysisProgress ? analysisProgress.total : 9) +
                " 그룹 · " +
                elapsedSec +
                "초 경과",
            ),
          ),
          React.createElement(
            "div",
            {
              style: {
                height: 6,
                borderRadius: 0,
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
            "보통 1~3분 걸려요. 먼저 끝난 그룹부터 카드로 뜨고, 다 끝나면 이번 주 한 줄과 연관 신호 묶음이 이어서 만들어집니다.",
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
            readsMarqueeEl,
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
            chartOpen && isNarrow
              ? mobileChartEl
              : chartOpen &&
              React.createElement(
                "div",
                // 위 카드들과 같은 너비. 18열은 카드 안에서 가로 스크롤.
                { className: "card", style: { overflow: "hidden" } },
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
                    // 그룹 헤더에 카테고리 해석을 잇는다: 헤드라인을 붙이고, 호버하면 해석 팝업 + 특이점 칸 강조
                    groupPlan.useGroups
                      ? groupPlan.groups.map((g, gi) => {
                          const ri = groupReads.findIndex((r) => r.group === g.label);
                          const read = ri >= 0 ? groupReads[ri] : null;
                          return React.createElement(
                            "div",
                            {
                              className: "grid-group-cell" + (read ? " has-read" : ""),
                              key: gi,
                              style: { gridColumn: "span " + g.count },
                              title: g.label,
                              // 호버 = 특이점 칸 강조, 클릭 = 해석 전문 모달
                              onMouseEnter: () =>
                                read && setHoveredEcho((read.anomalies || []).map((a) => a.itemId)),
                              onMouseLeave: () => read && setHoveredEcho(null),
                              onClick: () => read && setReadModal(ri),
                            },
                            g.label,
                            // 해석이 있으면 빨간 네모 하나. 헤드라인은 표 위 목록에 있다
                            read ? React.createElement("span", { className: "grid-group-mark" }) : null,
                          );
                        })
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
                needsReads && !ccOpen
                  ? React.createElement(
                      "button",
                      {
                        className: "btn btn-line",
                        style: { fontSize: 13, padding: "8px 14px" },
                        onClick: runAnalysis,
                        disabled: !sampleFn || state.analysisState === "running",
                      },
                      state.analysisState === "running"
                        ? "해석 만드는 중 " + analysisPct + "%"
                        : "카테고리 해석 만들기 (" + missingReadCount + "그룹)",
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
                  needsReads
                    ? "해석이 아직 없는 그룹이 " +
                        missingReadCount +
                        "개 있습니다. 분석하면 그룹 해석 → 이번 주 한 줄 → 연관 신호 묶음 순으로 채워집니다."
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
                // 손패: 앞면은 제목만. 누르면 뒤집히고 모달로 내용이 뜬다. 아래 선택 바(직접 묶기)와는 별개.
                bundOpen &&
                  React.createElement(
                    "div",
                    { className: "hand" },
                    visibleBundles.map((b) => {
                      const flipped = bundleOpen && state.activeBundleId === b.bundleId;
                      const fb = state.feedback[b.bundleId];
                      return React.createElement(
                        "div",
                        {
                          key: b.bundleId,
                          className: "hand-card" + (flipped ? " is-flipped" : "") + (fb ? " is-rated-" + fb : ""),
                          onMouseEnter: () => setHoveredBundleId(b.bundleId),
                          onMouseLeave: () => setHoveredBundleId(null),
                          onClick: (e) => {
                            e.stopPropagation();
                            openBundle(b.bundleId);
                          },
                        },
                        React.createElement(
                          "div",
                          { className: "hand-face hand-front" },
                          React.createElement("div", { className: "hand-title balance" }, b.title),
                          fb ? React.createElement("span", { className: "hand-fb" }, fb === "up" ? "좋아요" : "별로") : null,
                          React.createElement("span", { className: "hand-hint" }, "눌러서 읽기"),
                        ),
                        React.createElement(
                          "div",
                          { className: "hand-face hand-back" },
                          React.createElement("div", { className: "hand-title balance" }, b.title),
                        ),
                      );
                    }),
                  ),
                bundleOpen && activeBundle
                  ? (() => {
                      const b = activeBundle;
                      const picks = b.itemIds.map((id) => byId.get(id)).filter(Boolean);
                      return React.createElement(
                        "div",
                        { className: "read-modal-backdrop", onClick: closeBundle },
                        React.createElement(
                          "div",
                          {
                            className: "read-modal card",
                            onClick: (e) => e.stopPropagation(),
                            style: { padding: "22px 24px 20px" },
                          },
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
                                    closeBundle();
                                    dispatch({ type: "DELETE_BUNDLE", id: b.bundleId });
                                  },
                                },
                                "×",
                              ),
                              React.createElement("button", { onClick: closeBundle, style: ccGrey }, "닫기"),
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
                                          borderRadius: 0,
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
                        ),
                      );
                    })()
                  : null,
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
      fact: popup.item ? facts.tag[popup.item.id] : "",
      note: popup.item ? anomalyNote(popup.item.id) : "",
      onMouseEnter: () => {
        if (!isTouchDevice()) clearTimeout(popupCloseTimer.current);
      },
      onMouseLeave: () => {
        if (!isTouchDevice()) popupCloseTimer.current = setTimeout(closePopup, 100);
      },
    }),
    readModalEl,
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
        "v0.7 PROTOTYPE \xB7 ",
        state.isSample
          ? "새로고침하면 이번 주 기본 차트로 돌아갑니다"
          : "차트와 해석은 data/runs/" + (state.runId || "") + ".json 에 남습니다",
      ),
    ),
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  React.createElement(ErrorBoundary, null, React.createElement(App, null)),
);
