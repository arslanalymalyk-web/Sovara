import { describe, it, expect } from 'vitest';
import { can, canAnywhere, canGrant, aiCan, ACTIONS, ROLES, ROLE_ORDER, type Ctx, type Resource } from '@/lib/rbac';
import { proto, demoCtx } from './helpers';

function resources(ctx: Ctx): (Resource | null)[] {
  return [null, ...ctx.projects.map((p) => ({ projectId: p.id })), ...ctx.packages.map((w) => ({ packageId: w.id })), ...ctx.areas.map((a) => ({ areaId: a.id })),
    { projectId: 'missing' }, { packageId: 'missing' }, { projectId: ctx.projects[0]!.id, category: 'drawing' }];
}
function mismatch(ctx: Ctx, label: string) {
  const bad: string[] = [];
  const res = resources(ctx);
  for (const u of ctx.users) for (const a of [...Object.keys(ACTIONS), 'no.such.action']) for (const r of res) {
    const x = can(ctx, u.id, a, r), y = proto.can(ctx, u.id, a, r);
    if (JSON.stringify(x) !== JSON.stringify(y)) bad.push(`${label} ${u.id} ${a} ${JSON.stringify(r)}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`);
  }
  return bad;
}

describe('rule tables', () => {
  it('match the prototype exactly', () => {
    expect(ACTIONS).toEqual(proto.ACTIONS); expect(ROLES).toEqual(proto.ROLES); expect([...ROLE_ORDER]).toEqual(proto.ROLE_ORDER);
  });
});

describe('can() parity with the prototype', () => {
  it('gives identical decisions for every user, action and record in the demo data', () => {
    const ctx = demoCtx();
    const bad = mismatch(ctx, 'demo');
    expect(bad.slice(0, 5)).toEqual([]);
    expect(ctx.users.length * (Object.keys(ACTIONS).length + 1) * resources(ctx).length).toBeGreaterThan(20000);
  });

  it('stays identical when accounts, roles and authorities change', () => {
    const variants: [string, (c: Ctx) => void][] = [
      ['suspended user', (c) => { c.users.find((u) => u.id === 'u-pm')!.status = 'suspended'; }],
      ['revoked assignment', (c) => { const a = c.assignments.find((x) => x.userId === 'u-qa'); if (a) a.status = 'revoked'; }],
      ['expired authorities', (c) => { c.now = '2031-06-01T00:00:00+03:00'; }],
      ['before authorities start', (c) => { c.now = '2020-01-01T00:00:00+03:00'; }],
      ['revoked authority', (c) => { for (const d of c.authorities ?? []) if (d.userId === 'u-qa') d.revokedAt = '2026-01-01'; }],
      ['self-granted authority', (c) => { for (const d of c.authorities ?? []) d.grantedBy = d.userId; }],
      ['customer in the wrong org', (c) => { c.users.find((u) => u.id === 'u-cv')!.orgId = 'org-wh'; }],
      ['user without an org', (c) => { c.users.find((u) => u.id === 'u-so')!.orgId = 'nope'; }],
      ['staff role on a customer user', (c) => { c.assignments.push({ userId: 'u-cv', role: 'general_manager', scope: { projectId: '*' } }); }],
      ['unknown role', (c) => { c.assignments.push({ userId: 'u-so', role: 'wizard', scope: { projectId: '*' } }); }],
    ];
    for (const [label, mutate] of variants) {
      const ctx = demoCtx(); mutate(ctx);
      expect(mismatch(ctx, label).slice(0, 3)).toEqual([]);
    }
  });
});

describe('canAnywhere, canGrant, aiCan parity', () => {
  const ctx = demoCtx();
  it('canAnywhere matches for every user and action', () => {
    for (const u of ctx.users) for (const a of Object.keys(ACTIONS)) expect(canAnywhere(ctx, u.id, a), `${u.id} ${a}`).toBe(proto.canAnywhere(ctx, u.id, a));
  });
  it('aiCan matches for every user and action', () => {
    for (const u of ctx.users) for (const a of Object.keys(ACTIONS)) for (const r of [null, { projectId: 'p1' }]) expect(aiCan(ctx, u.id, a, r), `${u.id} ${a}`).toEqual(proto.aiCan(ctx, u.id, a, r));
  });
  it('canGrant matches across a grid of grants', () => {
    const tech = Object.keys(ACTIONS).filter((a) => ACTIONS[a]!.kind === 'technical');
    const dates = [undefined, '2026-12-31', '2028-01-01'];
    let n = 0;
    for (const grantor of ['u-adm', 'u-pm', 'u-gm']) for (const u of ctx.users) for (const action of [...tech, 'document.view']) for (const validTo of dates) for (const nominatedBy of [undefined, 'u-om', grantor]) for (const projectId of ['p1', 'nope']) {
      const g = { userId: u.id, action, scope: { projectId }, validTo, nominatedBy };
      expect(canGrant(ctx, grantor, g), JSON.stringify(g)).toEqual(proto.canGrant(ctx, grantor, g)); n++;
    }
    expect(n).toBeGreaterThan(5000);
  });
});

describe('invariants the plan relies on', () => {
  const ctx = demoCtx();
  it('the portal administrator can never sign off technical work', () => {
    for (const a of Object.keys(ACTIONS).filter((k) => ACTIONS[k]!.kind === 'technical')) expect(can(ctx, 'u-adm', a, { projectId: 'p1' }).allowed).toBe(false);
  });
  it('a customer never sees another customer organisation\'s project', () => {
    expect(can(ctx, 'u-wv', 'project.view', { projectId: 'p1' }).code).toBe('org_boundary');
  });
  it('a suspended account is refused everything', () => {
    ctx.users.find((u) => u.id === 'u-cv')!.status = 'suspended';
    expect(can(ctx, 'u-cv', 'project.view', { projectId: 'p1' }).code).toBe('inactive');
  });
});
