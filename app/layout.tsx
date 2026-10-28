import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Duet · find the songs you both love, decades apart",
  description:
    "An agent for families living with dementia. Duet uses Qloo's taste graph to rebuild the music, films and food of a loved one's teens and twenties, finds where your taste and theirs meet, and guides a gentle session you share.",
  openGraph: {
    title: "Duet",
    description: "Two eras, one song. A reminiscence agent that finds the common ground between generations, powered by Qloo.",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5eee2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
