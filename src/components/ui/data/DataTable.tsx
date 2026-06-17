'use client';

import {
  Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type HTMLAttributes, type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiPlus, PiMinus, PiCaretUp, PiCaretDown, PiCaretUpDown } from '@/lib/icons';
import { Pagination } from '@/components/ui/navigation/Pagination';
import { IconButton } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/input/SearchInput';
import { Select } from '@/components/ui/input/Select';
import { Skeleton } from '@/components/ui/feedback/Skeleton';
import { KeyValueChip, KeyValueChipRow, KeyValueChipDefaultsContext } from '@/components/custom/KeyValue';

// Types 

export interface DataTableColumn<T> {
  /** Unique identifier for the column. */
  key: string;
  /** Header label. */
  header: ReactNode;
  /** Plain-value getter - used for search and as - fallback when `cell` isn't set. */
  accessor?: (row: T) => unknown;
  /** Custom cell renderer. Receives the row and its rendered index on the current page. */
  cell?: (row: T, rowIndex: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
  /** Approximate min width in px - used by the auto-hide algorithm and as - style hint. */
  width?: number;
  /** Higher = stays visible longer when space runs out. Default 0. */
  priority?: number;
  /** Force this column to outrank the trailing actions column in the
   *  auto-hide order — it stays visible until only the first identity
   *  column is left.  Use for the human-meaningful columns that must
   *  survive longer than the row actions (e.g. First/Last Name, VP). */
  keep?: boolean;
  /** Never render in the table row — the column lives exclusively in
   *  the expanded panel at EVERY viewport width.  Use for secondary
   *  fields that would crowd the row (long dates, emails, notes) so
   *  the first view stays scannable.  Only meaningful with
   *  `overflow="expand"`; scroll/totals tables ignore it. */
  panelOnly?: boolean;
  /** Group key - columns sharing - group are clustered with - vertical separator at boundaries. */
  group?: string;
  /**
 * When the column is hidden and falls into the expanded panel, render the cell
 * "naked" a no label chip, no border around it. Useful for the trailing
 * actions column.
 */
  expandedBare?: boolean;
  /**
   * When the column is hidden and shown in the expanded panel as a
   * `KeyValueChip`, set this for columns whose cell renders an
   * interactive control (Select, Switch, Button, Input).  The chip
   * collapses its value-side padding to 2 px so the control sits
   * with an even 2 px halo on all four sides instead of swimming in
   * the default `px-3` text-cell padding.
   */
  expandedInteractive?: boolean;
  /**
   * Shape hint used by the skeleton renderer when the table is in
   * `loading` mode.  Defaults to a text-line skeleton sized off the
   * column's width.  Use the explicit presets for cells that render
   * pill chips, single buttons or paired action buttons so the
   * placeholder matches the cell's real height — that's what keeps
   * the row from snapping smaller/larger when the real data arrives.
   *
   *   `'text'`    — single text-line, width adapts to `col.width`.
   *   `'chip'`    — small pill (≈72×22).
   *   `'button'`  — single button (≈96×32).
   *   `'actions'` — two button-shaped skeletons side by side (Edit +
   *                 Delete style rows).
   *   `'avatar'`  — 28 px circle.
   *   `'none'`    — empty cell (no placeholder painted).
   */
  skeleton?: 'text' | 'chip' | 'button' | 'actions' | 'avatar' | 'none';
  /** Enable click-to-sort on this column.  When set, a discreet
   *  14 px caret appears next to the header — neutral text colour
   *  at rest, hover flips to primary-500, active sort paints
   *  primary-600.  Clicking cycles `asc → desc → unsorted`.
   *
   *  Two forms:
   *    • `true` — use the column's `accessor` (or the raw value at
   *      `row[key]`) and the built-in comparator: numbers sort
   *      numerically when both sides are numbers, everything else
   *      falls back to case-insensitive string compare.
   *    • `(a, b) => number` — your own comparator over the FULL
   *      rows, called for both directions; the table flips the sign
   *      automatically for `desc`.  Use this for domain-specific
   *      orderings (status enum priority, locale-aware date strings,
   *      multi-field tiebreakers, …) the default comparator can't
   *      express.
   *
   *  Default `undefined` — the icon hides and the header isn't
   *  clickable.  Action / utility columns (Edit / Delete buttons,
   *  expand toggles) should leave this off — they have no meaningful
   *  ordering. */
  sort?: boolean | ((a: T, b: T) => number);
  /** Pin this column to the left or right edge while the rest of the
   *  table scrolls horizontally (use with `overflow="scroll"`).  The
   *  pinned column sticks to its edge, keeps the row's background, and
   *  draws a divider on its INNER side — a RIGHT border when pinned
   *  left, a LEFT border when pinned right — so it reads as separate
   *  from the scrolling columns.  Give pinned columns an explicit
   *  `width` so the offsets line up when several are pinned per side. */
  pin?: 'left' | 'right';
  /** Extra classes merged onto this column's body `<td>` cells (escape
   *  hatch for one-off styling; prefer `pin` for sticky columns). */
  cellClassName?: string;
  /** Extra classes merged onto this column's header `<th>`. */
  headerClassName?: string;
}

export type DataTableOverflow = 'expand' | 'scroll';
export type DataTableVariant  = 'default' | 'totals';

export interface DataTableScrollMode {
  /** Max height of the scroll viewport (px or CSS string). */
  maxHeight: number | string;
  stickyHeader?: boolean;
  stickyFooter?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  /** Stable row identity for keys + expansion tracking. */
  rowKey: (row: T, index: number) => string | number;

  /**
   * `default` aa~ the full feature set (toolbar, pagination, expansion).
   * `totals` aa~ summary layout: no toolbar, no pagination, no expansion,
   *   equal-width columns via `table-layout: fixed`. Designed for the wide
   *   "Detail Summary" strips and similar single/few-row totals.
   */
  variant?: DataTableVariant;

