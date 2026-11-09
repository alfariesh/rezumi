import { createHash } from "node:crypto";
import { basename, normalize } from "node:path";
import { getStorageService, inferContentType, isPublicUploadOwner } from "@rezumi/api/features/storage";
import { matchesIfNoneMatch } from "@rezumi/utils/http";

// Uploads share the app origin and S3/Blob hand back the client-declared type, so only raster
// images render inline. Anything else (HTML, SVG, PDF, unknown) downloads, whatever was stored.
const INLINE_CONTENT_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);
// Uploaded fonts are public too, so shared resumes draw with them; they're served as fonts, never inline documents.
const PUBLIC_FONT_CONTENT_TYPES = new Set(["font/ttf", "font/otf"]);
// Short enough that a deleted picture, or one whose owner was banned, leaves shared caches within the hour.
const PUBLIC_PICTURE_CACHE_CONTROL = "public, max-age=3600";
/**
 * A portfolio's own files (`02-teknis.md` section 30): its pictures, and its PDFs (`portfolio.uploadPdf`, which checks
 * the bytes are a PDF). Anyone may load one only while the published portfolio uses it (`isPublicPortfolioFile`);
 * until then, and after, only its owner can, for the editor and its preview.
 */
// Any case: local storage on a case-insensitive disk would read `pictures/Portfolio/…` as the same file.
const PORTFOLIO_FILE_PATH = /^(?:pictures|documents)\/portfolio\//i;
const PORTFOLIO_PICTURE_PATH = /^pictures\/portfolio\/[\w-]+\.(?:webp|jpe?g|png)$/;
// PDFs are locked down: shown by the browser's PDF viewer, never sniffed into another type, and sandboxed so nothing
// in them runs with the app's origin. The address carries no title, so every one is named document.pdf.
const PUBLIC_PDF_PATH = /^documents\/portfolio\/[\w-]+\.pdf$/;
const PDF_CONTENT_TYPE = "application/pdf";
// The owner's own copy of a file not public yet: their browser may keep it (the editor's preview redraws often), no
// shared cache may. Keys are never reused, so a kept copy is never stale.
const OWNER_PORTFOLIO_FILE_CACHE_CONTROL = "private, max-age=3600";

const notFound = () => new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Whether the request is the signed-in owner of `userId`'s files (a session, API key or token that may read). */
async function isOwnerRequest(request: Request, userId: string): Promise<boolean> {
	const { resolveAuthenticationFromRequestHeaders } = await import("@rezumi/api/context");
	const authentication = await resolveAuthenticationFromRequestHeaders(request.headers).catch(() => null);
	return authentication?.user.id === userId && authentication.permissions.includes("read");
}

/**
 * Whether the request may read a portfolio's files privately: their owner (for the editor and its preview), or an
 * administrator's web session (for the review page, including a portfolio that's taken down).
 */
async function canReadPortfolioFiles(request: Request, userId: string): Promise<boolean> {
	const [{ resolveAuthenticationFromRequestHeaders }, { assertAdminSession }] = await Promise.all([
		import("@rezumi/api/context"),
		import("@rezumi/api/features/auth/admin-session"),
	]);
	const authentication = await resolveAuthenticationFromRequestHeaders(request.headers).catch(() => null);
	if (!authentication) return false;
	if (authentication.user.id === userId && authentication.permissions.includes("read")) return true;
	return assertAdminSession(authentication).then(
		() => true,
		() => false,
	);
}

export async function handleUpload(request: Request, trustedClient?: string) {
	const [userId, ...segments] = new URL(request.url).pathname.split("/uploads/")[1]?.split("/") ?? [];
	const filePath = segments.join("/");

	if (!userId || !filePath) return new Response("Bad Request", { status: 400 });

	if (![userId, ...segments].every(isValidPath)) return new Response("Forbidden", { status: 403 });
	if (segments[0] === "agent") return new Response("Not Found", { status: 404 });
	if (PORTFOLIO_FILE_PATH.test(filePath)) {
		const { publicPortfolioRequestAllowed, tooManyPortfolioRequests } =
			await import("@rezumi/api/features/portfolio/public-limit");
		if (!(await publicPortfolioRequestAllowed(trustedClient))) return tooManyPortfolioRequests();
		return servePortfolioFile(request, userId, filePath);
	}

	const filename = filePath.split("/").pop() ?? filePath;
	const publicPicturePath =
		(filePath.startsWith("pictures/") && INLINE_CONTENT_TYPES.has(inferContentType(filename))) ||
		(filePath.startsWith("fonts/") && PUBLIC_FONT_CONTENT_TYPES.has(inferContentType(filename)));
	let privateAccess = false;
	if (!publicPicturePath) {
		privateAccess = await isOwnerRequest(request, userId);
		if (!privateAccess) return notFound();
	}
	if (publicPicturePath && !(await isPublicUploadOwner(userId))) return notFound();
	const storageService = getStorageService();
	const key = `uploads/${userId}/${filePath}`;
	const storedFile = await storageService.read(key);
	if (!storedFile) return new Response("Not Found", { status: 404 });

	const contentType = storedFile.contentType ?? inferContentType(filename);
	const isPublicFont = publicPicturePath && PUBLIC_FONT_CONTENT_TYPES.has(contentType);
	const isPublicPicture = publicPicturePath && (INLINE_CONTENT_TYPES.has(contentType) || isPublicFont);
	if (!isPublicPicture && !privateAccess && !(await isOwnerRequest(request, userId))) return notFound();
	const etag = createEtag(storedFile);

	if (isPublicPicture && matchesIfNoneMatch(request.headers.get("If-None-Match"), etag))
		return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": PUBLIC_PICTURE_CACHE_CONTROL } });

	const shouldForceDownload = !INLINE_CONTENT_TYPES.has(contentType) && !isPublicFont;

	const headers = new Headers();
	headers.set("Content-Type", shouldForceDownload ? "application/octet-stream" : contentType);
	headers.set("Content-Length", storedFile.size.toString());

	if (shouldForceDownload) {
		headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(basename(filename))}"`);
	}

	headers.set("Cache-Control", isPublicPicture ? PUBLIC_PICTURE_CACHE_CONTROL : "private, no-store");
	// A public picture is shown by pages on other sites of this installation too: a resume or portfolio opened on the
	// alias domain or a custom domain draws its photo from here. Private files stay same-site.
	setFileHeaders(headers, etag, isPublicPicture ? "cross-origin" : "same-site");

	return new Response(storedFile.data as Uint8Array<ArrayBuffer>, { headers });
}

