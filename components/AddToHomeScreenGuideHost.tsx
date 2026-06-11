'use client';

import AddToHomeScreenGuide from '@/components/AddToHomeScreenGuide';
import { useAddToHomeScreen } from '@/lib/useAddToHomeScreen';

export default function AddToHomeScreenGuideHost() {
  const { guideOpen, setGuideOpen, iosHint, dismiss } = useAddToHomeScreen();

  return (
    <AddToHomeScreenGuide
      open={guideOpen}
      iosHint={iosHint}
      onClose={() => setGuideOpen(false)}
      onDismiss={dismiss}
    />
  );
}
