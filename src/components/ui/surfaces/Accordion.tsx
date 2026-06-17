'use client';

import {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { Typography } from '@/components/ui/typography';
import { Icon, PiCaretDown } from '@/lib/icons';
import { Collapse } from './Collapse';

/* ─── Container ─────────────────────────────────────────────────────────── */

export type AccordionMode = 'single' | 'multiple';
/** Header density / title scale.
 *    • `md` (default) — 14→16 px title, roomy header + body padding.
 *    • `sm` — 13 px title, tighter padding.  Use for accordions nested
 *      INSIDE another accordion (e.g. the Cross-Sell Playbook's
 *      Questions / Rebuttals / Tips rows) so the child rows read as
 *      subordinate to the parent row. */
export type AccordionSize = 'sm' | 'md';

interface AccordionCtx {
  mode: AccordionMode;
  size: AccordionSize;
  open: string[];
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
}
const AccordionContext = createContext<AccordionCtx | null>(null);

export interface AccordionProps {
  /** `single` (default) — only one item open at a time.  Pair with
   *  `alwaysOneOpen` to prevent collapsing the last open one.
   *  `multiple` — any number of items can be open at once. */
  mode?: AccordionMode;
  /** Header density / title scale — `md` (default) or `sm` (nested).
   *  Propagates to every `AccordionItem` inside via context, so a whole
   *  nested group shares one size without per-item props. */
  size?: AccordionSize;
  /** Only meaningful with `mode="single"`.  When true, clicking the
   *  currently-open header is a no-op so the accordion always has
   *  at least one row expanded. */
  alwaysOneOpen?: boolean;
  /** Initial open ids (uncontrolled). */
  defaultOpen?: string[];
  /** Controlled list of open ids.  Pair with `onOpenChange`. */
  open?: string[];
  onOpenChange?: (ids: string[]) => void;
  /** When false, the outer frame (rounded border + white background)
   *  is dropped so the items can sit inside a parent-provided wrapper
   *  (cards, drawers, etc.).  Default `true`. */
  framed?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Bordered list of collapsible rows.  The container handles open-state
 * tracking (single vs. multiple), the always-one-open rule, the header
 * density (`size`), and the outer frame (rounded border, white
 * background, hairlines between rows via each item's own `border-b`).
 * Drop `AccordionItem`s inside.
 *
 * Used by the questionnaire-template editor (each question is a row
 * with an editor body), the open-questionnaire summary view, and the
 * Cross-Sell Playbook (MD coverage rows wrapping SM Q&A / Rebuttal /
 * Tips rows — `size="sm"`).
 */
export function Accordion({
  mode = 'single',
  size = 'md',
  alwaysOneOpen = false,
  defaultOpen,
  open: openProp,
  onOpenChange,
  framed = true,
  className,
  children,
}: AccordionProps) {
  const [internal, setInternal] = useState<string[]>(defaultOpen ?? []);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp! : internal;

  const setOpen = useCallback((next: string[]) => {
    if (!isControlled) setInternal(next);
    onOpenChange?.(next);
  }, [isControlled, onOpenChange]);

  const isOpen = (id: string) => open.includes(id);

  const toggle = (id: string) => {
    const currentlyOpen = open.includes(id);
    if (mode === 'multiple') {
      setOpen(currentlyOpen ? open.filter((x) => x !== id) : [...open, id]);
      return;
    }
    // single
    if (currentlyOpen) {
      if (alwaysOneOpen) return;
      setOpen([]);
      return;
    }
    setOpen([id]);
  };

  return (
    <AccordionContext.Provider value={{ mode, size, open, isOpen, toggle }}>
      <div
        data-component="Accordion"
        data-mode={mode}
        data-size={size}
        className={cn(
          framed && 'border border-(--color-border-strong) rounded-lg overflow-hidden bg-(--color-surface-card)',
          className,
        )}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

/* ─── Item ──────────────────────────────────────────────────────────────── */

export type AccordionItemBodyVariant = 'plain' | 'tinted';

export interface AccordionItemProps {
  /** Stable id used to track open state.  Required. */
  id: string;
  /** Header title — typically a string or a short JSX block. */
  title: ReactNode;
  /** Right-side slot — buttons, checkboxes, chips, etc.  Clicks on
   *  this area do NOT toggle the accordion (stopPropagation is
   *  handled internally). */
  actions?: ReactNode;
  /** Body styling preset:
   *    • `plain` (default) — children sit in a regular padded body.
   *    • `tinted` — wraps children in a primary-50 zone with a 3 px
   *                 primary-500 left accent and 12 px padding.
   *                 Matches the question editor's "active" feel. */
  bodyVariant?: AccordionItemBodyVariant;
  /** Tells the item it's the bottom row so the row's `border-b`
   *  drops out.  The CSS `:last-child` selector can't be used here
   *  because every animation wrapper around the item (CollapseListItem
   *  etc.) makes its child a "last-child" of itself. */
  isLast?: boolean;
  children: ReactNode;
  className?: string;
}

/** Per-size header + body geometry.  `size` is read from the parent
 *  Accordion via context so a whole group scales together. */
const SIZE_STYLES: Record<AccordionSize, {
  header: string;
  title: string;
  caret: number;
  bodyPlain: string;
  bodyTinted: string;
}> = {
  md: {
    header:     'px-4 py-3',
    title:      'text-sm! md:text-base!',
    caret:      16,
    bodyPlain:  'p-4 md:p-6',
    bodyTinted: 'bg-primary-50 border-l-[3px] border-primary-500 p-3 space-y-4',
  },
  sm: {
    header:     'px-4 py-2.5',
    title:      'text-[13px]!',
    caret:      14,
    bodyPlain:  'p-3 md:p-4',
    bodyTinted: 'bg-primary-50 border-l-[3px] border-primary-500 p-3 space-y-3',
  },
};

/**
 * Single row inside an `Accordion`.  Header carries a numbered /
 * named title, a rotating caret, and optional right-side actions; body
 * collapses / expands via the shared `Collapse` motion helper.
 *
 * Header colour rules match the project-wide convention:
 *   • Active (open)   → primary-700.
 *   • Closed at rest  → neutral-400.
 *   • Closed on hover → neutral-600.
 *
 * Title size + padding follow the parent Accordion's `size` (`md`
 * default, `sm` for nested groups).
 */
export function AccordionItem({
  id, title, actions,
  bodyVariant = 'plain',
  isLast = false,
  children,
  className,
}: AccordionItemProps) {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('AccordionItem must be a descendant of <Accordion>');
  const open = ctx.isOpen(id);
  const s = SIZE_STYLES[ctx.size];

  return (
    <div
      data-component="AccordionItem"
      data-open={open ? 'true' : 'false'}
      className={cn(
        'bg-(--color-surface-card) border-(--color-border-strong)',
        !isLast && 'border-b',
        className,
      )}
    >
      {/* Header is a <div> flex row, NOT a wrapping <button>, because the
          `actions` slot routinely contains <Button> children (Duplicate,
          Remove, etc.) and nesting <button> inside <button> is invalid
          HTML.  The browser auto-corrects nested buttons by closing the
          outer one early, which yields a different DOM than React's
          virtual tree and triggers a hydration mismatch.  Splitting the
          toggle button (title + caret) from the actions area as siblings
          keeps the markup valid and the first paint stable. */}
      <div
        className={cn(
          'group/ai flex w-full items-center justify-between gap-3',
          // Header keeps a hairline below it whenever the body renders
          // — gives the title strip its own slot above the body.
          open && 'border-b border-(--color-border-strong)',
        )}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => ctx.toggle(id)}
          className={cn('group/btn flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer', s.header)}
        >
          <Typography
            variant="cardTitle"
            as="span"
            color={open ? 'primary-700' : undefined}
            truncate
            className={cn(
              'flex-1 min-w-0 transition-colors',
              s.title,
              !open && 'text-(--color-neutral-400)! group-hover/ai:text-neutral-600!',
            )}
          >
            {title}
          </Typography>
          {/* Rotating caret — primary-700 when open (tracks the title),
              muted otherwise.  Sits at the right edge of the toggle
              button (before any `actions`) so it's part of the click
              target. */}
          <Icon
            icon={PiCaretDown}
            size={s.caret}
            className={cn(
              'shrink-0 transition-transform duration-200',
              open ? 'rotate-180 text-primary-700' : 'text-(--color-text-subtle)',
            )}
          />
        </button>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 pr-4">
            {actions}
          </div>
        )}
      </div>

      <Collapse open={open}>
        <div className={bodyVariant === 'tinted' ? s.bodyTinted : s.bodyPlain}>
          {children}
        </div>
      </Collapse>
    </div>
  );
}
