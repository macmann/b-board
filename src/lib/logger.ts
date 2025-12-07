export function logInfo(message: string, meta?: any) {
  if (meta !== undefined) {
    console.log(message, meta);
  } else {
    console.log(message);
  }
}

export function logError(message: string, meta?: any) {
  if (meta !== undefined) {
    console.error(message, meta);
  } else {
    console.error(message);
  }
}
