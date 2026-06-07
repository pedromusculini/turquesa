'use client';

import { useEffect, useState } from 'react';

function queryMatches(breakpoint: number): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
}

/** true quando a largura da tela é menor que breakpoint (px). */
export function useMediaQuery(breakpoint = 768): boolean {
  const [matches, setMatches] = useState(() => queryMatches(breakpoint));

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return matches;
}
