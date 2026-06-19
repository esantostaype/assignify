'use client';

import { AlertDialog } from './AlertDialog';

export interface DiscardChangesDialogProps {
  open: boolean;
  /** Fires when the user dismisses without confirming (Keep editing,
   *  backdrop click, or ESC). */
  onClose: () => void;
  /** Fires when the user confirms the discard.  The parent is expected
   *  to close the underlying form/modal/drawer right after. */
  onConfirm: () => void;
  /** Override the heading.  Default copy is the standard
   *  "Discard changes?" used across the app. */
  title?: string;
  /** Override the body copy.  Default copy is the standard
   *  "Closing this dialog will discard the data you entered.  This
   *  action cannot be undone." */
  description?: string;
  /** Override the confirm button label.  Default `Discard`. */
  confirmLabel?: string;
  /** Override the cancel button label.  Default `Keep editing`. */
  cancelLabel?: string;
}

/**
 * Standard "Discard changes?" confirmation — shared across every form
 * that mutates a draft (NewQuoteDrawer, PayrollModal, future create
 * dialogs).  Wraps `AlertDialog` with the discard-specific tone, copy
 * and button labels so every consumer reads identically and any future
 * tweak (icon, button colour, copy) lives in one place.
 *
 *   • Tone           — `danger` (red circle + red filled Discard button)
 *   • Title          — "Discard changes?"
 *   • Description    — "Closing this dialog will discard the data you
 *                       entered.  This action cannot be undone."
 *   • Confirm label  — "Discard"
 *   • Cancel label   — "Keep editing"
 *
 * Pair with a `dirty`-detection helper at the call site so the dialog
 * only surfaces when the producer has actual unsaved work — closing a
 * pristine form should slip straight through.
 */
export function DiscardChangesDialog({
  open, onClose, onConfirm,
  title       = 'Discard changes?',
  description = 'Closing this dialog will discard the data you entered. This action cannot be undone.',
  confirmLabel = 'Discard',
  cancelLabel  = 'Keep editing',
}: DiscardChangesDialogProps) {
  return (
    <AlertDialog
      open={open}
      onClose={onClose}
      tone="danger"
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      // Surface the wrapper name in the Dev Mode inspector so developers
      // can spot the canonical "Discard" dialog as a first-class entity
      // instead of seeing the underlying `AlertDialog` primitive.
      dataComponentName="DiscardChangesDialog"
    />
  );
}
