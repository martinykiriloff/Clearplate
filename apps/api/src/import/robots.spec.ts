import { crawlDelayMs, isAllowed, parseRobots, refusesAiAgents } from './robots';

const UA = 'ClearplateRecipeImporter/0.1 (+https://example.test)';

describe('robots.txt', () => {
  it('applies the * group with longest-match rules', () => {
    const groups = parseRobots('User-agent: *\nDisallow: /admin/\nAllow: /admin/public\nCrawl-delay: 5\n');
    expect(isAllowed(groups, UA, '/recipe/1')).toBe(true);
    expect(isAllowed(groups, UA, '/admin/users')).toBe(false);
    expect(isAllowed(groups, UA, '/admin/public/x')).toBe(true);
    expect(crawlDelayMs(groups, UA)).toBe(5000);
  });

  it('prefers a group that names our agent', () => {
    const groups = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: ClearplateRecipeImporter\nDisallow:\n');
    expect(isAllowed(groups, UA, '/anything')).toBe(true);
  });

  it('treats a block on AI crawlers as a refusal even when * is allowed', () => {
    const groups = parseRobots('User-agent: anthropic-ai\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nDisallow:\n');
    expect(refusesAiAgents(groups)).toBe(true);
    expect(refusesAiAgents(parseRobots('User-agent: *\nDisallow: /private\n'))).toBe(false);
  });

  it('supports wildcards and end anchors', () => {
    const groups = parseRobots('User-agent: *\nDisallow: /*?search=\nDisallow: /print/$\n');
    expect(isAllowed(groups, UA, '/recipes?search=x')).toBe(false);
    expect(isAllowed(groups, UA, '/print/')).toBe(false);
    expect(isAllowed(groups, UA, '/print/123')).toBe(true);
  });
});
