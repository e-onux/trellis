#!/usr/bin/env node
// Trellis CLI. Thin wrapper over @sidrelabs/trellis-core. ESM, zero non-core dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  init, audit, validateContract, budgetCheck, validateExtensions,
  readYaml, findStandardDir, PROFILES, PRESETS,
  checkModelProvenance, stampProvenance, PROVENANCE_FILE, scanSecrets, installHooks,
  inventoryStatus, findInventory, validateInventory, addInventoryRecord, updateInventoryRecord,
  removeInventoryRecord, migrateInventory, recoverInventory, diffInventory, mergeInventory, formatDiff
} from '@sidrelabs/trellis-core';

// ---- tiny ANSI helpers (no dependency) ---------------------------------------------------------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = c('1'), dim = c('2'), red = c('31'), green = c('32'), yellow = c('33'), cyan = c('36');
const ok = (s) => green(`✓ ${s}`);
const bad = (s) => red(`✗ ${s}`);
const warn = (s) => yellow(`! ${s}`);

// ---- arg parsing -------------------------------------------------------------------------------
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { flags[key] = true; }
      else { flags[key] = next; i++; }
    } else positional.push(a);
  }
  return { positional, flags };
}

function rootOf(flags) {
  return path.resolve(flags.root || process.cwd());
}

// ---- capability discovery ----------------------------------------------------------------------
function discoverCapabilities(repoRoot) {
  const cfg = fs.existsSync(path.join(repoRoot, '.trellis.yaml')) ? readYaml(path.join(repoRoot, '.trellis.yaml')) : {};
  const base = path.join(repoRoot, cfg.paths?.capabilities || 'capabilities');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(base, e.name))
    .filter((d) => fs.existsSync(path.join(d, 'contract.yaml')));
}

