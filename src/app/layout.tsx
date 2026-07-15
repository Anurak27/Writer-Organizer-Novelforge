import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovelForge — Personal Writing Studio",
  description: "A personal, cloud-based creative writing workspace for novelists.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📖</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-zinc-950 text-zinc-100 overflow-hidden">
        {children}
      </body>
    </html>
  );
}