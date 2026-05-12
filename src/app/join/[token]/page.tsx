import { JoinTripInvite } from "@/components/join-trip-invite";

export default async function JoinTripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <JoinTripInvite token={token} />;
}
