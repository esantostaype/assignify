'use client';

import {
  Children, createContext, isValidElement, useContext, useEffect, useLayoutEffect,
  useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiCaretDown } from '@/lib/icons';

// ── types ─────────────────────────────────────────────────────────────────────
export type TabsVariant   = 'underline' | 'pills' | 'framed' | 'floating';
export type TabsSize      = 'sm' | 'md' | 'lg';
/** Layout width for the pill container and its children:
 *    `inline` — TabList is `inline-flex`; each Tab is its natural width.
 *    `full`   — TabList is `w-full`; each Tab is `flex-1 justify-center`
 *               so the pills evenly fill the row.
 *  Only meaningful for the `pills` variant. */
export type TabsWidthMode = 'inline' | 'full';

interface TabsCtx {
  value: string;
  setValue: (v: string) => void;
  variant: TabsVariant;
  size: TabsSize;
  widthMode: TabsWidthMode;
  /** True when the currently-selected tab is the first one in the list — used
   *  by the framed panel to switch its top-left corner between rounded and
   *  square. Computed from the React tree, not the DOM, so it stays in sync
   *  with the same render that flips aria-selected. */
  firstActive: boolean;
  /** When the consumer's container width drops below this many pixels, the
   *  TabList collapses ENTIRELY into the overflow dropdown — visible tabs go
   *  to 0 and the trigger renders the active tab's own label instead of the
   *  usual "N more" copy.  `undefined` keeps the legacy behaviour (always
   *  show at least one tab + a "N more" trigger when overflow kicks in). */
  compactBelow?: number;
}
const TabsContext = createContext<TabsCtx | null>(null);
function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs.* must be rendered inside <Tabs>');
  return ctx;
}

// Walks Tabs' children tree to find the first `<Tab>`'s value.  Limits the
// search to the TabList subtree so a stray Tab elsewhere can't poison the
// result.  Relies on displayName, set explicitly below.
function findFirstTabValue(node: ReactNode): string | undefined {
  let result: string | undefined;
  Children.forEach(node, (child) => {
    if (result !== undefined) return;
    if (!isValidElement(child)) return;
    const elType = child.type as { displayName?: string };
    if (elType.displayName !== 'TabList') return;
    const tabListChildren = (child.props as { children?: ReactNode }).children;
    Children.forEach(tabListChildren, (tabChild) => {
      if (result !== undefined) return;
      if (!isValidElement(tabChild)) return;
      const tabType = tabChild.type as { displayName?: string };
      const tabProps = tabChild.props as { value?: string };
      if (tabType.displayName === 'Tab' && typeof tabProps.value === 'string') {
        result = tabProps.value;
      }
    });
  });
  return result;
}

// ── per-size geometry — varies by variant ────────────────────────────────────
//
// Sizes are FIXED across every breakpoint — no responsive shrinking.
// A Tabs MD now reads the same on a phone as on a desktop; the previous
// "scale down on mobile" curve (md → sm below md breakpoint, lg → md below
// xl) is gone.  Matches the matching fixed sizes in Button so a Tabs MD
// and a Button MD still sit at the same height when laid side by side.
//
// Pills get their OWN size table because the pill cluster wraps its tabs in
// a `p-1` (8 px vertical) shell.  Subtracting that 8 px from each tab keeps
// the OUTER pill row at the SAME total height as a Button at the same size:
//
//   pills.sm  → tab h-6   + p-1 = 32 px  (== Button sm)
//   pills.md  → tab h-8   + p-1 = 40 px  (== Button md)
//   pills.lg  → tab h-10  + p-1 = 48 px  (== Button lg)
//
// So a Tabs pills MD and a Button MD sit at the exact same height when laid
// side by side in a toolbar — no awkward 8 px overshoot.
const TAB_SIZE: Record<TabsSize, { h: string; px: string; text: string }> = {
  sm: { h: 'h-8',  px: 'px-3', text: 'text-xs' },
  md: { h: 'h-10', px: 'px-4', text: 'text-sm' },
  lg: { h: 'h-12', px: 'px-5', text: 'text-sm' },
};

const TAB_SIZE_PILLS: Record<TabsSize, { h: string; px: string; text: string }> = {
  sm: { h: 'h-6.5',  px: 'px-2.5', text: 'text-xs' },
  md: { h: 'h-8.5',  px: 'px-3',   text: 'text-sm' },
  lg: { h: 'h-10.5', px: 'px-4',   text: 'text-sm' },
};