  /**
 * `expand` (default) aa~ auto-hide columns that don't fit; users click "+" to expand.
 * `scroll` aa~ keep every column visible; the table scrolls horizontally instead.
 */
  overflow?: DataTableOverflow;
  /** Manually pin the number of always-visible columns (overrides auto-hide). */
  fixedColumnsCount?: number;
  /** Force the expand column to render on every row even when no
   *  columns are currently hidden.  Use this when `expandedContent`
   *  carries out-of-band data (file attachments, audit trails, related
   *  rows) that's worth surfacing regardless of viewport width.
   *  Without it, the expand affordance only appears once the auto-hide
   *  algorithm drops at least one column into the expand panel —
   *  which would leave wide-viewport users with no way to reach the
   *  extra content. */
  alwaysExpandable?: boolean;

  /** Draw a 1px divider between every column (header + body).  Great for
   *  dense raw-data tables (Detail Summary, exports, etc.). */
  verticalDividers?: boolean;

  /** Suppress line breaks in every header and cell — long labels stay on one
   *  line and may be clipped by the column. Defaults to `true` for
   *  `overflow="scroll"` (the table grows sideways anyway) and `false`
   *  everywhere else, so totals / expand tables wrap naturally. */
  nowrap?: boolean;

  /** Hide the column-label header row (`<thead>`).  Use for static
   *  reference tables whose columns are self-evident from a section
   *  caption or the cell content (e.g. the Cross-Sell Playbook talking
   *  points / talk-track tables). */
  hideHeader?: boolean;
  /** Render a full-width banded section-header row (colspan = all
   *  columns) whenever this returns a NEW label vs. the previous row.
   *  Lets a single table group its rows under section titles like
   *  "Business with no employees".  Pairs with `hideHeader`. */
  sectionFor?: (row: T, index: number) => string | undefined | null;

  /** Left-aligned slot in the top toolbar for filters / buttons. */
  toolbar?: ReactNode;
  /** Optional second toolbar row - handy for - wider set of filters / buttons. */
  toolbarBottom?: ReactNode;
  /** Show the built-in search input. Default `true`. */
  showSearch?: boolean;
  searchPlaceholder?: string;
  /** Size of the top-toolbar controls (rows-per-page Select + Search).
   *  Defaults to `sm` when a `toolbarBottom` is present (so they don't
   *  tower over the second-row filter pills) and `md` otherwise.  Pass an
   *  explicit value to force a size regardless of `toolbarBottom`. */
  toolbarControlSize?: 'sm' | 'md';
  /** Breakpoint at which the top toolbar reflows from STACKED (custom
   *  slot above, rows-per-page + search below) to a single side-by-side
   *  row.  Default `md`.  Raise it to `lg` / `xl` when the `toolbar`
   *  slot carries several buttons that would otherwise wrap awkwardly
   *  next to the search controls on tablet-sized viewports. */
  toolbarBreak?: 'md' | 'lg' | 'xl';

  /** Initial page size. Default 10. */
  pageSize?: number;
  /** Choices for the rows-per-page dropdown. */
  pageSizeOptions?: number[];
  /** Hide the rows-per-page picker. */
  hidePageSizePicker?: boolean;

  /** Enable vertical-scroll mode (replaces pagination). */
  scrollMode?: DataTableScrollMode;

  /** Custom renderer for the expanded row body. Default: chip-style key/value pairs. */
  expandedContent?: (row: T, hiddenColumns: DataTableColumn<T>[]) => ReactNode;
  /** Keep showing the auto-hidden columns as KeyValue chips even when a
   *  custom `expandedContent` is set — the chips render ABOVE the custom
   *  content.  Without this, `expandedContent` fully replaces the chips, so
   *  collapsed columns become unreachable.  Use it when the expand panel
   *  carries its own UI (tabs, sub-rows) AND you still want the columns the
   *  viewport dropped to surface in the panel. */
  expandedShowHiddenColumns?: boolean;

  /** Optional table footer (e.g. totals row). */
  footer?: ReactNode;
  /** Custom empty-state content. */
  emptyState?: ReactNode;

  /** Replace the rows with shape-aware skeleton placeholders while data
   *  is loading.  The component itself doesn't time anything — the page
   *  flips this back to `false` once data is ready.  Pairs with the
   *  per-column `skeleton` hint to mirror chip / button / actions cells
   *  at roughly the right height so the row doesn't snap when real data
   *  lands. */
  loading?: boolean;
  /** Number of skeleton rows when `loading` is true.  Defaults to
   *  `pageSize` so the table reserves the same vertical real estate it
   *  will occupy once the data shows up. */
  skeletonRowCount?: number;

  /** Extra `className` applied per-row.  Use it to paint a selected /
   *  flagged / disabled tint that the consumer wants merged with
   *  DataTable's default row chrome.  `cn` runs at render time so
   *  Tailwind utility precedence (last wins) lets the returned class
   *  override the default `bg-white hover:bg-primary-50` row bg. */
  rowClassName?: (row: T, index: number) => string | undefined;
  /** Extra `<tr>` props merged onto each body row — `onMouseEnter` /
   *  `onMouseLeave` / `data-*` / etc.  Lets the consumer wire up
   *  row-level interactions (hover previews, custom focus rings,
   *  contextual data attributes for testing) without having to fork
   *  the table.  Class names provided here are folded in via `cn` and
   *  follow the same precedence rule as `rowClassName`. */
  rowProps?: (row: T, index: number) => HTMLAttributes<HTMLTableRowElement> | undefined;

