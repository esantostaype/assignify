'use client';

import type { ReactNode } from 'react';
import {
  Toaster,
  toast as rhtToast,
  type Toast as RhtToast,
} from 'react-hot-toast';
import { cn } from '@/lib/cn';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Alert01Icon,
  AlertCircleIcon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/shadcn/button';
import { Spinner } from '@/components/shadcn/spinner';

// ── Types ───────────────────────────────────────────────────────────────────
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

const TONE_ICON: Record<HotToastTone, IconSvgElement> = {
  info:    InformationCircleIcon,
  success: CheckmarkCircle02Icon,
  warning: Alert01Icon,
  error:   AlertCircleIcon,
  primary: InformationCircleIcon,
  neutral: InformationCircleIcon,
};

// Soft = color + transparencia (no el rango de shades viejo).
const TONE_BG: Record<HotToastTone, string> = {
  info:    'bg-primary/15 text-primary',
  success: 'bg-success-500/15 text-success-600',
  warning: 'bg-warning-500/15 text-warning-600',
  error:   'bg-destructive/15 text-destructive',
  primary: 'bg-primary/15 text-primary',
  neutral: 'bg-secondary text-muted-foreground',
};

const TONE_ACCENT: Record<HotToastTone, string> = {
  info:    'border-l-primary-500',
  success: 'border-l-success-500',
  warning: 'border-l-warning-500',
  error:   'border-l-error-500',
  primary: 'border-l-primary-600',
  neutral: 'border-l-neutral-400',
};

const ACTION_VARIANT = {
  filled: 'default',
  soft: 'soft',
  outlined: 'outline',
  ghost: 'ghost',
} as const;

// ── Public API ──────────────────────────────────────────────────────────────

export interface HotToastInput {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  /** Leading icon (hugeicons) shown in the tonal bubble. Pass `"spinner"` for loading. */
  icon?: IconSvgElement | 'spinner';
  tone?: HotToastTone;
  action?: {
    label: string;
    onClick: () => void;
    icon?: IconSvgElement;
    variant?: keyof typeof ACTION_VARIANT;
  };
  duration?: number;
  hideClose?: boolean;
  position?: HotToastPosition;
}

function HotToastBody({
  t, input, tone,
}: {
  t: RhtToast;
  input: HotToastInput;
  tone: HotToastTone;
}) {
  const useSpinner = input.icon === 'spinner';
  const resolvedIcon: IconSvgElement =
    input.icon && input.icon !== 'spinner' ? input.icon : TONE_ICON[tone];

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
        t.visible ? enterCls : leaveCls,
        'pointer-events-auto relative w-[320px] max-w-[calc(100vw-2rem)] rounded-lg bg-(--color-surface-card) shadow-xl ring-1 ring-border',
        'border-l-[3px]',
        TONE_ACCENT[tone],
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full', TONE_BG[tone])}>
          {useSpinner ? <Spinner /> : <HugeiconsIcon icon={resolvedIcon} size={18} />}
        </span>

        <div className="min-w-0 flex-1">
          {input.title && (
            <div className="text-sm font-semibold leading-snug text-foreground">{input.title}</div>
          )}
          {input.description && (
            <div className="mt-0.5 text-xs text-muted-foreground">{input.description}</div>
          )}
          {input.action && (
            <div className="mt-2.5">
              <Button
                size="sm"
                variant={ACTION_VARIANT[input.action.variant ?? 'soft']}
                onClick={() => {
                  input.action!.onClick();
                  rhtToast.dismiss(t.id);
                }}
              >
                {input.action.icon && <HugeiconsIcon icon={input.action.icon} size={14} />}
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
            className="absolute right-1 top-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Push a toast. Lower-level entry point used by all tonal helpers. */
function renderHotToast(input: HotToastInput): string {
  const tone     = input.tone     ?? 'neutral';
  const position = input.position ?? HOT_DEFAULT_TOAST_POSITION;
  const duration = input.duration ?? HOT_DEFAULT_TOAST_DURATION;

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

export function HotToaster() {
  return (
    <Toaster
      position={HOT_DEFAULT_TOAST_POSITION}
      reverseOrder={false}
      gutter={8}
      containerStyle={{ zIndex: 250 }}
      toastOptions={{
        duration: HOT_DEFAULT_TOAST_DURATION,
        style: { background: 'transparent', boxShadow: 'none', padding: 0 },
      }}
    />
  );
}
