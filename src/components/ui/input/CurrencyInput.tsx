'use client';

import { forwardRef } from 'react';
import { Input, type InputProps } from './Input';

export interface CurrencyInputProps extends Omit<InputProps, 'startAdornment' | 'endAdornment' | 'type'> {
  /** Currency symbol shown on the left (default: `$`). */
  symbol?: string;
  /** Currency code shown on the right (default: `USD`). */
  code?: string;
}

/**
 * Currency-style numeric input matching Form.pdf â€” leading symbol ($),
 * trailing 3-letter code (USD).  Pass `placeholder` like `1,000.00` to
 * show a hint, or `value`/`defaultValue` for a controlled/uncontrolled field.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { symbol = '$', code = 'USD', inputMode = 'decimal', ...rest },
  ref,
) {
  return (
    <Input
      ref={ref}
      type="text"
      inputMode={inputMode}
      startAdornment={<span className="font-semibold text-(--color-text-muted)">{symbol}</span>}
      endAdornment={<span className="font-semibold text-(--color-text-muted)">{code}</span>}
      {...rest}
    />
  );
});
