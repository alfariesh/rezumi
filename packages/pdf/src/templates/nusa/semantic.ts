import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const nusaSemanticManifest = baseManifest("nusa", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
