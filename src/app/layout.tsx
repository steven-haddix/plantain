import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { NeonAuthUIProvider } from "@neondatabase/neon-js/auth/react/ui";
import { NavHeader } from "@/components/nav-header";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth/client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flexi — AI Workout Companion",
  description: "Gym scanner and personalized workout generator",
};

import { UserSync } from "@/components/user-sync";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <NeonAuthUIProvider
          authClient={authClient}
          redirectTo="/dashboard"
          credentials={false}
          magicLink={true}
          emailOTP={true}
          social={{ providers: ["google"] }}
        >
          <UserSync />
          <div className="flex flex-col min-h-screen">
            <NavHeader />
            <main className="flex-1 flex flex-col">
              {children}
            </main>
          </div>
        </NeonAuthUIProvider>
        <Toaster />
      </body>
    </html>
  );
}
