"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTrips, createTrip } from "@/app/actions/trips";
import { toast } from "sonner";
import { Plus, Plane } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Trip {
    id: string;
    title: string | null;
    startDate: string | null;
    endDate: string | null;
}

export function TripsModal({
    isOpen,
    onSelect,
}: {
    isOpen: boolean;
    onSelect: (tripId: string) => void;
}) {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTripName, setNewTripName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadTrips();
        }
    }, [isOpen]);

    async function loadTrips() {
        try {
            setLoading(true);
            const data = await getTrips();
            setTrips(data as Trip[]);
        } catch (error) {
            toast.error("Failed to load trips");
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateTrip(e: React.FormEvent) {
        e.preventDefault();
        if (!newTripName.trim()) return;

        try {
            setIsCreating(true);
            const newTrip = await createTrip(newTripName);
            toast.success("Trip created successfully!");
            onSelect(newTrip.id);
        } catch (error) {
            toast.error("Failed to create trip");
        } finally {
            setIsCreating(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Plane className="w-6 h-6 text-primary" />
                        Your Trips
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-4">
                        <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Create a New Trip
                        </Label>
                        <form onSubmit={handleCreateTrip} className="flex gap-2">
                            <Input
                                placeholder="Summer Vacation 2024"
                                value={newTripName}
                                onChange={(e) => setNewTripName(e.target.value)}
                                className="bg-white/5 border-white/10 focus:border-primary/50"
                            />
                            <Button type="submit" disabled={isCreating || !newTripName.trim()}>
                                {isCreating ? "..." : <Plus className="w-4 h-4" />}
                            </Button>
                        </form>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {trips.length > 0 ? "Select a Trip" : "No trips yet"}
                        </Label>
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {trips.map((trip) => (
                                        <motion.div
                                            key={trip.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-between hover:bg-white/5 border border-transparent hover:border-white/10 group h-auto py-3"
                                                onClick={() => onSelect(trip.id)}
                                            >
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                                        {trip.title || "Untitled Trip"}
                                                    </span>
                                                </div>
                                                <Plane className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                            </Button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
