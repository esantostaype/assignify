  'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiCheck } from '@/lib/icons';
import type { IconComponent } from '@/lib/icons';

export interface StepperStep {
  label: ReactNode;
  description?: ReactNode;
  /** Icon shown inside the bullet for the `pending` and `active`
   *  states.  Falls back to the step's 1-based number when omitted.
   *  Completed steps always render `PiCheck` regardless of this
   *  field so the "done" affordance reads consistently across the
   *  whole stepper. */
  icon?: IconComponent;
}

export interface StepperProps {
  steps: StepperStep[];
  /** 0-based active step. */
  active: number;
  orientation?: 'horizontal' | 'vertical';
  /** When provided, each step renders as a clickable button that fires
   *  this with the step's 0-based index — lets a parent allow free
   *  navigation between steps (e.g. the Edit-flow wizard).  Omit for a
   *  static, display-only stepper. */
  onStepClick?: (index: number) => void;
  className?: string;
}

type State = 'done' | 'active' | 'pending';

/** Per-state typography colour for the step label.  Kept as a
 *  separate map so both orientations resolve the same colour token
 *  by state — done → strong, active → primary, pending → subtle. */
const LABEL_CLS: Record<State, string> = {
  done:    'text-(--color-text-strong)',
  active:  'text-primary-700',
  pending: 'text-(--color-text-subtle)',
};

/**
 * Stepper — linear progress indicator for multi-step workflows.
 *
 * Two orientations:
 *
 *   • `horizontal` (default) — bullets ride a single row.  Below
 *     `lg` (< 1024 px) the label drops UNDER the bullet so the
 *     stepper still fits a narrow viewport.  At `lg+` the label
 *     sits to the RIGHT of the bullet, matching the design-system
 *     spec for desktop dashboards.  Connector lines stretch with
 *     `flex-1` so the bullets spread evenly across the available
 *     width.
 *
 *   • `vertical` — bullets stack with the label / description on
 *     the right.  Used inside narrow side panels or summary
 *     drawers where a horizontal strip would overflow.
 *
 * Bullet visual states:
 *   • `done`    — primary-700 solid + white check (PiCheck).
 *   • `active`  — primary-100 tint + primary-700 step icon.
 *   • `pending` — neutral subtle tint + neutral-subtle step icon.
 */
