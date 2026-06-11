import { redirect } from 'next/navigation';
import { PWA_INSTALL_PATH } from '@/lib/constants';

export default function AppRedirectPage() {
  redirect(PWA_INSTALL_PATH);
}
