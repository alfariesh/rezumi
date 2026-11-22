// Design: one scrolling list of groups (Template · Entries · Type · Color · Icons · Page · Advanced), as the web's
// panel. The gallery and the exact-value editors push their own screens. Phones show it as the Design pane; tablets
// as the 400 pt panel beside the page. A locked resume shows every value, read-only.
import type { DesignScreen } from "@/routes";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { AdvancedGroup } from "./advanced-group";
import { ColorGroup } from "./color-group";
import { designWrite, useDesignDraft } from "./draft";
import { EntriesGroup } from "./entries-group";
import { IconsGroup } from "./icons-group";
import { LockedNotice } from "./locked-notice";
import { PageGroup } from "./page-group";
import { DesignSection } from "./section";
import { TemplateGroup } from "./template-group";
import { TypeGroup } from "./type-group";
import { useSession } from "@/auth/session";
import { routes } from "@/routes";
import { EmptyState, Screen, Skeleton, SkeletonGroup, cx } from "@/ui";

export function DesignPane({ id }: { id: string }) {
	const { t } = useLingui();
	const router = useRouter();
	const session = useSession();
	const draft = useDesignDraft(id);
	const { data, locked } = draft;
	const open = (screen: DesignScreen) => router.push(routes.design(id, screen));

	if (session.status === "signed-out" || session.status === "expired")
		return (
			<Screen>
				<EmptyState kind="page" icon="lock" title={t`Sign in to view this resume.`} />
			</Screen>
		);
	if (!data) {
		if (draft.status === "error")
			return (
				<Screen>
					<EmptyState
						kind="page"
						icon="warning-circle"
						title={t`Couldn't load the resume.`}
						action={{ label: t`Retry`, onPress: () => void draft.open(id).catch(() => undefined) }}
					/>
				</Screen>
			);
		return <DesignSkeleton />;
	}

	const props = { data, write: designWrite, disabled: locked };
	return (
		<Screen>
			{locked ? <LockedNotice id={id} /> : null}
			<View className={cx("gap-6", locked && "opacity-60")}>
				<DesignSection icon="squares-four" title={t`Template`}>
					<TemplateGroup {...props} onBrowse={() => open("templates")} />
				</DesignSection>
				<DesignSection icon="rows" title={t`Entries`}>
					<EntriesGroup {...props} />
				</DesignSection>
				<DesignSection icon="text-aa" title={t`Type`}>
					<TypeGroup {...props} onCustomFonts={() => open("typography")} />
				</DesignSection>
				<DesignSection icon="palette" title={t`Color`}>
					<ColorGroup {...props} />
				</DesignSection>
				<DesignSection icon="star" title={t`Icons`}>
					<IconsGroup {...props} />
				</DesignSection>
				<DesignSection icon="file" title={t`Page`}>
					<PageGroup {...props} />
				</DesignSection>
				<DesignSection icon="sliders-horizontal" title={t`Advanced`}>
					<AdvancedGroup {...props} onOpen={open} />
				</DesignSection>
			</View>
		</Screen>
	);
}

/** Loading: the first groups in their final shape. */
function DesignSkeleton() {
	const { t } = useLingui();
	return (
		<Screen>
			<SkeletonGroup isLoading variant="none" accessibilityLabel={t`Loading`} className="gap-6">
				{[0, 1, 2].map((index) => (
					<View key={index} className="gap-2">
						<Skeleton variant="none" className="h-4 w-24 rounded-md" />
						<Skeleton variant="none" className="h-36 w-full rounded-3xl" />
					</View>
				))}
			</SkeletonGroup>
		</Screen>
	);
}