export function Stepper({ steps, active, orientation = 'horizontal', onStepClick, className }: StepperProps) {
  // Connector fills animate from 0 → 100%.  Start "unprimed" (0%) for the
  // first paint, then flip to primed in an effect so the browser animates
  // the tracks filling — completed connectors then read as a progress bar.
  // A plain effect (not rAF) is used on purpose: rAF is throttled/paused in
  // background tabs, which would leave the bars stuck empty; an effect always
  // runs after mount, so the filled state is reached regardless of
  // visibility.  Advancing `active` later re-runs the same transition for
  // the newly-completed connector.
  const [primed, setPrimed] = useState(false);
  useEffect(() => { setPrimed(true); }, []);

  if (orientation === 'vertical') {
    return (
      <ol data-component="Stepper" data-orientation="vertical" className={cn('flex flex-col', className)}>
        {steps.map((s, idx) => {
          const state: State = idx < active ? 'done' : idx === active ? 'active' : 'pending';
          const vBody = (
            <>
              <Bullet state={state} icon={s.icon} number={idx + 1} />
              <div className="-mt-0.5">
                <div className={cn('text-sm font-semibold transition-colors', LABEL_CLS[state], onStepClick && 'group-hover/step:text-primary-600')}>
                  {s.label}
                </div>
                {s.description && (
                  <div className="text-[11.5px] text-(--color-text-muted) mt-0.5">{s.description}</div>
                )}
              </div>
            </>
          );
          return (
            <Fragment key={idx}>
              <li className="flex">
                {onStepClick ? (
                  <button type="button" onClick={() => onStepClick(idx)} className="group/step flex gap-3 text-left cursor-pointer w-full">
                    {vBody}
                  </button>
                ) : (
                  <div className="flex gap-3">{vBody}</div>
                )}
              </li>

              {/* Connector — neutral hairline track with a primary fill
                  that grows top→bottom (0 → 100%) once the step ABOVE it
                  is done, so completed connectors read as a vertical
                  progress bar.  The line is CENTRED under the bullet by
                  sitting in a bullet-width (`w-8 lg:w-10`) flex box, so it
                  tracks the bullet's centreline at any bullet size. */}
              {idx < steps.length - 1 && (
                <div aria-hidden className="flex w-8 lg:w-10 justify-center my-1 shrink-0">
                  <span className="relative w-0.5 h-4 bg-neutral-200 overflow-hidden rounded-full">
                    <span
                      className="absolute inset-x-0 top-0 bg-primary-700 transition-[height] duration-500 ease-app"
                      style={{ height: primed && idx < active ? '100%' : '0%' }}
                    />
                  </span>
                </div>
              )}
            </Fragment>
          );
        })}
      </ol>
    );
  }

  return (
    <ol
      data-component="Stepper"
      data-orientation="horizontal"
      // `pb-12 lg:pb-0` reserves vertical space for the
      // absolutely-positioned label below each bullet on mobile.
      // The label is pulled out of the flex flow (so its width
      // doesn't push the bullets apart and inflate the connector
      // lines), which means the parent `<ol>` only measures the
      // bullet — without padding, surrounding content would crash
      // INTO the label.  48 px covers a 2-line `text-xs` block at
      // line-height 1.4 (≈ 32 px) plus the 8 px gap below the 40 px
      // bullet.  At `lg+` the label switches to `static` and
      // contributes to the parent height naturally, so the padding
      // collapses to zero.
      className={cn('flex items-center w-full pb-12 lg:pb-0 px-4 lg:px-0', className)}
    >
      {steps.map((s, idx) => {
        const state: State = idx < active ? 'done' : idx === active ? 'active' : 'pending';
        const hBody = (
          <>
            <Bullet state={state} icon={s.icon} number={idx + 1} />
            <span
              className={cn(
                'text-xs lg:text-sm font-semibold text-center lg:text-left absolute lg:static top-11 lg:top-auto w-20 lg:w-auto transition-colors',
                LABEL_CLS[state],
                onStepClick && 'group-hover/step:text-primary-600',
              )}
            >
              {s.label}
            </span>
          </>
        );
        // Step block — column on mobile (bullet over label), row at
        // `lg+` (bullet beside label).  `shrink-0` so the block never
        // narrows; the flex spacing comes from the connector lines.
        // `relative` anchors the absolutely-positioned mobile label.
        const hBlockCls = 'flex flex-col items-center gap-2 lg:flex-row lg:items-center lg:gap-3 relative';
        return (
          <Fragment key={idx}>
            <li className="shrink-0">
              {onStepClick ? (
                <button type="button" onClick={() => onStepClick(idx)} className={cn(hBlockCls, 'group/step cursor-pointer')}>
                  {hBody}
                </button>
              ) : (
                <div className={hBlockCls}>{hBody}</div>
              )}
            </li>

            {/* Connector — neutral hairline track with a primary fill
                that grows left→right (0 → 100%) once the step on its
                LEFT is done, so completed connectors read as a progress
                bar.  `flex-1` keeps the bullets evenly spread across the
                available width. */}
            {idx < steps.length - 1 && (
              <span
                aria-hidden
                className="relative flex-1 h-0.5 bg-neutral-200 mx-2 lg:mx-4 shrink overflow-hidden rounded-full"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-primary-700 transition-[width] duration-500 ease-app"
                  style={{ width: primed && idx < active ? '100%' : '0%' }}
                />
              </span>
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

function Bullet({
  state, icon, number,
}: { state: State; icon?: IconComponent; number: number }) {
  // Bullet grows from 40 px (mobile) to 48 px (lg+) so the icon
  // inside reads clearly across viewports without crowding the
  // narrower mobile layout.
  return (
    <span
      data-state={state}
      className={cn(
        'inline-flex size-8 lg:size-10 items-center justify-center rounded-full shrink-0 transition-colors',
        state === 'done'    && 'bg-primary-700 text-white',
        state === 'active'  && 'bg-primary-100 text-primary-700',
        state === 'pending' && 'bg-(--color-surface-subtle) text-(--color-text-subtle)',
      )}
    >
      {state === 'done' ? (
        <Icon icon={PiCheck} size={20} />
      ) : icon ? (
        <Icon icon={icon} size={20} />
      ) : (
        <span className="text-sm font-bold">{number}</span>
      )}
    </span>
  );
}
