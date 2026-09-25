'use client';

import { MessageCircle } from 'lucide-react';
import { supportWhatsAppUrl } from '@/lib/legal';

type Props = {
  message: string;
  label?: string;
  variant?: 'solid' | 'outline' | 'floating';
  className?: string;
};

export default function WhatsAppConsultorButton({
  message,
  label = 'Falar com um consultor',
  variant = 'outline',
  className = '',
}: Props) {
  const href = supportWhatsAppUrl(message);
  if (!href) return null;

  if (variant === 'floating') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={`fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#1ebe5a] ${className}`}
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
        <span className="hidden sm:inline">{label}</span>
      </a>
    );
  }

  const base =
    'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition';
  const styles =
    variant === 'solid'
      ? 'bg-[#25D366] text-white hover:bg-[#1ebe5a]'
      : 'border border-[#25D366]/50 bg-white text-[#128C7E] hover:bg-[#25D366]/10';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${styles} ${className}`}
    >
      <MessageCircle className="h-5 w-5" aria-hidden />
      {label}
    </a>
  );
}
