// Trellis wizard. Drives the UI from the SAME compose engine the CLI uses (lib/compose.js),
// and builds the .zip starter client-side (lib/zip.js). No framework, no build-time bundler.
import {
  composeBootstrap, composeNpxCommand, composeAgentsMd, composeAgentPointer, pointerToRoot,
  composeTrellisConfig, trellisConfigToYaml, includeSkeletonPath, AGENT_FILES,
  ALL_AGENTS, PROFILES, PRESETS, MODULES
} from './lib/compose.js';
import { createZip } from './lib/zip.js';

// ---- UI metadata (labels/descriptions the engine doesn't carry) --------------------------------
const AGENT_LABELS = {
  claude: ['Claude Code', 'CLAUDE.md'],
  codex: ['Codex', 'AGENTS.md (native)'],
  copilot: ['GitHub Copilot', '.github/copilot-instructions.md'],
  cursor: ['Cursor', '.cursor/rules/'],
  windsurf: ['Windsurf', '.windsurf/rules/'],
  gemini: ['Gemini CLI', 'GEMINI.md']
};
const PROFILE_LABELS = {
  backend: ['Backend service', 'APIs, domain logic, jobs'],
  frontend: ['Frontend app', 'web UI, components, flows'],
  'data-pipeline': ['Data pipeline', 'ETL, batch, streaming'],
  'llm-app': ['LLM application', 'prompt pipelines, RAG, agents']
};
const PRESET_LABELS = {
  light: ['Light', 'fewer enforced gates - good for brownfield'],
  standard: ['Standard', 'recommended defaults'],
  strict: ['Strict', 'all gates enforced']
};
const PROJECT_TYPES = {
  greenfield: ['Greenfield', 'a brand-new repository'],
  brownfield: ['Brownfield', 'existing code - adopt incrementally']
};
const PILLARS = [
  ['🧠', 'Repository-native memory', 'Decisions, sources and contracts live in the repo, not in chat history.'],
  ['📐', 'Capability contracts', 'Every meaningful behavior has a machine-checkable input/output contract.'],
  ['📊', 'Capability budgets', 'Technical + semantic limits (files, LOC, deps, responsibilities) - enforced.'],
  ['🔍', 'Evidence graph', 'Source → Decision → Capability → Test → User validation, end to end.'],
  ['🗂️', 'Decision lifecycle', 'ADRs with assumptions, review intervals and re-evaluation triggers.'],
  ['🧩', 'Extension contracts', 'Directory-local rules listing the files an extension must register.'],
  ['🖥️', 'User test cockpit', 'Non-engineers compare expected vs actual output per capability.'],
  ['🛑', 'Obligation to not code', 'On a stop condition the agent proposes a split/refactor/ADR instead.'],
  ['🚦', 'Quality gates', 'CI gates: contract, budget, drift, evidence, regression, extension.']
];

// ---- state -------------------------------------------------------------------------------------
let SKELETON = {};   // { path: content }
let PROFILE_DEFS = {}; // { profile: def }
const state = {
  agents: new Set(['claude', 'codex', 'copilot', 'cursor', 'windsurf', 'gemini']),
  profile: 'backend',
  projectType: 'greenfield',
  preset: 'standard',
  modules: {}
};

const $ = (sel) => document.querySelector(sel);

function defaultModules(profile) {
  const fromDef = (PROFILE_DEFS[profile] && PROFILE_DEFS[profile].modules) || {};
  const out = {};
  for (const m of MODULES) out[m.key] = fromDef[m.key] !== false;
  return out;
}

// ---- rendering form ----------------------------------------------------------------------------
function checkbox(group, value, label, desc, checked) {
  return `<label class="opt"><input type="checkbox" name="${group}" value="${value}" ${checked ? 'checked' : ''}/>
    <span><span class="label">${label}</span><br/><span class="desc">${desc}</span></span></label>`;
}
function radio(group, value, label, desc, checked) {
  return `<label class="opt"><input type="radio" name="${group}" value="${value}" ${checked ? 'checked' : ''}/>
    <span><span class="label">${label}</span><br/><span class="desc">${desc}</span></span></label>`;
}