// ---- commands ----------------------------------------------------------------------------------
const commands = {
  init(flags) {
    const repoRoot = rootOf(flags);
    const agents = typeof flags.agents === 'string' ? flags.agents.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    const profile = flags.profile || 'backend';
    const preset = flags.preset || 'standard';
    if (!PROFILES.includes(profile)) fail(`Unknown profile "${profile}". Choose: ${PROFILES.join(', ')}`);
    if (!PRESETS.includes(preset)) fail(`Unknown preset "${preset}". Choose: ${PRESETS.join(', ')}`);

    console.log(bold(`\n🌿 Initializing Trellis`) + dim(`  profile=${profile} preset=${preset}`));
    const res = init({ repoRoot, profile, preset, agents, overwrite: !!flags.overwrite });
    console.log(ok(`Scaffolded ${res.created.length} files into ${path.relative(process.cwd(), repoRoot) || '.'}`));
    console.log(dim(`   governance/ product/ tech/ sources/ extensions/ capabilities/ quality/ lifecycle/`));
    console.log(ok(`Agent adapters: ${cyan('AGENTS.md')} (canonical) + ${res.agents.join(', ') || 'none'}`));
    console.log(`\nNext: add your first capability →  ${cyan('trellis capability add <id>')}`);
    console.log(`Then verify →  ${cyan('trellis audit')}\n`);
  },

  validate(flags) {
    const repoRoot = rootOf(flags);
    if (flags.capability) {
      const r = validateOne(repoRoot);
      process.exitCode = r ? 0 : 1;
      return;
    }
    const caps = discoverCapabilities(repoRoot);
    if (!caps.length) { console.log(warn('No capabilities found (looked in capabilities/).')); return; }
    console.log(bold(`\nValidating ${caps.length} capability contract(s)\n`));
    let failed = 0;
    for (const dir of caps) failed += validateOne(dir) ? 0 : 1;
    console.log('');
    console.log(failed ? bad(`${failed} capability/capabilities failed validation`) : ok('All contracts valid'));
    process.exitCode = failed ? 1 : 0;
  },

  'budget-check'(flags) {
    const repoRoot = rootOf(flags);
    const dirs = flags.capability ? [repoRoot] : discoverCapabilities(repoRoot);
    if (!dirs.length) { console.log(warn('No capabilities found.')); return; }
    console.log(bold(`\nCapability budgets\n`));
    let violations = 0;
    for (const dir of dirs) {
      const b = budgetCheck(dir, { repoRoot });
      const head = b.ok ? ok(b.id) : bad(b.id);
      console.log(`${head} ${dim(`(files via ${b.mode}, deps via ${b.depsSource})`)}`);
      for (const ck of b.checks) {
        const val = ck.measurable ? `${ck.measured}/${ck.limit}` : `${dim('declared-only')} (limit ${ck.limit})`;
        const mark = !ck.measurable ? dim('·') : ck.ok ? green('✓') : red('✗');
        console.log(`   ${mark} ${ck.budget.replace(/^max_/, '')}: ${val}`);
      }
      if (b.externalImports.length) console.log(dim(`   imports: ${b.externalImports.join(', ')}`));
      violations += b.violations.length ? 1 : 0;
    }
    console.log('');
    console.log(violations ? bad(`${violations} capability/capabilities over budget`) : ok('All capabilities within budget'));
    process.exitCode = violations ? 1 : 0;
  },

  audit(flags) {
    const repoRoot = rootOf(flags);
    const report = audit(repoRoot);
    if (flags.json) { console.log(JSON.stringify(report, null, 2)); process.exitCode = report.ok ? 0 : 1; return; }
    const s = report.summary;
    console.log(bold(`\n🌿 Trellis Audit`) + dim(`  ${path.relative(process.cwd(), repoRoot) || '.'}  (profile=${report.config.profile || '?'}, preset=${report.config.preset || '?'})\n`));
    line('Capabilities', s.capabilities);
    line('Healthy', s.healthy, s.healthy === s.capabilities);
    line('Contract violations', s.contractViolations, s.contractViolations === 0);
    line('Budget violations', s.budgetViolations, s.budgetViolations === 0);
    line('Missing error scenario', s.missingErrorScenario, s.missingErrorScenario === 0);
    line('Overdue reviews', s.overdueReviews, s.overdueReviews === 0);
    line('Broken evidence links', s.brokenEvidenceLinks, s.brokenEvidenceLinks === 0);
    line('Broken decision links', s.brokenDecisionLinks, s.brokenDecisionLinks === 0);
    line('Extension issues', s.extensionIssues, s.extensionIssues === 0);
    if (report.inventory.evaluated) line('Inventory issues', s.inventoryIssues, s.inventoryIssues === 0);
    for (const issue of report.references.evidenceIssues) console.log(`     ${yellow('evidence')} ${issue}`);
    for (const issue of report.references.decisionIssues) console.log(`     ${yellow('decision')} ${issue}`);
    for (const i of report.inventory.issues) console.log(`     ${yellow('inventory')} ${i.id} ${i.kind}: ${i.message}`);
    console.log('');
    console.log(bold('Gates'));
    for (const g of report.gates) {
      if (g.status === 'not-evaluated') {
        console.log('  ' + dim(`· ${g.id} - not evaluated (no check wired yet)`));
        continue;
      }
      const tag = g.enforced ? '' : dim(' (advisory)');
      const label = `${g.id}${tag}`;
      console.log('  ' + (g.status === 'passed' ? ok(label) : (g.enforced ? bad(label) : warn(label))) + (g.failingCount ? dim(`  ${g.failingCount} finding(s)`) : ''));
    }
    console.log('');
    console.log(report.ok ? green(bold('PASS - no enforced gate failures')) : red(bold(`FAIL - ${s.enforcedGateFailures} enforced gate(s) failing`)));
    if (s.gatesNotEvaluated) console.log(dim(`${s.gatesNotEvaluated} declared gate(s) have no wired check yet and were not evaluated.`));
    console.log('');
    process.exitCode = report.ok ? 0 : 1;
  },

  'model-check'(flags) {
    const repoRoot = rootOf(flags);
    const since = typeof flags.since === 'string' ? flags.since : undefined;
    const r = checkModelProvenance(repoRoot, { since });
    if (flags.json) {
      console.log(JSON.stringify(r, null, 2));
      process.exitCode = r.evaluated && !r.ok && r.enforcement === 'block' ? 1 : 0;
      return;
    }
    if (!r.evaluated) {
      // Opt-in (ADR-0009): no configured allow-list is neither a pass nor a block.
      console.log(warn(`model-provenance not evaluated - ${r.reason}`));
      if (!r.configured) console.log(dim(`Opt in by listing allowed_models in governance/model-policy.yaml.`));
      return;
    }
    const checked = r.results.length;
    console.log(bold(`\nModel provenance`) + dim(`  enforcement=${r.enforcement}, ${checked} commit(s) in window\n`));
    for (const v of r.violations) {
      const why = v.status === 'unverified' ? 'no recorded model' : `model ${v.model}`;
      console.log('  ' + bad(`${v.commit.slice(0, 9)}  ${v.status}`) + dim(`  ${why}`));
    }
    console.log('');
    if (r.ok) {
      console.log(green(bold(`PASS - all ${checked} commit(s) authored by an allowed model`)));
      process.exitCode = 0;
    } else if (r.enforcement === 'block') {
      console.log(red(bold(`FAIL - ${r.violations.length} commit(s) violate the model policy`)));
      console.log(dim(`Stamp a real author with: trellis model-stamp --commit <sha> --model <id>`));
      process.exitCode = 1;
    } else {
      console.log(yellow(bold(`WARN - ${r.violations.length} commit(s) violate the model policy (advisory)`)));
      process.exitCode = 0;
    }
    console.log('');
  },

  'model-stamp'(flags) {
    const repoRoot = rootOf(flags);
    const model = typeof flags.model === 'string' ? flags.model : undefined;
    if (!model) fail('Provide --model <id>  (e.g. trellis model-stamp --commit HEAD --model my-frontier-model)');
    const ref = typeof flags.commit === 'string' ? flags.commit : 'HEAD';
    let commit = ref;
    try { commit = execFileSync('git', ['rev-parse', ref], { cwd: repoRoot, encoding: 'utf8' }).trim(); } catch { /* not a git ref; record as given */ }
    const agent = typeof flags.agent === 'string' ? flags.agent : undefined;
    stampProvenance(repoRoot, { commit, model, agent });
    console.log(ok(`Stamped ${commit.slice(0, 9)} → ${model}${agent ? ` (${agent})` : ''}`) + dim(`  in ${PROVENANCE_FILE}`));
  },

  'secret-scan'(flags) {
    const repoRoot = rootOf(flags);
    const r = scanSecrets(repoRoot, { since: typeof flags.since === 'string' ? flags.since : undefined, staged: !!flags.staged });
    if (flags.json) { console.log(JSON.stringify(r, null, 2)); process.exitCode = r.ok ? 0 : 1; return; }
    console.log(bold(`\nSecret scan`) + dim(`  ${r.scanned} file(s) scanned\n`));
    for (const f of r.findings) {
      console.log('  ' + bad(`${f.file}:${f.line}`) + `  ${f.rule}` + dim(`  (${f.length})`));
    }
    console.log('');
    if (r.ok) {
      console.log(green(bold(`PASS - no committed secrets`)));
      process.exitCode = 0;
    } else {
      console.log(red(bold(`FAIL - ${r.findings.length} potential secret(s) found`)));
      console.log(dim(`Move it to env/secret store. Intentional fixture? add an inline 'trellis-allow-secret' comment.`));
      process.exitCode = 1;
    }
    console.log('');
  },

  hook(flags, positional) {
    const sub = positional[0];
    if (sub !== 'install') fail(`Unknown hook subcommand "${sub || ''}". Try: trellis hook install [--force] [--only post-commit|pre-push]`);
    const repoRoot = rootOf(flags);
    const only = flags.only === 'post-commit' || flags.only === 'pre-push' ? flags.only : undefined;
    const res = installHooks(repoRoot, { force: !!flags.force, only });
    console.log(bold(`\nTrellis git hooks`) + dim(`  ${res.dir}\n`));
    for (const h of res.installed) console.log('  ' + ok(h));
    for (const s of res.skipped) console.log('  ' + warn(`${s.hook} - ${s.reason}`));
    console.log('');
    console.log(dim(`post-commit stamps provenance when TRELLIS_MODEL is set; pre-push runs 'trellis model-check'.`));
    console.log(dim(`Export TRELLIS_MODEL (and optionally TRELLIS_AGENT) so your commits get stamped.`));
    console.log('');
  },

  extension(flags, positional) {
    const sub = positional[0];
    if (sub !== 'validate') fail(`Unknown extension subcommand "${sub || ''}". Try: trellis extension validate [id]`);
    const repoRoot = rootOf(flags);
    const only = positional[1];
    const res = validateExtensions(repoRoot, only);
    console.log(bold(`\nExtension completeness`) + dim(`  (${res.registries.length} registry file(s))\n`));
    if (!res.results.length) { console.log(warn('No extension contracts found.')); return; }
    for (const r of res.results) {
      console.log(r.ok ? ok(r.id) : bad(r.id));
      for (const m of r.missing) console.log(`   ${red('missing')} ${m}`);
      for (const cd of r.conditional) console.log(`   ${yellow('check')}  ${cd}`);
    }
    console.log('');
    console.log(res.ok ? ok('All required registration points present') : bad('Missing required registration points'));
    process.exitCode = res.ok ? 0 : 1;
  },

  capability(flags, positional) {
    const sub = positional[0];
    if (sub !== 'add') fail(`Unknown capability subcommand "${sub || ''}". Try: trellis capability add <id>`);
    const id = positional[1];
    if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fail('Provide a kebab-case id: trellis capability add <id>');
    const repoRoot = rootOf(flags);
    const standardDir = findStandardDir();
    const cfg = fs.existsSync(path.join(repoRoot, '.trellis.yaml')) ? readYaml(path.join(repoRoot, '.trellis.yaml')) : {};
    const dir = path.join(repoRoot, cfg.paths?.capabilities || 'capabilities', id);
    if (fs.existsSync(dir)) fail(`Capability already exists: ${path.relative(repoRoot, dir)}`);
    fs.mkdirSync(path.join(dir, 'examples'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'evidence'), { recursive: true });
    const contractTpl = fs.readFileSync(path.join(standardDir, 'templates', 'contract-template.yaml'), 'utf8').replace(/\bmy-capability\b/, id);
    const capTpl = fs.readFileSync(path.join(standardDir, 'templates', 'capability-template.md'), 'utf8').replaceAll('{{id}}', id);
    fs.writeFileSync(path.join(dir, 'contract.yaml'), contractTpl);
    fs.writeFileSync(path.join(dir, 'capability.md'), capTpl);
    console.log(ok(`Created ${path.relative(repoRoot, dir)}/ (contract.yaml, capability.md, examples/, tests/, evidence/)`));
    console.log(dim(`Fill in the contract, add a normal + error example, then: trellis validate`));
  },

  inventory(flags, positional) {
    const sub = positional[0];
    const repoRoot = rootOf(flags);
    const handler = inventoryCommands[sub];
    if (!handler) fail(`Unknown inventory subcommand "${sub || ''}". Try: ${Object.keys(inventoryCommands).join(' | ')}`);
    try {
      handler(repoRoot, flags, positional.slice(1));
    } catch (e) {
      if (!e.code) throw e;
      if (flags.json) console.log(JSON.stringify({ error: e.code, message: e.message, notice: e.notice, checks: e.checks, diff: e.diff }, null, 2));
      else {
        console.error(red(`error [${e.code}]: ${e.message}`));
        if (e.notice) printNotice(e.notice);
        if (e.diff) for (const l of formatDiff(e.diff)) console.error(`   ${l}`);
      }
      process.exitCode = e.code === 'NOTICE_REQUIRED' ? 3 : e.code === 'CONFLICT' || e.code === 'DIVERGED' ? 2 : 1;
    }
  },

  help() { printHelp(); },
  version() { console.log(`trellis ${pkgVersion()}`); }
};

