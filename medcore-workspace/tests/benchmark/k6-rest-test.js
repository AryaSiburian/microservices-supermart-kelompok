import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Ramp up ke 50 VUs (Virtual Users)
    { duration: '20s', target: 200 }, // Spike mendadak ke 200 VUs
    { duration: '10s', target: 0 },   // Cool down kembali ke 0
  ],
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const base = __ENV.REST_BASE_URL || 'http://localhost:8081';
  const url = `${base}/api/v1/drugs/check?drug_code=MED-AMX-500`;

  const res = http.get(url, { timeout: '3s' });

  check(res, {
    'HTTP 200': (r) => r.status === 200,
    'has valid json': (r) => {
      if (r.status !== 200) return false;
      const body = r.json();
      return body && body.drug_code === 'MED-AMX-500';
    },
    'stok tersedia': (r) => {
      if (r.status !== 200) return false;
      const body = r.json();
      return body && body.is_available === true && body.current_stock > 0;
    },
  });
}
