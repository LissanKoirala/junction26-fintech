declare namespace Cloudflare {
  interface Env {
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    GEMINI_IMPORT_MODEL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
