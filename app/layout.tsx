import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amparito · Seguros y asistencias Colsubsidio",
  description:
    "Amparito: la asistente que te lleva de 'no sé qué seguro necesito' a 'ya quedé asegurado', 24/7 y sin esperas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