function renderForm() {
  $('#opt-agents').innerHTML = ALL_AGENTS.map((a) =>
    checkbox('agents', a, AGENT_LABELS[a][0], `<code>${AGENT_LABELS[a][1]}</code>`, state.agents.has(a))).join('');
  $('#opt-profile').innerHTML = PROFILES.map((p) =>
    radio('profile', p, PROFILE_LABELS[p][0], PROFILE_LABELS[p][1], state.profile === p)).join('');
  $('#opt-projectType').innerHTML = Object.entries(PROJECT_TYPES).map(([k, v]) =>
    radio('projectType', k, v[0], v[1], state.projectType === k)).join('');
  $('#opt-preset').innerHTML = PRESETS.map((p) =>
    radio('preset', p, PRESET_LABELS[p][0], PRESET_LABELS[p][1], state.preset === p)).join('');
  renderModules();
}
function renderModules() {
  $('#opt-modules').innerHTML = MODULES.map((m) =>
    checkbox('modules', m.key, m.label, m.hint, state.modules[m.key])).join('');
}

function renderPillars() {
  $('#pillars-grid').innerHTML = PILLARS.map(([e, h, p]) =>
    `<div class="pillar"><div class="emoji">${e}</div><h3>${h}</h3><p>${p}</p></div>`).join('');
}

// ---- outputs -----------------------------------------------------------------------------------
function selectedAgents() { return ALL_AGENTS.filter((a) => state.agents.has(a)); }

function opts() {
  return {
    profile: state.profile, preset: state.preset, projectType: state.projectType,
    agents: selectedAgents(), modules: state.modules
  };
}

function generatedFiles() {
  const o = opts();
  const files = [];
  files.push({ name: 'TRELLIS.md', content: composeBootstrap(o), gen: true });
  files.push({ name: 'AGENTS.md', content: composeAgentsMd(o.profile), gen: true });
  for (const a of o.agents) {
    if (a === 'codex') continue;
    const rel = AGENT_FILES[a];
    files.push({ name: rel, content: composeAgentPointer(a, pointerToRoot(rel)), gen: true });
  }
  const config = composeTrellisConfig({ ...o, profileDef: PROFILE_DEFS[o.profile] });
  files.push({ name: '.trellis.yaml', content: trellisConfigToYaml(config), gen: true });
  // skeleton, filtered by enabled modules
  for (const [path, content] of Object.entries(SKELETON)) {
    if (includeSkeletonPath(path, state.modules)) files.push({ name: path, content, gen: false });
  }
  return files;
}

function updateOutputs() {
  const o = opts();
  $('#out-spec').textContent = composeBootstrap(o);
  $('#out-npx').textContent = composeNpxCommand(o);
  const files = generatedFiles();
  const gen = files.filter((f) => f.gen);
  const skel = files.filter((f) => !f.gen);
  $('#zip-list').innerHTML =
    gen.map((f) => `<li class="gen">+ ${f.name}</li>`).join('') +
    `<li>· ${skel.length} governed skeleton files (governance/, tech/, quality/${state.modules.evidence_graph ? ', sources/' : ''}${state.modules.extensions ? ', extensions/' : ''}…)</li>`;
}

// ---- events ------------------------------------------------------------------------------------
function wireForm() {
  $('#wizard-form').addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'agents') { t.checked ? state.agents.add(t.value) : state.agents.delete(t.value); }
    else if (t.name === 'modules') { state.modules[t.value] = t.checked; }
    else if (t.name === 'profile') { state.profile = t.value; state.modules = defaultModules(t.value); renderModules(); }
    else if (t.name === 'projectType') { state.projectType = t.value; }
    else if (t.name === 'preset') { state.preset = t.value; }
    updateOutputs();
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.tabpanel').forEach((x) => x.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.tabpanel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  document.querySelectorAll('.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy === 'npx' ? composeNpxCommand(opts()) : composeBootstrap(opts());
      try { await navigator.clipboard.writeText(text); } catch { fallbackCopy(text); }
      const old = btn.textContent; btn.textContent = '✓ Copied'; btn.classList.add('copied');
      setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1600);
    });
  });

  $('#download-zip').addEventListener('click', () => {
    const blob = createZip(generatedFiles().map(({ name, content }) => ({ name: `trellis/${name}`, content })));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'trellis-starter.zip'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
}

// ---- boot --------------------------------------------------------------------------------------
async function boot() {
  renderPillars();
  try {
    const data = await (await fetch('./skeleton.json', { cache: 'no-store' })).json();
    SKELETON = data.skeleton || {};
    PROFILE_DEFS = data.profiles || {};
  } catch (e) {
    console.warn('skeleton.json not loaded (zip will be empty of skeleton files):', e);
  }
  state.modules = defaultModules(state.profile);
  renderForm();
  wireForm();
  updateOutputs();
}

boot();
