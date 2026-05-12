// @ts-nocheck
import { describe, expect, test } from "bun:test";
import {
  buildDashboardHref,
  updateDashboardSearchParams,
  withDashboardTrip,
} from "../dashboard-url";

describe("dashboard-url helpers", () => {
  test("builds the bare dashboard path when there are no params", () => {
    expect(buildDashboardHref()).toBe("/dashboard");
    expect(buildDashboardHref(new URLSearchParams())).toBe("/dashboard");
  });

  test("sets the trip param while preserving existing dashboard state", () => {
    const searchParams = new URLSearchParams({
      chat: "team",
      place: "abc123",
    });

    expect(withDashboardTrip(searchParams, "trip_42")).toBe(
      "/dashboard?chat=team&place=abc123&trip=trip_42",
    );
  });

  test("can remove one-time params without disturbing the selected trip", () => {
    const searchParams = new URLSearchParams({
      trip: "trip_42",
      invite: "accepted",
      chat: "team",
    });

    expect(
      updateDashboardSearchParams(searchParams, (params) => {
        params.delete("invite");
      }),
    ).toBe("/dashboard?trip=trip_42&chat=team");
  });
});
