'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CollapseAxis = 'vertical' | 'horizontal';

export interface CollapseProps {
  /** When `true`, the block expands to its content size; when
   *  `false`, it collapses to 0.  Sibling content gets pushed /
   *  pulled smoothly along the chosen axis. */
  open: boolean;
  /** Animation axis:
   *    `vertical`   (default) — height animates 0 → content; siblings
   *                             stacked below get pushed down.  Drop
   *                             one around form sub-sections, YES/NO
   *                             toggles, "advanced options" panels.
   *    `horizontal` — width animates 0 → content; siblings to the
   *                   RIGHT slide over smoothly.  Use inside a flex
   *                   row when an icon/button or chip needs to
   *                   appear / disappear without snapping the row's
   *                   layout. */
  axis?: CollapseAxis;
  /** Trailing-margin compensation for a parent's flex/grid `gap`
   *  or `space-y-*` / `space-x-*`.  Pass the parent's gap value in
   *  px (e.g. `12` for Tailwind's `gap-3`) so the gap appears and
   *  disappears alongside the collapse animation instead of
   *  snapping the instant the wrapper enters / leaves the layout.
   *
   *  When **omitted**, the Collapse auto-detects the parent's gap
   *  at mount by:
   *    1. Reading the parent's computed `row-gap` / `column-gap`
   *       (covers `gap-*` on flex / grid containers).
   *    2. Parsing the parent's className for `space-y-N` /
   *       `space-x-N` (Tailwind: N × 4 px).  Skipped when the
   *       Collapse is the structural `:last-child` (Tailwind v4's
   *       `space-y-*` selector excludes the last child, so emitting
   *       a margin here would ADD spacing that wasn't in the
   *       original layout).
   *    3. Falling back to `0` when neither matches.
   *
   *  Pass an explicit number to force a specific value (or `0` to
   *  opt out of compensation entirely).  An explicit `gapHint` is
   *  treated as `container` semantics (flex/grid `gap-*`), since
   *  every consumer using `gapHint` today sits inside a `gap-N`
   *  flex row.
   *
   *  Internally the compensation strategy depends on HOW the parent
   *  supplies the gap, because an inline `margin-block-end`
   *  interacts differently in each case:
   *
   *    `container` (flex/grid `gap-*`) — the parent owns the gap;
   *      children have no Tailwind margin.  Inline margins SUM with
   *      the parent's gap, so closing animates `0 → -gap` to cancel
   *      the parent gap to the next sibling.
   *    `sibling`   (Tailwind v4 `space-y-N`) — the parent class puts
   *      `margin-block-end: N` on every non-last child; an inline
   *      `margin-block-end` OVERRIDES that.  Closing animates `N →
   *      0` so the override matches Tailwind when open, then
   *      cancels Tailwind's margin cleanly when closed — going
   *      negative here would yank the next sibling UP past where
   *      `[hidden]` finally lands it, snapping the layout DOWN
   *      when the wrapper leaves the flow.
   *
   *  In both cases the gap appears / disappears in lockstep with
   *  the `0fr → 1fr` track growth, so the next sibling slides into
   *  its final position smoothly. */
  gapHint?: number;
  /** Total animation duration in milliseconds.  Default `260`. */
  duration?: number;
  /** Drop the children from the DOM once the collapse animation has
   *  finished closing.  Use this when keeping the content mounted
   *  would be expensive (large subtrees) or could leak focus to
   *  invisible controls.  Default `false` — content stays mounted
   *  so re-opening is instantaneous. */
  unmountOnClose?: boolean;
  /** Extra classes applied to the wrapper.  Use sparingly — the
   *  wrapper owns the size/opacity transitions, so heavy styling
   *  here can fight the animation. */
  className?: string;
  children: ReactNode;
}

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * Collapse — organic show/hide for any block of content.
 *
 * Uses the modern `display: grid` + `grid-template-rows: 0fr → 1fr`
 * trick so the height transition handles content of ANY size,
 * including blocks that grow or shrink while visible.  Combined
 * with a synchronised opacity fade, the result is a smooth
 * "push the rest of the page out of the way" reveal instead of a
 * hard `display: none → block` snap.
 *
 *   <Collapse open={showAdvanced}>
 *     <AdvancedOptionsBlock />
 *   </Collapse>
 *
 * Drop one around any conditionally-rendered chunk of form fields,
 * cards, or info panels — toggle's YES/NO branches, "advanced
 * options" sections, results panels that appear after a search,
 * etc.  Inputs inside a closed Collapse are made inert (no tab
 * focus, no pointer events) so keyboard users can't accidentally
 * land on hidden controls.
 *
 * Once the close animation finishes, the wrapper drops out of the
 * parent's flow entirely via the native `hidden` attribute.  This
 * is what lets `space-y-*` / `gap-*` parents skip a closed
 * Collapse — without it the 0-height wrapper still counts as a
 * sibling and the gap between the neighbours above and below ends
 * up doubled.
 */
