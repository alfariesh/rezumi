import { Button, Description, InputGroup, Label, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { isValidSlug, MAX_SLUG_LENGTH, normalizeSlug } from "@rezumi/resume/sharing";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { CopyLinkButton } from "./copy-link-button";
import { useCurrentResume } from "@/features/resume/builder/draft";
import { orpc } from "@/libs/orpc/client";

type SaveSlug = (settings: { slug: string }) => Promise<boolean>;

/** The address as typed, its live availability check (300 ms), and the save once a new one checks out. */
function useSlugAvailability(update: SaveSlug) {
	const resume = useCurrentResume();
	const [slug, setSlug] = useState(resume.slug);
	const [debouncedSlug] = useDebounceValue(slug, 300);

	const changed = slug !== resume.slug;
	const wellFormed = isValidSlug(slug);
	const check = useQuery({
		...orpc.resume.checkSlug.queryOptions({ input: { resumeId: resume.id, slug: debouncedSlug } }),
		enabled: (resume.isPublic ?? false) && changed && wellFormed && debouncedSlug === slug,
	});
	const result = debouncedSlug === slug ? check.data : undefined;

	// Save as soon as a new address checks out; until then the current one keeps working.
	const saving = useRef<string | null>(null);
	const save = useEffectEvent((next: string) => {
		saving.current = next;
		void update({ slug: next }).finally(() => {
			saving.current = null;
		});
	});
	useEffect(() => {
		if (result?.status === "available" && saving.current !== slug) save(slug);
	}, [result?.status, slug]);

	// A save here, another tab or a restore can change the address; the field follows it unless the user is typing.
	const [savedSlug, setSavedSlug] = useState(resume.slug);
	if (resume.slug !== savedSlug) {
		setSavedSlug(resume.slug);
		if (slug === savedSlug) setSlug(resume.slug);
	}

	return { slug, setSlug, changed, wellFormed, result };
}

type AddressFieldProps = {
	url: string;
	username: string;
	/** Saves a new address; Share's one `resume.update`, so every Share control sees it pending. */
	update: SaveSlug;
};

/** The address, checked as you type. The old one stays live until the new one is valid and saved. */
export function AddressField({ url, username, update }: AddressFieldProps) {
	const resume = useCurrentResume();
	const isPublic = resume.isPublic ?? false;
	const { slug, setSlug, changed, wellFormed, result } = useSlugAvailability(update);

	const invalid = isPublic && (!slug || (changed && !wellFormed) || result?.status === "taken");
	const canShare = typeof navigator.share === "function";

	// The hint under the field, when the address isn't taken (that block has its own text).
	const hint = () => {
		if (!isPublic) return t`Turn on the link to choose an address.`;
		if (!slug) return t`Add an address.`;
		if (!changed) return t`Live at ${url.replace(/^https?:\/\//, "")}`;
		if (slug.length > MAX_SLUG_LENGTH) return t`Use at most 64 characters.`;
		if (!wellFormed) return t`Use lowercase letters, numbers and single dashes.`;
		if (result?.status === "available")
			return t`Saving ${new URL(url).host}/${username}/${slug}… Copy is available after saving.`;
		return t`Checking… Copy is available after saving.`;
	};

	// What the field says under it: why the address is taken (with a suggestion), else the hint.
	const note =
		result?.status === "taken" ? (
			<>
				{result.takenBy ? (
					<Trans>You already use this for “{result.takenBy}”.</Trans>
				) : (
					<Trans>Another of your resumes uses this address.</Trans>
				)}{" "}
				{result.suggestion && (
					// An inline action inside the sentence: a HeroUI Button would break the line.
					<button
						type="button"
						className="cursor-(--cursor-interactive) font-medium text-foreground underline underline-offset-2"
						onClick={() => setSlug(result.suggestion ?? slug)}
					>
						<Trans>Try {result.suggestion}</Trans>
					</button>
				)}
			</>
		) : (
			hint()
		);

	return (
		<div className="grid gap-3">
			<TextField
				variant="secondary"
				value={slug}
				onChange={(value) => setSlug(normalizeSlug(value))}
				isDisabled={!isPublic}
				// Read-only, not disabled, while locked: the copy button in the field keeps working.
				isReadOnly={resume.isLocked}
				isInvalid={invalid}
				className="gap-1.5"
			>
				<Label>
					<Trans>Address</Trans>
				</Label>
				<InputGroup variant="secondary" fullWidth>
					{/* A long host or username truncates, so the part being edited stays visible. */}
					<InputGroup.Prefix className="max-w-[55%] pe-0">
						<span className="truncate font-mono text-[13px] text-muted" dir="ltr">
							{new URL(url).host}/{username}/
						</span>
					</InputGroup.Prefix>
					<InputGroup.Input
						spellCheck={false}
						// Set explicitly so a valid address reads aria-invalid="false", not a missing attribute.
						aria-invalid={invalid}
						className="font-mono text-[13px]"
					/>
					<InputGroup.Suffix className="gap-1 pe-1">
						{isPublic && slug && (
							<Icon
								name={invalid ? "warning-circle" : "check-circle"}
								size={18}
								className={invalid ? "text-danger" : "text-success"}
							/>
						)}
						<CopyLinkButton url={url} disabled={!isPublic || changed} />
					</InputGroup.Suffix>
				</InputGroup>
				{/* HeroUI hides a field's Description while it's invalid; this one carries the reason too, so it stays. */}
				<Description role="status" className={cn("block break-all", invalid && "text-danger")}>
					{note}
				</Description>
			</TextField>
			{isPublic && canShare && (
				<Button
					variant="secondary"
					className="w-fit pointer-fine:hidden"
					onPress={() => void navigator.share({ title: resume.name, url }).catch(() => undefined)}
				>
					<Icon name="export" size={18} />
					<Trans>Share via…</Trans>
				</Button>
			)}
		</div>
	);
}
