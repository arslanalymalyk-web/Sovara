import { createRequire } from 'node:module';
import path from 'node:path';
import type { Ctx } from '@/lib/rbac';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../../rgs-portal');

/** The prototype's access module, used as the oracle. */
export const proto = require(path.join(root, 'rbac.js')) as {
  can: (ctx: unknown, u: string, a: string, r?: unknown) => { allowed: boolean; code: string; trace: string[]; via?: string; authority?: string };
  canAnywhere: (ctx: unknown, u: string, a: string) => boolean;
  canGrant: (ctx: unknown, g: string, grant: unknown) => { allowed: boolean; code: string; trace: string[] };
  aiCan: (ctx: unknown, u: string, a: string, r?: unknown) => { allowed: boolean; code: string; trace: string[] };
  ACTIONS: Record<string, unknown>; ROLES: Record<string, unknown>; ROLE_ORDER: string[];
};
export const fixtures = require(path.join(root, 'fixtures/demo-fixtures.js')) as Record<string, any[] | string>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function demoCtx(): Ctx {
  const f = fixtures as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return structuredClone({ now: f.now, orgs: f.orgs, users: f.users, projects: f.projects, areas: f.areas, packages: f.packages, assignments: f.assignments, authorities: f.authorities }) as Ctx;
}