/**
 * A portfolio's picture or PDF. Public (any site may show it, so pages on the alias domain and custom domains load it)
 * while the published portfolio uses it; otherwise its owner's alone; otherwise not found, the same answer as for a
 * file that doesn't exist. Pictures are served as the raster they are; PDFs locked down; anything else downloads.
 */
async function servePortfolioFile(request: Request, userId: string, filePath: string): Promise<Response> {
	const key = `uploads/${userId}/${filePath}`;
	const filename = filePath.split("/").pop() ?? filePath;
	const pdfPath = PUBLIC_PDF_PATH.test(filePath);
	let owner: Promise<boolean> | undefined;
	const isOwner = () => (owner ??= canReadPortfolioFiles(request, userId));
	// The lookup comes first, before storage is read or an ETag compared: a file no longer public never answers 304.
	const { isPublicPortfolioFile } = await import("@rezumi/api/features/portfolio/public");
	let isPublic = (pdfPath || PORTFOLIO_PICTURE_PATH.test(filePath)) && (await isPublicPortfolioFile(key));
	if (!isPublic && !(await isOwner())) return notFound();

	const storedFile = await getStorageService().read(key);
	if (!storedFile) return notFound();
	const contentType = storedFile.contentType ?? inferContentType(filename);
	const asPdf = pdfPath && contentType === PDF_CONTENT_TYPE;
	const asPicture = !pdfPath && INLINE_CONTENT_TYPES.has(contentType);
	// Stored as something it shouldn't be: its owner can still download it, nobody else sees it.
	if (!asPdf && !asPicture) {
		if (!(await isOwner())) return notFound();
		isPublic = false;
	}

	const etag = createEtag(storedFile);
	const cacheControl = isPublic ? PUBLIC_PICTURE_CACHE_CONTROL : OWNER_PORTFOLIO_FILE_CACHE_CONTROL;
	const resourcePolicy = isPublic ? "cross-origin" : "same-site";
	if ((asPdf || asPicture) && matchesIfNoneMatch(request.headers.get("If-None-Match"), etag))
		return new Response(null, {
			status: 304,
			headers: { ETag: etag, "Cache-Control": cacheControl, "Cross-Origin-Resource-Policy": resourcePolicy },
		});

	const headers = new Headers();
	headers.set("Content-Length", storedFile.size.toString());
	if (asPdf) {
		headers.set("Content-Type", PDF_CONTENT_TYPE);
		headers.set("Content-Disposition", 'inline; filename="document.pdf"');
		headers.set("Content-Security-Policy", "sandbox");
		headers.set("Cache-Control", cacheControl);
	} else if (asPicture) {
		headers.set("Content-Type", contentType);
		headers.set("Cache-Control", cacheControl);
	} else {
		headers.set("Content-Type", "application/octet-stream");
		headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(basename(filename))}"`);
		headers.set("Cache-Control", "private, no-store");
	}
	setFileHeaders(headers, etag, resourcePolicy);
	return new Response(storedFile.data as Uint8Array<ArrayBuffer>, { headers });
}

function setFileHeaders(headers: Headers, etag: string, resourcePolicy: "same-site" | "cross-origin") {
	headers.set("ETag", etag);
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("X-Robots-Tag", "noindex, nofollow");
	headers.set("Cross-Origin-Resource-Policy", resourcePolicy);
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	headers.set("X-Frame-Options", "DENY");
	headers.set("X-Download-Options", "noopen");
}

function isValidPath(segment: string): boolean {
	const normalized = normalize(segment).replace(/^(\.\.(\/|\\|$))+/, "");

	return normalized === segment;
}

function createEtag(storedFile: { data: Uint8Array; size: number; etag?: string }): string {
	if (storedFile.etag) {
		const tag = storedFile.etag.trim();

		if (tag.startsWith("W/") || tag.startsWith('"')) {
			return tag;
		}
		return `"${tag}"`;
	}

	const hash = createHash("sha256").update(storedFile.data).digest("hex");

	return `"${storedFile.size}-${hash}"`;
}
