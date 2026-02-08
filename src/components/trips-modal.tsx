"use client";

import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronsUpDown,
  Loader2,
  MapPin,
  Pencil,
  Plane,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import {
  createTrip,
  getTrips,
  searchPlaces,
  updateTrip,
} from "@/app/actions/trips";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { GeocodingResult } from "@/lib/geocoding/types";
import { cn } from "@/lib/utils";

interface Trip {
  id: string;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  destinationLocation?: { latitude: number; longitude: number } | null;
}

// ... existing TripsModal component ...

function LocationSearch({
  onSelect,
  defaultValue,
}: {
  onSelect: (location: { latitude: number; longitude: number } | null) => void;
  defaultValue?: { latitude: number; longitude: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState("");

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchPlaces(query);
        setResults(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white/5 border-white/10 hover:bg-white/10"
        >
          {selectedName ||
            (defaultValue ? "Location set" : "Select location...")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-100 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search for a city..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />{" "}
                Searching...
              </div>
            )}
            {!loading && results.length === 0 && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            <CommandGroup>
              {results.map((result, index) => (
                <CommandItem
                  key={`${result.placeId ?? result.formattedAddress ?? result.query}-${index}`}
                  value={result.formattedAddress ?? result.query}
                  onSelect={() => {
                    onSelect({
                      latitude: result.latitude,
                      longitude: result.longitude,
                    });
                    setSelectedName(
                      result.city || result.formattedAddress || result.query,
                    );
                    setOpen(false);
                  }}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  <span>{result.formattedAddress ?? result.query}</span>
                  {/* <Check
                                        className={cn(
                                            "ml-auto h-4 w-4",
                                            value === framework.value ? "opacity-100" : "opacity-0"
                                        )}
                                    /> */}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [newTripName, setNewTripName] = useState("");
  const [newTripDate, setNewTripDate] = useState<DateRange | undefined>();
  const [newTripLocation, setNewTripLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Editing state
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState<DateRange | undefined>();
  const [editLocation, setEditLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const hasTrips = trips.length > 0;

  const loadTrips = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTrips();
      setTrips(data as Trip[]);
    } catch (_error) {
      toast.error("Failed to load trips");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setEditingTripId(null);
      setIsCreateMode(false);
      loadTrips();
    }
  }, [isOpen, loadTrips]);

  async function handleCreateTrip() {
    if (!newTripName.trim()) return;

    try {
      setIsCreating(true);
      const newTrip = await createTrip(
        newTripName,
        newTripDate?.from,
        newTripDate?.to,
        newTripLocation || undefined,
      );
      toast.success("Trip created successfully!");
      setNewTripName("");
      setNewTripDate(undefined);
      setNewTripLocation(null);
      onSelect(newTrip);
    } catch (_error) {
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
        destination: editLocation,
      });

      toast.success("Trip updated successfully!");
      setEditingTripId(null);
      loadTrips(); // Reload to get updated data
    } catch (_error) {
      toast.error("Failed to update trip");
    } finally {
      setIsUpdating(false);
    }
  }

  function startEditing(trip: Trip) {
    setEditingTripId(trip.id);
    setEditName(trip.title || "");
    setEditComponentDate(trip.startDate, trip.endDate);
    setEditLocation(trip.destinationLocation || null);
  }

  function setEditComponentDate(start: string | null, end: string | null) {
    setEditDate({
      from: start ? new Date(start) : undefined,
      to: end ? new Date(end) : undefined,
    });
  }

  const showCreateMode =
    !editingTripId && !loading && (!hasTrips || isCreateMode);
  const modalTitle = editingTripId
    ? "Edit Trip"
    : showCreateMode
      ? hasTrips
        ? "New Trip"
        : "Create Your First Trip"
      : "Your Trips";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl border-white/10">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
            {editingTripId ? (
              <>
                <Pencil className="w-6 h-6 text-primary" />
                {modalTitle}
              </>
            ) : (
              <>
                <Plane className="w-6 h-6 text-primary" />
                {modalTitle}
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
                    <Label
                      htmlFor="edit-name"
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
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
                      Location
                    </Label>
                    <LocationSearch
                      onSelect={setEditLocation}
                      defaultValue={editLocation}
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
                            !editDate && "text-muted-foreground",
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
            ) : loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex justify-center py-12"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </motion.div>
            ) : showCreateMode ? (
              <motion.div
                key="create"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {hasTrips
                        ? "Create a New Trip"
                        : "Create your first trip"}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {hasTrips
                        ? "Add another trip to your workspace."
                        : "Start planning by adding your first trip."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Input
                      placeholder="Summer Vacation 2024"
                      value={newTripName}
                      onChange={(e) => setNewTripName(e.target.value)}
                      className="bg-white/5 border-white/10 focus:border-primary/50"
                    />
                    <LocationSearch
                      onSelect={setNewTripLocation}
                      defaultValue={newTripLocation}
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-white/5 border-white/10 hover:bg-white/10 overflow-hidden",
                            !newTripDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {newTripDate?.from ? (
                              newTripDate.to ? (
                                <>
                                  {format(newTripDate.from, "LLL dd")} -{" "}
                                  {format(newTripDate.to, "LLL dd")}
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
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {hasTrips && (
                    <Button
                      variant="ghost"
                      onClick={() => setIsCreateMode(false)}
                      className="flex-1 hover:bg-white/5 border border-white/10"
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    onClick={handleCreateTrip}
                    disabled={isCreating || !newTripName.trim()}
                    className="flex-1"
                  >
                    {isCreating ? "Creating..." : "Create Trip"}
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
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Select a trip or edit details.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setIsCreateMode(true)}
                    className="h-8 px-3"
                  >
                    New Trip
                  </Button>
                </div>

                <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1 -mr-1 custom-scrollbar">
                  {trips.map((trip) => (
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
                          <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                            {(trip.startDate || trip.endDate) && (
                              <>
                                <CalendarIcon className="w-3 h-3" />
                                {trip.startDate &&
                                  format(new Date(trip.startDate), "LLL dd")}
                                {trip.endDate &&
                                  ` - ${format(new Date(trip.endDate), "LLL dd, yyyy")}`}
                              </>
                            )}
                            {trip.destinationLocation && (
                              <>
                                <div className="w-px h-3 bg-white/20 mx-1" />
                                <MapPin className="w-3 h-3" />
                                Location Set
                              </>
                            )}
                          </div>
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
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
