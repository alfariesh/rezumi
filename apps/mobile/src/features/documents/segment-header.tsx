// The library's section menu under the title, as the web's Documents menu: All, Resumes, Letters and Trash. The
// counts are read by screen readers; the segment keeps short labels so it never truncates.
import type { RouterOutput } from "@/api/client";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Segment, Typography } from "@/ui";

export type LibrarySegment = "all" | "resume" | "letter" | "trash";

export const isLibrarySegment = (value: unknown): value is LibrarySegment =>
	value === "all" || value === "resume" || value === "letter" || value === "trash";

type SegmentHeaderProps = {
	segment: LibrarySegment;
	counts: RouterOutput["documents"]["counts"] | undefined;
	onChange: (segment: LibrarySegment) => void;
};

export function SegmentHeader({ segment, counts, onChange }: SegmentHeaderProps) {
	const { t } = useLingui();
	return (
		<View className="gap-3">
			<Segment
				size="sm"
				value={segment}
				onValueChange={onChange}
				accessibilityLabel={t`Documents sections`}
				options={[
					{ value: "all", label: t`All` },
					{ value: "resume", label: t`Resumes` },
					{ value: "letter", label: t`Letters` },
					{ value: "trash", label: t`Trash` },
				]}
			/>
			{counts ? (
				<Typography type="body-xs" color="muted" accessibilityLiveRegion="polite">
					{segment === "trash"
						? t`Documents are deleted permanently after 30 days.`
						: segment === "resume"
							? plural(counts.resume, { one: "# resume", other: "# resumes" })
							: segment === "letter"
								? plural(counts.letter, { one: "# letter", other: "# letters" })
								: plural(counts.resume + counts.letter, { one: "# document", other: "# documents" })}
				</Typography>
			) : segment === "trash" ? (
				<Typography type="body-xs" color="muted">
					{t`Documents are deleted permanently after 30 days.`}
				</Typography>
			) : null}
		</View>
	);
}
