import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Filipino Basketball Manager',
  description: 'Manage your Filipino basketball franchise.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23f97316' stroke='%2318181b' stroke-width='4'/><line x1='5' y1='50' x2='95' y2='50' stroke='%2318181b' stroke-width='4'/><line x1='50' y1='5' x2='50' y2='95' stroke='%2318181b' stroke-width='4'/><path d='M 17 25 C 38 35, 38 65, 17 75' fill='none' stroke='%2318181b' stroke-width='4'/><path d='M 83 25 C 62 35, 62 65, 83 75' fill='none' stroke='%2318181b' stroke-width='4'/></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