// ---- reuse inventory (ADR-0008) ----------------------------------------------------------------
const csv = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : undefined);

function recordFromFlags(flags) {
  const fromJson = typeof flags.record === 'string' ? JSON.parse(flags.record) : {};
  const rec = { ...fromJson };
  for (const k of ['id', 'purpose', 'entry', 'status', 'capability', 'adr']) if (typeof flags[k] === 'string') rec[k] = flags[k];
  for (const k of ['terms', 'tests']) if (typeof flags[k] === 'string') rec[k] = csv(flags[k]);
  for (const k of csv(flags.clear) || []) rec[k] = null;
  return rec;
}

function printNotice(notice) {
  console.log('');
  console.log(bold('Migration notice') + dim(`  (tell the user ONCE, before migrating${notice.translate ? ' - translate it to the conversation language' : ''})`));
  console.log(`  ${notice.text}`);
  console.log(dim('  Then run: trellis inventory migrate --notified'));
}

function printStatus(st, flags) {
  if (flags.json) return console.log(JSON.stringify(st, null, 2));
  const size = st.records !== undefined ? dim(`  ${st.records} record(s)${st.bytes !== undefined ? `, ${st.bytes} bytes` : ''}`) : '';
  console.log(`${bold('Reuse inventory')}  state=${cyan(st.state)}${size}`);
  if (st.message) console.log(yellow(`  ${st.message}`));
  if (st.stale_temp) console.log(yellow(`  leftover temp file from an interrupted migration (trellis inventory recover removes it)`));
  if (st.state === 'migration_pending') { console.log(dim(`  threshold crossed: ${st.reasons.join('; ')}`)); printNotice(st.notice); }
}

