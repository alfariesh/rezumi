import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { Alert, Button, Modal, Radio, RadioGroup, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId, useRef, useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { defaultPortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { toast } from "@rezumi/ui/components/toast";
import { keepDraftForEditor } from "./ai/apply";
import { DraftNote, DraftProgress, draftFailure, useDraftRun } from "./ai/draft-form";
import { TextInput } from "./editor/fields";
import { portfolioErrorCode, portfolioErrorMessage } from "./errors";
import { invalidatePortfolioQueries } from "./status";
import { ThemeGallery } from "./theme-gallery";
import { useAiSource } from "@/features/billing/ai-source";
import { AiSourceMenu } from "@/features/billing/ai-source-menu";
import { authClient } from "@/libs/auth/client";
import { client, orpc } from "@/libs/orpc/client";

const WITHOUT_RESUME = "none";

/**
 * Make a portfolio (`01-desain.md` section 2): first the resume it comes from (the primary one is picked) or none,
 * with a name and headline; then a theme; then, from a resume, an optional draft with AI. The editor opens next, and
 * a draft goes in there as one edit Undo takes back.
 */
type CreatePortfolioDialogProps = { onClose: () => void };

export function CreatePortfolioDialog({ onClose }: CreatePortfolioDialogProps) {
	const id = useId();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const { data: resumes, isPending: loadingResumes } = useQuery(orpc.resume.list.queryOptions());
	const [step, setStep] = useState<"source" | "theme" | "ai">("source");
	const [chosen, setChosen] = useState<string | null>(null);
	const [name, setName] = useState(session?.user.name ?? "");
	const [headline, setHeadline] = useState("");
	const [theme, setTheme] = useState<PortfolioTheme>(defaultPortfolioTheme);
	const [creating, setCreating] = useState(false);
	const [note, setNote] = useState("");
	const [failure, setFailure] = useState<string | null>(null);
	/** Made, while AI still wrote or failed: it's never made twice. */
	const [created, setCreated] = useState(false);
	const stopped = useRef(false);
	const ai = useAiSource();
	const draft = useDraftRun();

	const primary = resumes?.find((resume) => resume.isPrimary) ?? resumes?.[0];
	const source = chosen ?? primary?.id ?? WITHOUT_RESUME;
	const withoutResume = source === WITHOUT_RESUME;
	const offersAi = !withoutResume && ai.source !== null;
	const busy = creating || draft.isRunning;

	const openEditor = async () => {
		await invalidatePortfolioQueries(queryClient);
		onClose();
		void navigate({ to: "/builder/portfolio" });
	};

	/** Makes the portfolio; false when that failed (it says why), or when one already exists and opens instead. */
	const make = async (): Promise<boolean> => {
		if (created) return true;
		setCreating(true);
		try {
			await client.portfolio.create(
				withoutResume
					? { sourceResumeId: null, theme, basics: { name: name.trim(), headline: headline.trim() } }
					: { sourceResumeId: source, theme },
			);
			setCreated(true);
			setCreating(false);
			return true;
		} catch (error) {
			// Made meanwhile in another tab: that one opens, as an account has one portfolio.
			if (portfolioErrorCode(error) === "PORTFOLIO_EXISTS") {
				toast.add({ description: t`You already have a portfolio, so it opens instead.` });
				await openEditor();
				return false;
			}
			toast.add({
				type: "error",
				description: portfolioErrorMessage(error, { fallback: t`Couldn't create your portfolio. Try again.` }),
			});
			setCreating(false);
			return false;
		}
	};

	const createWithoutAi = async () => {
		if (await make()) await openEditor();
	};

	const createWithAi = async () => {
		setFailure(null);
		stopped.current = false;
		if (!(await make())) return;
		try {
			keepDraftForEditor(await draft.run(note.trim() ? { note: note.trim() } : {}));
			await openEditor();
		} catch (error) {
			setFailure(draftFailure(error, stopped.current));
		}
	};

	/** Closing once it's made opens it: there's no way back to making one. */
	const close = () => {
		if (busy) return;
		if (created) void openEditor();
		else onClose();
	};

	const stepLabel = () => {
		if (!offersAi)
			return step === "source" ? (
				<Trans>Step 1 of 2 · What it starts from</Trans>
			) : (
				<Trans>Step 2 of 2 · How it looks</Trans>
			);
		if (step === "source") return <Trans>Step 1 of 3 · What it starts from</Trans>;
		if (step === "theme") return <Trans>Step 2 of 3 · How it looks</Trans>;
		return <Trans>Step 3 of 3 · Start with AI</Trans>;
	};

	return (
		<Modal.Backdrop isOpen onOpenChange={(open) => !open && close()}>
			<Modal.Container size={step === "theme" ? "lg" : "md"} scroll="inside">
				<Modal.Dialog aria-labelledby={`${id}-title`} aria-describedby={`${id}-step`}>
					{!busy && <Modal.CloseTrigger aria-label={t`Close`} />}
					<Modal.Header>
						<Modal.Heading id={`${id}-title`}>
							<Trans>Create your portfolio</Trans>
						</Modal.Heading>
						<p id={`${id}-step`} className="text-body-sm text-muted">
							{stepLabel()}
						</p>
					</Modal.Header>
					<Modal.Body className="grid gap-4">
						{step === "source" ? (
							loadingResumes ? (
								<div className="grid place-items-center py-8">
									<Spinner size="md" color="current" />
								</div>
							) : (
								<>
									<RadioGroup aria-label={t`Start from`} value={source} onChange={setChosen} className="grid gap-2">
										{[
											...(resumes ?? []).map((resume) => ({
												id: resume.id,
												label: resume.name,
												note: resume.isPrimary ? t`Your primary resume` : null,
											})),
											{ id: WITHOUT_RESUME, label: t`Without a resume`, note: t`Fill in your details yourself.` },
										].map((option) => (
											<Radio
												key={option.id}
												value={option.id}
												className="rounded-2xl border border-separator p-3 transition-colors hover:bg-default data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft"
											>
												<Radio.Content className="flex items-start gap-3">
													<Radio.Control className="mt-0.5 border border-separator">
														<Radio.Indicator />
													</Radio.Control>
													<span className="grid gap-0.5">
														<span className="text-sm font-medium">{option.label}</span>
														{option.note && <span className="text-xs text-muted">{option.note}</span>}
													</span>
												</Radio.Content>
											</Radio>
										))}
									</RadioGroup>
									<p className="text-body-xs text-muted">
										{withoutResume ? (
											<Trans>You can link a resume later in Publish.</Trans>
										) : (
											<Trans>
												Your name, photo, experience, education and skills follow this resume as it changes. Its summary
												becomes About me and its projects become your work, to edit freely.
											</Trans>
										)}
									</p>
									{withoutResume && (
										<div className="grid gap-3">
											<TextInput
												label={t`Your name`}
												value={name}
												maxLength={PORTFOLIO_LIMITS.text.name}
												onChange={setName}
											/>
											<TextInput
												label={t`Headline`}
												value={headline}
												maxLength={PORTFOLIO_LIMITS.text.headline}
												placeholder={t`Product designer`}
												onChange={setHeadline}
											/>
											<p className="text-body-xs text-muted">
												<Trans>A photo can be added later.</Trans>
											</p>
										</div>
									)}
								</>
							)
						) : step === "ai" ? (
							draft.isRunning ? (
								<DraftProgress
									onStop={() => {
										stopped.current = true;
										draft.stop();
									}}
								/>
							) : (
								<div className="grid gap-4">
									<p className="text-body-sm">
										<Trans>
											Write your intro, About me and the story of your work from your resume, then edit it however you
											like. You can undo it.
										</Trans>
									</p>
									<DraftNote value={note} onChange={setNote} />
									{failure && (
										<Alert status="warning">
											<Alert.Indicator />
											<Alert.Content>
												<Alert.Description>{failure}</Alert.Description>
											</Alert.Content>
										</Alert>
									)}
								</div>
							)
						) : (
							<div className="grid gap-3">
								<ThemeGallery value={theme} onChange={setTheme} columns={2} />
								<p className="text-body-xs text-muted">
									<Trans>You can change the theme any time in Design.</Trans>
								</p>
							</div>
						)}
					</Modal.Body>
					<Modal.Footer className="flex-wrap items-center">
						{step === "source" ? (
							<>
								<Button variant="secondary" onPress={onClose}>
									<Trans>Cancel</Trans>
								</Button>
								<Button isDisabled={loadingResumes} onPress={() => setStep("theme")}>
									<Trans>Next</Trans>
								</Button>
							</>
						) : step === "theme" ? (
							<>
								<Button variant="secondary" isDisabled={creating} onPress={() => setStep("source")}>
									<Trans>Back</Trans>
								</Button>
								{offersAi ? (
									<Button onPress={() => setStep("ai")}>
										<Trans>Next</Trans>
									</Button>
								) : (
									<Button isPending={creating} onPress={() => void createWithoutAi()}>
										<Trans>Create portfolio</Trans>
									</Button>
								)}
							</>
						) : (
							!draft.isRunning && (
								<>
									<AiSourceMenu action="portfolio-draft" className="me-auto" />
									<Button variant="secondary" isDisabled={creating || created} onPress={() => setStep("theme")}>
										<Trans>Back</Trans>
									</Button>
									<Button variant="secondary" isDisabled={creating} onPress={() => void createWithoutAi()}>
										{created ? <Trans>Continue without AI</Trans> : <Trans>Skip</Trans>}
									</Button>
									<Button isPending={creating} onPress={() => void createWithAi()}>
										<Trans>Write draft</Trans>
									</Button>
								</>
							)
						)}
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
