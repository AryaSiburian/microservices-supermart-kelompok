import grpc from 'k6/net/grpc';
import { check } from 'k6';
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
}