  className?: string;
}

// Constants 

const DEFAULT_PAGE_SIZE         = 10;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_MIN_COL_WIDTH     = 140;
const PLUS_BUTTON_WIDTH         = 48;
const PADDING_SAFE              = 32;

// Auto-hide "keep" floors layered ON TOP of each column's own `priority`
// so two structural columns are always the last to collapse into the
// expand panel, regardless of the per-column priorities a page sets:
//   • the trailing actions column (Edit / Delete …) is the PENULTIMATE
//     survivor, and
//   • the FIRST column — unless it's an id / "#" index column — is the
//     VERY LAST survivor (it carries the row's human-readable identity,
//     so a row with every other column collapsed is still recognisable).
// The floors sit far above any realistic hand-set priority and the
// first-column floor outranks the actions floor so their relative order
// is fixed.
const ACTIONS_KEEP_FLOOR     = 1_000_000;
// `keep` columns sit ABOVE the actions floor but below the first-column
// floor, so a page can declare "this data column matters more than the row
// actions" (First/Last Name, VP) without dislodging the identity column.
const KEEP_FLOOR             = 1_500_000;
const FIRST_COL_KEEP_FLOOR   = 2_000_000;

// Static per-breakpoint classes for the top toolbar's stacked → side-by-side
// reflow (`toolbarBreak` prop).  Spelled out literally so the Tailwind JIT
// picks every variant up.
const TOOLBAR_BREAK_ROW: Record<'md' | 'lg' | 'xl', string> = {
  md: 'md:flex-row md:flex-wrap md:items-center',
  lg: 'lg:flex-row lg:flex-wrap lg:items-center',
  xl: 'xl:flex-row xl:flex-wrap xl:items-center',
};
const TOOLBAR_BREAK_SLOT: Record<'md' | 'lg' | 'xl', string> = {
  md: 'md:flex-1',
  lg: 'lg:flex-1',
  xl: 'xl:flex-1',
};
const TOOLBAR_BREAK_CONTROLS: Record<'md' | 'lg' | 'xl', string> = {
  md: 'md:ml-auto',
  lg: 'lg:ml-auto',
  xl: 'xl:ml-auto',
};

/** True when the column reads as the trailing row-actions column produced
 *  by `actionsColumn` (Edit / Delete buttons).  Detected off the
 *  `skeleton: 'actions'` hint it always sets, with the conventional
 *  `key === 'actions'` as a fallback. */
function isActionsColumn(col: DataTableColumn<unknown>): boolean {
  return col.skeleton === 'actions' || col.key === 'actions';
}

/** True when the column looks like a leading id / row-number / "#" index
 *  column, OR a selection-checkbox utility column — these carry no human
 *  meaning, so they're NOT worth protecting as the last-visible column
 *  (a `keep` data column should outrank them). */
function isIdLikeColumn(col: DataTableColumn<unknown>): boolean {
  if (/^(id|#|no|num|number|index|row|rownumber|seq|select|selection|checkbox)$/i.test(col.key)) return true;
  return typeof col.header === 'string' && /^(#|id|no\.?|num|number)$/i.test(col.header.trim());
}

/** Every KeyValueChip rendered inside a DataTable — both the ones the
 *  table paints itself (expanded panel, responsive totals row) and any
 *  chip the consumer hands back from `expandedContent` — defaults to
 *  `size="sm"`.  Stable module-level reference so the provider doesn't
 *  re-render its subtree on every parent render. */
const DATATABLE_CHIP_DEFAULTS = { defaultSize: 'sm' as const, defaultResponsiveBlock: true };

// Component 

export function DataTable<T>({
  data,
  columns,
  rowKey,
  variant = 'default',
  overflow = 'expand',
  fixedColumnsCount,
  alwaysExpandable = false,
  verticalDividers,
  nowrap: nowrapProp,
  hideHeader = false,
  sectionFor,
  toolbar,
  toolbarBottom,
  showSearch: showSearchProp,
  searchPlaceholder = 'Search...',
  toolbarControlSize,
  toolbarBreak = 'md',
  pageSize: pageSizeProp,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hidePageSizePicker: hidePageSizePickerProp,
  scrollMode,
  expandedContent,
  expandedShowHiddenColumns,
  footer,
  emptyState,
  loading = false,
  skeletonRowCount,
  rowClassName,
  rowProps,
  className,
}: DataTableProps<T>) {
  // ── variant defaults ──────────────────────────────────────────────────────
  // `totals` strips the toolbar and pagination and uses a fixed table layout
  // so each column gets equal width without depending on its content.
  const isTotals = variant === 'totals';
  const showSearch         = showSearchProp         ?? !isTotals;
  const hidePageSizePicker = hidePageSizePickerProp ?? isTotals;
  const initialPageSize    = pageSizeProp           ?? (isTotals ? 0 : DEFAULT_PAGE_SIZE);
  const nowrap             = nowrapProp             ?? overflow === 'scroll';
  // Top-toolbar control size (rows-per-page Select + Search).  Defaults to
  // `sm` when a second filter row (`toolbarBottom`) is present so the
  // controls don't tower over the filter pills; `md` otherwise.  An explicit
  // `toolbarControlSize` overrides that heuristic.
  const ctrlSize = toolbarControlSize ?? (toolbarBottom ? 'sm' : 'md');
  const ctrlIsSm = ctrlSize === 'sm';
  const containerRef = useRef<HTMLDivElement>(null);

  // aa State
  const [search,         setSearch]         = useState('');
  const [page,           setPage]           = useState(1);
  const [pageSize,       setPageSize]       = useState(initialPageSize);
  const [expandedKeys,   setExpandedKeys]   = useState<Set<string | number>>(new Set());
  const [containerWidth, setContainerWidth] = useState(0);

  // aa Track container width for auto-hide 
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // aa Column visibility
  const { visibleColumns, hiddenColumns } = useMemo(() => {
    // Totals variant always shows every column - table-layout: fixed handles
    // the squeeze without dropping columns into an expand panel.
    if (isTotals || overflow !== 'expand') {
      return { visibleColumns: columns, hiddenColumns: [] as DataTableColumn<T>[] };
    }

    // `panelOnly` columns never compete for row width — they live in the
    // expanded panel at every viewport size.  Everything below (fixed count,
    // width fitting, hide order) runs over the remaining row candidates.
    const rowIndices = columns.map((_, i) => i).filter(i => !columns[i].panelOnly);

    if (containerWidth === 0) {
      const visible0: DataTableColumn<T>[] = [];
      const hidden0:  DataTableColumn<T>[] = [];
      columns.forEach((c) => (c.panelOnly ? hidden0 : visible0).push(c));
      return { visibleColumns: visible0, hiddenColumns: hidden0 };
    }

    if (fixedColumnsCount !== undefined) {
      const keepFixed = new Set(rowIndices.slice(0, fixedColumnsCount));
      const visibleF: DataTableColumn<T>[] = [];
      const hiddenF:  DataTableColumn<T>[] = [];
      columns.forEach((c, i) => (keepFixed.has(i) ? visibleF : hiddenF).push(c));
      return { visibleColumns: visibleF, hiddenColumns: hiddenF };
    }

    const available = containerWidth - PLUS_BUTTON_WIDTH - PADDING_SAFE;
    const widths = columns.map(c => c.width ?? DEFAULT_MIN_COL_WIDTH);

    // Effective "keep" priority = the column's own `priority` raised to a
    // structural floor for the two columns that must outlast the rest:
    // the leading identity column (last to hide) and the trailing actions
    // column (penultimate).  `Math.max` means an explicit priority can
    // never drag these BELOW their floor.
    const firstRowIdx = rowIndices[0];
    const effPriority = (i: number): number => {
      const col  = columns[i] as DataTableColumn<unknown>;
      const base = col.priority ?? 0;
      // Floor order (highest wins): first identity column > `keep`
      // columns > actions column > the column's own priority.
      if (i === firstRowIdx && !isIdLikeColumn(col)) return Math.max(base, FIRST_COL_KEEP_FLOOR);
      if (col.keep)                        return Math.max(base, KEEP_FLOOR);
      if (isActionsColumn(col))            return Math.max(base, ACTIONS_KEEP_FLOOR);
      return base;
    };

    // Hide order: lowest effective priority first, right-most as tiebreaker.
    const hideOrder = [...rowIndices].sort((a, b) => {
      const pa = effPriority(a);
      const pb = effPriority(b);
      if (pa !== pb) return pa - pb;
      return b - a;
    });

    const keep = new Set(rowIndices);
    let total = rowIndices.reduce((s, i) => s + widths[i], 0);
    for (const idx of hideOrder) {
      if (total <= available) break;
      if (keep.size <= 1) break;
      keep.delete(idx);
      total -= widths[idx];
    }

    const visible: DataTableColumn<T>[] = [];
    const hidden:  DataTableColumn<T>[] = [];
    columns.forEach((c, i) => ((keep.has(i) && !c.panelOnly) ? visible : hidden).push(c));
    return { visibleColumns: visible, hiddenColumns: hidden };
  }, [columns, containerWidth, overflow, fixedColumnsCount, isTotals]);

  const hasExpand =
    overflow === 'expand' && !isTotals &&
    (hiddenColumns.length > 0 || alwaysExpandable);

  // Sticky-column offsets.  Only meaningful with `overflow="scroll"`
  // (which never renders the expand column), so left-pinned columns
  // accumulate straight from the left edge and right-pinned from the
  // right.  Columns should declare a `width` so multiple pins per side
  // stack without overlapping.
  const pinInfo = useMemo(() => {
    const left:  Record<string, number> = {};
    const right: Record<string, number> = {};
    let l = 0;
    for (const col of visibleColumns) {
      if (col.pin === 'left') { left[col.key] = l; l += col.width ?? 0; }
    }
    let r = 0;
    for (let i = visibleColumns.length - 1; i >= 0; i--) {
      const col = visibleColumns[i];
      if (col.pin === 'right') { right[col.key] = r; r += col.width ?? 0; }
    }
    return { left, right };
  }, [visibleColumns]);

  /** Sticky positioning classes for a pinned column.  The inner-side
   *  divider (right edge for left-pinned, left edge for right-pinned) is
   *  what keeps the pinned column visually distinct from the columns
   *  scrolling underneath.  It's drawn as an INSET box-shadow, not a
   *  `border`: the table uses `border-collapse`, where cell borders are
   *  owned by the table and a sticky cell's own border only paints once
   *  it detaches on scroll — so the divider would vanish at rest.  An
   *  inset shadow is painted by the cell itself, so it shows at ALL
   *  times, scrolled or not.  Header cells paint their own surface; body
   *  cells inherit the row background (zebra / hover / selected). */
  const pinCellCls = (col: DataTableColumn<T>, kind: 'head' | 'body'): string | undefined => {
    if (!col.pin) return undefined;
    return cn(
      'sticky',
      kind === 'head' ? 'z-20 bg-(--color-surface-card)' : 'z-[1] bg-inherit',
      col.pin === 'left'
        ? 'shadow-[inset_-1px_0_0_0_var(--color-border-strong)]'
        : 'shadow-[inset_1px_0_0_0_var(--color-border-strong)]',
    );
  };

  /** Merge a column's width with its sticky `left` / `right` offset. */
  const colStyle = (col: DataTableColumn<T>): CSSProperties | undefined => {
    const s: CSSProperties = {};
    if (col.width) s.width = col.width;
    if (col.pin === 'left')  s.left  = pinInfo.left[col.key]  ?? 0;
    if (col.pin === 'right') s.right = pinInfo.right[col.key] ?? 0;
    return Object.keys(s).length ? s : undefined;
  };

  // aa Filtering
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter(row =>
      columns.some(col => {
        const val = col.accessor
          ? col.accessor(row)
          : (row as Record<string, unknown>)[col.key];
        if (val == null) return false;
        return String(val).toLowerCase().includes(q);
      }),
    );
  }, [data, search, columns]);

  // aa Sorting
  // Sort state lives ON the table — consumers opt INTO sorting by
  // setting `sort: true` on a column (the click handler + caret icon
  // then surface in the header).  Clicking a column cycles:
  //   unsorted (no key set)  →  asc  →  desc  →  unsorted
  // The cycle resets when the producer picks a DIFFERENT column.
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc')      setSortDir('desc');
    else if (sortDir === 'desc'){ setSortKey(null); setSortDir(null); }
    else                         setSortDir('asc');
  };

  /** Compare two values for the active sort.  Numbers compare
   *  numerically; everything else falls back to a case-insensitive
   *  string compare so dates / chips / mixed cells still order
   *  predictably.  `null` / `undefined` sink to the bottom regardless
   *  of direction. */
  const compareForSort = (a: unknown, b: unknown): number => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    const sa = String(a).toLowerCase();
    const sb = String(b).toLowerCase();
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return filteredData;
    const col = columns.find(c => c.key === sortKey);
    if (!col || !col.sort) return filteredData;
    const sign = sortDir === 'asc' ? 1 : -1;
    // Two strategies, picked off the column config:
    //   • function-form `sort` → consumer-supplied comparator over
    //     the FULL rows.  Gives the consumer access to fields the
    //     accessor / display value might not surface.
    //   • boolean `sort: true` → default comparator on the column's
    //     accessor (or `row[key]`), with the number / string
    //     heuristic in `compareForSort`.
    if (typeof col.sort === 'function') {
      const cmp = col.sort;
      return [...filteredData].sort((a, b) => sign * cmp(a, b));
    }
    const getVal = (row: T) => col.accessor
      ? col.accessor(row)
      : (row as Record<string, unknown>)[col.key];
    return [...filteredData].sort((a, b) => sign * compareForSort(getVal(a), getVal(b)));
  }, [filteredData, sortKey, sortDir, columns]);

  // aa Pagination
  const useVerticalScroll = !!scrollMode;
  /** `pageSize <= 0` disables pagination — render every row without slicing. */
  const paginationOff = useVerticalScroll || pageSize <= 0;
  const totalPages   = paginationOff ? 1 : Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage  = Math.min(page, totalPages);
  const pagedData    = paginationOff
    ? sortedData
    : sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [search]);

  // aa Helpers
  // Single-row expansion — at most one row can be open at any time.
  // Clicking `+` on a different row implicitly collapses whichever
  // row was previously expanded; clicking `−` on the open row
  // collapses it (empty set).  Keeps the table tidy: a producer
  // never has to scroll past two simultaneously-open expanded
  // panels when comparing siblings.
  const toggleRow = (key: string | number) =>
    setExpandedKeys(prev =>
      prev.has(key) ? new Set() : new Set([key]),
    );

  const getCellValue = (col: DataTableColumn<T>, row: T, rowIdx: number): ReactNode => {
    if (col.cell) return col.cell(row, rowIdx);
    if (col.accessor) return col.accessor(row) as ReactNode;
    return (row as Record<string, unknown>)[col.key] as ReactNode;
  };

  const isGroupBoundary = (col: DataTableColumn<T>, idx: number, list: DataTableColumn<T>[]) =>
    idx > 0 &&
    col.group !== list[idx - 1].group &&
    !!(col.group || list[idx - 1].group);

  // aa Render
  const totalCols = visibleColumns.length + (hasExpand ? 1 : 0);
  const showToolbar = !!toolbar || !!toolbarBottom || showSearch || !hidePageSizePicker;

  // Header styling - primary-950 semibold 11px uppercase, letter-spacing 4 %, line-height 120 % (per design spec).
  const HEADER_CLS = 'px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.04em] leading-[1.2] text-primary-950';

  // Page-size Select options
  const pageSizeOptionsForSelect = useMemo(
    () => pageSizeOptions.map(n => ({ value: String(n), label: String(n) })),
    [pageSizeOptions],
  );

  // ── totals variant — responsive split ─────────────────────────────────────
  // Desktop (xl+): wide horizontal table, one row of metrics, equal-width
  //   columns via `table-fixed`.
  // Responsive (<xl): vertical stack of label/value chips.  The label is the
  //   one that compresses (truncates with ellipsis); the value is pinned
  //   right at its natural width so the number stays fully visible.  Every
  //   page that uses `variant="totals"` gets this for free — no per-page
  //   wrapper required.
  if (isTotals) {
    const totalsRow = data[0] as T | undefined;
    return (
      <KeyValueChipDefaultsContext.Provider value={DATATABLE_CHIP_DEFAULTS}>
      <div
        ref={containerRef}
        data-component="DataTable"
        data-variant="totals"
        className={cn('w-full', className)}
      >
        {/* Desktop — horizontal totals table */}
        <div className="hidden xl:block rounded-lg border border-(--color-border-strong) bg-(--color-surface-card) overflow-hidden">
          <table className="w-full border-collapse text-sm table-fixed">
            <thead className="bg-(--color-surface-card) border-b border-neutral-300">
              {/* No `h-*` floor on the row — the variant is a compact
                  summary, so the `HEADER_CLS` `py-3` alone defines the
                  natural header height (≈ 37 px).  Consumers that
                  render multiple totals tables side-by-side in a grid
                  can opt into a `min-h-*` floor via className (see the
                  Detail Summary report's `TotalsTable` helper) so any
                  table whose header wraps to 2 lines stays vertically
                  aligned with its single-line neighbours. */}
              <tr>
                {visibleColumns.map((col, idx) => (
                  <th
                    key={col.key}
                    className={cn(
                      HEADER_CLS,
                      col.align === 'center' && 'text-center',
                      col.align === 'right'  && 'text-right',
                      (verticalDividers && idx > 0) && 'border-l border-l-(--color-border-default)',
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* The single totals data row carries `bg-surface-muted`
                  — same tonal treatment that conventional summary
                  reports paint behind the headline numbers.  Reads as
                  a banded "totals" strip distinct from the white
                  header above and any surrounding card chrome. */}
              {totalsRow && (
                <tr>
                  {visibleColumns.map((col, idx) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 py-2.5 bg-(--color-surface-muted) text-(--color-text-default) align-middle',
                        col.align === 'center' && 'text-center',
                        col.align === 'right'  && 'text-right',
                        (verticalDividers && idx > 0) && 'border-l border-l-(--color-border-default)',
                      )}
                      style={col.width ? { width: col.width } : undefined}
                    >
                      {getCellValue(col, totalsRow, 0)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Responsive — chips at their natural (auto) width, wrapping to new
            rows when they don't fit.  Chips only shrink (and the label
            truncate kicks in) when a single chip is wider than its row —
            i.e. when the parent is narrower than the chip itself. */}
        <div className="xl:hidden">
          <KeyValueChipRow
            items={visibleColumns.map(col => ({
              label: col.header,
              value: totalsRow ? getCellValue(col, totalsRow, 0) : '',
            }))}
          />
        </div>
      </div>
      </KeyValueChipDefaultsContext.Provider>
    );
  }

  return (
    <KeyValueChipDefaultsContext.Provider value={DATATABLE_CHIP_DEFAULTS}>
    <div
      ref={containerRef}
      data-component="DataTable"
      className={cn(
        'flex flex-col rounded-lg border border-(--color-border-strong) bg-(--color-surface-card) overflow-hidden',
        className,
      )}
    >
      {/* Toolbar — stacks vertically on narrow viewports (custom slot above,
          controls below) and reflows to a single row at the `toolbarBreak`
          breakpoint (default md) where there's room.  The left slot (custom
          actions / filters) and the right cluster (page-size + search) are
          two independent flex groups so each can wrap or stack on its own
          axis without dragging the other along. */}
      {showToolbar && (
        <div className="border-b border-(--color-border-strong)">
          <div className={cn('flex flex-col gap-3 px-4 py-3', TOOLBAR_BREAK_ROW[toolbarBreak])}>
            {toolbar && (
              <div className={cn('flex min-w-0 items-center gap-2 flex-wrap', TOOLBAR_BREAK_SLOT[toolbarBreak])}>{toolbar}</div>
            )}
            <div className={cn(
              // Cross-cluster behaviour — stack vertically on very narrow
              // (so search drops below the page-size picker), reflow to a
              // row at sm+ where there's room for both side by side.
              'flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3',
              !!toolbar && TOOLBAR_BREAK_CONTROLS[toolbarBreak],
            )}>
              {!useVerticalScroll && !hidePageSizePicker && (
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-(--color-text-muted) whitespace-nowrap',
                    // Tighter label when a `toolbarBottom` is present —
                    // the second-row filters already crowd the toolbar
                    // visually, so the page-size cluster scales down
                    // to keep the chrome from feeling top-heavy.
                    ctrlIsSm ? 'text-xs' : 'text-[13px]',
                  )}>
                    Rows per page:
                  </span>
                  <div className={ctrlIsSm ? 'w-[84px]' : 'w-[96px]'}>
                    <Select
                      size={ctrlSize}
                      value={String(pageSize)}
                      onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
                      options={pageSizeOptionsForSelect}
                    />
                  </div>
                </div>
              )}
              {showSearch && (
                // Full-width on narrow so the search input never overflows
                // the toolbar; clamps back to a fixed pill at sm+.
                // Search shrinks to sm when a `toolbarBottom` is in
                // play so it doesn't tower over the second-row filter
                // pills.
                <div className={cn(
                  'w-full',
                  ctrlIsSm ? 'sm:w-[240px]' : 'sm:w-[280px]',
                )}>
                  <SearchInput
                    size={ctrlSize}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                  />
                </div>
              )}
            </div>
          </div>
          {toolbarBottom && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-(--color-border-muted) bg-neutral-50/40">
              {toolbarBottom}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div
        className={cn(
          'flex-1 min-h-0',
          overflow === 'scroll' && 'overflow-x-auto',
          useVerticalScroll && 'overflow-y-auto',
        )}
        style={useVerticalScroll ? { maxHeight: scrollMode!.maxHeight } : undefined}
      >
        <table className={cn('w-full border-collapse text-sm', isTotals && 'table-fixed')}>
          {!hideHeader && (
          <thead
            className={cn(
              'bg-(--color-surface-card)',
              // Sticky <thead>+border-collapse drops the bottom border in
              // Chrome/Safari.  Use a 1px box-shadow as a stand-in so the
              // divider stays visible when the header pins to the top.
              useVerticalScroll && scrollMode!.stickyHeader
                ? 'sticky top-0 z-10 shadow-[0_1px_0_var(--color-neutral-300)]'
                : 'border-b border-neutral-300',
            )}
          >
            {/* 48 px floor on the header row.  `min-height` on `<tr>`
                is unreliable across browsers (tables size rows by
                their tallest cell), so the floor lives on the TH
                children via the arbitrary `[&>th]:h-12` — table
                cells DO respect `height` as a minimum row-track
                height in CSS-2.1 table layout, so the tallest
                specified cell height drives the row.  Mirrors the
                same trick on body rows (`[&>td]:h-12`). */}
            <tr className="[&>th]:h-12">
              {hasExpand && <th className="w-12 px-2 py-3" />}
              {visibleColumns.map((col, idx) => {
                const sortable     = col.sort === true || typeof col.sort === 'function';
                const isSorted     = sortable && sortKey === col.key && sortDir !== null;
                const sortIcon     = isSorted
                  ? (sortDir === 'asc' ? PiCaretUp : PiCaretDown)
                  : PiCaretUpDown;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      HEADER_CLS,
                      nowrap && 'whitespace-nowrap',
                      col.align === 'center' && 'text-center',
                      col.align === 'right'  && 'text-right',
                      (verticalDividers && idx > 0) && 'border-l border-l-(--color-border-default)',
                      isGroupBoundary(col, idx, visibleColumns) && 'border-l border-l-neutral-300',
                      sortable && 'group cursor-pointer select-none',
                      pinCellCls(col, 'head'),
                      col.headerClassName,
                    )}
                    style={colStyle(col)}
                    onClick={sortable ? () => toggleSort(col.key) : undefined}
                    aria-sort={
                      !sortable ? undefined
                        : !isSorted ? 'none'
                        : sortDir === 'asc' ? 'ascending'
                        : 'descending'
                    }
                  >
                    <span className={cn(
                      'inline-flex items-center gap-1.5',
                      col.align === 'center' && 'justify-center',
                      col.align === 'right'  && 'justify-end',
                    )}>
                      {col.header}
                      {sortable && (
                        <Icon
                          icon={sortIcon}
                          size={14}
                          className={cn(
                            'transition-colors shrink-0',
                            isSorted
                              ? 'text-primary-600'
                              : 'text-(--color-text-subtle) group-hover:text-primary-500',
                          )}
                        />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          )}

          <tbody>
            {loading ? (
              // Skeleton mode — render N placeholder rows sharing the
              // exact same <tr>/<td> structure as the real rows so
              // zebra stripes, dividers, padding and column widths all
              // line up.  Row height is dictated by the tallest cell
              // placeholder (the `actions` / `chip` / `button` hints
              // mirror the real cells' intrinsic heights) so the table
              // doesn't snap when real data lands.
              Array.from({ length: Math.max(1, skeletonRowCount ?? pageSize) }).map((_, rowIdx) => {
                const baseRowBg = rowIdx % 2 === 0
                  ? 'bg-(--color-surface-muted)'
                  : 'bg-(--color-surface-card)';
                return (
                  <tr
                    key={`__skeleton-${rowIdx}`}
                    aria-hidden
                    className={cn(
                      // 48 px floor — matches the real rows below so
                      // the skeleton placeholder strip occupies the
                      // same vertical real estate the live data will.
                      // Same trick as the body rows (`[&>td]:h-12`):
                      // height on table cells acts as a minimum
                      // row-track height in CSS-2.1 table layout.
                      '[&>td]:h-12',
                      rowIdx > 0 && 'border-t border-(--color-border-default)',
                      baseRowBg,
                    )}
                  >
                    {hasExpand && <td className="px-2 py-2 w-12" />}
                    {visibleColumns.map((col, idx) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2.5 align-middle',
                          nowrap && 'whitespace-nowrap',
                          (verticalDividers && idx > 0) && 'border-l border-l-(--color-border-default)',
                          isGroupBoundary(col, idx, visibleColumns) && 'border-l border-l-neutral-300',
                          pinCellCls(col, 'body'),
                          col.cellClassName,
                        )}
                        style={colStyle(col)}
                      >
                        <CellSkeleton hint={col.skeleton} width={col.width} align={col.align} />
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : pagedData.length === 0 ? (
              <tr>
                <td
                  colSpan={totalCols}
                  className="px-3 py-12 text-center text-[13px] text-(--color-text-subtle) border-t border-(--color-border-strong)"
                >
                  {emptyState ?? 'No results'}
                </td>
              </tr>
            ) : (
              pagedData.map((row, rowIdx) => {
                const key       = rowKey(row, rowIdx);
                const expanded  = expandedKeys.has(key);
                const showPanel = hasExpand && expanded;
                // Zebra: odd index neutral-50, even white. Hover/expanded aa~ primary-50.
                const baseRowBg = rowIdx % 2 === 0 ? 'bg-(--color-surface-muted)' : 'bg-(--color-surface-card)';
                const consumerRowProps = rowProps?.(row, rowIdx);
                const { className: consumerRowClass, ...restRowProps } = consumerRowProps ?? {};
                // Section grouping — emit a banded full-width row whenever the
                // section label changes from the previous row.
                const section     = sectionFor?.(row, rowIdx);
                const prevSection = rowIdx > 0 ? sectionFor?.(pagedData[rowIdx - 1], rowIdx - 1) : undefined;
                const showSection = !!section && section !== prevSection;
                return (
                  <Fragment key={key}>
                    {showSection && (
                      <tr>
                        <th
                          scope="colgroup"
                          colSpan={totalCols}
                          className={cn(
                            // Match the column-header (`th`) appearance — small,
                            // uppercase, tracked, primary-950, centered — on the
                            // same white surface + bottom border as the real
                            // table header (`<thead>`).
                            'px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.04em] leading-[1.2] text-primary-950',
                            'bg-(--color-surface-card) border-b border-neutral-300',
                            rowIdx > 0 && 'border-t border-neutral-300',
                          )}
                        >
                          {section}
                        </th>
                      </tr>
                    )}
                    <tr
                      {...restRowProps}
                      className={cn(
                        'transition-colors',
                        // 48 px floor on every row.  `min-height` on
                        // `<tr>` is unreliable across browsers (tables
                        // size rows by their tallest cell), so the
                        // floor lives on the TD children via the
                        // arbitrary `[&>td]:h-12` — table cells DO
                        // respect `height` as a minimum row-track
                        // height in the CSS-2.1 table layout, so the
                        // tallest specified cell height drives the
                        // row.  Cells with extra content can still
                        // grow past 48 px naturally.
                        '[&>td]:h-12',
                        rowIdx > 0 && 'border-t border-(--color-border-default)',
                        showPanel ? 'bg-primary-50' : `${baseRowBg} hover:bg-primary-50`,
                        // Consumer-supplied overrides come LAST so
                        // their utility classes (e.g. selected-row
                        // `bg-primary-100`) win the Tailwind cascade
                        // against the default row chrome above.
                        rowClassName?.(row, rowIdx),
                        consumerRowClass,
                      )}
                    >
                      {hasExpand && (
                        <td className="px-3 py-2 w-12 align-middle">
                          <IconButton
                            size="xs"
                            variant="soft"
                            shape="circle"
                            aria-label={expanded ? 'Collapse row' : 'Expand row'}
                            onClick={() => toggleRow(key)}
                          >
                            <Icon icon={expanded ? PiMinus : PiPlus} size={12} />
                          </IconButton>
                        </td>
                      )}
                      {visibleColumns.map((col, idx) => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-3 py-2.5 text-(--color-text-default) align-middle',
                            nowrap && 'whitespace-nowrap',
                            col.align === 'center' && 'text-center',
                            col.align === 'right'  && 'text-right',
                            (verticalDividers && idx > 0) && 'border-l border-l-(--color-border-default)',
                            isGroupBoundary(col, idx, visibleColumns) && 'border-l border-l-neutral-300',
                            pinCellCls(col, 'body'),
                            col.cellClassName,
                          )}
                          style={colStyle(col)}
                        >
                          {getCellValue(col, row, rowIdx)}
                        </td>
                      ))}
                    </tr>

                    {hasExpand && (
                      <tr className={cn(expanded ? 'bg-primary-50' : baseRowBg)}>
                        <td colSpan={totalCols} className="p-0">
                          <div
                            className={cn(
                              'grid transition-[grid-template-rows] duration-300 ease-app',
                              expanded ? '[grid-template-rows:1fr]' : '[grid-template-rows:0fr]',
                            )}
                          >
                            <div className="overflow-hidden">
              {(() => {
                                const showHidden = hiddenColumns.length > 0 && (!expandedContent || expandedShowHiddenColumns);
                                // Non-bare hidden columns → KeyValue chips ABOVE the
                                // custom content.  Bare columns (the actions column) →
                                // BELOW it, so row actions land at the END of the
                                // panel instead of in the middle of the data chips.
                                const chipCols = showHidden ? hiddenColumns.filter(c => !c.expandedBare) : [];
                                const bareCols = showHidden ? hiddenColumns.filter(c => c.expandedBare)  : [];
                                return (
                                  <div className="px-3 pb-3 space-y-3">
                                    {chipCols.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-2">
                                        {chipCols.map(col => (
                                          <KeyValueChip
                                            key={col.key}
                                            label={col.header}
                                            value={getCellValue(col, row, rowIdx)}
                                            interactive={col.expandedInteractive}
                                          />
                                        ))}
                                      </div>
                                    )}
                                    {expandedContent?.(row, hiddenColumns)}
                                    {bareCols.length > 0 && (
                                      // Bare columns (e.g. the row-actions cluster) each take the FULL
                                      // panel width — that gives their own content a width to reflow
                                      // against, so a cell using `flex-wrap` (the actions buttons) wraps
                                      // its controls one-below-another as the panel narrows instead of
                                      // overflowing.  Multiple bare columns stack vertically.
                                      <div className="flex flex-col gap-2">
                                        {bareCols.map(col => (
                                          <div key={col.key} className="w-full">
                                            {getCellValue(col, row, rowIdx)}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>

          {footer && (
            <tfoot
              className={cn(
                'bg-(--color-surface-card)',
                // Same sticky+border-collapse workaround as <thead> — the
                // box-shadow stands in for border-top when pinned to bottom.
                useVerticalScroll && scrollMode!.stickyFooter
                  ? 'sticky bottom-0 z-10 shadow-[0_-1px_0_var(--color-neutral-300)]'
                  : 'border-t border-neutral-300',
              )}
            >
              {footer}
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination footer — hidden when scrollMode is set, pageSize <= 0,
          while the table is in `loading` mode (the counter would show
          "0 results" against a sea of skeletons, which reads worse than
          just omitting the strip until real data arrives), OR when
          everything fits on a single page (`totalPages <= 1`) — the
          page chips would just say "1" against itself and the counter
          would echo what the producer already sees on screen.  Stacks
          vertically on narrow viewports so the page chips don't overflow
          next to the results counter. */}
      {!paginationOff && !loading && data.length > 0 && totalPages > 1 && (
        <div className="flex flex-col gap-2 px-4 py-2.5 border-t border-(--color-border-strong) sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="text-xs text-(--color-text-muted)">
            {filteredData.length === 0
              ? '0 results'
              : <>{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length}</>
            }
          </div>
          <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
    </KeyValueChipDefaultsContext.Provider>
  );
}

// ─── Cell skeleton ──────────────────────────────────────────────────────────
// Renders the placeholder for a single skeleton cell.  Honours the column's
// horizontal `align` so the placeholder anchors the same way the real value
// will (right-aligned numbers, centered statuses, left-aligned text), and
// uses the column `width` (when set) to size text-line skeletons proportional
// to the real column.  Heights are picked to match the real cells' intrinsic
// content so the row doesn't snap when data lands — `chip`, `button` and
// `actions` mirror the height of the components they stand in for.
function CellSkeleton({
  hint = 'text',
  width,
  align = 'left',
}: {
  hint?: 'text' | 'chip' | 'button' | 'actions' | 'avatar' | 'none';
  width?: number;
  align?: 'left' | 'center' | 'right';
}) {
  if (hint === 'none') return null;

  const justify =
    align === 'right'  ? 'justify-end'    :
    align === 'center' ? 'justify-center' :
                         'justify-start';

  if (hint === 'avatar') {
    return (
      <div className={cn('flex items-center', justify)}>
        <Skeleton variant="circle" width={28} height={28} />
      </div>
    );
  }

  if (hint === 'chip') {
    return (
      <div className={cn('flex items-center', justify)}>
        <Skeleton width={72} height={22} className="rounded-full" />
      </div>
    );
  }

  if (hint === 'button') {
    return (
      <div className={cn('flex items-center', justify)}>
        <Skeleton width={96} height={32} />
      </div>
    );
  }

  if (hint === 'actions') {
    return (
      <div className={cn('flex items-center gap-2', justify)}>
        <Skeleton width={76} height={32} />
        <Skeleton width={88} height={32} />
      </div>
    );
  }

  // Default — text-line skeleton sized off the column width so wide
  // columns don't end up with a comically short stub.  Floor at 40 px so
  // very narrow # / id columns still have a visible placeholder.
  const textWidth: number | string =
    typeof width === 'number'
      ? Math.max(40, Math.round(width * 0.6))
      : '70%';
  return (
    <div className={cn('flex items-center', justify)}>
      <Skeleton width={textWidth} height={14} />
    </div>
  );
}
