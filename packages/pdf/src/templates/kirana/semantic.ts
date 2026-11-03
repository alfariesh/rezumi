import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const kiranaSemanticManifest = baseManifest("kirana", [
	itemHeaderRowPart,
	{
		name: "sidebar-background",
		key: "sidebar-background",
		owner: { kind: "region", key: "sidebar" },
		binding: { type: "primitive", primitive: "View", source: "existing" },
		route: { parent: "owner", at: "start" },
	},
]) satisfies TemplateSemanticManifest;
