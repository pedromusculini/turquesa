'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Cadastro por e-mail desativado — use login com Google */
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?acesso=google');
  }, [router]);

  return null;
}
