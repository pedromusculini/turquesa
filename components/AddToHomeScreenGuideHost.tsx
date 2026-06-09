'use client';

import AddToHomeScreenGuide from '@/components/AddToHomeScreenGuide';
import { useAddToHomeScreen } from '@/lib/useAddToHomeScreen';

export default function AddToHomeScreenGuideHost() {
  const { guideOpen, setGuideOpen, iosHint } = useAddToHomeScreen();

  return (
    <AddToHomeScreenGuide
      open={guideOpen}
      iosHint={iosHint}
      onClose={() => setGuideOpen(false)}
    />
  );
}
