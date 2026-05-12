const DASHBOARD_PATH = "/dashboard";

type SearchParamsLike =
  | URLSearchParams
  | Readonly<URLSearchParams>
  | { toString(): string }
  | string
  | null
  | undefined;

const toSearchParams = (value?: SearchParamsLike) => {
  if (!value) {
    return new URLSearchParams();
  }

  if (typeof value === "string") {
    return new URLSearchParams(value);
  }

  return new URLSearchParams(value.toString());
};

export const buildDashboardHref = (value?: SearchParamsLike) => {
  const params = toSearchParams(value);
  const query = params.toString();
  return query ? `${DASHBOARD_PATH}?${query}` : DASHBOARD_PATH;
};

export const updateDashboardSearchParams = (
  value: SearchParamsLike,
  mutator: (params: URLSearchParams) => void,
) => {
  const next = toSearchParams(value);
  mutator(next);
  return buildDashboardHref(next);
};

export const withDashboardTrip = (
  value: SearchParamsLike,
  tripId: string | null | undefined,
) =>
  updateDashboardSearchParams(value, (params) => {
    if (tripId) {
      params.set("trip", tripId);
    } else {
      params.delete("trip");
    }
  });
