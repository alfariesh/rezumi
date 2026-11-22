import { useLingui } from "@lingui/react/macro";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { useSession } from "@/auth/session";
import { useResumeStore } from "@/draft";
import { nativeEnvironment } from "@/draft/native";
import { ProposedEditsCaption, useMarkedResumeData } from "@/features/assistant/page-marks";
import { usePreviewedDraft } from "@/features/design/draft";
import { TemplatePreviewCaption } from "@/features/design/preview-caption";
import { ResumePage } from "@/preview/page";
import { PageNotice } from "@/preview/page-parts";
import { routes } from "@/routes";

// Metro removes this branch and its require before collecting release dependencies.
const DevelopmentTools: typeof import("../../../scripts/parity/development").DevelopmentTools | null = __DEV__
	? require("../../../scripts/parity/development").DevelopmentTools
	: null;

type PageScreenProps = {
	/** The full-screen view (`preview.tsx`): its button closes it instead of opening it. */
	fullScreen?: boolean | undefined;
};

/** The Page pane on phones, the page beside the panel on tablets, and the full-screen view. */
export default function PageScreen({ fullScreen = false }: PageScreenProps) {
	const { t } = useLingui();
	const router = useRouter();
	const { id, parity, smoke } = useLocalSearchParams<{ id: string; parity?: string; smoke?: string }>();
	const developmentOrigin = parity ?? smoke;
	// The builder layout owns the draft; the page only reads it.
	const draft = useResumeStore();
	const session = useSession();
	const current = draft.document?.id === id;
	// On a tablet this page sits beside Design: a template held there shows here.
	const shown = usePreviewedDraft(current ? draft : { ...draft, data: null });
	// The Assistant's pending edits, marked on the page (never saved).
	const marked = useMarkedResumeData(id, shown.data);
	return (
		<View className="flex-1 bg-surface-secondary">
			{DevelopmentTools && developmentOrigin ? (
				<DevelopmentTools id={id} origin={developmentOrigin} fullParity={!!parity} />
			) : null}
			{session.status === "signed-out" || session.status === "expired" ? (
				<PageNotice status="warning" message={t`Sign in to view this resume.`} />
			) : draft.status === "error" && !current ? (
				<PageNotice
					status="danger"
					message={t`Couldn't load the resume.`}
					onRetry={() => void draft.open(id).catch(() => undefined)}
				/>
			) : null}
			<ProposedEditsCaption resumeId={id} pending={marked.pending} />
			<ResumePage
				id={id}
				draft={shown}
				previewData={marked.data}
				focused={nativeEnvironment.focused()}
				fullScreen={fullScreen}
				onFullScreen={fullScreen ? () => router.back() : () => router.push(routes.preview(id))}
			/>
			<TemplatePreviewCaption />
		</View>
	);
}
