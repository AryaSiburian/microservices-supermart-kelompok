import grpc from 'k6/net/grpc';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Ramp-up ke 50 VUs
    { duration: '20s', target: 200 }, // Spike ke 200 VUs
    { duration: '10s', target: 0 },   // Cool-down ke 0
  ],
};

const client = new grpc.Client();

// Load file .proto agar k6 memahami skema Request & Response gRPC
client.load(['../../proto'], 'pharmacy.proto');

export default function () {
  // Sambungkan koneksi ke server gRPC jika belum terhubung
  client.connect('localhost:50051', { plaintext: true });

  const data = {
    drug_code: 'MED-AMX-500',
    quantity_needed: 10,
  };

  const response = client.invoke(
    'medcore.pharmacy.v1.PharmacyService/CheckDrugAvailability',
    data
  );

  check(response, {
    'status is OK': (r) => r && r.status === grpc.StatusOK,
    'has valid stock': (r) => r && r.message && r.message.is_available === true,
  });

  // Tutup koneksi di akhir VU iteration
  client.close();
}