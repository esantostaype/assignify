// src/app/page.tsx - Root page that redirects
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';
import { Typography } from '@/components/ui';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to /tasks
    router.replace('/tasks');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Spinner size={36} />
      <Typography variant="body" color="neutral-500">
        Redirecting...
      </Typography>
    </div>
  );
}
