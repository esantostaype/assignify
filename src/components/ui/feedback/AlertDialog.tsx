'use client';

import { type ReactNode } from 'react';
import { Modal } from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import {
  Icon, PiCheck, PiX, PiWarning, PiWarningCircle, PiInfo, PiCheckCircle,
} from '@/lib/icons';
import type { IconComponent } from '@/lib/icons';

export type AlertTone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';

export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  tone?: AlertTone;
  /** Override the default tone icon. Pass `null` to hide it entirely. */
  icon?: IconComponent | null;
  title: ReactNode;
  description?: ReactNode;
  /** Custom body (rendered between description and footer). */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** If omitted, the cancel button is hidden (informational alert). */
  onConfirm?: () => void;
  /** Show - leading icon on the confirm button. Default true. */
  confirmIcon?: IconComponent | null;
  /** Hide the X close button in the header. */
  hideCloseButton?: boolean;
  /** Disable click-outside-to-close. */
  staticBackdrop?: boolean;
  /** Override the dialog's z-index.  AlertDialogs are the critical
   *  interaction layer of the app, so by default they sit ABOVE every
   *  floating pane (drawer 200, side PDF preview 230, fullscreen PDF
   *  260) — set here to 280 so the confirmation always wins. */
  zIndex?: number;
  /** Override the dialog's `data-component` attribute — wrapper
   *  components (`DiscardChangesDialog`, `DeleteConfirmDialog`) pass
   *  their own name so the Dev Mode inspector identifies them as the
   *  named components they are. */
  dataComponentName?: string;
}

interface ToneConfig {
  icon:        IconComponent;
  iconBg:      string;
  iconColor:   string;
  /** Button color for the confirm action. */
  confirmColor: 'primary' | 'error' | 'warning' | 'success' | 'neutral';
  defaultConfirmIcon: IconComponent | null;
}

const TONE: Record<AlertTone, ToneConfig> = {
  danger:  { icon: PiWarningCircle,       iconBg: 'bg-error-100',   iconColor: 'text-error-600',   confirmColor: 'error',   defaultConfirmIcon: PiCheck },
  warning: { icon: PiWarning,             iconBg: 'bg-warning-100', iconColor: 'text-warning-600', confirmColor: 'primary', defaultConfirmIcon: null },
  info:    { icon: PiInfo,                iconBg: 'bg-primary-100', iconColor: 'text-primary-600', confirmColor: 'primary', defaultConfirmIcon: null },
  success: { icon: PiCheckCircle, iconBg: 'bg-success-100', iconColor: 'text-success-600', confirmColor: 'success', defaultConfirmIcon: PiCheck },
  neutral: { icon: PiInfo,                iconBg: 'bg-(--color-surface-subtle)', iconColor: 'text-(--color-text-muted)', confirmColor: 'primary', defaultConfirmIcon: null },
};

/**
 * Confirmation / alert dialog. Built on top of <Modal density="compact">
 * (24 px paddings, no separator borders). Renders the icon + title +
 * description as one aligned block so the description sits directly under
 * the title text instead of resetting to the left edge.
 *
 * The close button is transparent (ghost), small, pinned to the top-right
 * corner of the dialog. Confirm button color tracks `tone`.
 */
export function AlertDialog({
  open, onClose,
  tone = 'info',
  icon,
  title, description, children,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  onConfirm,
  confirmIcon,
  hideCloseButton,
  staticBackdrop,
  zIndex = 280,
  dataComponentName = 'AlertDialog',
}: AlertDialogProps) {
  const cfg = TONE[tone];
  const IconCmp = icon === null ? null : (icon ?? cfg.icon);
  const ConfirmIcon = confirmIcon === null
    ? null
    : (confirmIcon ?? cfg.defaultConfirmIcon);

  return (
    <Modal
      open={open}
      onClose={onClose}
      /* `sm` modal is now 640px, so override with - tighter 408px alert width */
      size="sm"
      className="!max-w-[408px]"
      position="center"
      density="compact"
      hideCloseButton={hideCloseButton}
      staticBackdrop={staticBackdrop}
      zIndex={zIndex}
      dataComponentName={dataComponentName}
      /* Transparent (ghost) X, small, pinned right at the corner (4px) */
      closeButtonVariant="ghost"
      closeButtonSize="sm"
      closeButtonOffset="corner"
      /* Custom header icon + title + description as ONE aligned cluster */
      header={
        <div className="flex items-start gap-3">
          {IconCmp && (
            <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${cfg.iconBg} ${cfg.iconColor}`}>
              <Icon icon={IconCmp} size={20} />
            </span>
          )}
          <div className="flex-1 min-w-0">
            {/* `h5` is responsive at the variant level (16 → 18 px),
                so the alert title downshifts on mobile automatically
                — no per-call-site override needed. */}
            <Typography variant="h5" as="span" className="block">
              {title}
            </Typography>
            {description && (
              <Typography variant="bodySm" className="mt-1">
                {description}
              </Typography>
            )}
          </div>
        </div>
      }
      footer={
        <>
          {onConfirm && (
            <Button
              variant="soft"
              color="neutral"
              startIcon={<Icon icon={PiX} size={14} />}
              onClick={onClose}
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            color={cfg.confirmColor}
            startIcon={ConfirmIcon ? <Icon icon={ConfirmIcon} size={14} /> : undefined}
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
