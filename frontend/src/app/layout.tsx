import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Super Tutor",
  description: "Turn any article into a complete study session",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://oat.ink/oat.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
