import { AuthView } from "@neondatabase/neon-js/auth/react/ui";

export const dynamicParams = false;

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6">
      <AuthView pathname={`/auth/${path}`} />
    </main>
  );
}