const inventoryCommands = {
  status(repoRoot, flags) { printStatus(inventoryStatus(repoRoot, { lang: flags.lang }), flags); },

  find(repoRoot, flags, rest) {
    const query = rest.join(' ').trim();
    if (!query) fail('Provide a query: trellis inventory find "<what you need>" [--limit 3] [--json]');
    const r = findInventory(repoRoot, query, { limit: flags.limit });
    if (flags.json) return console.log(JSON.stringify(r, null, 2));
    for (const x of r.results) {
      console.log(`${bold(x.id)} ${dim(`[${x.status}] score ${x.score}`)}  ${x.purpose}`);
      console.log(`   entry ${cyan(x.entry)}  tests ${x.tests.join(', ')}${x.capability ? `  capability ${x.capability}` : ''}${x.adr ? `  ${x.adr}` : ''}`);
      console.log(dim(`   matched: ${x.matched.join(', ')}`));
    }
    if (r.truncated) console.log(dim(`(${r.total_matches - r.results.length} more match(es) not shown - refine the query)`));
    console.log(dim(r.hint));
  },

  add(repoRoot, flags) {
    const r = addInventoryRecord(repoRoot, recordFromFlags(flags));
    console.log(ok(`Added ${r.record.id}`) + dim(`  (${r.status.format || r.status.state})`));
    if (r.status.state === 'migration_pending') printStatus(r.status, {});
  },

  update(repoRoot, flags, rest) {
    if (!rest[0]) fail('Provide the id: trellis inventory update <id> --purpose ... [--clear capability,adr]');
    const r = updateInventoryRecord(repoRoot, rest[0], recordFromFlags(flags));
    console.log(ok(`Updated ${r.record.id}`));
    if (r.status.state === 'migration_pending') printStatus(r.status, {});
  },

  remove(repoRoot, flags, rest) {
    if (!rest[0]) fail('Provide the id: trellis inventory remove <id>');
    removeInventoryRecord(repoRoot, rest[0]);
    console.log(ok(`Removed ${rest[0]}`));
  },

  validate(repoRoot, flags) {
    const r = validateInventory(repoRoot);
    if (flags.json) { console.log(JSON.stringify(r, null, 2)); process.exitCode = r.ok ? 0 : 1; return; }
    if (!r.evaluated) { console.log(dim('Reuse inventory disabled - not evaluated.')); return; }
    for (const i of r.issues) console.log('  ' + bad(`${i.id}`) + `  ${i.kind}: ${i.message}`);
    console.log(r.ok ? ok(`Inventory valid (${r.count} record(s), ${r.state})`) : bad(`${r.issues.length} inventory issue(s)`));
    process.exitCode = r.ok ? 0 : 1;
  },

  migrate(repoRoot, flags) {
    const r = migrateInventory(repoRoot, { notified: !!flags.notified, force: !!flags.force });
    if (flags.json) return console.log(JSON.stringify(r, null, 2));
    if (!r.migrated) return console.log(dim(r.message));
    for (const c of r.checks) console.log('  ' + ok(`${c.check}`) + dim(`  ${c.detail}`));
    console.log(ok(`Migrated ${r.records} record(s) to ${r.sqlite}; removed ${r.removed}`));
    console.log(dim(`Commit both changes together: git add -A ${path.posix.dirname(r.sqlite)}`));
  },

  recover(repoRoot, flags) {
    const keep = flags.keep === 'sqlite' || flags.keep === 'jsonl' ? flags.keep : undefined;
    const r = recoverInventory(repoRoot, { keep });
    if (flags.json) return console.log(JSON.stringify(r, null, 2));
    console.log(r.resolved ? ok(`${r.action} → state=${r.state}`) : dim(r.message));
  },

  diff(repoRoot, flags, rest) {
    const d = diffInventory(repoRoot, { from: rest[0] || 'HEAD', to: rest[1] });
    if (flags.json) return console.log(JSON.stringify(d, null, 2));
    console.log(bold(`Inventory diff`) + dim(`  ${d.from} (${d.fromSource}) → ${d.to} (${d.toSource})`));
    const lines = formatDiff(d);
    for (const l of lines) console.log(`  ${l.startsWith('+') ? green(l) : l.startsWith('-') ? red(l) : yellow(l)}`);
    if (!lines.length) console.log(dim('  no record changes'));
  },

  merge(repoRoot, flags, rest) {
    if (!rest[0]) fail('Provide the other branch: trellis inventory merge <ref> [--prefer ours|theirs] [--dry-run]');
    const prefer = flags.prefer === 'ours' || flags.prefer === 'theirs' ? flags.prefer : undefined;
    const r = mergeInventory(repoRoot, rest[0], { prefer, dryRun: !!flags['dry-run'] });
    if (flags.json) { console.log(JSON.stringify(r, null, 2)); process.exitCode = r.conflicts.length && !prefer ? 2 : 0; return; }
    for (const l of formatDiff(r.changes)) console.log(`  ${l}`);
    for (const c of r.conflicts) console.log('  ' + bad(`conflict ${c.id}`) + dim('  changed differently on both branches'));
    if (r.conflicts.length && !prefer) { console.log(red('Not written. Resolve with --prefer ours|theirs, or edit one side and re-run.')); process.exitCode = 2; return; }
    console.log(r.written ? ok('Merged inventory written - run `trellis inventory validate`, then `git add`.') : dim('Dry run - nothing written.'));
  }
};

