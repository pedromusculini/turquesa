'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_LEMBRETES_SETTINGS_UI,
  type LembretesSettingsUi,
} from '@/lib/lembretesCopy';

export function useLembretesSettings(): LembretesSettingsUi {
  const [settings, setSettings] = useState<LembretesSettingsUi>(
    DEFAULT_LEMBRETES_SETTINGS_UI,
  );

  useEffect(() => {
    fetch('/api/perfil/mensagens-whatsapp')
      .then((r) => r.json())
      .then((d) => {
        if (d.lembretesSettings) {
          setSettings({ ...DEFAULT_LEMBRETES_SETTINGS_UI, ...d.lembretesSettings });
        }
      })
      .catch(() => {});
  }, []);

  return settings;
}
