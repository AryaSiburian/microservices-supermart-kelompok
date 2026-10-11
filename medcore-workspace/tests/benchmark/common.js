import { Counter, Rate } from 'k6/metrics';

export const requests = new Counter('medcore_requests');
export const errors = new Rate('medcore_errors');
export const options = {
  scenarios: {
    steady_load: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 50),
      duration: __ENV.DURATION || '20s',
      gracefulStop: '5s',
    },
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: { checks: ['rate==1'], medcore_errors: ['rate==0'] },
};
export function handleSummary(data) {
  return { stdout: `MEDCORE_SUMMARY=${JSON.stringify(data)}\n` };
}
