import { z } from 'zod';
import type { Profile } from '../core/types';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date like 2026-11-02');
const id = z.string().regex(/^[a-z0-9][a-z0-9-_]*$/i, 'Use letters, digits, - or _');

const category = z.object({
  id,
  name: z.string().min(1),
  hidden: z.boolean().default(false),
});

const area = z.object({
  id,
  name: z.string().min(1),
  color: z.string().default('#1f6f5c'),
  countsAsWork: z.boolean().default(true),
  hidden: z.boolean().default(false),
  categories: z.array(category).default([]),
});

const phase = z.object({
  id,
  name: z.string().min(1),
  start: isoDate,
  end: isoDate,
  plannedHoursPerWeek: z.union([z.number().min(0), z.literal('zero-balance')]),
  areaShare: z.record(z.string(), z.number()).optional(),
  note: z.string().optional(),
});

export const profileSchema = z
  .object({
    version: z.literal(1).default(1),
    name: z.string().default('My profile'),
    locale: z.enum(['en', 'de']).optional(),
    period: z.object({
      start: isoDate,
      end: isoDate,
      startBalanceHours: z.number().default(0),
    }),
    contract: z.object({
      weeklyHours: z.number().min(0),
      workdays: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5]),
    }),
    vacation: z
      .object({
        daysPerYear: z.number().min(0).default(0),
        proRata: z.boolean().default(true),
        overrides: z.record(z.string(), z.number()).default({}),
      })
      .default({ daysPerYear: 0, proRata: true, overrides: {} }),
    holidays: z
      .object({
        country: z.string().default(''),
        region: z.string().optional(),
        extra: z.array(z.object({ date: isoDate, name: z.string() })).default([]),
        excluded: z.array(isoDate).default([]),
      })
      .default({ country: '', extra: [], excluded: [] }),
    areas: z.array(area).min(1),
    phases: z.array(phase).default([]),
    warnings: z
      .object({
        enabled: z.boolean().default(true),
        maxDailyHours: z.number().default(10),
        longSessionHours: z.number().default(6),
        breakRules: z
          .array(z.object({ afterHours: z.number(), minBreakMinutes: z.number() }))
          .default([
            { afterHours: 6, minBreakMinutes: 30 },
            { afterHours: 9, minBreakMinutes: 45 },
          ]),
      })
      .default({
        enabled: true,
        maxDailyHours: 10,
        longSessionHours: 6,
        breakRules: [
          { afterHours: 6, minBreakMinutes: 30 },
          { afterHours: 9, minBreakMinutes: 45 },
        ],
      }),
  })
  .superRefine((p, ctx) => {
    if (p.period.end < p.period.start) {
      ctx.addIssue({ code: 'custom', path: ['period', 'end'], message: 'End is before start' });
    }
    const areaIds = new Set<string>();
    p.areas.forEach((a, i) => {
      if (areaIds.has(a.id)) ctx.addIssue({ code: 'custom', path: ['areas', i, 'id'], message: `Duplicate area id "${a.id}"` });
      areaIds.add(a.id);
      const catIds = new Set<string>();
      a.categories.forEach((c, j) => {
        if (catIds.has(c.id)) ctx.addIssue({ code: 'custom', path: ['areas', i, 'categories', j, 'id'], message: `Duplicate category id "${c.id}"` });
        catIds.add(c.id);
      });
    });
    p.phases.forEach((ph, i) => {
      if (ph.end < ph.start) ctx.addIssue({ code: 'custom', path: ['phases', i, 'end'], message: 'End is before start' });
    });
  });

export type ProfileInput = z.input<typeof profileSchema>;

export type ParseResult = { ok: true; profile: Profile } | { ok: false; errors: string[] };

/** Validates and normalizes a profile (fills defaults). */
export function parseProfile(data: unknown): ParseResult {
  const result = profileSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  return { ok: true, profile: result.data as Profile };
}

export function parseProfileJson(text: string): ParseResult {
  try {
    return parseProfile(JSON.parse(text));
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
  }
}
