'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { cn } from '@/lib/cn';

export interface SliderProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  /** Show the value bubble above the thumb while dragging. */
  showValue?: boolean;
  /** Optional unit/format function for the value bubble. */
  formatValue?: (value: number) => string;
  className?: string;
  /** Optional aria-label for the thumb. */
  'aria-label'?: string;
}

/**
 * Single-thumb slider with primary fill, neutral track, and a value popover
 * during drag. Follows the same blue palette as the rest of the system.
 */
export function Slider({
  value, defaultValue = 0, min = 0, max = 100, step = 1,
  onChange, disabled, showValue, formatValue,
  className, ...rest
}: SliderProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const current = isControlled ? value : internal;
  const [dragging, setDragging] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);

  const setValue = (v: number) => {
    const clamped = Math.max(min, Math.min(max, v));
    const stepped = Math.round((clamped - min) / step) * step + min;
    if (!isControlled) setInternal(stepped);
    onChange?.(stepped);
  };

  const fromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current; if (!el) return current;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return min + pct * (max - min);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    setValue(fromEvent(e));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging || disabled) return;
    setValue(fromEvent(e));
  };
  const onPointerUp = () => setDragging(false);

  const pct = ((current - min) / (max - min)) * 100;
  const label = formatValue ? formatValue(current) : String(current);

  return (
    <div
      ref={trackRef}
      data-component="Slider"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn(
        'relative h-6 w-full select-none touch-none flex items-center',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer',
        className,
      )}
    >
      {/* track */}
      <span className="absolute left-0 right-0 h-1 rounded-full bg-neutral-200" />
      {/* fill */}
      <span className="absolute left-0 h-1 rounded-full bg-primary-600" style={{ width: `${pct}%` }} />
      {/* thumb */}
      <span
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-label={rest['aria-label']}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   { e.preventDefault(); setValue(current + step); }
          if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') { e.preventDefault(); setValue(current - step); }
          if (e.key === 'Home') { e.preventDefault(); setValue(min); }
          if (e.key === 'End')  { e.preventDefault(); setValue(max); }
        }}
        className="absolute -translate-x-1/2 h-4 w-4 rounded-full bg-white border-2 border-primary-600 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
        style={{ left: `${pct}%` }}
      />
      {/* value popover */}
      {showValue && dragging && (
        <span
          className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-white"
          style={{ left: `${pct}%` }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
