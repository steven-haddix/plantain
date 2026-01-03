"use client";

import { authClient } from "@/lib/auth/client";
import { useAppStore } from "@/lib/store";
import { TripsModal } from "@/components/trips-modal";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, MapPin } from "lucide-react";
import { useState } from "react";

export function NavHeader() {
    const { data: session, isPending } = authClient.useSession();
    const activeTrip = useAppStore((state) => state.activeTrip);
    const setActiveTrip = useAppStore((state) => state.setActiveTrip);
    const [isTripsModalOpen, setIsTripsModalOpen] = useState(false);

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
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    className="flex items-center gap-2 text-sm font-medium hover:bg-muted/50"
                    onClick={() => setIsTripsModalOpen(true)}
                >
                    <MapPin className="h-4 w-4" />
                    {activeTrip ? (activeTrip.title || "Untitled Trip") : "Select Trip"}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
                <UserMenu />
            </div>

            <TripsModal
                isOpen={isTripsModalOpen}
                onSelect={(trip) => {
                    setActiveTrip(trip);
                    setIsTripsModalOpen(false);
                }}
            />
        </header>
    );
}
