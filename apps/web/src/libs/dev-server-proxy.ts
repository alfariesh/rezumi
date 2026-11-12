import { RESERVED_SEGMENTS } from "@rezumi/utils/app-paths";

// First path segments that are never a username: the app's own, plus Vite's in development. `.well-known` needs its dot
// escaped; the lookahead takes regex fragments.
const ownSegments = [
	...RESERVED_SEGMENTS.map((segment) => segment.replaceAll(".", "\\.")),
	"assets",
	"src",
	"node_modules",
	"@[a-z-]+",
	"__[^/]*",
].join("|");

// The server's public pages: `/<username>` (resume or portfolio), `/<username>/<slug>` (a resume) and
// `/<username>/work/<slug>` (a portfolio's work page). Query parameters must not turn the homepage or an app route into
// a public-page request; the app's own three-segment routes all start with one of its segments.
export const publicResumeProxyPattern = `^/(?!(?:${ownSegments})(?:/|\\?|$))[^/.?]+(?:/work/[^/.?]+|/[^/.?]+)?/?(?:\\?.*)?$`;
