import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import '@/lib/auth-interceptor';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SI-FMRP - Controle de Estoque",
  description: "Sistema de controle e gerenciamento SI-FMRP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="bg-gray-50">
      <body
        className={`${inter.variable} font-sans antialiased bg-gray-50`}
      >
        <Header />
        {children}
      </body>
    </html>
  );
}
