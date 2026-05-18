import type { Metadata } from "next";
import { Providers } from "@/shared/lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enterprise LMS",
  description: "AI-powered Learning Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