// ---- helpers -----------------------------------------------------------------------------------
function validateOne(dir) {
  const contractPath = path.join(dir, 'contract.yaml');
  if (!fs.existsSync(contractPath)) { console.log(bad(`${path.basename(dir)} - no contract.yaml`)); return false; }
  const contract = readYaml(contractPath);
  const v = validateContract(contract);
  const b = budgetCheck(dir, { repoRoot: path.resolve(dir, '..', '..') });
  const id = contract.id || path.basename(dir);
  if (v.ok && b.ok) console.log(ok(`${id}`));
  else console.log(bad(`${id}`));
  for (const e of v.errors) console.log(`   ${red('error')}  ${e}`);
  for (const w of v.warnings) console.log(`   ${yellow('warn')}   ${w}`);
  for (const bv of b.violations) console.log(`   ${red('budget')} ${bv}`);
  return v.ok && b.ok;
}

function line(label, value, good) {
  const v = good === undefined ? String(value) : (good ? green(String(value)) : red(String(value)));
  console.log(`  ${label.padEnd(24)} ${v}`);
}

function pkgVersion() {
  try {
    const p = new URL('../package.json', import.meta.url);
    return JSON.parse(fs.readFileSync(p, 'utf8')).version;
  } catch { return '0.1.0'; }
}

