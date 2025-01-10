import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

export const metadata: Metadata = {
  title: "crdt editor",
  description: "a simple multiplayer editor",
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`min-h-screen w-screen ${inter.className}`}>
        {/* <SocketProvider> */}
        {children}
        {/* </SocketProvider> */}
      </body>
    </html>
  );
}
