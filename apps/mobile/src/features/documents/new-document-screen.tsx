// New (01-desain 2.1: the floating New of Home and Documents, the sidebar's New): import a resume, start a resume or a
// letter, copy a resume for a job, or save a job, as the web's New document dialog. A sheet over the app; the editor
// replaces it once a document exists. `?step=copy&sourceResumeId=&applicationId=` opens Copy for a job.
import { useLingui } from "@lingui/react/macro";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { NewChoices } from "./new-choices";
import { NewCopy } from "./new-copy";
import { useNewDocuments } from "./new-documents";
import { NewImport } from "./new-import";
import { useDocumentOperations } from "./queries";
import { useImport } from "./use-import";
import { useStartDocument } from "./use-start-document";
import { client } from "@/api/client";
import { useSession } from "@/auth/session";
import { useHasAIProvider } from "@/features/ai/providers";
import { SaveJobSheet } from "@/features/applications/save-sheet";
import { routes } from "@/routes";
import { EmptyState, Screen } from "@/ui";

type Step = "choose" | "copy";

export function NewDocumentScreen() {
	const { t } = useLingui();
	const router = useRouter();
	const session = useSession();
	const params = useLocalSearchParams<{ step?: string; sourceResumeId?: string; applicationId?: string }>();
	const applicationId = typeof params.applicationId === "string" ? params.applicationId : undefined;
	const ai = useHasAIProvider();
	const [aiPdf, setAiPdf] = useState<boolean | null>(null);
	const [step, setStep] = useState<Step>(params.step === "copy" ? "copy" : "choose");
	const [savingJob, setSavingJob] = useState(false);
	const start = useStartDocument({ applicationId, navigation: "replace" });
	const operations = useDocumentOperations();
	const imports = useImport({ aiAvailable: ai.hasAIProvider, aiPdf: aiPdf ?? ai.hasAIProvider, applicationId });
	const importing = imports.step.name !== "idle";
	const busy = start.creating || operations.busy || imports.step.name === "importing";

	const openResume = (id: string, withAssistant = false) => {
		useNewDocuments.getState().markOpened({ id, type: "resume" });
		router.replace(routes.builder(id));
		if (withAssistant) router.push({ pathname: routes.assistant(id), params: { prepare: "1" } });
	};
	const copy = (input: { resumeId: string; name: string; applicationId?: string | undefined }) =>
		void operations.run(async () => {
			const id = await client.documents.copyForJob({
				resumeId: input.resumeId,
				name: input.name,
				...(input.applicationId ? { applicationId: input.applicationId } : {}),
			});
			useNewDocuments.getState().markNew({ id, type: "resume" });
			openResume(id, !!input.applicationId && ai.hasAIProvider);
		});

	if (session.status !== "signed-in")
		return (
			<Screen>
				<EmptyState
					kind="page"
					icon="file-text"
					title={t`Sign in to create or import documents.`}
					action={{ label: t`Sign in`, onPress: () => router.replace(routes.signIn()) }}
				/>
			</Screen>
		);

	return (
		<Screen testID="new-document">
			<Stack.Screen
				options={{
					title: step === "copy" ? t`Copy a resume for a job` : t`New document`,
					sheetGrabberVisible: !busy,
					gestureEnabled: !busy,
				}}
			/>
			{importing && imports.step.name !== "idle" ? (
				<NewImport
					step={imports.step}
					creating={start.creating}
					onCancel={imports.cancel}
					onChooseFile={imports.choose}
					onStartBlank={() => void start.startBlank()}
					onOpen={() => {
						if (imports.step.name !== "imported") return;
						const { document } = imports.step;
						useNewDocuments.getState().markOpened(document);
						router.replace(document.type === "resume" ? routes.builder(document.id) : routes.letter(document.id));
					}}
					onStay={() => router.back()}
				/>
			) : step === "copy" ? (
				<NewCopy
					initialSourceId={params.sourceResumeId}
					initialJobId={applicationId}
					busy={busy}
					onCreate={copy}
					onBack={() => setStep("choose")}
				/>
			) : (
				<NewChoices
					busy={busy}
					ai={ai}
					aiPdf={aiPdf ?? ai.hasAIProvider}
					onAiPdfChange={setAiPdf}
					onImport={imports.choose}
					onStartBlank={() => void start.startBlank()}
					onNewLetter={() => void start.newLetter()}
					onTrySample={() => void start.trySample()}
					onCopy={() => setStep("copy")}
					onSaveJob={() => setSavingJob(true)}
					onAtsChecker={() => router.replace(routes.atsChecker())}
				/>
			)}
			<SaveJobSheet isOpen={savingJob} onOpenChange={setSavingJob} />
		</Screen>
	);
}
