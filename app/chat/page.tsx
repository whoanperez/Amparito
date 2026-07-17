import Link from "next/link";
import Chat from "@/components/Chat";

export default function ChatPage() {
  return (
    <main>
      <header className="header">
        <Link href="/" className="logo">
          <span className="logo-mark" />
          Colsubsidio
        </Link>
        <nav className="header-nav">
          <span>Subsidios</span>
          <span>Salud</span>
          <span>Vivienda</span>
          <span className="active">Seguros</span>
          <span>Créditos</span>
        </nav>
      </header>
      <Chat />
    </main>
  );
}
