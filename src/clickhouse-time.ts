export function toClickHouseDateTime64(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid date");
  }
  return date.toISOString().replace("T", " ").replace("Z", "");
}
