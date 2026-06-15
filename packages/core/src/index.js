// Public API for @sidrelabs/trellis-core.
// The CLI (and, in Phase 2, the web wizard) consume only what is re-exported here.
export { validateContract } from './contract.js';
export { budgetCheck, scanImports } from './budgets.js';
export { validateExtensions, findRegistries } from './extension.js';
export { init, AGENT_FILES } from './scaffold.js';
export { audit } from './audit.js';
export { buildEvidenceGraph, NODE_TYPES, EDGE_KINDS } from './graph.js';
export { loadEvidenceModel, loadEvidenceGraph } from './evidence.js';
export { parseYaml, stringifyYaml, readYaml, extractYamlBlock } from './yaml.js';
export { findStandardDir } from './util.js';

// Pure, browser-safe composition (shared with the web wizard).
export {
  composeBootstrap, composeAgentsMd, composeAgentPointer, pointerToRoot,
  composeTrellisConfig, composeNpxCommand, includeSkeletonPath, trellisConfigToYaml,
  PROFILES, PRESETS, ALL_AGENTS, MODULES, RULES
} from './compose.js';

export const STANDARD_VERSION = '0.1';
