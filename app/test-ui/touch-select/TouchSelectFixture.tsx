'use client';

import { useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import MultiSelect from '@/components/MultiSelect';

const OPTIONS = [
  { value: 'a', label: 'Opção A' },
  { value: 'b', label: 'Opção B' },
  { value: 'c', label: 'Opção C' },
];

export default function TouchSelectFixture() {
  const [single, setSingle] = useState('');
  const [multi, setMulti] = useState<string[]>([]);

  return (
    <main className="min-h-dvh p-6 space-y-8 max-w-md mx-auto">
      <h1 className="text-lg font-semibold text-gray-900">Touch select fixture</h1>

      <SearchableSelect
        label="Searchable"
        options={OPTIONS}
        value={single}
        onChange={setSingle}
        placeholder="Selecionar..."
        dropdownMode="fixed"
      />

      <MultiSelect
        label="Multi"
        options={OPTIONS}
        selected={multi}
        onChange={setMulti}
        placeholder="Selecionar..."
      />
    </main>
  );
}
