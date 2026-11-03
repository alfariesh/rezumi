import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const tunasSemanticManifest = baseManifest("tunas", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
