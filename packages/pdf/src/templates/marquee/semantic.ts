import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const marqueeSemanticManifest = baseManifest("marquee", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
