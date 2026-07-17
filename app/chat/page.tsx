import SiteHeader from "@/components/SiteHeader";
import Chat from "@/components/Chat";

export default function ChatPage({
  searchParams,
}: {
  searchParams: { interes?: string };
}) {
  return (
    <main>
      <SiteHeader />
      <Chat interes={searchParams?.interes ?? null} />
    </main>
  );
}
