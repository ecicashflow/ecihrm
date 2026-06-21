import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
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
  title: "ECI Pvt Ltd - HRM Performance Appraisal System",
  description: "Performance Appraisal and Career Growth Management System for ECI Pvt Ltd",
  icons: {
    icon: "/eci-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Catch unhandled promise rejections silently to prevent raw JSON errors
              window.addEventListener('unhandledrejection', function(event) {
                console.warn('[Global] Unhandled promise rejection caught:', event.reason);
                event.preventDefault();
              });
              // Intercept fetch errors globally
              const originalFetch = window.fetch;
              window.fetch = function(...args) {
                return originalFetch.apply(this, args).catch(function(err) {
                  console.warn('[Global] Fetch error intercepted:', err);
                  throw err;
                });
              };
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}