import grpc from 'k6/net/grpc';
import { check } from 'k6';
<<<<<<< HEAD

export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Ramp-up ke 50 VUs
    { duration: '20s', target: 200 }, // Spike ke 200 VUs
    { duration: '10s', target: 0 },   // Cool-down ke 0
  ],
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const client = new grpc.Client();

// Load file .proto agar k6 memahami skema Request & Response gRPC
client.load(['../../proto'], 'pharmacy.proto');

export default function () {
  const target = __ENV.GRPC_TARGET || 'localhost:50051';

  // Sambungkan koneksi ke server gRPC
  client.connect(target, { plaintext: true, timeout: '3s' });

  const data = {
    drug_code: 'MED-AMX-500',
    quantity_needed: 10,
  };

  const response = client.invoke(
    'medcore.pharmacy.v1.PharmacyService/CheckDrugAvailability',
    data,
    { timeout: '3s' }
  );

  check(response, {
    'status is OK': (r) => r && r.status === grpc.StatusOK,
    'has valid drug_code': (r) => r && r.message && r.message.drug_code === 'MED-AMX-500',
    'stok tersedia': (r) => r && r.message && r.message.is_available === true,
    'current_stock > 0': (r) => r && r.message && r.message.current_stock > 0,
  });

  // Tutup koneksi di akhir VU iteration
  client.close();
=======
import { requests, errors } from './common.js';
export { options, handleSummary } from './common.js';

const client = new grpc.Client();
client.load(['../../proto'], 'pharmacy.proto');
let connected = false;
export default function () {
  requests.add(1);
  try {
  // Channel dipakai ulang per VU, sebagaimana keep-alive pada baseline REST.
  if (!connected) {
    client.connect(__ENV.GRPC_TARGET || 'localhost:50051', { plaintext: true, timeout: '2s' });
    connected = true;
  }
  const response = client.invoke('medcore.pharmacy.v1.PharmacyService/CheckDrugAvailability', {
    drugCode: 'MED-AMX-500', quantityNeeded: 10,
  }, { timeout: '2s' });
  const ok = check(response, {
    'gRPC OK': (r) => r && r.status === grpc.StatusOK,
    'stok identik': (r) => r && r.message && r.message.drugCode === 'MED-AMX-500'
      && r.message.isAvailable === true && r.message.currentStock === 500,
  });
  errors.add(!ok);
  } catch (error) {
    errors.add(true);
    check(false, { 'RPC completed': (value) => value });
  }
>>>>>>> 3bb0bff4507673571bf18965a6f49f139aaecdf1
}
