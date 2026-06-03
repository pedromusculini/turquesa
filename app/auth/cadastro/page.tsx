'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CadastroPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?acesso=google');
  }, [router]);

  return null;
}
