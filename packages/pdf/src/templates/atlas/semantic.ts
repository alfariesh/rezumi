import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const atlasSemanticManifest = baseManifest("atlas", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