/** Pick the right size table for a given variant. */
function sizeFor(variant: TabsVariant, size: TabsSize) {
  return variant === 'pills' ? TAB_SIZE_PILLS[size] : TAB_SIZE[size];
}

// Panel padding for the framed variant — fixed per size so the inside
// chrome reads the same on every breakpoint.  Matches the no-responsive-
// scaling rule applied to the tab heights above.
const FRAMED_PANEL_PADDING: Record<TabsSize, string> = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

// ── root ──────────────────────────────────────────────────────────────────────
export interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  size?: TabsSize;
  /** Pills layout — `inline` (default) hugs the content; `full`
   *  stretches the row and makes each pill evenly fill the width via
   *  `flex-1`.  Ignored by non-pill variants. */
  widthMode?: TabsWidthMode;
  /** When the available container width falls below this many pixels, the
   *  ENTIRE tab row collapses into a single dropdown that shows the active
   *  tab's label.  Use this for tab strips that have to live inside narrow
   *  drawers / cards / sub-question editors where the usual "1 tab + N more"
   *  overflow still feels too cramped.  Leave undefined to keep the legacy
   *  always-show-at-least-one-tab behaviour. */
  compactBelow?: number;
  className?: string;
  children: ReactNode;
}

export function Tabs({
  defaultValue, value, onValueChange,
  variant = 'underline',
  size = 'md',
  widthMode = 'inline',
  compactBelow,
  className, children,
}: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const setValue = (v: string) => { if (!isControlled) setInternal(v); onValueChange?.(v); };

  const firstTabValue = useMemo(() => findFirstTabValue(children), [children]);
  const firstActive = firstTabValue !== undefined && firstTabValue === current;

  // Split children so all TabPanels share a single height-animating wrapper,
  // while TabList (and anything else the user injects) sits above it untouched.
  const tabList: ReactNode[] = [];
  const panels: ReactNode[] = [];
  const other: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) { other.push(child); return; }
    const dn = (child.type as { displayName?: string }).displayName;
    if (dn === 'TabPanel') panels.push(child);
    else if (dn === 'TabList') tabList.push(child);
    else other.push(child);
  });

  return (
    <TabsContext.Provider value={{ value: current, setValue, variant, size, widthMode, firstActive, compactBelow }}>
      <div
        data-component="Tabs"
        data-variant={variant}
        data-size={size}
        data-first-active={firstActive ? 'true' : 'false'}
        className={cn('flex flex-col', className)}
      >
        <KeyframesOnce />
        {tabList}
        {other}
        {panels.length > 0 && <TabPanelsContainer>{panels}</TabPanelsContainer>}
      </div>
    </TabsContext.Provider>
  );
}

