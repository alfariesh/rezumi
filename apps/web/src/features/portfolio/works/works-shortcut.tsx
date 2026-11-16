import { Button } from "@heroui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { getRouteApi } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { usePortfolioData } from "../editor/store";

const routeApi = getRouteApi("/builder/portfolio/");

/**
 * The Work section in Content's list: its order, visibility and title stay there with the other sections, while the
 * works themselves are written in Work, which this opens.
 */
export function WorksShortcut() {
	const count = usePortfolioData().works.items.length;
	const navigate = routeApi.useNavigate();
	const openWork = () =>
		void navigate({
			to: ".",
			search: (search: ReturnType<typeof routeApi.useSearch>) => ({ ...search, mode: "work" as const }),
			replace: true,
			resetScroll: false,
		});

	return (
		<div className="flex flex-wrap items-center gap-3">
			<span className="flex-1 text-sm text-muted">
				<Plural value={count} _0="No works yet." one="# work on the page." other="# works on the page." />
			</span>
			<Button size="sm" variant="secondary" onPress={openWork}>
				{count ? <Trans>Edit in Work</Trans> : <Trans>Add a work</Trans>}
				<Icon name="arrow-right" size={16} />
			</Button>
		</div>
	);
}
