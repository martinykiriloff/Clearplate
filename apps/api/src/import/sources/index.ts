import { gotvetesmen } from './gotvetesmen';
import { recepti1001 } from './recepti1001';
import { receptite } from './receptite';
import type { RecipeSource } from './types';

/**
 * Sources whose robots.txt permits general crawling and does not single out AI agents.
 * gotvach.bg / bonapeti.bg block Anthropic crawlers and 24kitchen.bg and rozali.com
 * block AI agents, so they are deliberately absent.
 */
export const RECIPE_SOURCES: readonly RecipeSource[] = [receptite, gotvetesmen, recepti1001];
