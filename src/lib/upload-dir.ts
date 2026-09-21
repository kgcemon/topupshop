import path from "path";

// Deliberately kept outside `public/`: in production `next start` snapshots the
// public directory's file list once at boot (for its static-file route check), so
// files written here at runtime would 404 until the process restarts. Serving
// through the app/uploads route handler instead reads the file fresh on every
// request. See src/app/uploads/[filename]/route.ts.
//
// Lives in its own module (not upload.ts) so that route handler doesn't drag in
// `sharp`. Next's image optimizer ships its own copy of sharp, and the first
// thing it does for an /uploads/* image is fetch it through that handler —
// loading a second libvips into the process broke the optimizer on Windows
// (GLib type-registry clash), which made it silently fall back to serving the
// original full-size file.
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