/** How the parent supplies the gap between siblings:
 *
 *    • `container` — the parent owns the gap directly (flex / grid
 *      `gap-*`).  Tailwind doesn't set any margin on the children;
 *      the gap and any child margins SUM in flex/grid.  Compensating
 *      means emitting a NEGATIVE margin on the closed Collapse to
 *      cancel the parent's gap to the next sibling.
 *    • `sibling`   — the parent class produces the gap by setting
 *      `margin-block-end` on every non-last child (Tailwind v4's
 *      `space-y-N` model — `:where(& > :not(:last-child)) {
 *      margin-block-end: N }`).  An inline `margin-block-end`
 *      OVERRIDES Tailwind's value, so compensating means emitting
 *      the FULL gap value when expanded (to match Tailwind) and 0
 *      when closed (to cancel Tailwind cleanly without going
 *      negative — going negative would yank the next sibling UP
 *      past where `[hidden]` finally drops it, snapping the layout
 *      DOWN when the wrapper leaves the flow). */
type GapKind = 'container' | 'sibling';

interface ParentGap {
  value: number;
  kind:  GapKind;
}

const NO_GAP: ParentGap = { value: 0, kind: 'container' };

/** Detect the parent's effective gap for the chosen axis, in
 *  pixels, AND whether the gap lives on the container or on the
 *  siblings.  Three signals, in priority order:
 *
 *    1. Computed `row-gap` / `column-gap` — `gap-*` on flex / grid
 *       containers.  Reported as `container`.
 *    2. Tailwind utility class `space-y-N` / `space-x-N` on the
 *       parent — block-flow case where Tailwind v4 puts
 *       `margin-block-end` on each non-last child.  Reported as
 *       `sibling`.  Assumes the default v4 spacing scale (1 unit
 *       = 4 px).  STRUCTURAL last-child is skipped: Tailwind's
 *       selector is `:where(& > :not(:last-child))`, so a Collapse
 *       sitting at the end of a `space-y-*` parent never receives
 *       a Tailwind margin-block-end — emitting an inline one would
 *       ADD spacing the original CSS surface didn't have, pushing
 *       the parent's content box past its natural height.
 *    3. Anything else → 0 (no compensation).
 *
 *  Runs once on mount inside a useLayoutEffect; the consumer can
 *  always override with an explicit `gapHint` prop. */
