// ==================================================================
// React 컴포넌트 (ReasonPopup · Cell · ManualEditor · ErrorBoundary)
// ==================================================================
import { csvCell, buildChartCsv, buildGroupPlan, parseRawTitle, buildItemsFromMatrix, normTitleKey, normalizeIdeas, groupByCategory, useSectionOpen, computePopupPos, uidSeq, uid, asText, hlText, normalizeReason, KEYWORD_LIMIT, isTouchDevice, sampleWithTimeout, describeSampleError } from "./util.mjs";

const { useState, useEffect, useRef, useReducer, useLayoutEffect, useCallback, useMemo } = React;

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return React.createElement(
        "div",
        { style: { maxWidth: 640, margin: "80px auto", padding: 24, textAlign: "center" } },
        React.createElement(
          "div",
          { style: { fontSize: 16, fontWeight: 700, marginBottom: 8 } },
          "화면을 그리다 문제가 생겼어요",
        ),
        React.createElement(
          "div",
          { style: { fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 } },
          String((this.state.err && this.state.err.message) || this.state.err),
        ),
        React.createElement(
          "button",
          { className: "btn btn-primary", onClick: () => this.setState({ err: null }) },
          "다시 그리기",
        ),
      );
    }
    return this.props.children;
  }
}

export function ReasonPopup({ item, pos, open, onMouseEnter, onMouseLeave }) {
  const ref = useRef(null);
  const [visReasons, setVisReasons] = useState(9);
  const [visKeywords, setVisKeywords] = useState(99);
  const [showType, setShowType] = useState(true);
  useEffect(() => {
    if (item && item.reason) {
      const nr = normalizeReason(item.reason);
      setVisReasons(nr.reasons.length);
      setVisKeywords(Math.min(nr.keywords.length, KEYWORD_LIMIT));
      setShowType(true);
    }
  }, [item && item.id]);
  useLayoutEffect(() => {
    if (!open || !item || !item.reason) return;
    const el = ref.current;
    if (!el) return;
    const MAX = 400;
    if (el.scrollHeight <= MAX) return;
    if (showType) {
      setShowType(false);
      return;
    }
    if (visKeywords > 0) {
      setVisKeywords((v) => Math.max(0, v - 2));
      return;
    }
    if (visReasons > 0) {
      setVisReasons((v) => Math.max(0, v - 1));
      return;
    }
  });
  if (!item || !item.reason) return React.createElement("div", { className: "reason-pop" });
  const r = normalizeReason(item.reason);
  const reasons = r.reasons.slice(0, visReasons);
  const keywords = r.keywords.slice(0, Math.min(visKeywords, KEYWORD_LIMIT));
  return React.createElement(
    "div",
    {
      className: "reason-pop" + (open ? " is-open" : ""),
      style: { left: pos.left, top: pos.top },
      ref,
      onMouseEnter,
      onMouseLeave,
    },
    React.createElement(
      "div",
      {
        style: {
          fontSize: 11,
          fontWeight: 600,
          color: "var(--ink-faint)",
          marginBottom: 6,
          letterSpacing: ".02em",
        },
        className: "mono",
      },
      item.category.toUpperCase(),
      " \xB7 ",
      String(item.rank).padStart(2, "0"),
      "위",
      item.variantGroup ? ` \xB7 이번 주 ${item.variantGroup.length}개 표기로 등장` : "",
    ),
    React.createElement(
      "div",
      {
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: "var(--ink)",
          lineHeight: 1.4,
          marginBottom: 8,
          wordBreak: "keep-all",
        },
      },
      item.title,
      item.artist
        ? React.createElement(
            "span",
            { style: { fontWeight: 500, color: "var(--ink-faint)" } },
            " \xB7 ",
            item.artist,
          )
        : null,
    ),
    React.createElement(
      "div",
      {
        style: {
          fontSize: 20,
          fontWeight: 900,
          lineHeight: 1.25,
          marginBottom: 8,
          letterSpacing: "-.01em",
        },
        className: "balance",
      },
      r.headline,
    ),
    React.createElement(
      "div",
      {
        style: {
          fontSize: 13.5,
          color: "var(--ink-soft)",
          lineHeight: 1.55,
          marginBottom: reasons.length ? 10 : 0,
        },
      },
      r.summary,
    ),
    reasons.length > 0 &&
      React.createElement(
        "div",
        { style: { marginBottom: keywords.length ? 8 : 0 } },
        reasons.map((rs, i) =>
          React.createElement(
            "div",
            { className: "reason-row", key: i },
            React.createElement("span", { className: "reason-rank mono" }, i + 1),
            React.createElement(
              "div",
              { style: { fontSize: 13, color: "var(--ink)", lineHeight: 1.5 } },
              rs.detail,
            ),
          ),
        ),
      ),
    keywords.length > 0 &&
      React.createElement(
        "div",
        { style: { paddingTop: 8, borderTop: "1px solid var(--line)" } },
        keywords.map((k, i) => React.createElement("span", { className: "chip", key: i }, k)),
      ),
  );
}

