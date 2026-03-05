import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Flyhigh.tv",
  description: "Wakeboard films streaming"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" data-header-theme="light">
      <body>{children}</body>
    </html>
  );
}
