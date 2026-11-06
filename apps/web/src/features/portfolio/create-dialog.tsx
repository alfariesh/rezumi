import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { Button, Modal, Radio, RadioGroup, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { defaultPortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { TextInput } from "./editor/fields";
import { ThemeGallery } from "./theme-gallery";
import { authClient } from "@/libs/auth/client";
import { toastError } from "@/libs/error-message";
import { client, orpc } from "@/libs/orpc/client";

const WITHOUT_RESUME = "none";

/**
 * Make a portfolio (`01-desain.md` section 2): first the resume it comes from (the primary one is picked) or none,
 * with a name and headline; then a theme. Starting with AI joins as a third step in Phase 10. The editor opens next.
 */
export function CreatePortfolioDialog({ onClose }: { onClose: () => void }) {
	const id = useId();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const { data: resumes, isPending: loadingResumes } = useQuery(orpc.resume.list.queryOptions());
	const [step, setStep] = useState<"source" | "theme">("source");
	const [chosen, setChosen] = useState<string | null>(null);
	const [name, setName] = useState(session?.user.name ?? "");
	const [headline, setHeadline] = useState("");
	const [theme, setTheme] = useState<PortfolioTheme>(defaultPortfolioTheme);
	const [creating, setCreating] = useState(false);

	const primary = resumes?.find((resume) => resume.isPrimary) ?? resumes?.[0];
	const source = chosen ?? primary?.id ?? WITHOUT_RESUME;
	const withoutResume = source === WITHOUT_RESUME;

	const create = async () => {
		setCreating(true);
		try {
			await client.portfolio.create(
				withoutResume
					? { sourceResumeId: null, theme, basics: { name: name.trim(), headline: headline.trim() } }
					: { sourceResumeId: source, theme },
			);
			await queryClient.invalidateQueries({ queryKey: orpc.portfolio.get.key() });
			onClose();
			void navigate({ to: "/builder/portfolio" });
		} catch (error) {
			toastError(error, t`Couldn't create your portfolio. Try again.`, { allowServerMessage: true });
			setCreating(false);
		}
	};

	return (
		<Modal.Backdrop isOpen onOpenChange={(open) => !open && !creating && onClose()}>
			<Modal.Container size={step === "theme" ? "lg" : "md"} scroll="inside">
				<Modal.Dialog aria-labelledby={`${id}-title`} aria-describedby={`${id}-step`}>
					{!creating && <Modal.CloseTrigger aria-label={t`Close`} />}
					<Modal.Header>
						<Modal.Heading id={`${id}-title`}>
							<Trans>Create your portfolio</Trans>
						</Modal.Heading>
						<p id={`${id}-step`} className="text-sm text-muted">
							{step === "source" ? (
								<Trans>Step 1 of 2 · What it starts from</Trans>
							) : (
								<Trans>Step 2 of 2 · How it looks</Trans>
							)}
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
									<p className="text-xs text-muted">
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
											<p className="text-xs text-muted">
												<Trans>A photo can be added later.</Trans>
											</p>
										</div>
									)}
								</>
							)
						) : (
							<div className="grid gap-3">
								<ThemeGallery value={theme} onChange={setTheme} columns={2} />
								<p className="text-xs text-muted">
									<Trans>You can change the theme any time in Design.</Trans>
								</p>
							</div>
						)}
					</Modal.Body>
					<Modal.Footer>
						{step === "source" ? (
							<>
								<Button variant="secondary" onPress={onClose}>
									<Trans>Cancel</Trans>
								</Button>
								<Button isDisabled={loadingResumes} onPress={() => setStep("theme")}>
									<Trans>Next</Trans>
								</Button>
							</>
						) : (
							<>
								<Button variant="secondary" isDisabled={creating} onPress={() => setStep("source")}>
									<Trans>Back</Trans>
								</Button>
								<Button isPending={creating} onPress={() => void create()}>
									<Trans>Create portfolio</Trans>
								</Button>
							</>
						)}
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
