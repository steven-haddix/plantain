export type TripActionEvent = {
  type: "trip.action";
  signal: {
    entity: "saved_location" | "trip" | "note";
    action: "create" | "update" | "delete";
    id: string;
  };
  feedItem?: {
    id: string;
    message: string;
    actor: { name: string; avatarUrl: string };
    timestamp: Date;
  };
  data?: unknown;
};

export type RealtimeChannel = {
  publish: (eventName: string, payload: TripActionEvent) => Promise<unknown> | void;
};

export type RealtimeClient = {
  channels: {
    get: (name: string) => RealtimeChannel;
  };
};

export async function publishTripActionEvent(
  realtime: RealtimeClient,
  tripId: string,
  event: TripActionEvent,
) {
  await realtime.channels.get(`trip:${tripId}`).publish(event.type, event);
}
