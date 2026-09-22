import data from './catalogue.json';
import type { Definition } from './project.js';

export const catalogue = data as { version: number; tags: Definition[] };
