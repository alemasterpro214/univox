export function isDebugMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("unyvox-debug-mode") === "true";
}

export function debugLog(...args: any[]) {
  if (isDebugMode()) {
    // eslint-disable-next-line no-console
    console.log("[Unyvox Debug]", ...args);
  }
}

export function debugError(...args: any[]) {
  if (isDebugMode()) {
    // eslint-disable-next-line no-console
    console.error("[Unyvox Debug]", ...args);
  }
}
