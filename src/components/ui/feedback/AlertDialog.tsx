'use client';

import { type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import {
  Tick02Icon,
  Alert01Icon,
  AlertCircleIcon,
  InformationCircleIcon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';
import { Modal } from '@/components/ui/surfaces';
import { Button } from '@/components/shadcn/button';

export type AlertTone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';

export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  tone?: AlertTone;
  /** Override the default tone icon. Pass `null` to hide it entirely. */
  icon?: IconSvgElement | null;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  confirmIcon?: IconSvgElement | null;
  hideCloseButton?: boolean;
  staticBackdrop?: boolean;
  zIndex?: number;
  dataComponentName?: string;
}

interface ToneConfig {
  icon: IconSvgElement;
  iconBg: string;
  confirmVariant: 'default' | 'destructive';
  confirmClassName?: string;
  defaultConfirmIcon: IconSvgElement | null;
}

const TONE: Record<AlertTone, ToneConfig> = {
  danger:  { icon: AlertCircleIcon,        iconBg: 'bg-destructive/15 text-destructive',      confirmVariant: 'destructive', defaultConfirmIcon: Tick02Icon },
  warning: { icon: Alert01Icon,            iconBg: 'bg-warning-500/15 text-warning-600',      confirmVariant: 'default',     defaultConfirmIcon: null },
  info:    { icon: InformationCircleIcon,  iconBg: 'bg-primary/15 text-primary',              confirmVariant: 'default',     defaultConfirmIcon: null },
  success: { icon: CheckmarkCircle02Icon,  iconBg: 'bg-success-500/15 text-success-600',      confirmVariant: 'default', confirmClassName: 'bg-success-500 text-white hover:bg-success-500/90', defaultConfirmIcon: Tick02Icon },
  neutral: { icon: InformationCircleIcon,  iconBg: 'bg-secondary text-muted-foreground',      confirmVariant: 'default',     defaultConfirmIcon: null },
};

/**
 * Confirmation / alert dialog sobre <Modal density="compact">. Icono + título +
 * descripción como un bloque alineado. Confirm button según `tone`.
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
  const iconEl = icon === null ? null : (icon ?? cfg.icon);
  const confirmIconEl = confirmIcon === null ? null : (confirmIcon ?? cfg.defaultConfirmIcon);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      className="!max-w-[408px]"
      position="center"
      density="compact"
      hideCloseButton={hideCloseButton}
      staticBackdrop={staticBackdrop}
      zIndex={zIndex}
      dataComponentName={dataComponentName}
      closeButtonSize="sm"
      closeButtonOffset="corner"
      header={
        <div className="flex items-start gap-3">
          {iconEl && (
            <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${cfg.iconBg}`}>
              <HugeiconsIcon icon={iconEl} size={20} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-(--color-text-strong)">{title}</span>
            {description && <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>}
          </div>
        </div>
      }
      footer={
        <>
          {onConfirm && (
            <Button variant="ghost" onClick={onClose}>
              {cancelLabel}
            </Button>
          )}
          <Button
            variant={cfg.confirmVariant}
            className={cfg.confirmClassName}
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
          >
            {confirmIconEl && <HugeiconsIcon icon={confirmIconEl} size={14} />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
