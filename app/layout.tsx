import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amparito · Seguros Colsubsidio",
  description:
    "Amparito: la asistente que te lleva de 'no sé qué seguro necesito' a 'ya quedé asegurado', 24/7 y sin esperas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body>{children}</body>
    </html>
  );
}
