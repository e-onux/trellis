#!/usr/bin/env node
// Trellis CLI. Thin wrapper over @sidrelabs/trellis-core. ESM, zero non-core dependencies.
import fs from 'node:fs';
import path from 'node:path';
import {
  init, audit, validateContract, budgetCheck, validateExtensions,
  readYaml, findStandardDir, PROFILES, PRESETS
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
    for (const issue of report.references.evidenceIssues) console.log(`     ${yellow('evidence')} ${issue}`);
    for (const issue of report.references.decisionIssues) console.log(`     ${yellow('decision')} ${issue}`);
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

  help() { printHelp(); },
  version() { console.log(`trellis ${pkgVersion()}`); }
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
  ${cyan('extension validate')}   Check extension registration completeness    ${dim('[<id> --root <dir>]')}
  ${cyan('capability add')}       Scaffold a new capability                    ${dim('<id> [--root <dir>]')}
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
