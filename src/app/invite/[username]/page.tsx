import InviteClientPage from "./InviteClientPage";

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { username } = await params;
  return <InviteClientPage username={username} />;
}
