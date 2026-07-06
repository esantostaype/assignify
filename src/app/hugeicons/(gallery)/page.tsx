import { Suspense } from 'react'
import { HugeiconsBrowser } from '@/components/hugeicons/HugeiconsBrowser'

// `HugeiconsBrowser` calls `useSearchParams()` (tab/search/open-icon all
// round-trip through the URL) — Next requires a Suspense boundary around
// that so the rest of the route shell isn't forced dynamic too.
export default function HugeiconsPage() {
  return (
    <Suspense fallback={null}>
      <HugeiconsBrowser />
    </Suspense>
  )
}
