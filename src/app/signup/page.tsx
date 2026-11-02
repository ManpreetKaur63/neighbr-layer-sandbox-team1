import type { Metadata } from 'next';
import { SignUpClient } from './SignUpClient';

export const metadata: Metadata = { title: 'Sign up · Neighbr' };

export default function Page() {
  return <SignUpClient />;
}
