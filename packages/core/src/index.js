// Public API for @sidrelabs/trellis-core.
// The CLI (and, in Phase 2, the web wizard) consume only what is re-exported here.
export { validateContract } from './contract.js';
export { budgetCheck, scanImports } from './budgets.js';
export { validateExtensions, findRegistries } from './extension.js';
export { init, AGENT_FILES } from './scaffold.js';
export { audit } from './audit.js';
export { buildEvidenceGraph, NODE_TYPES, EDGE_KINDS } from './graph.js';
export { loadEvidenceModel, loadEvidenceGraph } from './evidence.js';
export {
  checkModelProvenance, classifyCommits, loadModelPolicy, readProvenance, stampProvenance, PROVENANCE_FILE
} from './model-policy.js';
export { scanSecrets, detectSecrets } from './secret-scan.js';
export { installHooks, HOOKS } from './hooks.js';
export { parseYaml, stringifyYaml, readYaml, extractYamlBlock } from './yaml.js';
export { findStandardDir } from './util.js';

// Reuse inventory (ADR-0008): pure ranking/validation is browser-safe; storage and migration are Node-only.
export {
  INVENTORY_SCHEMA_VERSION, INVENTORY_THRESHOLDS, INVENTORY_STATUSES, INVENTORY_LIMITS, FIND_DEFAULT_LIMIT, FIND_MAX_LIMIT,
  validateRecord, validateRecords, normalizeRecord, parseJsonl, serializeJsonl, searchRecords, decideStorage,
  diffRecords, formatDiff, mergeRecords, migrationNotice, MIGRATION_NOTICES
} from './inventory.js';
export {
  InventoryError, inventoryStatus, inventoryEnabled, inventoryPaths, loadInventory, findInventory, validateInventory,
  checkInventoryRefs, addInventoryRecord, updateInventoryRecord, removeInventoryRecord, INVENTORY_JSONL, INVENTORY_SQLITE
} from './inventory-store.js';
export { diffInventory, mergeInventory, readInventoryAtRef } from './inventory-git.js';
export { migrateInventory, recoverInventory, verifySqliteCopy } from './inventory-migrate.js';

// Pure, browser-safe composition (shared with the web wizard).
export {
  composeBootstrap, composeAgentsMd, composeAgentPointer, pointerToRoot, REUSE_INVENTORY_SECTION,
  composeTrellisConfig, composeNpxCommand, includeSkeletonPath, trellisConfigToYaml,
  PROFILES, PRESETS, ALL_AGENTS, MODULES, RULES
} from './compose.js';

export const STANDARD_VERSION = '0.1';