export function Cell({
  item,
  move,
  selIndex,
  dimmed,
  echo,
  canInteract,
  onOpen,
  onClose,
  onToggleSelect,
  onEchoEnter,
  onEchoLeave,
  onRetry,
}) {
  const btnRef = useRef(null);
  const enterTimer = useRef(null);
  const leaveTimer = useRef(null);
  if (!item.raw) {
    return React.createElement("div", { className: "grid-cell is-empty" }, "—");
  }
  if (item.status === "failed") {
    return React.createElement(
      "button",
      {
        type: "button",
        className: "grid-cell is-failed",
        onClick: () => onRetry(item),
      },
      React.createElement(
        "div",
        { style: { width: "100%" } },
        React.createElement("div", { className: "cell-title" }, item.title),
        React.createElement(
          "div",
          { style: { fontSize: 11, color: "var(--danger)", fontWeight: 700, marginTop: 3 } },
          "분석 실패 · 다시 시도",
        ),
        item.errorReason &&
          React.createElement(
            "div",
            { style: { fontSize: 10, color: "var(--danger)", opacity: 0.8, marginTop: 1 } },
            item.errorReason,
          ),
      ),
    );
  }
  const handleEnter = () => {
    if (isTouchDevice() || !canInteract) return;
    onEchoEnter(item);
    clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(() => {
      if (item.status === "ready") onOpen(item, btnRef.current.getBoundingClientRect());
    }, 120);
  };
  const handleLeave = () => {
    if (isTouchDevice()) return;
    onEchoLeave();
    clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(() => onClose(), 100);
  };
  const handleClick = () => {
    if (isTouchDevice()) {
      if (item.status === "ready") onOpen(item, btnRef.current.getBoundingClientRect(), true);
      return;
    }
    if (item.status === "ready") onToggleSelect(item.id);
  };
  const classes = ["grid-cell"];
  if (canInteract) classes.push("is-hoverable");
  if (selIndex != null) classes.push("is-selected");
  if (dimmed) classes.push("is-dim");
  if (echo) classes.push("is-variant-echo");
  return React.createElement(
    "button",
    {
      ref: btnRef,
      type: "button",
      className: classes.join(" "),
      onMouseEnter: handleEnter,
      onMouseLeave: handleLeave,
      onClick: handleClick,
    },
    selIndex != null && React.createElement("span", { className: "sel-badge mono" }, selIndex + 1),
    React.createElement(
      "div",
      { style: { width: "100%" } },
      move &&
        React.createElement(
          "span",
          { className: "rank-move is-" + move.kind, title: move.title },
          move.label,
        ),
      item.status === "loading"
        ? React.createElement("div", { className: "shimmer", style: { width: "70%" } })
        : React.createElement(
            React.Fragment,
            null,
            React.createElement("div", { className: "cell-title" }, item.title),
            item.artist && React.createElement("div", { className: "cell-artist" }, item.artist),
          ),
    ),
  );
}

export function ManualEditor({ draft, onChange, onCancel, onConfirm }) {
  const setCat = (ci, val) => {
    const cats = draft.categories.slice();
    cats[ci] = val;
    onChange({ ...draft, categories: cats });
  };
  const setCell = (ri, ci, val) => {
    const rows = draft.rows.map((r) => r.slice());
    rows[ri][ci] = val;
    onChange({ ...draft, rows });
  };
  const handlePaste = (ri, ci, e) => {
    const text = e.clipboardData.getData("text");
    if (!text || (!text.includes("	") && !text.includes("\n"))) return;
    e.preventDefault();
    const grid = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((l, idx, arr) => !(idx === arr.length - 1 && l === ""))
      .map((l) => l.split("	"));
    const rows = draft.rows.map((r) => r.slice());
    grid.forEach((line, dr) => {
      line.forEach((val, dc) => {
        const rr = ri + dr,
          cc = ci + dc;
        if (rr < rows.length && cc < draft.categories.length) rows[rr][cc] = val;
      });
    });
    onChange({ ...draft, rows });
  };
  return React.createElement(
    "div",
    { className: "card", style: { padding: 24 } },
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 4,
        },
      },
      React.createElement(
        "h2",
        { style: { fontSize: 18, fontWeight: 700, margin: 0 } },
        "엑셀을 읽지 못했어요. 직접 입력할게요.",
      ),
    ),
    React.createElement(
      "p",
      { style: { fontSize: 13.5, color: "var(--ink-soft)", margin: "6px 0 18px" } },
      "카테고리명과 순위별 항목을 직접 채우거나, 엑셀에서 범위를 복사해 셀에 그대로 붙여넣으세요. 일부 칸만 채워도 진행할 수 있어요.",
    ),
    React.createElement(
      "div",
      { style: { overflowX: "auto" } },
      React.createElement(
        "div",
        {
          className: "rank-grid",
          style: {
            gridTemplateColumns: `56px repeat(${draft.categories.length}, minmax(150px,1fr))`,
            minWidth: 56 + draft.categories.length * 150,
          },
        },
        React.createElement("div", { className: "grid-corner" }),
        draft.categories.map((c, ci) =>
          React.createElement(
            "div",
            { className: "grid-head-cell", key: ci },
            React.createElement("input", {
              className: "manual-input",
              style: { fontWeight: 700, fontSize: 14 },
              value: c,
              onChange: (e) => setCat(ci, e.target.value),
              placeholder: `카테고리 ${ci + 1}`,
            }),
          ),
        ),
        draft.rows.map((row, ri) =>
          React.createElement(
            React.Fragment,
            { key: ri },
            React.createElement(
              "div",
              { className: "rank-cell mono" },
              String(ri + 1).padStart(2, "0"),
            ),
            row.map((val, ci) =>
              React.createElement(
                "div",
                { className: "grid-cell is-empty", key: ci, style: { cursor: "text" } },
                React.createElement("input", {
                  className: "manual-input",
                  value: val,
                  onChange: (e) => setCell(ri, ci, e.target.value),
                  onPaste: (e) => handlePaste(ri, ci, e),
                  placeholder: "—",
                }),
              ),
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { style: { display: "flex", gap: 10, marginTop: 18 } },
      React.createElement(
        "button",
        { className: "btn btn-primary", onClick: onConfirm },
        "이 데이터로 진행",
      ),
      React.createElement("button", { className: "btn btn-ghost", onClick: onCancel }, "취소"),
    ),
  );
}
