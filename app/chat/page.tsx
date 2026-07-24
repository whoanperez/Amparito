import SiteHeader from "@/components/SiteHeader";
import Chat from "@/components/Chat";

export default function ChatPage({
  searchParams,
}: {
  searchParams: { interes?: string; evento?: string; offline?: string };
}) {
  const offline = searchParams?.offline === "1" || searchParams?.offline === "true";
  return (
    <main>
      <SiteHeader />
      <Chat interes={searchParams?.interes ?? null} evento={searchParams?.evento ?? null} offline={offline} />
    </main>
  );
}
