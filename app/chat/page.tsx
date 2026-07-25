import SiteHeader from "@/components/SiteHeader";
import Chat from "@/components/Chat";

export default function ChatPage({
  searchParams,
}: {
  searchParams: { interes?: string; evento?: string; offline?: string; jurado?: string };
}) {
  const offline = searchParams?.offline === "1" || searchParams?.offline === "true";
  // El atajo del jurado va detrás de una URL: la pantalla por defecto no confiesa que es un demo.
  const jurado = searchParams?.jurado === "1" || searchParams?.jurado === "true";
  return (
    <main>
      <SiteHeader />
      <Chat interes={searchParams?.interes ?? null} evento={searchParams?.evento ?? null} offline={offline} jurado={jurado} />
    </main>
  );
}
