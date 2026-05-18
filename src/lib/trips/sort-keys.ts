export {
  generateKeyBetween,
  generateNKeysBetween,
} from "fractional-indexing";

const SORT_KEY_PATTERN = /^[0-9A-Za-z]+$/;

export function isValidSortKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    SORT_KEY_PATTERN.test(value)
  );
}
