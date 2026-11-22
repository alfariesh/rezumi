import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { client } from "@/api/client";
import { useResumeStore } from "@/draft";
import { resume } from "@/draft/runtime";
import { useInvalidateApplications } from "@/features/applications/queries";
import { showToast } from "@/ui";

/** Links the resume to an application (or unlinks it), after its pending edits are saved. */
export function useLinkApplication(id: string) {
	const { t } = useLingui();
	const invalidate = useInvalidateApplications();
	const [linking, setLinking] = useState(false);
	const controller = useRef<AbortController | null>(null);
	useEffect(() => () => controller.current?.abort(), []);

	const link = async (applicationId: string | null) => {
		if (controller.current) return false;
		const request = new AbortController();
		controller.current = request;
		setLinking(true);
		try {
			await useResumeStore.getState().flush();
			const ready = useResumeStore.getState();
			if (request.signal.aborted || ready.document?.id !== id || ready.locked) return false;
			if (ready.conflict || ready.status === "error" || ready.status === "offline") throw new Error("Draft not saved");
			await client.documents.linkApplication({ type: "resume", id, applicationId }, { signal: request.signal });
			if (!request.signal.aborted && useResumeStore.getState().document?.id === id) {
				await resume.refresh();
				// Applies a metadata refresh the posting field's keyboard deferred, without queuing a save.
				await resume.blur();
			}
			return true;
		} catch {
			if (!request.signal.aborted)
				showToast({ title: t`Couldn't link the application. Try again.`, variant: "danger" });
			return false;
		} finally {
			void invalidate();
			if (!request.signal.aborted) setLinking(false);
			if (controller.current === request) controller.current = null;
		}
	};

	return { link, linking };
}
