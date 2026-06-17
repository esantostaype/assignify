'use client';

import { forwardRef, useContext, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { KeyValueChipContext } from '@/components/custom/KeyValue';

export type SwitchSize = 'sm' | 'md' | 'lg';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  helper?: ReactNode;
  /** Text shown when on. Ignored when `size="sm"`. */
  onLabel?: string;
  /** Text shown when off. Ignored when `size="sm"`. */
  offLabel?: string;
  /**
   * - `sm` â†’ 20px tall, switch only (no internal text)
   * - `md` â†’ 32px tall, 12px text-padding, 24px knob, 3px horizontal inset
   * - `lg` â†’ 40px tall, 16px text-padding, 32px knob, 4px horizontal inset
   *
   * Default is `md` standalone (and inside any normal table cell), but
   * auto-shrinks to `sm` when rendered inside a `KeyValueChip` so the
   * switch fits inside the chip's tight 32 px band.  Pass `size`
   * explicitly to override the context default.
   */
  size?: SwitchSize;
  labelPosition?: 'left' | 'right';
}

interface SizeTokens {
  height:  number;  // track height
  knob:    number;  // knob diameter
  hInset:  number;  // knob distance from LEFT/RIGHT track edges
  textPad: number;  // breathing room around the LONGER label (both sides)
  font:    string;
}

// Geometry per size.  Vertical centering is automatic (top: 50% + translateY).
const SIZE: Record<SwitchSize, SizeTokens> = {
  sm: { height: 20, knob: 16, hInset: 2, textPad: 0,  font: '' },
  md: { height: 32, knob: 24, hInset: 3, textPad: 12, font: 'text-xs' },
  lg: { height: 40, knob: 32, hInset: 4, textPad: 16, font: 'text-sm' },
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    label, helper,
    onLabel = 'YES', offLabel = 'NO',
    size: sizeProp,
    labelPosition = 'right',
    className, id, disabled,
    checked: checkedProp, defaultChecked, onChange,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [internal, setInternal] = useState(defaultChecked ?? false);
  const isControlled = checkedProp !== undefined;
  const checked = isControlled ? checkedProp : internal;
  const chipCtx = useContext(KeyValueChipContext);
  const size: SwitchSize = sizeProp ?? (chipCtx ? 'sm' : 'md');
  const t = SIZE[size];
  const showText = size !== 'sm';
  const longer = onLabel.length >= offLabel.length ? onLabel : offLabel;

  // Track layout (ON state):
  //   [ textPad | longer_label | textPad | knob | hInset ]
  //   |â”€â”€â”€â”€â”€â”€â”€ half â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€|   â”€â”€â”€â”€  knob area â”€â”€â”€â”€â”€|
  // Half-width = textPad + longer_label_width + textPad
  // Track-width = half + knob + hInset
  //
  // Ghost padding = total padding (track minus label-content):
  //   padding-left  = textPad
  //   padding-right = textPad + knob + hInset
  const ghostPaddingRight = t.textPad + t.knob + t.hInset;

  // Active label is rendered inside an absolute container that fills its half,
  // and centered horizontally with flex.  The half exactly excludes the knob
  // area (knob + hInset) â€” NOT the textPad â€” so the centering is correct.
  const halfRightOffset = t.knob + t.hInset; // for the ON label container
  const halfLeftOffset  = t.hInset + t.knob; // for the OFF label container

  // Knob slides between the two horizontal insets.
  const knobLeftOn  = `calc(100% - ${t.knob + t.hInset}px)`;
  const knobLeftOff = `${t.hInset}px`;

  const control = (
    <span className="relative inline-flex shrink-0">
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        checked={checkedProp}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={(e) => { if (!isControlled) setInternal(e.target.checked); onChange?.(e); }}
        className="peer absolute inset-0 z-10 h-full w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        {...rest}
      />

      {showText ? (
        <span
          aria-hidden
          className={cn(
            'relative inline-flex items-center rounded-full overflow-hidden',
            'transition-[background-color,border-color] duration-300',
            checked
              ? 'bg-primary-600 border border-transparent'
              : 'bg-transparent border-[1.5px] border-primary-300',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-200 peer-focus-visible:ring-offset-1',
          )}
          style={{ height: t.height }}
        >
          {/* Ghost â€” sets the track's intrinsic width */}
          <span
            className={cn('invisible font-semibold uppercase tracking-wide whitespace-nowrap', t.font)}
            style={{ paddingLeft: t.textPad, paddingRight: ghostPaddingRight }}
          >
            {longer}
          </span>

          {/* ON label â€” fills the LEFT half (everything except the knob area) */}
          <span
            className="absolute flex items-center justify-center transition-opacity duration-300 pointer-events-none"
            style={{
              top: 0, bottom: 0,
              left: 0,
              right: halfRightOffset,
              opacity: checked ? 1 : 0,
            }}
          >
            <span className={cn('font-semibold uppercase tracking-wide whitespace-nowrap text-white', t.font)}>
              {onLabel}
            </span>
          </span>

          {/* OFF label â€” fills the RIGHT half (everything except the knob area) */}
          <span
            className="absolute flex items-center justify-center transition-opacity duration-300 pointer-events-none"
            style={{
              top: 0, bottom: 0,
              left: halfLeftOffset,
              right: 0,
              opacity: checked ? 0 : 1,
            }}
          >
            <span className={cn('font-semibold uppercase tracking-wide whitespace-nowrap text-primary-700', t.font)}>
              {offLabel}
            </span>
          </span>

          {/* Sliding knob â€” vertically centered, slides horizontally */}
          <span
            className="absolute rounded-full shadow-sm transition-[left,background-color] duration-300"
            style={{
              width:     t.knob,
              height:    t.knob,
              top:       '50%',
              transform: 'translateY(-50%)',
              left:      checked ? knobLeftOn : knobLeftOff,
              background: checked ? '#fff' : 'var(--color-primary-500)',
            }}
          />
        </span>
      ) : (
        /* sm â€” switch only, no label inside */
        <span
          aria-hidden
          className={cn(
            'relative inline-flex items-center rounded-full',
            'transition-[background-color] duration-300',
            checked ? 'bg-primary-600' : 'bg-neutral-300',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-200 peer-focus-visible:ring-offset-1',
          )}
          style={{ height: t.height, width: 36 }}
        >
          <span
            className="absolute rounded-full bg-white shadow-sm transition-[left] duration-300"
            style={{
              width: t.knob,
              height: t.knob,
              top: '50%',
              transform: 'translateY(-50%)',
              left: checked ? knobLeftOn : knobLeftOff,
            }}
          />
        </span>
      )}
    </span>
  );

  if (!label && !helper) {
    return (
      <label htmlFor={inputId} data-component="Switch" data-size={size} className={cn('inline-flex', disabled && 'opacity-50 cursor-not-allowed', className)}>
        {control}
      </label>
    );
  }

  const textBlock = (
    <span className="flex flex-col">
      {label && <span className="text-sm text-(--color-text-strong)">{label}</span>}
      {helper && <span className="text-[11.5px] text-(--color-text-muted)">{helper}</span>}
    </span>
  );

  return (
    <label
      htmlFor={inputId}
      data-component="Switch"
      data-size={size}
      className={cn(
        'inline-flex items-center gap-2.5 cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {labelPosition === 'left' && textBlock}
      {control}
      {labelPosition === 'right' && textBlock}
    </label>
  );
});
