'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginRegisterRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?acesso=google');
  }, [router]);

  return null;
}
