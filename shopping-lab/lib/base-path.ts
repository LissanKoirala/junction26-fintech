// Optional sub-path hosting: build with NEXT_PUBLIC_BASE_PATH=/lab to serve the demo under /lab/ (next.config.ts
// sets the framework basePath from the same variable). Unset, every URL stays root-relative exactly as before.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const withBase = (url: string) => (BASE_PATH && url.startsWith("/") && !url.startsWith("//") ? BASE_PATH + url : url);