// ── TabPanels height container ────────────────────────────────────────────────
// Wraps all TabPanels so the outer height can transition smoothly when the
// active panel swaps to one with a different content size. Only one panel
// renders at a time (the others return null), so the ResizeObserver only sees
// the active panel's natural size and the wrapper animates between them.
function TabPanelsContainer({ children }: { children: ReactNode }) {
  const { value } = useTabs();
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!innerRef.current) return;
    const measure = () => {
      if (innerRef.current) setHeight(innerRef.current.scrollHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div
      style={{
        height: height !== null ? `${height}px` : undefined,
        // Skip the transition on the very first measurement so the panel
        // doesn't "grow" from 0 on mount — only inter-panel swaps animate.
        transition: height !== null ? 'height 380ms cubic-bezier(0.32, 0.72, 0, 1)' : undefined,
      }}
      className="overflow-hidden"
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

// ── TabList ───────────────────────────────────────────────────────────────────
/** TabList accepts an `overflow` prop:
 *   • `menu` (default) — when the container is narrower than the natural
 *      sum of all tabs, the tail tabs collapse into a "N more" trigger that
 *      opens a dropdown with the hidden ones.  The dropdown matches the
 *      shared header user-menu transition (slide-down 8 px + fade, 220 ms /
 *      160 ms).
 *   • `none` — never collapse; lets the list overflow horizontally
 *      (legacy behaviour).
 */
export interface TabListProps {
  className?: string;
  children: ReactNode;
  /** How to behave when the visible width can't fit every tab.  `menu`
   *  collapses tail tabs into a dropdown; `none` keeps the old overflow
   *  behaviour. */
  overflow?: 'menu' | 'none';
}

export function TabList({ className, children, overflow = 'menu' }: TabListProps) {
  const { variant, value, size, widthMode, compactBelow } = useTabs();
  const wrapRef         = useRef<HTMLDivElement>(null);
  const listRef         = useRef<HTMLDivElement>(null);
  const measureRef      = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    ready: boolean;
    /** Right edge of the last visible Tab, used by the floating variant to
     *  stop its bottom line before the overflow `+N more` trigger. Equals
     *  the list's full width when no trigger is present. */
    tabsRight: number;
  }>({ left: 0, width: 0, ready: false, tabsRight: 0 });

  // Flatten children once so we have a stable array of Tab elements + (rare)
  // non-Tab siblings.  Only Tabs participate in the overflow calculation.
  const tabElements = useMemo(() => {
    const tabs: React.ReactElement[] = [];
    const nonTabs: React.ReactElement[] = [];
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      const dn = (child.type as { displayName?: string }).displayName;
      if (dn === 'Tab') tabs.push(child);
      else              nonTabs.push(child);
    });
    return { tabs, nonTabs };
  }, [children]);

  // `visibleCount` starts at the full tab count so the FIRST paint shows
  // every tab.  The post-mount measurement then collapses any that don't
  // fit — meaning the only visual effect is a one-frame "everything visible"
  // flash, which is acceptable.  Going the other way (starting at 0) would
  // briefly hide all tabs and feel worse.
  const [visibleCount, setVisibleCount] = useState(tabElements.tabs.length);
  const [menuOpen,     setMenuOpen]     = useState(false);

  // Overflow-to-menu is now enabled for EVERY variant, including
  // inline-mode pills.  Inline pills used to skip overflow because
  // the cluster expanded with its children, leaving no constraint
  // to overflow against — but a `max-w-full` on the inline wrapper
  // (see the pills branch below) now lets the cluster shrink when
  // the parent runs out of horizontal room, which is exactly when
  // the producer needs the "+N more" trigger.
  const overflowEnabled = overflow === 'menu';

  // ── Overflow measurement ─────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!overflowEnabled) {
      setVisibleCount(tabElements.tabs.length);
      return;
    }
    if (!listRef.current || !measureRef.current) return;

    // Gap (px) between tabs — must match the gap-* utility used by each
    // variant below so the measurement matches what flex actually lays out.
    const GAP =
      variant === 'pills'    ? 4 :   // gap-1
      variant === 'underline' ? 8 :  // gap-2
                                6;   // gap-1.5 (framed + floating)

    const measure = () => {
      const list  = listRef.current;
      const probe = measureRef.current;
      const wrap  = wrapRef.current;
      if (!list || !probe || !wrap) return;

      // Walk UP from the wrap to find the closest ancestor whose width
      // doesn't depend on our own content.  The direct parent (Tabs
      // root, `flex flex-col`) inherits the wrap's content width when
      // it sits inside a flex-row toolbar, so measuring against it just
      // gives us our own current size — kicking off a feedback loop
      // where every "hide a tab" iteration shrinks the parent, which
      // shrinks the available width, which hides more tabs.
      //
      // The CONSUMER's container (one level above Tabs root) is the
      // first node whose width is set by the surrounding layout
      // (toolbar row, page section, etc.) rather than by us — so its
      // clientWidth is a stable, true measure of available space.
      const consumerBox = wrap.parentElement?.parentElement
        ?? wrap.parentElement
        ?? wrap;
      const availableW = consumerBox.clientWidth || wrap.clientWidth;
      if (availableW === 0) return; // not laid out yet

      // Forced-compact path — when the consumer set `compactBelow` and the
      // container is below that threshold, drop every tab into the
      // dropdown.  The trigger swaps its label to the active tab's label
      // downstream so the row still tells the producer what's selected.
      if (compactBelow !== undefined && availableW < compactBelow) {
        setVisibleCount(0);
        return;
      }

      const nodes = Array.from(probe.children) as HTMLElement[];
      const tabWidths = nodes.slice(0, tabElements.tabs.length).map(el => el.offsetWidth);
      const moreW     = nodes[tabElements.tabs.length]?.offsetWidth ?? 80;

      // Pills wrap themselves in a padded shell (p-1) — discount 8 px so
      // the available area matches the inner flex row that holds the tabs.
      const containerInner = variant === 'pills' ? availableW - 8 : availableW;

      // Does everything fit?  A 1 px tolerance absorbs sub-pixel rounding
      // mismatches between the probe (offsetWidth) and the available
      // width (clientWidth), which would otherwise toggle a single tab
      // into the overflow menu in borderline cases.
      const totalAllGaps = tabWidths.reduce((s, w) => s + w, 0)
        + GAP * Math.max(0, tabElements.tabs.length - 1);
      if (totalAllGaps <= containerInner + 1) {
        setVisibleCount(tabElements.tabs.length);
        return;
      }

      // Reserve room for the trigger + the gap before it, then fit as many
      // tabs as possible while keeping that reserve.
      const reserve = moreW + GAP;
      let used = 0;
      let count = 0;
      for (const w of tabWidths) {
        const inc = (count > 0 ? GAP : 0) + w;
        if (used + inc + reserve > containerInner) break;
        used += inc;
        count++;
      }
      // Without `compactBelow`, keep at least one tab visible so the row
      // never disappears.  With `compactBelow` opt-in, allow visibleCount=0
      // as a graceful auto-collapse when not even one tab + trigger fits.
      setVisibleCount(compactBelow !== undefined ? count : Math.max(1, count));
    };

    measure();
    // Observe the CONSUMER's container — same node we measure against
    // — so the algorithm reacts to changes in the real available space
    // (window resize, sidebar opens, toolbar wrap) rather than to our
    // own visibility toggles.  Observing the direct parent caused a
    // feedback loop because that parent inherits our content size in
    // flex-row layouts.
    const consumerBox = wrapRef.current?.parentElement?.parentElement
      ?? wrapRef.current?.parentElement;
    if (!consumerBox) return;
    const ro = new ResizeObserver(measure);
    ro.observe(consumerBox);
    return () => ro.disconnect();
  }, [overflowEnabled, variant, tabElements.tabs.length, tabElements.tabs, compactBelow]);

  // ── Underline / floating indicator ───────────────────────────────────────
  // Recompute the active tab's position whenever it changes (or the list
  // resizes).  Used by the underline indicator (which slides) AND by the
  // floating variant to split its bottom line around the active tab.
  useLayoutEffect(() => {
    if (variant !== 'underline' && variant !== 'floating') return;
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const lr = list.getBoundingClientRect();

      // Right edge of the last visible Tab — used by the floating variant
      // to stop the bottom line before the `+N more` trigger so the line
      // never appears to cross underneath it.
      const allTabs  = list.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      const lastTab  = allTabs[allTabs.length - 1];
      const tabsRight = lastTab
        ? lastTab.getBoundingClientRect().right - lr.left
        : lr.width;

      const active = list.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
      if (!active) {
        setIndicator(prev => ({ ...prev, ready: false, tabsRight }));
        return;
      }
      const ar = active.getBoundingClientRect();
      setIndicator({ left: ar.left - lr.left, width: ar.width, ready: true, tabsRight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [variant, value, visibleCount]);

  // ── Slice the visible vs hidden tabs ─────────────────────────────────────
  const visibleTabs = overflowEnabled
    ? tabElements.tabs.slice(0, visibleCount)
    : tabElements.tabs;
  const hiddenTabs  = overflowEnabled
    ? tabElements.tabs.slice(visibleCount)
    : [];
  const activeHidden = hiddenTabs.some(t => (t.props as { value?: string }).value === value);

  // ── Shared offscreen measurement layer ───────────────────────────────────
  // Renders all tabs + a sample more-button so we can read their natural
  // widths.  Lives OUTSIDE the `[role="tablist"]` element so the indicator
  // query (which looks for `[role="tab"][aria-selected="true"]` inside the
  // list) can't accidentally pick up these hidden probe buttons.
  //
  // `data-measure="off"` marks the probe so any future query scoped to the
  // wrap (instead of the list) can easily exclude it.
  const measurementLayer = overflowEnabled ? (
    <div
      ref={measureRef}
      aria-hidden
      data-measure="off"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        visibility: 'hidden',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        display: 'flex',
        gap:
          variant === 'pills'    ? 4 :
          variant === 'underline' ? 8 :
                                    6,
      }}
    >
      {tabElements.tabs}
      <MoreTrigger
        count={1}
        active={false}
        variant={variant}
        size={size}
        onClick={() => {}}
      />
    </div>
  ) : null;

  // When the row is fully collapsed (no visible tabs), surface the active
  // tab's own label inside the trigger so the row still communicates
  // "you're on X" without needing the producer to open the menu first.
  const compactMode = visibleTabs.length === 0 && hiddenTabs.length > 0;
  const activeTabEl = compactMode
    ? tabElements.tabs.find(t => (t.props as { value?: string }).value === value)
    : undefined;
  const compactLabel = activeTabEl
    ? (activeTabEl.props as { children?: ReactNode }).children
    : undefined;

  const overflowTail = hiddenTabs.length > 0 ? (
    <OverflowMenu
      tabs={hiddenTabs}
      open={menuOpen}
      setOpen={setMenuOpen}
      active={activeHidden}
      variant={variant}
      size={size}
      triggerLabel={compactLabel}
      fullWidth={compactMode}
    />
  ) : null;

  // ── Variant-specific wrappers ────────────────────────────────────────────
  if (variant === 'pills') {
    // `full` mode stretches the row + makes every pill `flex-1` so they
    // evenly fill the parent (good for form-row pills).  `inline` keeps
    // the container hugging the pills (good for filter strips).
    //
    // Compact mode (no visible tabs, all in dropdown) also forces full
    // width so the lone trigger reads as a proper select dropdown rather
    // than a tiny pill stranded at the row's left edge.
    //
    // Both modes carry `max-w-full` so the cluster CAN shrink when the
    // parent runs out of horizontal room — that's what enables overflow
    // to kick in on inline pills too (otherwise the inline-block would
    // expand indefinitely and the +N more trigger would never appear).
    const wide = widthMode === 'full' || compactMode;
    return (
      <div ref={wrapRef} className={cn('relative max-w-full min-w-0', wide ? '' : 'inline-block')}>
        {measurementLayer}
        <div
          ref={listRef}
          role="tablist"
          className={cn(
            'flex items-center gap-1 rounded-lg bg-primary-50 border border-primary-100 p-0.5 max-w-full',
            wide ? 'w-full' : 'inline-flex',
            className,
          )}
        >
          {visibleTabs}
          {tabElements.nonTabs}
          {overflowTail}
        </div>
      </div>
    );
  }

  if (variant === 'underline') {
    return (
      <div ref={wrapRef} className={cn('relative', overflowEnabled || compactMode ? 'w-full' : 'inline-block')}>
        {measurementLayer}
        <div
          ref={listRef}
          role="tablist"
          className={cn(
            'relative flex items-center gap-2 border-b border-(--color-border-default)',
            overflowEnabled || compactMode ? 'w-full' : 'inline-flex',
            className,
          )}
        >
          {visibleTabs}
          {tabElements.nonTabs}
          {overflowTail}
          {/* `-bottom-px` makes the 2 px indicator straddle the 1 px gray border
              so the active colour visually replaces the line in the tab area. */}
          <span
            aria-hidden
            style={{
              transform: `translateX(${indicator.left}px)`,
              width: indicator.width,
              opacity: indicator.ready ? 1 : 0,
            }}
            className="pointer-events-none absolute -bottom-px left-0 h-[2px] rounded-t bg-primary-600 transition-[transform,width,opacity] duration-[280ms] ease-app z-[1]"
          />
        </div>
      </div>
    );
  }

  // framed + floating share the same folder-tab strip.  Same wrap/list
  // pattern as underline + pills so they participate in the overflow
  // behaviour — the more-trigger styles itself as a folder tab so it sits
  // flush with the rest of the row.
  return (
    <div ref={wrapRef} className={cn('relative', overflowEnabled || variant === 'floating' ? 'w-full' : 'inline-block')}>
      {measurementLayer}
      <div
        ref={listRef}
        role="tablist"
        className={cn(
          'relative flex items-end gap-1.5',
          overflowEnabled || variant === 'floating' ? 'w-full' : 'inline-flex',
          className,
        )}
      >
        {visibleTabs}
        {tabElements.nonTabs}
        {overflowTail}
        {/* Floating bottom line — appears UNDER inactive tabs (and the
            inactive `+N more` trigger) but never under whatever element
            is currently active.  Active elements have transparent fills
            in the floating variant, so leaving the line under them would
            visibly cross through the active label.  Two behaviours:
              • Active tab visible → split the line around it.  Left
                segment runs 0 → active.left; right segment runs
                active.right → end of list, covering the gap AND the
                inactive trigger (which blends its muted bg over the
                line like any other inactive tab).
              • Active tab HIDDEN in the dropdown → trigger paints in
                the active tone, so the line stops at the trigger's
                LEFT edge (`tabsRight + gap-1.5 = +6 px`) so the gap
                between the last inactive Tab and the active trigger
                still reads as part of the line. */}
        {(() => {
          if (variant !== 'floating') return null;
          const FLOATING_GAP = 6;
          const hasTrigger   = hiddenTabs.length > 0;
          if (indicator.ready) {
            return (
              <>
                <span
                  aria-hidden
                  style={{ width: `${indicator.left}px` }}
                  className="pointer-events-none absolute -bottom-px left-0 h-px bg-(--color-border-strong)"
                />
                <span
                  aria-hidden
                  style={{ left: `${indicator.left + indicator.width}px`, right: 0 }}
                  className="pointer-events-none absolute -bottom-px h-px bg-(--color-border-strong)"
                />
              </>
            );
          }
          if (indicator.tabsRight > 0) {
            const lineEnd = hasTrigger
              ? indicator.tabsRight + FLOATING_GAP
              : indicator.tabsRight;
            return (
              <span
                aria-hidden
                style={{ width: `${lineEnd}px` }}
                className="pointer-events-none absolute -bottom-px left-0 h-px bg-(--color-border-strong)"
              />
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
}

// ── Overflow trigger + dropdown ──────────────────────────────────────────────
const MENU_ENTER_MS = 220;
const MENU_EXIT_MS  = 160;
const MENU_EASE     = 'cubic-bezier(0.32, 0.72, 0, 1)';

function MoreTrigger({
  count, active, variant, size, onClick, open, buttonRef,
  triggerLabel, fullWidth = false,
}: {
  count: number;
  active: boolean;
  variant: TabsVariant;
  size: TabsSize;
  onClick: () => void;
  open?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  /** Replaces the default "N more" label.  Used by compact mode so the
   *  trigger speaks the active tab's name. */
  triggerLabel?: ReactNode;
  /** Stretches the trigger to fill its row — used in compact mode so the
   *  collapsed dropdown reads as a proper select-style affordance, not a
   *  small inline pill stranded at the start of the row. */
  fullWidth?: boolean;
}) {
  // Same size table as the visible tabs — guarantees the More-trigger
  // sits flush with the row regardless of variant.
  const sz = sizeFor(variant, size);
  const isFolder = variant === 'framed' || variant === 'floating';

  // Folder variants need to match the tab's "folder" shape so the trigger
  // sits flush with the rest of the row (rounded-top, bottom-borderless).
  // All other variants get a ghost-style button that adopts the active
  // tab tone if the selected tab lives in the dropdown.
  //
  // In compact mode (fullWidth) the trigger swaps `inline-flex` for
  // `flex w-full` and `justify-between` so the caret lands at the row's
  // right edge — the classic select-dropdown affordance.
  const className = cn(
    fullWidth
      ? 'flex w-full items-center justify-between gap-1'
      : 'inline-flex items-center gap-1',
    'font-semibold whitespace-nowrap min-w-0',
    sz.h, 'px-2.5', sz.text,
    isFolder
      ? cn(
          'relative -mb-px rounded-t-md border border-b-0 transition-[color,background-color,border-color] duration-[420ms] ease-app',
          active
            ? cn(
                'border-(--color-border-strong) text-primary-950 z-10',
                variant === 'framed'   && 'bg-(--color-surface-card)',
                variant === 'floating' && 'bg-transparent',
              )
            : 'border-transparent bg-(--color-surface-muted) text-(--color-text-muted) hover:text-(--color-text-strong) hover:bg-(--color-surface-subtle) z-0',
        )
      : cn(
          'rounded-md transition-colors',
          variant === 'pills'
            ? active
              ? 'text-primary-800 bg-(--color-surface-card) shadow-sm'
              : 'text-(--color-text-muted) hover:text-(--color-text-strong)'
            : active
              ? 'text-primary-700'
              : 'text-(--color-text-muted) hover:text-(--color-text-strong)',
        ),
  );

  const showsLabel = triggerLabel !== undefined && triggerLabel !== null;

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={showsLabel ? `${count} options available` : `${count} more tabs`}
      aria-haspopup="menu"
      aria-expanded={open || undefined}
      onClick={onClick}
      className={className}
    >
      <span className="truncate min-w-0">
        {showsLabel ? triggerLabel : `${count} more`}
      </span>
      <Icon icon={PiCaretDown} size={12} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
    </button>
  );
}

function OverflowMenu({
  tabs, open, setOpen, active, variant, size, triggerLabel, fullWidth = false,
}: {
  tabs: React.ReactElement[];
  open: boolean;
  setOpen: (v: boolean) => void;
  active: boolean;
  variant: TabsVariant;
  size: TabsSize;
  triggerLabel?: ReactNode;
  fullWidth?: boolean;
}) {
  const { value, setValue } = useTabs();
  const wrapRef    = useRef<HTMLDivElement>(null);
  const buttonRef  = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  // Mount/unmount lifecycle — mirror the header UserMenu so the exit
  // animation has time to play before the popover is torn down.
  useEffect(() => {
    if (open) { setMounted(true); return; }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), MENU_EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, [mounted]);

  // Outside-click + ESC handlers.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  return (
    <div ref={wrapRef} className={cn('relative min-w-0', fullWidth && 'flex-1')}>
      <MoreTrigger
        buttonRef={buttonRef}
        count={tabs.length}
        active={active}
        variant={variant}
        size={size}
        open={open}
        onClick={() => setOpen(!open)}
        triggerLabel={triggerLabel}
        fullWidth={fullWidth}
      />
      {mounted && (
        <div
          role="menu"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translate3d(0, 0, 0)' : 'translate3d(0, -8px, 0)',
            transition: `opacity ${visible ? MENU_ENTER_MS : MENU_EXIT_MS}ms ${MENU_EASE}, transform ${visible ? MENU_ENTER_MS : MENU_EXIT_MS}ms ${MENU_EASE}`,
          }}
          className="absolute z-[120] top-full right-0 mt-2 min-w-[180px] max-w-[280px] rounded-lg border border-(--color-border-default) bg-(--color-surface-raised) dark:bg-neutral-50 shadow-xl p-1"
        >
          {tabs.map((tab) => {
            const tabValue = (tab.props as { value?: string }).value ?? '';
            const tabKids  = (tab.props as { children?: ReactNode }).children;
            const selected = tabValue === value;
            return (
              <button
                key={tabValue}
                type="button"
                role="menuitem"
                onClick={() => { setValue(tabValue); setOpen(false); }}
                className={cn(
                  'flex items-center w-full gap-2 rounded-md px-2.5 py-2 text-[13px] font-semibold text-left transition-colors',
                  selected
                    ? 'bg-primary-50 text-primary-800'
                    : 'text-(--color-text-default) hover:bg-(--color-surface-muted)',
                )}
              >
                <span className="truncate">{tabKids}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────
export interface TabProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Cap the label width and ellipsise overflow.  Default `true` — a single
   *  very-long label can't dominate the row and push other tabs into the
   *  overflow menu.  Set `false` for cases where you'd rather let the
   *  label grow to fit (rare). */
  truncate?: boolean;
}

/** Responsive label cap.  Tighter on mobile so a long label can't eat the
 *  whole row in a narrow drawer; loosens on tablet/desktop where there's
 *  more horizontal space for context. */
const TRUNCATE_MAX = '';

export function Tab({ value, children, disabled, className, truncate = true }: TabProps) {
  const { value: current, setValue, variant, size, widthMode } = useTabs();
  const selected = current === value;
  // Pills get their own smaller-by-8 px size table so the OUTER pill
  // row (Tab + p-1 wrapper) lands at the Button-equivalent height.
  const sz = sizeFor(variant, size);
  // `truncate` utility = overflow:hidden + text-overflow:ellipsis +
  // white-space:nowrap.  Pairs with the max-w cap above.
  const truncateCls = truncate ? cn('truncate', TRUNCATE_MAX) : 'whitespace-nowrap';

  if (variant === 'pills') {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        disabled={disabled}
        onClick={() => setValue(value)}
        className={cn(
          'rounded-md font-semibold transition-colors duration-150',
          truncateCls,
          sz.h, sz.px, sz.text,
          // `full` mode stretches every pill to fill its share of the
          // row — paired with `w-full` on the TabList wrapper.  Inline
          // mode lets each pill keep its natural width.
          widthMode === 'full' && 'flex-1 justify-center',
          selected
            ? 'bg-(--color-surface-card) text-primary-800 shadow-sm'
            : 'text-neutral-600 hover:text-primary-700',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
      >
        {children}
      </button>
    );
  }

  if (variant === 'underline') {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        disabled={disabled}
        onClick={() => setValue(value)}
        className={cn(
          'relative -mb-px font-semibold transition-colors duration-200',
          truncateCls,
          sz.h, sz.px, sz.text,
          selected ? 'text-primary-700' : 'text-(--color-text-muted) hover:text-(--color-text-strong)',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
      >
        {children}
      </button>
    );
  }

  // framed + floating share the folder-tab styling.  Every tab is the SAME
  // height regardless of state — only the bg, text colour and border colour
  // change when active.  -mb-px lets the active tab visually punch through
  // the line/panel border below by 1 px.
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      onClick={() => setValue(value)}
      className={cn(
        'relative -mb-px rounded-t-md border border-b-0 font-semibold transition-[color,background-color,border-color] duration-[420ms] ease-app',
        truncateCls,
        sz.h, sz.px, sz.text,
        selected
          ? cn(
              'border-(--color-border-strong) text-primary-950 z-10',
              variant === 'framed'   && 'bg-(--color-surface-card)',
              variant === 'floating' && 'bg-transparent',
            )
          : 'border-transparent bg-(--color-surface-muted) text-(--color-text-muted) hover:text-(--color-text-strong) hover:bg-(--color-surface-subtle) z-0',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ── TabPanel ──────────────────────────────────────────────────────────────────
export function TabPanel({
  value, className, children,
}: { value: string; className?: string; children: ReactNode }) {
  const { value: current, variant, size, firstActive } = useTabs();
  if (current !== value) return null;

  // Folder-style tabs feel heavier; give their panels a longer ease so the
  // handoff reads naturally. Underline + pills stay snappier.
  const isFolder = variant === 'framed' || variant === 'floating';
  const animation = {
    animation: `ds-tabpanel-in ${isFolder ? 440 : 220}ms cubic-bezier(0.32, 0.72, 0, 1) both`,
  };

  if (variant === 'framed') {
    return (
      <div
        role="tabpanel"
        style={animation}
        className={cn(
          'rounded-md border border-(--color-border-strong) bg-(--color-surface-card)',
          firstActive && 'rounded-tl-none',
          FRAMED_PANEL_PADDING[size],
          className,
        )}
      >
        {children}
      </div>
    );
  }

  // underline / pills / floating — bare panel with a comfortable top gap.
  return (
    <div
      role="tabpanel"
      style={animation}
      className={cn('pt-5', className)}
    >
      {children}
    </div>
  );
}

// Set displayName so `findFirstTabValue` + the Tabs root's child splitter can
// identify TabList / Tab / TabPanel from the React tree regardless of how the
// bundler renames functions in production.
TabList.displayName = 'TabList';
Tab.displayName = 'Tab';
TabPanel.displayName = 'TabPanel';

// ── one-time global styles injection ──────────────────────────────────────────
// Inlined so the component is self-contained — `useEffect` makes sure we only
// add the <style> element once per document even when several Tabs mount.
//
// The `::after` rule paints a small swatch of `surface-muted` below the first
// tab — but ONLY when that tab is inactive AND the variant is `framed`.  Its
// radial gradient cuts a quarter-circle of transparency that matches the
// panel's rounded-tl curve, so the gap left by the curve is filled with the
// inactive tab's background while the panel's curve itself stays untouched.
let stylesInjected = false;
function KeyframesOnce() {
  useEffect(() => {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.setAttribute('data-ds-tabs', 'styles');
    style.textContent = `
      @keyframes ds-tabpanel-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      /* Notch fill — only on the first INACTIVE tab in the framed variant.
         The mask reproduces the panel's rounded-tl curve so the bg-color
         is only painted in the small "L" of empty space between the tab's
         bottom-left and the panel's curve. */
      [data-component="Tabs"][data-variant="framed"] [role="tablist"] > [role="tab"]:first-child:not([aria-selected="true"])::after {
        content: '';
        position: absolute;
        left: -1px;
        bottom: -4px;
        width: 6px;
        height: 5px;
        pointer-events: none;
        background-color: var(--color-surface-muted);
        -webkit-mask-image: radial-gradient(circle 6px at bottom right, transparent 5.7px, black 6.3px);
                mask-image: radial-gradient(circle 6px at bottom right, transparent 5.7px, black 6.3px);
        transition: background-color 420ms cubic-bezier(0.32, 0.72, 0, 1);
      }
      [data-component="Tabs"][data-variant="framed"] [role="tablist"] > [role="tab"]:first-child:not([aria-selected="true"]):hover::after {
        background-color: var(--color-surface-subtle);
      }
    `;
    document.head.appendChild(style);
  }, []);
  return null;
}
