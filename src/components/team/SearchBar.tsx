import React from 'react';
import { Input } from '@/components/ui';
import { Icon, PiMagnifyingGlass } from '@/lib/icons';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search by Name or Email...",
  className = ''
}) => {
  return (
    <div className={`relative ${className}`}>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        startAdornment={<Icon icon={PiMagnifyingGlass} size={16} />}
        size="sm"
        fullWidth
      />
    </div>
  );
};
