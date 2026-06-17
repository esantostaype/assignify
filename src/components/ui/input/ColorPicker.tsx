'use client';

import {
  useCallback, useEffect, useId, useRef, useState,
  type PointerEvent as RPointerEvent, type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiCaretDown, PiPlus } from '@/lib/icons';
import { FormField } from './FormField';

export interface ColorPickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (hex: string) => void;
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Preset colors shown in the swatch grid. */
  presets?: string[];
  /** Show the placeholder pill when no color is selected. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const DEFAULT_PRESETS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6', '#6366F1',
  '#EC4899', '#F43F5E', '#D946EF', '#A855F7', '#0EA5E9', '#10B981', '#84CC16',
];

/** Popover open / close motion — matches `<Select>` / `<MultiSelect>`
 *  / `<UserMenu>` so every floating panel in the app shares one motion
 *  vocabulary: slide-in 8 px + fade in on open, slide-out 8 px + fade
 *  out on close. */
const DROPDOWN_ENTER_MS = 220;
const DROPDOWN_EXIT_MS  = 160;
const DROPDOWN_EASE     = 'cubic-bezier(0.32, 0.72, 0, 1)';

// tiny HSV aa HEX helpers 
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, v };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60)        [r, g, b] = [c, x, 0];
  else if (60 <= h && h < 120) [r, g, b] = [x, c, 0];
  else if (120 <= h && h < 180)[r, g, b] = [0, c, x];
  else if (180 <= h && h < 240)[r, g, b] = [0, x, c];
  else if (240 <= h && h < 300)[r, g, b] = [x, 0, c];
  else                          [r, g, b] = [c, 0, x];
  const to255 = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${to255(r)}${to255(g)}${to255(b)}`.toUpperCase();
}

function isValidHex(s: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(s.trim());
}

// component
export function ColorPicker({
  value, defaultValue = '#000000', onChange,
  label, helper, error, required,
  presets = DEFAULT_PRESETS,
  placeholder = 'Select color',
  disabled, className, id,
}: ColorPickerProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const current = isControlled ? value! : internal;

  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  // Popover mount / visible lifecycle — mirrors `<Select>` so the
  // exit transition can play before the popover unmounts.  `mounted`
  // keeps it in the DOM through the exit window; `visible` drives
  // the inline opacity + transform.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const enterScheduledRef = useRef(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setVisible(false);
    enterScheduledRef.current = false;
    const t = setTimeout(() => setMounted(false), DROPDOWN_EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  // Schedule the enter transition once per mount cycle.  Double rAF
  // so the first paint sees opacity:0 + translate3d(-8px) and the
  // next paint flips to visible, giving the CSS transition a delta
  // to animate from.
  useEffect(() => {
    if (!mounted || enterScheduledRef.current) return;
    enterScheduledRef.current = true;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
      enterScheduledRef.current = false;
    };
  }, [mounted]);

  const set = useCallback((next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }, [isControlled, onChange]);

  /** Hex used for the INTERNAL HSV math (area background, slider,
   *  hex input commit).  Falls back to `defaultValue` when the
   *  consumer hands us an empty / non-hex `value` — without this
   *  guard, `hexToHsv('')` returns NaN and every subsequent
   *  `hsvToHex(NaN, …)` call serialises as the literal string
   *  `"#NANNANNAN"`, which then propagates back through
   *  `onChange` the moment the producer drags in the SV area.
   *  `current` (the consumer-facing value) keeps its empty / raw
   *  form so the trigger label still reads as "Select color"
   *  placeholder when no selection has been made. */
  const computedHex = isValidHex(current) ? current : defaultValue;
  const hasSelection = isValidHex(current);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // HSV state derived from `computedHex` (guaranteed valid hex) so
  // the area / slider / picker math never sees NaN even when the
  // consumer's controlled `value` is empty or malformed.
  const { h, s, v } = hexToHsv(computedHex);

  // aa 2D area drag (saturation "a value) 
  const areaRef = useRef<HTMLDivElement>(null);
  const dragArea = (e: RPointerEvent<HTMLDivElement>) => {
    const el = areaRef.current; if (!el) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const update = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const sx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const sy = Math.max(0, Math.min(1, (clientY - rect.top)  / rect.height));
      set(hsvToHex(h, sx, 1 - sy));
    };
    update(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => update(ev.clientX, ev.clientY);
    const up   = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup',   up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup',   up);
  };

  // aa 1D hue slider 
  const hueRef = useRef<HTMLDivElement>(null);
  const dragHue = (e: RPointerEvent<HTMLDivElement>) => {
    const el = hueRef.current; if (!el) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const update = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      set(hsvToHex(t * 360, s, v));
    };
    update(e.clientX);
    const move = (ev: PointerEvent) => update(ev.clientX);
    const up   = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup',   up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup',   up);
  };

  // aa hex input
  // Initialise with the consumer's `current` directly so an empty
  // controlled `value` paints an empty input field (the producer
  // sees "" + placeholder rather than a confusing default hex they
  // didn't pick).  Commit-validates on blur / Enter — invalid edits
  // snap back to whatever's currently shown.
  const [hexInput, setHexInput] = useState(current);
  useEffect(() => { setHexInput(current); }, [current]);
  const commitHex = (s: string) => {
    if (isValidHex(s)) set('#' + s.replace('#', '').toUpperCase());
    else setHexInput(current); // reset to last valid
  };

  // aa derived styles 
  const hueColor = hsvToHex(h, 1, 1); // pure hue at full S/V
  const areaBg = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`;

  const trigger = (
    <button
      type="button"
      id={inputId}
      disabled={disabled}
      data-component="ColorPicker"
      data-open={open}
      className={cn(
        'flex h-10 w-full items-center gap-2.5 rounded-md border px-3 transition-colors text-left',
        open ? 'border-primary-600 bg-(--color-surface-card)' : 'border-(--color-border-strong) bg-(--color-surface-muted) hover:border-neutral-400',
        !!error && 'border-error-500 bg-(--color-surface-card)',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      onClick={() => setOpen(o => !o)}
    >
      <span
        aria-hidden
        className="inline-block size-5 shrink-0 rounded-full border border-(--color-border-strong)"
        // Show the actual selection when valid; fall back to a
        // transparent swatch (the border alone reads as "empty") when
        // the consumer is in the "no selection yet" state.
        style={{ background: hasSelection ? current : 'transparent' }}
      />
      {/* Trigger label reads as a regular Input value — Inter / 14 px
          / text-default — instead of the previous monospaced 13 px
          hex.  Same font + colour as every other Input on the page. */}
      <span className={cn(
        'text-sm flex-1 truncate',
        hasSelection ? 'text-(--color-text-default)' : 'text-(--color-text-subtle)',
      )}>
        {hasSelection ? current : placeholder}
      </span>
      <Icon icon={PiCaretDown} size={14} className={cn('text-(--color-text-subtle) transition-transform', open && 'rotate-180')} />
    </button>
  );

  const popover = mounted && (
    <div
      data-component="ColorPickerPopover"
      style={{
        // Slide-in 8 px + fade — same vocabulary as the Select /
        // MultiSelect dropdowns.  The popover anchors below the
        // trigger so it slides DOWN into place on open and UP out
        // on close.
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate3d(0, 0, 0)' : 'translate3d(0, -8px, 0)',
        transition: `opacity ${visible ? DROPDOWN_ENTER_MS : DROPDOWN_EXIT_MS}ms ${DROPDOWN_EASE}, transform ${visible ? DROPDOWN_ENTER_MS : DROPDOWN_EXIT_MS}ms ${DROPDOWN_EASE}`,
      }}
      className="absolute top-[calc(100%+6px)] left-0 z-50 w-[260px] rounded-xl border border-(--color-border-default) bg-(--color-surface-card) p-3 shadow-xl"
    >
      {/* Saturation / Value area */}
      <div
        ref={areaRef}
        onPointerDown={dragArea}
        className="relative h-[140px] w-full rounded-md overflow-hidden cursor-crosshair select-none touch-none"
        style={{ background: areaBg }}
      >
        <span
          aria-hidden
          className="absolute -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-white shadow"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: computedHex }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        onPointerDown={dragHue}
        className="relative mt-3 h-3 w-full rounded-full cursor-pointer select-none touch-none"
        style={{
          background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        }}
      >
        <span
          aria-hidden
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-white shadow"
          style={{ left: `${(h / 360) * 100}%`, background: hueColor }}
        />
      </div>

      {/* Hex input row */}
      <div className="mt-3 flex items-center gap-2">
        <div className="inline-flex h-8 items-center rounded-md border border-(--color-border-default) bg-(--color-surface-muted) px-2 text-[11px] font-semibold text-(--color-text-muted)">
          Hex
        </div>
        {/* Hex input — same font + colour as a regular Input, no
            monospace.  Keeps the popover visually consistent with
            the trigger and the rest of the form controls. */}
        <input
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={() => commitHex(hexInput)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitHex(hexInput); }}
          className="flex-1 h-8 rounded-md border border-(--color-border-default) bg-(--color-surface-muted) px-2 text-[13px] text-(--color-text-default) outline-none focus:border-primary-600 focus:bg-(--color-surface-card)"
        />
      </div>

      {/* Saved colors */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-(--color-text-muted)">Saved colors:</span>
          <button
            type="button"
            onClick={() => setSaved(prev => prev.includes(current) ? prev : [current, ...prev].slice(0, 14))}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary-700 hover:text-primary-800"
          >
            <Icon icon={PiPlus} size={11} /> Add
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {[...saved, ...presets].slice(0, 14).map((c, i) => (
            <button
              key={`${c}-${i}`}
              type="button"
              aria-label={c}
              onClick={() => set(c)}
              className={cn(
                'size-6 rounded-full border transition-transform hover:scale-110',
                c.toUpperCase() === current.toUpperCase() ? 'border-neutral-700 ring-2 ring-neutral-300 ring-offset-1' : 'border-(--color-border-default)',
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const field = (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger}
      {popover}
    </div>
  );

  if (label || helper || error) {
    return (
      <FormField label={label} helper={helper} error={error} required={required} htmlFor={inputId}>
        {field}
      </FormField>
    );
  }
  return field;
}
