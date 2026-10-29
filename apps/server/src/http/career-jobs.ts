import { timingSafeEqual } from "node:crypto";
import { runCareerJobs } from "@rezumi/api/features/career/jobs";
import { env } from "@rezumi/env/server";

export async function handleCareerJobs(request: Request): Promise<Response> {
	const headers = { "Cache-Control": "no-store" };
	if (!env.CRON_SECRET) return new Response(null, { status: 404, headers });
	const supplied = Buffer.from(request.headers.get("authorization") ?? "");
	const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
	if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
		return new Response(null, { status: 401, headers });
	return Response.json(await runCareerJobs(), { headers });
}
