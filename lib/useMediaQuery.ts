'use client';

import { useEffect, useState } from 'react';

/** true quando a largura da tela é menor que breakpoint (px). */
export function useMediaQuery(breakpoint = 768): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return matches;
}
