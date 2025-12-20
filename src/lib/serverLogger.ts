export function logServer(requestId: string, event: string, data?: any) {
  console.info(
    JSON.stringify({
      area: "QA",
      requestId,
      event,
      ...(data ?? {}),
    })
  );
}
