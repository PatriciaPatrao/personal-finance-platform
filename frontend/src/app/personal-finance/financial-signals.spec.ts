import { AnalysisSummary } from '../analysis/analysis-summary';
import { ForecastResponse } from '../forecast/forecast-response';
import { deriveFinancialSignals } from './financial-signals';

describe('deriveFinancialSignals', () => {
  const emptySummary: AnalysisSummary = {
    from_date: '2026-10-01',
    to_date: '2026-10-05',
    total_income: '0.00',
    total_expenses: '0.00',
    net_cash_flow: '0.00',
  };

  const increasingForecast: ForecastResponse = {
    from_date: '2026-10-05',
    to_date: '2026-12-31',
    currency: 'EUR',
    group_by: 'month',
    periods: [
      {
        period: '2026-10',
        income: '2000.00',
        expenses: '1250.00',
        net_cash_flow: '750.00',
        projected_balance: '5750.00',
      },
      {
        period: '2026-12',
        income: '2000.00',
        expenses: '1250.00',
        net_cash_flow: '750.00',
        projected_balance: '7250.00',
      },
    ],
  };

  it('returns no cash-flow signal when the month has no activity', () => {
    const signals = deriveFinancialSignals(emptySummary, increasingForecast);
    expect(signals.map((signal) => signal.title)).toEqual([
      'Balance projected to increase',
    ]);
  });

  it('returns a positive cash-flow signal when income exceeds expenses', () => {
    const signals = deriveFinancialSignals(
      {
        ...emptySummary,
        total_income: '2000.00',
        total_expenses: '1350.00',
        net_cash_flow: '650.00',
      },
      null,
    );

    expect(signals).toEqual([
      {
        title: 'Positive cash flow',
        detail: 'Your income is currently higher than your expenses.',
      },
    ]);
  });

  it('returns an expenses-exceeded signal when net cash flow is negative', () => {
    const signals = deriveFinancialSignals(
      {
        ...emptySummary,
        total_income: '1000.00',
        total_expenses: '1500.00',
        net_cash_flow: '-500.00',
      },
      null,
    );

    expect(signals[0]?.title).toBe('Expenses exceeded income');
  });

  it('returns no signals when both sources have nothing to compare', () => {
    const signals = deriveFinancialSignals(emptySummary, {
      ...increasingForecast,
      periods: [
        {
          period: '2026-10',
          income: '100.00',
          expenses: '100.00',
          net_cash_flow: '0.00',
          projected_balance: '5000.00',
        },
      ],
    });

    expect(signals).toEqual([]);
  });

  it('returns no scheduled income when every period has zero income', () => {
    const signals = deriveFinancialSignals(emptySummary, {
      ...increasingForecast,
      periods: [
        {
          period: '2026-10',
          income: '0.00',
          expenses: '0.00',
          net_cash_flow: '0.00',
          projected_balance: '5000.00',
        },
      ],
    });

    expect(signals.map((signal) => signal.title)).toEqual([
      'No scheduled income',
    ]);
  });
});
