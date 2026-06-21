export function logSafeError(error: unknown): void {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : "Request failed";
  console.error(`${name}: ${message}`);
}
