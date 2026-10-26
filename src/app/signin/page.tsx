import type { Metadata } from 'next';
import { SignInClient } from './SignInClient';

export const metadata: Metadata = { title: 'Sign in · Neighbr' };

export default function Page() {
  return <SignInClient />;
}
