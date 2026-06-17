'use client';

import { forwardRef } from 'react';
import { Input, type InputProps } from './Input';
import { Icon, PiMagnifyingGlass } from '@/lib/icons';

export interface SearchInputProps extends Omit<InputProps, 'startAdornment' | 'type'> {}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { placeholder = 'Search…', ...rest }, ref,
) {
  return (
    <Input
      ref={ref}
      type="search"
      placeholder={placeholder}
      startAdornment={<Icon icon={PiMagnifyingGlass} size={16} />}
      {...rest}
    />
  );
});
