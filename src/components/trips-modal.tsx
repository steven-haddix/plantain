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
import { getTrips, createTrip, updateTrip } from "@/app/actions/trips";
import { toast } from "sonner";
import { Plus, Plane, Calendar as CalendarIcon, Pencil, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface Trip {
    id: string;
    title: string | null;
    startDate: string | null;
    endDate: string | null;
}

export function TripsModal({
    isOpen,
    onOpenChange,
    onSelect,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (trip: Trip) => void;
}) {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTripName, setNewTripName] = useState("");
    const [newTripDate, setNewTripDate] = useState<DateRange | undefined>();
    const [isCreating, setIsCreating] = useState(false);

    // Editing state
    const [editingTripId, setEditingTripId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editDate, setEditDate] = useState<DateRange | undefined>();
    const [isUpdating, setIsUpdating] = useState(false);

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
            const newTrip = await createTrip(
                newTripName,
                newTripDate?.from,
                newTripDate?.to
            );
            toast.success("Trip created successfully!");
            setNewTripName("");
            setNewTripDate(undefined);
            onSelect(newTrip);
        } catch (error) {
            toast.error("Failed to create trip");
        } finally {
            setIsCreating(false);
        }
    }

    async function handleUpdateTrip(tripId: string) {
        if (!editName.trim()) return;

        try {
            setIsUpdating(true);
            await updateTrip(tripId, {
                title: editName,
                startDate: editDate?.from || null,
                endDate: editDate?.to || null,
            });

            toast.success("Trip updated successfully!");
            setEditingTripId(null);
            loadTrips(); // Reload to get updated data
        } catch (error) {
            toast.error("Failed to update trip");
        } finally {
            setIsUpdating(false);
        }
    }

    function startEditing(trip: Trip) {
        setEditingTripId(trip.id);
        setEditName(trip.title || "");
        setEditDate({
            from: trip.startDate ? new Date(trip.startDate) : undefined,
            to: trip.endDate ? new Date(trip.endDate) : undefined,
        });
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        {editingTripId ? (
                            <>
                                <Pencil className="w-6 h-6 text-primary" />
                                Edit Trip
                            </>
                        ) : (
                            <>
                                <Plane className="w-6 h-6 text-primary" />
                                Your Trips
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    <AnimatePresence mode="wait">
                        {editingTripId ? (
                            <motion.div
                                key="edit"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Trip name
                                        </Label>
                                        <Input
                                            id="edit-name"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="bg-white/5 border-white/10 focus:border-primary/50"
                                            placeholder="Trip name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Dates
                                        </Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal bg-white/5 border-white/10 hover:bg-white/10",
                                                        !editDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {editDate?.from ? (
                                                        editDate.to ? (
                                                            <>
                                                                {format(editDate.from, "LLL dd, y")} -{" "}
                                                                {format(editDate.to, "LLL dd, y")}
                                                            </>
                                                        ) : (
                                                            format(editDate.from, "LLL dd, y")
                                                        )
                                                    ) : (
                                                        <span>Pick dates</span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    initialFocus
                                                    mode="range"
                                                    defaultMonth={editDate?.from}
                                                    selected={editDate}
                                                    onSelect={setEditDate}
                                                    numberOfMonths={2}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setEditingTripId(null)}
                                        className="flex-1 hover:bg-white/5 border border-white/10"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => handleUpdateTrip(editingTripId)}
                                        disabled={isUpdating || !editName.trim()}
                                        className="flex-1"
                                    >
                                        {isUpdating ? "Saving..." : "Save Changes"}
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="list"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                <div className="space-y-4">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Create a New Trip
                                    </Label>
                                    <div className="flex flex-col gap-2">
                                        <Input
                                            placeholder="Summer Vacation 2024"
                                            value={newTripName}
                                            onChange={(e) => setNewTripName(e.target.value)}
                                            className="bg-white/5 border-white/10 focus:border-primary/50"
                                        />
                                        <div className="flex gap-2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className={cn(
                                                            "flex-1 justify-start text-left font-normal bg-white/5 border-white/10 hover:bg-white/10 overflow-hidden",
                                                            !newTripDate && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                                        <span className="truncate">
                                                            {newTripDate?.from ? (
                                                                newTripDate.to ? (
                                                                    <>
                                                                        {format(newTripDate.from, "LLL dd")} - {format(newTripDate.to, "LLL dd")}
                                                                    </>
                                                                ) : (
                                                                    format(newTripDate.from, "LLL dd")
                                                                )
                                                            ) : (
                                                                "Pick dates"
                                                            )}
                                                        </span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        initialFocus
                                                        mode="range"
                                                        defaultMonth={newTripDate?.from}
                                                        selected={newTripDate}
                                                        onSelect={setNewTripDate}
                                                        numberOfMonths={2}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <Button
                                                onClick={handleCreateTrip}
                                                disabled={isCreating || !newTripName.trim()}
                                                className="shrink-0 px-4"
                                            >
                                                {isCreating ? (
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                                                ) : (
                                                    "Create"
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {trips.length > 0 ? "Your Trips" : "No trips yet"}
                                    </Label>
                                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 -mr-1 custom-scrollbar">
                                        {loading ? (
                                            <div className="flex justify-center py-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                            </div>
                                        ) : (
                                            trips.map((trip) => (
                                                <motion.div
                                                    key={trip.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="group relative"
                                                >
                                                    <Button
                                                        variant="ghost"
                                                        className="w-full justify-between hover:bg-white/5 border border-white/5 hover:border-white/10 group h-auto py-3 pr-10"
                                                        onClick={() => onSelect(trip)}
                                                    >
                                                        <div className="flex flex-col items-start gap-1">
                                                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                                                {trip.title || "Untitled Trip"}
                                                            </span>
                                                            {(trip.startDate || trip.endDate) && (
                                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    <CalendarIcon className="w-3 h-3" />
                                                                    {trip.startDate && format(new Date(trip.startDate), "LLL dd")}
                                                                    {trip.endDate && ` - ${format(new Date(trip.endDate), "LLL dd, yyyy")}`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 hover:bg-white/10 hover:text-primary"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            startEditing(trip);
                                                        }}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                </motion.div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    );
}