function detectParentGap(el: HTMLElement | null, axis: CollapseAxis): ParentGap {
  if (!el) return NO_GAP;
  const parent = el.parentElement;
  if (!parent) return NO_GAP;

  // 1. Parent's `row-gap` / `column-gap` (flex / grid `gap-*`).
  const pcs = window.getComputedStyle(parent);
  const gapStr = axis === 'vertical' ? pcs.rowGap : pcs.columnGap;
  const gap = parseFloat(gapStr || '0');
  if (gap > 0) return { value: gap, kind: 'container' };

  // 2. Tailwind `space-y-N` / `space-x-N` class on the parent —
  //    but ONLY when there's a next sibling for the margin to bridge
  //    over.  Tailwind's selector is `:not(:last-child)`, so a
  //    Collapse at the structural end of the parent never receives
  //    Tailwind's margin and shouldn't compensate either.
  if (parent.lastElementChild === el) return NO_GAP;
  const pattern = axis === 'vertical'
    ? /(?:^|\s)space-y-(\d+)(?:\s|$)/
    : /(?:^|\s)space-x-(\d+)(?:\s|$)/;
  const match = parent.className.match(pattern);
  if (match) {
    const n = parseInt(match[1], 10);
    if (Number.isFinite(n) && n > 0) return { value: n * 4, kind: 'sibling' };
  }

  return NO_GAP;
}

