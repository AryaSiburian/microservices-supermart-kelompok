import http from 'k6/http';
import { check } from 'k6';
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
}
