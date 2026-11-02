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

// Query parameters must not turn the homepage or an app route into a public-resume request.
export const publicResumeProxyPattern = `^/(?!(?:${ownSegments})(?:/|\\?|$))[^/.?]+(?:/[^/.?]+)?/?(?:\\?.*)?$`;
