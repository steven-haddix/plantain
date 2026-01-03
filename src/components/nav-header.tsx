"use client";

import { authClient } from "@/lib/auth/client";
import { UserMenu } from "@/components/user-menu";

export function NavHeader() {
    const { data: session, isPending } = authClient.useSession();

    // Don't show header if we're checking session or if user is not logged in
    if (isPending || !session?.session) {
        return null;
    }

    return (
        <header className="flex justify-between items-center px-4 md:px-8 border-b h-14 bg-background/50 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <span className="text-xl font-extrabold tracking-tighter text-primary">
                    Plantain
                </span>

            </div>
            <UserMenu />
        </header>
    );
}
