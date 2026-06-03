'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import CatalogoServicosClient from '@/components/CatalogoServicosClient';

export default function CatalogoPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#228B22]"
        >
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
      </div>
      <CatalogoServicosClient />
    </div>
  );
}
