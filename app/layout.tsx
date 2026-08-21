import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { AuthProvider } from "@/components/AuthProvider";
import AgentBanner from "@/components/AgentBanner";
import Tracker from "@/components/Tracker";

export const metadata: Metadata = {
  title: "Sign Calculators — Banner · Neon Line · 3D Box Up",
  description:
    "Unified calculator suite for inkjet banners, neon line signage, and 3D LED box-up letters.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <CartProvider>
            <Tracker />
            <AgentBanner />
            {children}
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
