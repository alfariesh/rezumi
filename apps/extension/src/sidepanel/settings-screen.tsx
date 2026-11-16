import type { Account } from "../shared/storage";
import type { RouterOutput } from "./api";
import { Button } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { Icon } from "@rezumi/ui/components/icon";
import { SwitchRow } from "@rezumi/ui/components/switch";
import { EXTENSION_VERSION } from "../shared/config";
import { askWorker } from "./api";
import { SelectField } from "./fields";
import { useMatchResume } from "./match-section";
import { useSettings } from "./stores";

/** The browser's own page for extension shortcuts (Edge has its own address). */
function openShortcuts() {
	const edge = navigator.userAgent.includes("Edg/");
	void chrome.tabs.create({ url: edge ? "edge://extensions/shortcuts" : "chrome://extensions/shortcuts" });
}

type SettingsScreenProps = {
	account: Account | null;
	summary: RouterOutput["billing"]["summary"];
};

const planName = (planId: string) => (planId === "plus" ? "Plus" : planId === "pro-ai" ? "Pro AI" : null);

/**
 * 01-desain.md §3.8: the connected account (name, email, plan), the language, the on-page button (aturan turunan #5),
 * the resume the match uses (aturan turunan #11), desktop reminders (aturan turunan #7: the browser asks for permission
 * when they are turned on), the keyboard shortcut and Sign out.
 */
export function SettingsScreen({ account, summary }: SettingsScreenProps) {
	const { t } = useLingui();
	const signOut = useMutation({ mutationFn: () => askWorker({ type: "disconnect" }) });
	const [settings, updateSettings] = useSettings();
	const matchResume = useMatchResume();
	// Plans that don't apply (billing off) say nothing about a plan.
	const plan = summary.enabled ? (planName(summary.planId) ?? t`Free`) : null;

	return (
		<div className="flex flex-col gap-6">
			<section aria-labelledby="account-heading" className="flex flex-col gap-3">
				<h2 id="account-heading" className="text-xs font-semibold text-muted">
					<Trans>Account</Trans>
				</h2>
				<div className="flex items-center gap-3">
					<span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-control">
						<Icon name="user-circle" size={22} />
					</span>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{account?.name || t`Rezumi account`}</p>
						{account?.email ? <p className="truncate text-sm text-muted">{account.email}</p> : null}
					</div>
					{plan ? (
						<span className="shrink-0 rounded-full bg-control px-2.5 py-0.5 text-xs font-medium">{plan}</span>
					) : null}
				</div>
				<Button variant="secondary" isPending={signOut.isPending} onPress={() => signOut.mutate()}>
					<Icon name="sign-out" size={16} aria-hidden />
					<Trans comment="Button in the browser extension that disconnects it from the Rezumi account">Sign out</Trans>
				</Button>
			</section>

			<section aria-labelledby="extension-heading" className="flex flex-col gap-3">
				<h2 id="extension-heading" className="text-xs font-semibold text-muted">
					<Trans comment="Settings section in the browser extension about the extension itself">Extension</Trans>
				</h2>
				<SelectField
					label={t`Language`}
					value={settings?.language ?? "system"}
					isDisabled={!settings}
					options={[
						{ value: "system", label: t`Same as the browser` },
						{ value: "en", label: "English" },
						{ value: "id", label: "Bahasa Indonesia" },
					]}
					onChange={(language) => {
						if (language === "system" || language === "en" || language === "id") void updateSettings({ language });
					}}
				/>
				{matchResume.resumes?.length ? (
					<SelectField
						label={t`Resume for the match score`}
						value={matchResume.id ?? ""}
						options={matchResume.resumes.map((resume) => ({ value: resume.id, label: resume.name }))}
						onChange={matchResume.choose}
					/>
				) : null}
				<SwitchRow
					isSelected={settings?.notifications ?? false}
					isDisabled={!settings}
					onChange={(on) => {
						// The permission request must start in the click itself (the browser asks only during a gesture).
						if (on)
							void chrome.permissions
								.request({ permissions: ["notifications"] })
								.then((granted) => updateSettings({ notifications: granted }));
						else
							void updateSettings({ notifications: false }).then(() =>
								chrome.permissions.remove({ permissions: ["notifications"] }),
							);
					}}
					label={t`Desktop reminders`}
					description={t`A notification at 9:00 on the day a follow-up is due, once per application.`}
				/>
				<SwitchRow
					isSelected={settings?.pageButton ?? true}
					isDisabled={!settings}
					onChange={(pageButton) => void updateSettings({ pageButton, floatingHidden: [] })}
					label={t`Button on job sites`}
					description={t`Shows "Save to Rezumi" on LinkedIn, Indeed, JobStreet and Glints.`}
				/>
				<div className="flex items-center justify-between gap-3 py-1">
					<div className="min-w-0">
						<p className="text-sm">
							<Trans>Keyboard shortcut</Trans>
						</p>
						<p className="text-xs text-muted">
							<Trans comment="The default keyboard shortcut that opens the browser extension">
								Alt+Shift+S opens Rezumi
							</Trans>
						</p>
					</div>
					<Button size="sm" variant="secondary" onPress={openShortcuts}>
						<Trans>Change</Trans>
					</Button>
				</div>
			</section>

			<p className="text-xs text-muted">
				<Trans>Version {EXTENSION_VERSION}</Trans>
			</p>
		</div>
	);
}
