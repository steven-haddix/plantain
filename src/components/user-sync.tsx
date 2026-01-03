"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { syncUser } from "@/app/actions/auth";

export function UserSync() {
    const { data: session } = authClient.useSession();

    useEffect(() => {
        if (session?.user) {
            syncUser();
        }
    }, [session]);

    return null;
}
