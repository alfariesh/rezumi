import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const anggrekSemanticManifest = baseManifest("anggrek", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
