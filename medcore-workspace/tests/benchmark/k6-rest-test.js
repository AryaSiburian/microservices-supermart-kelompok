import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Ramp up ke 50 VUs (Virtual Users)
    { duration: '20s', target: 200 }, // Spike mendadak ke 200 VUs
    { duration: '10s', target: 0 },   // Cool down kembali ke 0
  ],
};

export default function () {
  const url = 'http://localhost:8081/api/v1/drugs/check?drug_code=MED-AMX-500';
  
  const res = http.get(url);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has valid json': (r) => r.json() && r.json().drug_code === 'MED-AMX-500',
  });
}