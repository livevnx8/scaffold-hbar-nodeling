import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Nodeling — Hashinal authenticity + NFT mint pad',
  description:
    "Vera Labs' Nodeling: prepare Hashinal collections, authenticity receipts, and allowlists offline. List on SentX / HashPack.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
