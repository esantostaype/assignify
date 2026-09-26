// src/lib/utils.ts — cn para componentes shadcn (clsx + tailwind-merge, dedup de
// clases en conflicto). El `cn` de src/lib/cn.ts (sin merge) sigue para el design
// system propio; los componentes de shadcn usan ESTE.
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
