// src/app/page.tsx - Página raíz que redirige
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';
import { Typography } from '@/components/ui';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir automáticamente a /tasks
    console.log('🏠 Root page: Redirecting to /tasks...');
    router.replace('/tasks');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Spinner size={36} />
      <Typography variant="body" color="neutral-500">
        Redirigiendo...
      </Typography>
    </div>
  );
}
