'use client';

import type { ReactNode } from 'react';
import {
  Toaster,
  toast as rhtToast,
  type Toast as RhtToast,
} from 'react-hot-toast';
import { cn } from '@/lib/cn';
import {
  Icon, PiX, PiCheckCircle, PiWarning, PiWarningCircle, PiInfo, PiSpinner,
} from '@/lib/icons';
import type { IconComponent } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';

// ── Types ───────────────────────────────────────────────────────────────────
// This wrapper exposes ONLY what react-hot-toast supports natively.  What it
// adds is purely cosmetic: a Tailwind palette / accent stripe / icon bubble /
// title-description-action / close layout — built inside a `toast.custom`
// slot, which is the library's documented way of taking over the visual.

export type HotToastTone =
  | 'info' | 'success' | 'warning' | 'error' | 'primary' | 'neutral';

/** Matches react-hot-toast's own `ToastPosition` exactly. */
export type HotToastPosition =
  | 'top-left'    | 'top-center'    | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export const HOT_TOAST_POSITIONS: HotToastPosition[] = [
  'top-left',    'top-center',    'top-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

export const HOT_TOAST_TONES: HotToastTone[] = [
  'neutral', 'info', 'success', 'warning', 'error', 'primary',
];

export const HOT_DEFAULT_TOAST_DURATION = 2000;
export const HOT_DEFAULT_TOAST_POSITION: HotToastPosition = 'top-right';

const TONE_ICON: Record<HotToastTone, IconComponent> = {
  info:    PiInfo,
  success: PiCheckCircle,
  warning: PiWarning,
  error:   PiWarningCircle,
  primary: PiInfo,
  neutral: PiInfo,
};

const TONE_BG: Record<HotToastTone, string> = {
  info:    'bg-primary-100 text-primary-700',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  error:   'bg-error-100   text-error-700',
  primary: 'bg-primary-100 text-primary-700',
  neutral: 'bg-neutral-100 text-neutral-700',
};

const TONE_ACCENT: Record<HotToastTone, string> = {
  info:    'border-l-primary-500',
  success: 'border-l-success-500',
  warning: 'border-l-warning-500',
  error:   'border-l-error-500',
  primary: 'border-l-primary-600',
  neutral: 'border-l-neutral-400',
};

// ── Public API ──────────────────────────────────────────────────────────────

export interface HotToastInput {
  /** Mirrors `ToastOptions.id`. */
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  /** Leading icon shown in the tonal bubble.  Pass `"spinner"` for a
   *  loading indicator.  Rendered as part of OUR JSX inside `toast.custom`. */
  icon?: IconComponent | 'spinner';
  tone?: HotToastTone;
  /** Optional CTA button rendered below the body.  `icon` adds a leading
   *  glyph; `variant` overrides the default (`soft`). */
  action?: {
    label: string;
    onClick: () => void;
    icon?: IconComponent;
    variant?: 'filled' | 'soft' | 'outlined' | 'ghost';
  };
  /** Mirrors `ToastOptions.duration`.  0 / Infinity → never auto-dismiss. */
  duration?: number;
  /** Hide the X close button inside our JSX. */
  hideClose?: boolean;
  /** Mirrors `ToastOptions.position`. */
  position?: HotToastPosition;
}

/** Visual body of one toast — lives inside react-hot-toast's `toast.custom`
 *  slot.  All animation is driven by toggling the `.hot-toast-enter` /
 *  `.hot-toast-leave` classes based on `t.visible`, exactly as the
 *  library's docs demonstrate.  No raf flips, no transform book-keeping,
 *  no per-toast pause logic — that's all native. */
function HotToastBody({
  t, input, tone,
}: {
  t: RhtToast;
  input: HotToastInput;
  tone: HotToastTone;
}) {
  const IconCmp = input.icon === 'spinner' || !input.icon ? null : input.icon;
  const showIcon = IconCmp != null || input.icon === 'spinner';

  // `t.position` is the live value the library resolved for this toast —
  // honours per-toast `position` overrides AND the Toaster's default.
  // We swap to a horizontal slide animation for the right-edge anchors
  // so those toasts come from / return to off-screen right, while the
  // other positions keep the docs-default scale + fade.
  const position = t.position ?? input.position ?? HOT_DEFAULT_TOAST_POSITION;
  const isRight  = position.endsWith('-right');
  const enterCls = isRight ? 'hot-toast-enter-right' : 'hot-toast-enter';
  const leaveCls = isRight ? 'hot-toast-leave-right' : 'hot-toast-leave';

  return (
    <div
      role="status"
      data-component="HotToast"
      data-tone={tone}
      data-position={position}
      data-visible={t.visible}
      className={cn(
        // The animation classes are defined in globals.css and are the
        // official `toast.custom` pattern from the react-hot-toast docs
        // — applied via class swap on `t.visible`.
        t.visible ? enterCls : leaveCls,
        'pointer-events-auto relative w-[320px] max-w-[calc(100vw-2rem)] rounded-lg border border-(--color-border-default) bg-(--color-surface-card) shadow-xl',
        'border-l-[3px]',
        TONE_ACCENT[tone],
      )}
    >
      <div className="flex items-start gap-3 py-3.5 px-4">
        {showIcon && (
          <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full', TONE_BG[tone])}>
            {input.icon === 'spinner' ? (
              <Icon icon={PiSpinner} size={18} className="animate-spin" />
            ) : (
              <Icon icon={IconCmp ?? TONE_ICON[tone]} size={18} />
            )}
          </span>
        )}

        <div className="flex-1 min-w-0">
          {input.title && (
            // Wraps freely (no truncation) so longer titles stay fully readable.
            <Typography variant="h6" className="leading-snug">
              {input.title}
            </Typography>
          )}
          {input.description && (
            <Typography variant="bodySm" className="mt-0.5">
              {input.description}
            </Typography>
          )}
          {input.action && (
            <div className="mt-2.5">
              <Button
                size="sm"
                variant={input.action.variant ?? 'soft'}
                startIcon={input.action.icon ? <Icon icon={input.action.icon} size={14} /> : undefined}
                onClick={() => {
                  input.action!.onClick();
                  rhtToast.dismiss(t.id);
                }}
              >
                {input.action.label}
              </Button>
            </div>
          )}
        </div>

        {!input.hideClose && (
          <button
            type="button"
            onClick={() => rhtToast.dismiss(t.id)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-(--color-text-default) absolute top-1 right-1"
          >
            <Icon icon={PiX} size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Push a toast.  Lower-level entry point used by all tonal helpers. */
function renderHotToast(input: HotToastInput): string {
  const tone     = input.tone     ?? 'neutral';
  const position = input.position ?? HOT_DEFAULT_TOAST_POSITION;
  const duration = input.duration ?? HOT_DEFAULT_TOAST_DURATION;

  // react-hot-toast resolves duration with `opts.duration || default`
  // (logical OR, not nullish), so passing `0` collapses to the Toaster's
  // default duration and the toast self-dismisses after that fallback
  // window — NOT what callers expect when they say "0 = manual only".
  // Coerce both 0 and non-finite values to Infinity here to honour the
  // documented contract.
  const resolvedDuration =
    !Number.isFinite(duration) || duration === 0 ? Infinity : duration;

  return rhtToast.custom(
    (t) => <HotToastBody t={t} input={input} tone={tone} />,
    {
      id:       input.id,
      duration: resolvedDuration,
      position,
    },
  );
}

/** Tonal helpers + dismiss / clear API.  Mirrors the call shape used across
 *  the reference project so call sites read `hotToast.success({ title, description })`. */
export const hotToast = {
  info:    (t: Omit<HotToastInput, 'tone'>) => renderHotToast({ ...t, tone: 'info'    }),
  success: (t: Omit<HotToastInput, 'tone'>) => renderHotToast({ ...t, tone: 'success' }),
  warning: (t: Omit<HotToastInput, 'tone'>) => renderHotToast({ ...t, tone: 'warning' }),
  error:   (t: Omit<HotToastInput, 'tone'>) => renderHotToast({ ...t, tone: 'error'   }),
  neutral: (t: Omit<HotToastInput, 'tone'>) => renderHotToast({ ...t, tone: 'neutral' }),
  primary: (t: Omit<HotToastInput, 'tone'>) => renderHotToast({ ...t, tone: 'primary' }),
  push:    (t: HotToastInput)              => renderHotToast(t),
  dismiss: (id: string)                    => rhtToast.dismiss(id),
  clear:   ()                              => rhtToast.dismiss(),
};

// ── Container ───────────────────────────────────────────────────────────────

/** Mount this once near the root to render every queued hot-toast.  All
 *  positioning, gutter spacing, sibling reordering and pause-on-hover come
 *  from the library. */
export function HotToaster() {
  return (
    <Toaster
      position={HOT_DEFAULT_TOAST_POSITION}
      reverseOrder={false}
      gutter={8}
      containerStyle={{ zIndex: 250 }}
      toastOptions={{
        duration: HOT_DEFAULT_TOAST_DURATION,
        // Strip the library's default ToastBar chrome so our card is the
        // only thing painted — we provide all visual styling.
        style: { background: 'transparent', boxShadow: 'none', padding: 0 },
      }}
    />
  );
}
