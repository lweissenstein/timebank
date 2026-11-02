import { describe, expect, it } from 'vitest';
import { eachDay } from './dates';
import { Ledger } from './ledger';
import { balanceCurve, forecast, requiredToBalance, simulatePlan } from './plan';
import { absence, testProfile, work } from './testUtils';
import type { Absence, HolidayMap, Phase, Session } from './types';

// Berlin holidays within the period (as delivered by the calendar adapter).
const BERLIN: HolidayMap = new Map([
  ['2026-12-25', 'Christmas'],
  ['2026-12-26', 'Boxing Day'],
  ['2027-01-01', 'New Year'],
  ['2027-03-08', "Women's Day"],
  ['2027-03-26', 'Good Friday'],
  ['2027-03-29', 'Easter Monday'],
]);

const PHASES: Phase[] = [
  { id: 'a', name: 'A', start: '2026-11-02', end: '2026-12-20', plannedHoursPerWeek: 40 },
  { id: 'off', name: 'Off', start: '2026-12-21', end: '2026-12-27', plannedHoursPerWeek: 0 },
  { id: 'b', name: 'B', start: '2026-12-28', end: '2027-02-14', plannedHoursPerWeek: 8 },
  { id: 'buf', name: 'Buffer', start: '2027-02-15', end: '2027-02-21', plannedHoursPerWeek: 0 },
  { id: 'rest', name: 'Rest', start: '2027-02-22', end: '2027-03-31', plannedHoursPerWeek: 'zero-balance' },
];

function vacationRange(from: string, to: string): Absence[] {
  return eachDay(from, to).map((d) => absence(d));
}

const VACATION = [
  ...vacationRange('2026-12-21', '2026-12-24'),
  ...vacationRange('2027-02-15', '2027-02-19'),
];

function ledger(sessions: Session[] = [], absences: Absence[] = VACATION, startBalanceHours = 0) {
  const profile = testProfile({
    phases: PHASES,
    period: { start: '2026-11-02', end: '2027-03-31', startBalanceHours },
  });
  return new Ledger({ profile, holidays: BERLIN, sessions, absences, now: Date.now() });
}

describe('phase plan simulation', () => {
  it('reproduces the planned trajectory', () => {
    const l = ledger();
    const sim = simulatePlan(l, l.start, 0);
    expect(sim.daily.get('2026-12-20')).toBeCloseTo(140); // 7 weeks × +20
    expect(sim.daily.get('2026-12-27')).toBeCloseTo(140); // vacation + Christmas
    expect(sim.daily.get('2027-02-14')).toBeCloseTo(60); // 7 × −12 + New Year
    expect(sim.daily.get('2027-02-21')).toBeCloseTo(60); // buffer week on vacation
    expect(sim.endBalance).toBeCloseTo(0); // zero-balance phase
  });

  it('plans the 40 h needed in the zero-balance phase', () => {
    const l = ledger();
    const sim = simulatePlan(l, l.start, 0);
    const restWork = eachDay('2027-02-22', '2027-03-31').reduce((s, d) => s + (sim.plannedWork.get(d) ?? 0), 0);
    expect(restWork).toBeCloseTo(40);
  });

  it('starts the curve at the start balance and fills actual values up to today', () => {
    const l = ledger([work('2026-11-02', 8)], VACATION, 13);
    const curve = balanceCurve(l, '2026-11-04');
    expect(curve[0]).toMatchObject({ planned: 13, actual: 13 });
    expect(curve[1].date).toBe('2026-11-08');
    expect(curve[1].planned).toBeCloseTo(33);
    expect(curve[1].actual).toBeCloseTo(13 + 8 - 12); // balance as of today
    expect(curve[2].actual).toBeUndefined();
  });
});

describe('forecast and requirement', () => {
  it('forecasts by plan from the actual balance', () => {
    const l = ledger();
    // nothing worked in week 1: balance −20 on Sunday 08.11.
    const [feb, end] = forecast(l, '2026-11-08', ['2027-02-22', '2027-04-01']);
    expect(feb.byPlan).toBeCloseTo(20); // 60 − 40 (week 1: −20 instead of +20)
    expect(end.byPlan).toBeCloseTo(0); // zero-balance phase compensates
    expect(feb.byPace).toBeNull(); // no completed week yet
  });

  it('extrapolates the recent weekly pace', () => {
    const l = ledger();
    const [feb] = forecast(l, '2026-11-09', ['2027-02-22']);
    const days = eachDay('2026-11-10', '2027-02-21').length;
    expect(feb.byPace).toBeCloseTo(-24 + (-20 * days) / 7);
  });

  it('computes the hours needed to reach 0 at the end of the period', () => {
    const profile = testProfile({
      phases: PHASES,
      period: { start: '2027-02-22', end: '2027-03-31', startBalanceHours: 60 },
    });
    const l = new Ledger({ profile, holidays: BERLIN, sessions: [], absences: [], now: Date.now() });
    // 22.02.–31.03.: target 112 h, holidays 12 h → 40 h of work on 25 free workdays.
    const r = requiredToBalance(l, '2027-02-21');
    expect(r.totalHours).toBeCloseTo(40);
    expect(r.freeWorkdays).toBe(25);
    expect(r.perFreeWorkday).toBeCloseTo(1.6);
    expect(r.perWeek).toBeCloseTo(40 / (38 / 7));
  });
});
