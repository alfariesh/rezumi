export function toRenderWithLayoutResult(raw) {
    return { pdf: raw.pdf, layout: raw.layout, warnings: raw.warnings ?? [] };
}
/**
 * Serialize the per-render engine options (`RenderOptions` on the Rust
 * side) for the WASM boundary. Returns `undefined` when every option is
 * off, so the default render takes the exact historical code path —
 * "costs nothing when off" is enforced by construction, not by hoping
 * the engine ignores an empty object cheaply.
 */
export function encodeRenderOptions(options) {
    if (!options?.auditContent)
        return undefined;
    return JSON.stringify({ auditContent: true });
}
