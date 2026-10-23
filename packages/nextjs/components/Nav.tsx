import Link from 'next/link';

export function Nav() {
  return (
    <nav>
      <strong style={{ marginRight: '1rem' }}>Nodeling</strong>
      <Link href="/start">Start</Link>
      <Link href="/">Mint pad</Link>
      <Link href="/verify">Verify</Link>
      <Link href="/allowlist">Allowlist</Link>
      <Link href="/about">About</Link>
    </nav>
  );
}
