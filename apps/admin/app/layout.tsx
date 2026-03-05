import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Flyhigh Admin",
  description: "Flyhigh.tv content and subscription management"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

