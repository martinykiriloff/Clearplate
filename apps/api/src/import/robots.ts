/** A robots.txt group: the agents it addresses and its rules, in file order. */
export interface RobotsGroup {
  agents: string[];
  rules: { allow: boolean; path: string }[];
  crawlDelaySec: number | null;
}

/** Agent tokens that site owners use to opt out of AI crawlers. A `Disallow: /` for any of them is honoured. */
const AI_AGENT_TOKENS = ['anthropic-ai', 'claudebot', 'claude-web', 'gptbot', 'ccbot', 'ai2bot', 'bytespider'];

export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let collectingAgents = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!current || !collectingAgents) {
        current = { agents: [], rules: [], crawlDelaySec: null };
        groups.push(current);
        collectingAgents = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) continue;
    collectingAgents = false;
    if (field === 'allow' || field === 'disallow') {
      if (value || field === 'disallow') current.rules.push({ allow: field === 'allow', path: value });
    } else if (field === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) current.crawlDelaySec = n;
    }
  }
  return groups;
}

/** The group for our agent (first token of the User-Agent, case-insensitive), else the `*` group. */
export function groupFor(groups: RobotsGroup[], userAgent: string): RobotsGroup | null {
  const token = userAgent.split('/')[0].toLowerCase();
  return groups.find((g) => g.agents.some((a) => a !== '*' && token.includes(a))) ?? groups.find((g) => g.agents.includes('*')) ?? null;
}

const toRegex = (pattern: string): RegExp => {
  const escaped = pattern
    .split('*')
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + (escaped.endsWith('\\$') ? escaped.slice(0, -2) + '$' : escaped));
};

/** Standard longest-match evaluation; an empty Disallow allows everything. */
export function isAllowed(groups: RobotsGroup[], userAgent: string, path: string): boolean {
  const group = groupFor(groups, userAgent);
  if (!group) return true;
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of group.rules) {
    if (!rule.path) continue;
    if (!toRegex(rule.path).test(path)) continue;
    if (!best || rule.path.length > best.length || (rule.path.length === best.length && rule.allow)) best = { allow: rule.allow, length: rule.path.length };
  }
  return best ? best.allow : true;
}

/** True when the site shuts out AI crawlers by name; we then leave it alone even if `*` is allowed. */
export function refusesAiAgents(groups: RobotsGroup[]): boolean {
  return groups.some((g) => g.agents.some((a) => AI_AGENT_TOKENS.includes(a)) && g.rules.some((r) => !r.allow && r.path === '/'));
}

export function crawlDelayMs(groups: RobotsGroup[], userAgent: string): number | null {
  const sec = groupFor(groups, userAgent)?.crawlDelaySec;
  return sec == null ? null : sec * 1000;
}
