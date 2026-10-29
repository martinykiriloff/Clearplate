import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crawlDelayMs, isAllowed, parseRobots, refusesAiAgents, RobotsGroup } from './robots';

export const USER_AGENT = 'ClearplateRecipeImporter/0.1 (+https://github.com/martinykiriloff/Clearplate; nutrition estimates; contact via the repository)';

export interface CrawlerOptions {
  /** Pages are kept on disk so re-imports (after dictionary fixes) never hit the site again. */
  cacheDir: string;
  /** Minimum gap between two requests to the same host. The site's Crawl-delay wins when larger. */
  delayMs: number;
  encoding?: 'windows-1251';
  /** Never go to the network; a page missing from the cache counts as not fetched. */
  offline?: boolean;
  log?: (message: string) => void;
}

export interface CrawlStats {
  fromCache: number;
  fetched: number;
  missing: number;
  errors: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polite per-host fetcher: honours robots.txt (including opt-outs aimed at AI agents),
 * identifies itself, serialises requests with a delay, backs off on 429/5xx and caches bodies.
 */
export class HostCrawler {
  readonly stats: CrawlStats = { fromCache: 0, fetched: 0, missing: 0, errors: 0 };
  private robots: RobotsGroup[] = [];
  private delayMs: number;
  private queue: Promise<void> = Promise.resolve();
  private nextSlotAt = 0;

  constructor(
    readonly host: string,
    private readonly options: CrawlerOptions,
  ) {
    this.delayMs = options.delayMs;
    mkdirSync(join(options.cacheDir, host), { recursive: true });
  }

  /** Reads robots.txt. Returns the reason the host must be skipped, or null when crawling is allowed. */
  async init(): Promise<string | null> {
    const text = await this.fetchText(`https://${this.host}/robots.txt`, { ignoreRobots: true });
    this.robots = text ? parseRobots(text) : [];
    if (refusesAiAgents(this.robots)) return 'robots.txt disallows AI crawlers';
    if (!isAllowed(this.robots, USER_AGENT, '/')) return 'robots.txt disallows crawling';
    const siteDelay = crawlDelayMs(this.robots, USER_AGENT);
    if (siteDelay != null) this.delayMs = Math.max(this.delayMs, siteDelay);
    return null;
  }

  /** Body of a page (decoded), or null when it is gone, disallowed or could not be fetched. */
  async fetchText(url: string, opts: { ignoreRobots?: boolean } = {}): Promise<string | null> {
    const path = new URL(url).pathname + new URL(url).search;
    if (!opts.ignoreRobots && !isAllowed(this.robots, USER_AGENT, path)) return null;

    const file = join(this.options.cacheDir, this.host, createHash('sha1').update(url).digest('hex'));
    if (existsSync(`${file}.html`)) {
      this.stats.fromCache++;
      return readFileSync(`${file}.html`, 'utf8');
    }
    if (existsSync(`${file}.missing`)) {
      this.stats.missing++;
      return null;
    }
    if (this.options.offline) return null;

    const body = await this.enqueue(() => this.download(url));
    if (body === null) {
      writeFileSync(`${file}.missing`, url);
      this.stats.missing++;
      return null;
    }
    if (body === undefined) {
      this.stats.errors++;
      return null;
    }
    writeFileSync(`${file}.html`, body, 'utf8');
    this.stats.fetched++;
    return body;
  }

  /** One request at a time per host, `delayMs` apart. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.nextSlotAt - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await task();
      } finally {
        this.nextSlotAt = Date.now() + this.delayMs;
      }
    });
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** null = permanently gone, undefined = failed after retries. */
  private async download(url: string, attempt = 1): Promise<string | null | undefined> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'bg,en;q=0.5' },
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 404 || res.status === 410 || res.status === 403 || res.status === 451) return null;
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= 3) {
          this.options.log?.(`${url}: ${res.status} after ${attempt} attempts, giving up`);
          return undefined;
        }
        const retryAfter = Number(res.headers.get('retry-after'));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 120_000) : 10_000 * attempt;
        this.options.log?.(`${url}: ${res.status}, waiting ${backoff} ms`);
        await sleep(backoff);
        return this.download(url, attempt + 1);
      }
      if (!res.ok) {
        this.options.log?.(`${url}: unexpected ${res.status}`);
        return undefined;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      return new TextDecoder(this.options.encoding ?? 'utf-8').decode(bytes);
    } catch (err) {
      if (attempt >= 3) {
        this.options.log?.(`${url}: ${err instanceof Error ? err.message : String(err)}, giving up`);
        return undefined;
      }
      await sleep(5_000 * attempt);
      return this.download(url, attempt + 1);
    }
  }
}