function fail(msg) { console.error(red(`error: ${msg}`)); process.exit(1); }

function printHelp() {
  console.log(`
${bold('🌿 trellis')} ${dim(pkgVersion())} - capability-first, evidence-governed standard for AI-built software

${bold('Usage')}
  trellis <command> [options]

${bold('Commands')}
  ${cyan('init')}                 Scaffold the governed structure + agent adapters into a repo
                         ${dim('--profile <backend|frontend|data-pipeline|llm-app>  --preset <light|standard|strict>')}
                         ${dim('--agents claude,codex,copilot,cursor,windsurf,gemini  --overwrite  --root <dir>')}
  ${cyan('validate')}             Validate capability contracts (+ budgets)   ${dim('[--capability --root <dir>]')}
  ${cyan('budget-check')}         Check capability size/dependency budgets     ${dim('[--capability --root <dir>]')}
  ${cyan('audit')}                Whole-repo health report + quality gates     ${dim('[--json --root <dir>]')}
  ${cyan('model-check')}          Verify commits were authored by an allowed model (opt-in)  ${dim('[--since <ref> --json --root <dir>]')}
  ${cyan('model-stamp')}          Record which model authored a commit         ${dim('--model <id> [--commit <ref> --agent <id>]')}
  ${cyan('secret-scan')}          Scan for committed secrets (keys, tokens)    ${dim('[--staged --since <ref> --json --root <dir>]')}
  ${cyan('hook install')}         Install git hooks (model-stamp + pre-push check) ${dim('[--force --only <hook> --root <dir>]')}
  ${cyan('extension validate')}   Check extension registration completeness    ${dim('[<id> --root <dir>]')}
  ${cyan('capability add')}       Scaffold a new capability                    ${dim('<id> [--root <dir>]')}
  ${cyan('inventory find')}       Search reusable solutions (bounded results)  ${dim('<query> [--limit 3 --json]')}
  ${cyan('inventory')} ${dim('status | add | update <id> | remove <id> | validate | migrate --notified | recover | diff [from] [to] | merge <ref>')}
  ${cyan('help')} | ${cyan('version')}

${bold('Examples')}
  trellis init --profile llm-app --preset strict --agents claude,codex
  trellis capability add calculate-shipping-cost
  trellis audit
`);
}

// ---- dispatch ----------------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') return printHelp();
  if (argv[0] === '--version' || argv[0] === '-v') return console.log(`trellis ${pkgVersion()}`);
  const cmd = argv[0];
  const { positional, flags } = parseArgs(argv.slice(1));
  const handler = commands[cmd];
  if (!handler) { console.error(red(`Unknown command: ${cmd}`)); printHelp(); process.exit(1); }
  try {
    handler(flags, positional);
  } catch (e) {
    fail(e.message);
  }
}

main();
