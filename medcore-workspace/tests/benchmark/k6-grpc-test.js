import grpc from 'k6/net/grpc';
import { check } from 'k6';

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
}
