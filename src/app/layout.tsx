import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const jet = JetBrains_Mono({ variable: "--font-jet", subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "Racha · divide a conta e gera o Pix de cada um",
  description:
    "Monte a comanda, divida por item ou igual, com 10% de serviço, e mande no grupo: cada pessoa abre o link e paga o próprio QR Code Pix. Sem cadastro.",
  applicationName: "Racha",
};

export const viewport: Viewport = { themeColor: "#f3ede1", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${jet.variable} antialiased`}>
      <body className="min-h-screen overflow-x-hidden font-sans">{children}</body>
    </html>
  );
}
