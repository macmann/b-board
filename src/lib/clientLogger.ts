export function logClient(event: string, data?: any) {
  // Intentionally log only non-sensitive information for QA flows.
  console.info(`[QA] ${event}`, data);
}