export function Collapse({
  open,
  duration = 260,
  axis = 'vertical',
  gapHint,
  unmountOnClose = false,
  className,
  children,
}: CollapseProps) {
  const isHorizontal = axis === 'horizontal';
  const outerRef = useRef<HTMLDivElement | null>(null);
  // Auto-detected gap, in px, plus the KIND of gap (container vs
  // sibling).  Measured once at mount from the parent's computed
  // style + classList — see `detectParentGap`.  Explicit `gapHint`
  // always wins, so consumers can force a specific value (or zero)
  // regardless of what's auto-detected — and explicit gapHints are
  // treated as `container` (flex/grid `gap-*`), since every existing
  // consumer of `gapHint` is sitting inside a `gap-N` flex row.
  const [autoGap, setAutoGap] = useState<ParentGap>(NO_GAP);
  // When `unmountOnClose` is on, we keep the content mounted for
  // the duration of the closing animation and only THEN unmount —
  // otherwise the children would vanish before the animation could
  // play, defeating the point.
  const [renderChildren, setRenderChildren] = useState(open);

  // `hidden` removes the wrapper from layout entirely (display:none
  // via the native HTML attribute) once the close animation has
  // finished.  Without it a 0-height-but-still-displayed wrapper
  // gets counted by `space-y-*` / `gap-*` parents and leaves a
  // phantom margin slot behind.
  const [hidden, setHidden] = useState(!open);
  // STAY-IN-FLOW mode — when the Collapse sits at the STRUCTURAL
  // end of its parent (`:last-child`), flipping `[hidden]` on the
  // way out causes the previous sibling's `margin-block-end` (from
  // a parent's `space-y-N` rule, or any other source) to suddenly
  // start collapsing OUT of the parent — block-flow's
  // last-in-flow-child-margin-propagation rule.  That makes the
  // parent's content box SHRINK by ~`gap` px the instant `[hidden]`
  // flips, snapping the next-section sibling upward.
  //
  // For these Collapses we keep the wrapper IN FLOW even when
  // fully closed (`display: grid` + `grid-template-rows: 0fr` +
  // `opacity: 0` + `inert`).  Tailwind's `:where(& > :not(:last-
  // child))` selector already excludes a structural last-child
  // from the `space-y-*` margin rule, so staying in flow doesn't
  // introduce a phantom gap below — it just blocks the previous
  // sibling's margin from propagating out, holding the parent's
  // content box at a stable height through the entire close.
  //
  // Detection happens in the same `useLayoutEffect` that runs
  // `detectParentGap`, on mount — see below.  Captured in a ref
  // (not state) so the close-branch read inside `useLayoutEffect`
  // sees the latest value without scheduling another render. */
  const stayInFlowRef = useRef(false);

  // `expanded` drives the grid-row / opacity values independently
  // of `open`.  When un-hiding to open, we render one paint at the
  // collapsed state (0fr / opacity 0) so the next paint at the
  // expanded state has a previous value to animate from.
  const [expanded, setExpanded] = useState(open);

  // Snapshot of the LAST `children` we rendered while `open` was
  // true.  When the consumer toggles open=false and ALSO clears the
  // upstream data that produced `children` (e.g.
  // `{file && <FileItem ... />}` where `file` is now null), the
  // children prop becomes empty mid-animation and the close
  // transition would otherwise collapse from an already-blank box
  // — looking like an instant snap.  Holding onto the previous
  // children lets the box keep rendering its old content while it
  // shrinks, so the exit reads as a real transition.
  const [snapshot, setSnapshot] = useState<ReactNode>(children);

  const hideTimeoutRef    = useRef<number | null>(null);
  const unmountTimeoutRef = useRef<number | null>(null);
  const rafRef            = useRef<number | null>(null);
  const prevOpenRef       = useRef(open);

  useEffect(() => {
    if (open) {
      // While the panel is open we mirror whatever the consumer
      // passes — the snapshot tracks the live children.
      setSnapshot(children);
    }
    // While closed, snapshot stays put (no setSnapshot call) so the
    // exit transition keeps painting the last-open contents.
  }, [open, children]);

  /** Re-evaluate the parent gap + `:last-child` status from the live
   *  DOM.  Used at mount AND at every open/close transition — a
   *  Collapse that was the structural last child at mount can lose
   *  that status when a sibling is appended later (e.g. another file
   *  row uploaded into a `<FileAttachments>` rows-container), and
   *  the cached values would otherwise lock in the
   *  "no compensation, stay in flow" path even when the row now
   *  needs to animate Tailwind's `margin-block-end` away and flip
   *  `[hidden]` on the way out.
   *
   *  Returns the freshly-detected gap so the caller can use it in
   *  the same effect tick (the state setter is async — relying on
   *  the next render would race the transition setup). */
  const refreshParentMetrics = (): ParentGap => {
    const el = outerRef.current;
    if (!el || !el.parentElement) return autoGap;
    stayInFlowRef.current = el.parentElement.lastElementChild === el;
    if (gapHint !== undefined) return autoGap;
    const measured = detectParentGap(el, axis);
    if (measured.value !== autoGap.value || measured.kind !== autoGap.kind) {
      setAutoGap(measured);
    }
    return measured;
  };

  // Initial detection on mount — sets the cache so the FIRST render
  // (before any open/close transition) sees correct values for the
  // entry animation's margin compensation.  Lives in a layout effect
  // so it reads the parent's computed style + DOM position
  // synchronously before the first paint that needs the value.
  useLayoutEffect(() => {
    refreshParentMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drive the open/close transition.  useLayoutEffect (not useEffect)
  // so the un-hide + collapsed-state render happens BEFORE the
  // browser paints — otherwise the first visible frame would be at
  // the expanded state and the entry transition would be skipped.
  useLayoutEffect(() => {
    const prevOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (prevOpen === open) return;

    // Re-detect parent gap + last-child status before deciding the
    // close-path semantics.  Sibling rows may have been added or
    // removed since mount, invalidating the cached `autoGap` /
    // `stayInFlowRef` — without this refresh a row that mounted as
    // the only child of a `<FileAttachments>` would keep its
    // "no compensation, stay in flow" behaviour even after more
    // rows were uploaded behind it, leaving Tailwind's
    // `margin-block-end` un-animated and producing an 8 px snap on
    // the next sibling when the row unmounts.
    refreshParentMetrics();

    if (open) {
      // OPENING — cancel any in-flight hide, un-hide, render the
      // collapsed state once, then flip to expanded on the next
      // frame so the CSS transition has a previous value to animate
      // from.  Double rAF guards against the browser collapsing
      // both renders into a single paint.
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setHidden(false);
      setExpanded(false);
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = window.requestAnimationFrame(() => {
          setExpanded(true);
          rafRef.current = null;
        });
      });
    } else {
      // CLOSING — start animating to collapsed immediately.  For
      // most Collapses we then flip `[hidden]` after `duration`
      // ms so the parent's space-y/gap stops counting this element
      // once the visual transition is done.
      //
      // EXCEPTION — `stayInFlowRef.current` is set for Collapses
      // sitting at the STRUCTURAL last position of their parent.
      // For those the `[hidden]` flip would cause the previous
      // sibling's margin to start collapsing out of the parent
      // (see the `stayInFlowRef` block above), snapping the
      // parent's content box on the very last frame of the close.
      // Skip the flip entirely — the wrapper stays in flow as
      // `display: grid` + `grid-template-rows: 0fr` + `opacity: 0`,
      // occupying 0 px height but BLOCKING the propagation so the
      // parent's content box stays stable.  Tailwind's
      // `space-y-N` already excludes structural last-children from
      // its margin rule, so staying in flow doesn't add a
      // phantom gap below the wrapper either.
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setExpanded(false);
      if (stayInFlowRef.current) return;
      hideTimeoutRef.current = window.setTimeout(() => {
        setHidden(true);
        hideTimeoutRef.current = null;
      }, duration);
    }
  }, [open, duration]);

  // Child-unmount lifecycle — kept separate from the visual phase
  // machinery so toggling `unmountOnClose` doesn't disturb an
  // in-flight open/close transition.
  useEffect(() => {
    if (open) {
      setRenderChildren(true);
      return;
    }
    if (!unmountOnClose) return;
    unmountTimeoutRef.current = window.setTimeout(() => {
      setRenderChildren(false);
      unmountTimeoutRef.current = null;
    }, duration);
    return () => {
      if (unmountTimeoutRef.current !== null) {
        window.clearTimeout(unmountTimeoutRef.current);
        unmountTimeoutRef.current = null;
      }
    };
  }, [open, duration, unmountOnClose]);

  useEffect(() => () => {
    if (hideTimeoutRef.current    !== null) window.clearTimeout(hideTimeoutRef.current);
    if (unmountTimeoutRef.current !== null) window.clearTimeout(unmountTimeoutRef.current);
    if (rafRef.current            !== null) window.cancelAnimationFrame(rafRef.current);
  }, []);

  const opacityDuration = Math.max(120, Math.round(duration * 0.7));

  // While open, render the live `children` (so updates propagate
  // immediately).  While closed, render the cached snapshot until
  // the consumer reopens with fresh content.
  const visibleChildren = open ? children : snapshot;

  // Axis-specific style + inner clip:
  //   vertical   — animate `grid-template-rows: 0fr → 1fr`; inner
  //                clip uses `overflow: hidden, minHeight: 0` so the
  //                track can shrink past the child's intrinsic height.
  //   horizontal — animate `grid-template-columns: 0fr → 1fr`; inner
  //                clip uses `overflow: hidden, minWidth: 0` so the
  //                track can shrink past the child's intrinsic width.
  //                Wrap inside a flex row (or any context where
  //                siblings sit beside this one) and they'll slide
  //                over smoothly as the column grows / shrinks.
  const trackProp            = isHorizontal ? 'gridTemplateColumns' : 'gridTemplateRows';
  const trackTransitionProp  = isHorizontal ? 'grid-template-columns' : 'grid-template-rows';
  const marginProp           = isHorizontal ? 'marginInlineEnd' : 'marginBlockEnd';
  const marginTransitionProp = isHorizontal ? 'margin-inline-end' : 'margin-block-end';
  const innerClipStyle       = isHorizontal
    ? { overflow: 'hidden' as const, minWidth:  0 }
    : { overflow: 'hidden' as const, minHeight: 0 };

  // Gap compensation — animate a trailing-margin override on the
  // wrapper so the gap between this Collapse and the next sibling
  // appears / disappears IN LOCKSTEP with the size track, instead
  // of snapping the moment `hidden` flips.
  //
  // The right formula depends on HOW the parent supplies the gap,
  // because an inline `margin-block-end` interacts differently in
  // each case:
  //
  //   `container` — parent has flex/grid `gap-*`.  The gap and any
  //                 child margins SUM.  So:
  //                     open:    inline 0  (no extra margin, just
  //                              the parent's gap)
  //                     closed:  inline -gap  (cancel the parent's
  //                              gap so the next sibling sits flush
  //                              against the zero-height wrapper —
  //                              matches the post-`[hidden]` layout
  //                              where the parent's gap to the
  //                              REMOVED item also disappears)
  //
  //   `sibling`   — Tailwind v4 `space-y-N` puts `margin-block-end:
  //                 N` on every non-last child.  An inline
  //                 `margin-block-end` OVERRIDES that, so:
  //                     open:    inline gap  (RESTORE Tailwind's
  //                              value — without this we'd flatten
  //                              the space between Collapse and the
  //                              next sibling to zero, fields-pegados
  //                              regression)
  //                     closed:  inline 0    (cancel Tailwind's
  //                              margin cleanly — going NEGATIVE
  //                              here would yank the next sibling
  //                              UP past where `[hidden]` finally
  //                              lands it, snapping the layout DOWN
  //                              when the wrapper leaves the flow)
  //
  // `effectiveGap` resolves explicit `gapHint` first, then falls
  // back to the auto-detected `autoGap`.  Explicit `gapHint` is
  // treated as `container` — every consumer using `gapHint` today
  // sits inside a flex `gap-N` row, and a plain numeric prop is
  // ambiguous about which model the parent uses.  Consumers in a
  // `space-y-*` parent should rely on auto-detect (or omit
  // `gapHint`).
  const effectiveGap  = gapHint ?? autoGap.value;
  const effectiveKind: GapKind = gapHint !== undefined ? 'container' : autoGap.kind;
  const hasGapCompensation = effectiveGap > 0;
  const trailingMargin     = effectiveKind === 'sibling'
    ? (expanded ?  effectiveGap : 0)
    : (expanded ?  0            : -effectiveGap);
  const gapTransition      = hasGapCompensation
    ? `, ${marginTransitionProp} ${duration}ms ${EASE}`
    : '';

  return (
    <div
      ref={outerRef}
      data-component="Collapse"
      data-open={open ? 'true' : 'false'}
      data-axis={axis}
      // `inert` removes the closed subtree from the tab order and
      // suppresses pointer events.  React 19+ accepts the attribute
      // natively as a boolean prop.
      inert={!open}
      // `hidden` drops the wrapper from the parent's flow once the
      // close animation finishes.  When set, inline `display` MUST
      // be omitted or the inline style would override the UA
      // stylesheet's `display: none` from `[hidden]`.
      hidden={hidden}
      style={hidden ? undefined : {
        display: 'grid',
        [trackProp]: expanded ? '1fr' : '0fr',
        opacity: expanded ? 1 : 0,
        // Only declare the trailing-margin override when gap
        // compensation is opted into.  Skipping the key entirely
        // leaves the browser default in place (no inline override),
        // so `space-y-*` / `gap-*` parents behave exactly as they
        // did before the `gapHint` prop existed.
        ...(hasGapCompensation ? { [marginProp]: trailingMargin } : null),
        transition: `${trackTransitionProp} ${duration}ms ${EASE}, opacity ${opacityDuration}ms ${EASE}${gapTransition}`,
      }}
      className={cn(className)}
    >
      {/* Inner wrapper handles the clip.  `minHeight: 0` (vertical) /
          `minWidth: 0` (horizontal) lets the grid track collapse to 0
          even when the child has intrinsic size — without it some
          browsers (Firefox / Safari) leave a 1 px sliver. */}
      <div style={innerClipStyle}>
        {renderChildren ? visibleChildren : null}
      </div>
    </div>
  );
}
