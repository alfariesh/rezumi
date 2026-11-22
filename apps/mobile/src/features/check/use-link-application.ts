import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { client } from "@/api/client";
import { useResumeStore } from "@/draft";
import { resume } from "@/draft/runtime";
import { useInvalidateApplications } from "@/features/applications/queries";
import { showToast } from "@/ui";

/**
 * Links the resume to an application (or unlinks it), after its pending edits are saved. A link under way finishes
 * even when the screen closes: the server may already have it, so the draft is refreshed either way. True once the
 * server has the link.
 */
export function useLinkApplication(id: string) {
	const { t } = useLingui();
	const invalidate = useInvalidateApplications();
	const [linking, setLinking] = useState(false);
	const inFlight = useRef(false);

	const send = async (applicationId: string | null) => {
		try {
			await useResumeStore.getState().flush();
			const ready = useResumeStore.getState();
			if (ready.document?.id !== id || ready.locked) return false;
			if (ready.conflict || ready.status === "error" || ready.status === "offline") throw new Error("Draft not saved");
			await client.documents.linkApplication({ type: "resume", id, applicationId });
		} catch {
			showToast({ title: t`Couldn't link the application. Try again.`, variant: "danger" });
			return false;
		}
		try {
			if (useResumeStore.getState().document?.id === id) {
				await resume.refresh();
				// Applies a metadata refresh the posting field's keyboard deferred, without queuing a save.
				await resume.blur();
			}
		} catch {
			// The link is saved; the draft picks it up on its next refresh.
		}
		return true;
	};

	const link = async (applicationId: string | null) => {
		if (inFlight.current) return false;
		inFlight.current = true;
		setLinking(true);
		try {
			return await send(applicationId);
		} finally {
			void invalidate();
			setLinking(false);
			inFlight.current = false;
		}
	};

	return { link, linking };
}
