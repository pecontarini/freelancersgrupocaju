import { useReducer, useCallback } from "react";
import type { ManualSchedule } from "@/hooks/useManualSchedules";
import type { ShortcutPatch } from "./gridShortcuts";

export type Cell = { row: number; col: number };
export type ClipboardCell = {
  // Patch a aplicar; null = limpar
  patch: ShortcutPatch & { agreed_rate?: number; praca_id?: string | null };
} | null;

export type Clipboard = {
  rows: number;
  cols: number;
  cells: ClipboardCell[][];
} | null;

export type Action =
  | { affected: Cell[]; before: (ManualSchedule | null)[]; after: (ShortcutPatch | null)[] };

interface State {
  active: Cell | null;
  selection: { anchor: Cell; head: Cell } | null;
  clipboard: Clipboard;
  history: Action[];
  cursor: number; // -1 = nada para desfazer
}

type Msg =
  | { type: "setActive"; cell: Cell | null }
  | { type: "moveActive"; dRow: number; dCol: number; maxRows: number; maxCols: number; extend: boolean }
  | { type: "setSelection"; anchor: Cell; head: Cell }
  | { type: "extendSelection"; head: Cell }
  | { type: "clearSelection" }
  | { type: "selectAll"; maxRows: number; maxCols: number }
  | { type: "selectRow"; row: number; maxCols: number }
  | { type: "setClipboard"; clipboard: Clipboard }
  | { type: "pushHistory"; action: Action }
  | { type: "moveCursor"; delta: number }
  | { type: "resetHistory" };

const initial: State = {
  active: null,
  selection: null,
  clipboard: null,
  history: [],
  cursor: -1,
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function reducer(state: State, msg: Msg): State {
  switch (msg.type) {
    case "setActive":
      return { ...state, active: msg.cell, selection: null };
    case "moveActive": {
      const base = state.active ?? { row: 0, col: 0 };
      const next: Cell = {
        row: clamp(base.row + msg.dRow, 0, msg.maxRows - 1),
        col: clamp(base.col + msg.dCol, 0, msg.maxCols - 1),
      };
      if (msg.extend) {
        const anchor = state.selection?.anchor ?? base;
        return { ...state, active: next, selection: { anchor, head: next } };
      }
      return { ...state, active: next, selection: null };
    }
    case "setSelection":
      return { ...state, active: msg.head, selection: { anchor: msg.anchor, head: msg.head } };
    case "extendSelection": {
      const anchor = state.selection?.anchor ?? state.active ?? msg.head;
      return { ...state, active: msg.head, selection: { anchor, head: msg.head } };
    }
    case "clearSelection":
      return { ...state, selection: null };
    case "selectAll": {
      const anchor = { row: 0, col: 0 };
      const head = { row: msg.maxRows - 1, col: msg.maxCols - 1 };
      return { ...state, selection: { anchor, head }, active: head };
    }
    case "selectRow": {
      if (state.active == null) return state;
      const anchor = { row: msg.row, col: 0 };
      const head = { row: msg.row, col: msg.maxCols - 1 };
      return { ...state, selection: { anchor, head }, active: head };
    }
    case "setClipboard":
      return { ...state, clipboard: msg.clipboard };
    case "pushHistory": {
      const trimmed = state.history.slice(0, state.cursor + 1);
      const next = [...trimmed, msg.action].slice(-50);
      return { ...state, history: next, cursor: next.length - 1 };
    }
    case "moveCursor":
      return { ...state, cursor: clamp(state.cursor + msg.delta, -1, state.history.length - 1) };
    case "resetHistory":
      return { ...state, history: [], cursor: -1, clipboard: null };
    default:
      return state;
  }
}

export function getSelectionRect(sel: State["selection"], active: Cell | null) {
  if (!sel && !active) return null;
  if (!sel && active) return { r0: active.row, r1: active.row, c0: active.col, c1: active.col };
  const { anchor, head } = sel!;
  return {
    r0: Math.min(anchor.row, head.row),
    r1: Math.max(anchor.row, head.row),
    c0: Math.min(anchor.col, head.col),
    c1: Math.max(anchor.col, head.col),
  };
}

export function isInRect(rect: ReturnType<typeof getSelectionRect>, row: number, col: number) {
  if (!rect) return false;
  return row >= rect.r0 && row <= rect.r1 && col >= rect.c0 && col <= rect.c1;
}

export function useGridSelection() {
  const [state, dispatch] = useReducer(reducer, initial);

  return {
    state,
    setActive: useCallback((cell: Cell | null) => dispatch({ type: "setActive", cell }), []),
    moveActive: useCallback(
      (dRow: number, dCol: number, maxRows: number, maxCols: number, extend = false) =>
        dispatch({ type: "moveActive", dRow, dCol, maxRows, maxCols, extend }),
      []
    ),
    setSelection: useCallback(
      (anchor: Cell, head: Cell) => dispatch({ type: "setSelection", anchor, head }),
      []
    ),
    extendSelection: useCallback((head: Cell) => dispatch({ type: "extendSelection", head }), []),
    clearSelection: useCallback(() => dispatch({ type: "clearSelection" }), []),
    selectAll: useCallback(
      (maxRows: number, maxCols: number) => dispatch({ type: "selectAll", maxRows, maxCols }),
      []
    ),
    selectRow: useCallback(
      (row: number, maxCols: number) => dispatch({ type: "selectRow", row, maxCols }),
      []
    ),
    setClipboard: useCallback((clipboard: Clipboard) => dispatch({ type: "setClipboard", clipboard }), []),
    pushHistory: useCallback((action: Action) => dispatch({ type: "pushHistory", action }), []),
    undo: useCallback(() => dispatch({ type: "moveCursor", delta: -1 }), []),
    redo: useCallback(() => dispatch({ type: "moveCursor", delta: 1 }), []),
    resetHistory: useCallback(() => dispatch({ type: "resetHistory" }), []),
  };
}
