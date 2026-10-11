import http from 'k6/http';
import { check } from 'k6';
<<<<<<< HEAD

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
=======
import { requests, errors } from './common.js';
export { options, handleSummary } from './common.js';

export default function () {
  const base = __ENV.REST_BASE_URL || 'http://localhost:8081';
  const response = http.get(`${base}/api/v1/drugs/check?drug_code=MED-AMX-500&quantity_needed=10`, { timeout: '2s' });
  const ok = check(response, {
    'HTTP 200': (r) => r.status === 200,
    'stok identik': (r) => r.status === 200 && r.json().drug_code === 'MED-AMX-500'
      && r.json().is_available === true && r.json().current_stock === 500,
  });
  requests.add(1);
  errors.add(!ok);
>>>>>>> 3bb0bff4507673571bf18965a6f49f139aaecdf1
}
