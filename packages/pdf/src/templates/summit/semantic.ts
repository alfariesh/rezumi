import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const summitSemanticManifest = baseManifest("summit", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
