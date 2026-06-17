'use client';

import {
  Children, isValidElement, useLayoutEffect, useRef, useState,
  type ReactElement, type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

/* ─── Public types ─────────────────────────────────────────────────────── */

export type StepFlowDirection = 'forward' | 'backward';

export interface StepFlowProps {
  /** Id of the panel currently shown.  Setting this to a different id
   *  starts the transition: the previous panel exits while the new
   *  panel enters.  The first render shows the matching panel
   *  immediately (no entry animation — there's nothing to transition
   *  from yet). */
  value: string;
  /** Direction the consumer is moving through the flow:
   *
   *    • `forward` (default) — new content slides in from the RIGHT
   *      while the old slides out to the LEFT.
   *    • `backward` — reversed: new slides in from the LEFT, old
   *      exits to the RIGHT.
   *
   *  The consumer is responsible for flipping this on every step
   *  change BEFORE updating `value` — typically a single `direction`
   *  state alongside the active step id, set in the same handler
   *  that fires `setStep('list' | 'create')`. */
  direction?: StepFlowDirection;
  /** Total animation duration in ms.  Default `260` — matches the
   *  project's Collapse / Drawer easing so the slide reads as part
   *  of the same motion vocabulary. */
  duration?: number;
  className?: string;
  /** Pass one or more `<StepFlow.Panel value="...">` children.  Only
   *  the panel whose `value` matches the parent's `value` is shown
   *  in idle state; during a transition the previous panel is also
   *  rendered (absolutely positioned) so both can animate in / out
   *  at the same time. */
  children: ReactNode;
}

export interface StepFlowPanelProps {
  /** Stable id matched against the parent `<StepFlow>`'s `value`. */
  value: string;
  children: ReactNode;
}

/* ─── Panel — declarative sentinel ─────────────────────────────────────── */

/** Sentinel child node consumed by `<StepFlow>`.  The component itself
 *  is invisible in the DOM — its sole purpose is to declare a panel
 *  with an id + payload that the parent can extract.  Render nothing
 *  directly so a panel rendered outside `<StepFlow>` doesn't leak
 *  extra wrappers into the layout. */
function StepFlowPanel(_props: StepFlowPanelProps): null {
  return null;
}
StepFlowPanel.displayName = 'StepFlowPanel';

/* ─── StepFlow — the transition controller ─────────────────────────────── */

/**
 * StepFlow — horizontal step transitions for multi-view modals and
 * drawers.  Wrap any flow whose body content swaps between named
 * steps (cross-sell list ↔ create form, quote program-select ↔
 * client-info ↔ location-detail, etc.) and the swap reads as a
 * left-right slide instead of a hard jump.
 *
 * Usage:
 *
 *   const [step, setStep]      = useState<'list' | 'create'>('list');
 *   const [dir,  setDir]       = useState<StepFlowDirection>('forward');
 *
 *   <StepFlow value={step} direction={dir}>
 *     <StepFlow.Panel value="list">
 *       <ListView onNext={() => { setDir('forward');  setStep('create'); }} />
 *     </StepFlow.Panel>
 *     <StepFlow.Panel value="create">
 *       <CreateView onBack={() => { setDir('backward'); setStep('list'); }} />
 *     </StepFlow.Panel>
 *   </StepFlow>
 *
 * Implementation notes:
 *   • The outgoing panel is rendered absolutely positioned on top
 *     of the incoming one so both share the same flow slot during
 *     the animation.  `overflow-x-hidden` clips the slide so content
 *     beyond the container edge doesn't leak into surrounding
 *     chrome.
 *   • Keyed re-mount on `value` change re-fires the CSS entry
 *     animation cleanly from frame 0.  State inside panels is
 *     RESET on every step swap — pages that need to preserve
 *     transient form state across steps should lift it to the
 *     parent's React state (which is what the cross-sell drawer
 *     does for its create form's pre-fill).
 *   • Snap-to-zero animation when `prefers-reduced-motion: reduce`
 *     is honored via the matching media query in `globals.css`.
 */
export function StepFlow({
  value,
  direction = 'forward',
  duration = 400,
  className,
  children,
}: StepFlowProps) {
  // Collect Panel children by `displayName` — `<StepFlow.Panel>` is
  // a sentinel; we don't render it directly, we just read its
  // `value` + `children` props.
  const panels = Children.toArray(children).filter(
    (c): c is ReactElement<StepFlowPanelProps> =>
      isValidElement(c)
      && (c.type as { displayName?: string }).displayName === 'StepFlowPanel',
  );

  const panelById = (id: string) =>
    panels.find(p => p.props.value === id);

  // Track the panel id that's currently animating OUT.  While
  // `outgoing` is non-null, both panels are in the DOM; once the
  // transition timer fires we drop it so only the active panel
  // remains.  `outgoingDir` is captured at the moment of transition
  // so a rapid double-click that flips `direction` mid-animation
  // doesn't reverse the outgoing slide partway through.
  const [outgoing, setOutgoing] = useState<{ id: string; dir: StepFlowDirection } | null>(null);
  const prevValueRef = useRef(value);
  const timerRef = useRef<number | null>(null);

  // `useLayoutEffect` (not `useEffect`) so the outgoing snapshot
  // commits BEFORE the browser paints the new value.  Otherwise the
  // first paint after a step change shows ONLY the new active panel
  // (no animation overlay) for one frame, then the outgoing slips
  // in on the next render — a visible flicker that breaks the
  // sense of continuity the slide is supposed to create.  Pre-paint
  // setup also lets consumers reset scroll position in their own
  // `useLayoutEffect` and have both swaps land on the same frame.
  //
  // The `setTimeout` for unmounting still uses real-time scheduling
  // (it has to outlive the animation, regardless of paint phase)
  // and lives outside the layout effect's synchronous window.
  useLayoutEffect(() => {
    const prev = prevValueRef.current;
    if (prev === value) return;
    prevValueRef.current = value;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    // Only animate when we actually have a panel for the OLD value
    // — otherwise (initial mount race, consumer feeding an id that
    // doesn't match any child) we'd render a ghost wrapper with no
    // contents.
    if (panelById(prev)) {
      setOutgoing({ id: prev, dir: direction });
      timerRef.current = window.setTimeout(() => {
        setOutgoing(null);
        timerRef.current = null;
      }, duration);
    }

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // `panelById` is a closure over `children`; deliberately not in
    // the dep list to avoid spurious effect re-runs when the
    // consumer rebuilds the children array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, direction, duration]);

  const activePanel   = panelById(value);
  const outgoingPanel = outgoing ? panelById(outgoing.id) : null;

  return (
    <div
      data-component="StepFlow"
      data-direction={direction}
      data-transitioning={outgoing ? 'true' : 'false'}
      className={cn('relative overflow-x-hidden', className)}
    >
      {/* OUTGOING panel — absolutely positioned over the active one
          while the slide-out animation runs.  Dropped from the DOM
          once the timer fires, leaving the active panel in the
          normal flow.  `overflow-hidden` is critical: the wrapper's
          size is clamped to the ACTIVE panel's height (because
          `inset: 0` measures against the parent, whose height is
          driven by the active in-flow child).  Without the clip, an
          outgoing panel that's taller than the active one (e.g.
          backwards-navigating from a long create form to a short
          list) would bleed its content below the wrapper into the
          surrounding drawer body — visible as duplicated content
          and a phantom second scroll area during the animation. */}
      {outgoingPanel && outgoing && (
        <div
          data-step-state={`exit-${outgoing.dir}`}
          style={{ animationDuration: `${duration}ms` }}
          className="absolute inset-0 overflow-hidden"
        >
          {outgoingPanel.props.children}
        </div>
      )}

      {/* ACTIVE panel.  `key={value}` forces a fresh mount on every
          step change so the CSS entry animation re-fires from frame
          0 — the alternative (toggling the data-attr on the same
          DOM node) won't restart CSS animations reliably. */}
      {activePanel && (
        <div
          key={value}
          data-step-state={`enter-${direction}`}
          style={{ animationDuration: `${duration}ms` }}
        >
          {activePanel.props.children}
        </div>
      )}
    </div>
  );
}

/* Attach Panel as a static property so consumers can use
 * `<StepFlow.Panel value="...">` without a separate import. */
StepFlow.Panel = StepFlowPanel;
