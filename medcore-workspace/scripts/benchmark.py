#!/usr/bin/env python3
"""Jalankan enam pengujian k6 bergantian dan simpan hasil nyata ke repo."""
import argparse
import datetime
import json
import os
from pathlib import Path
import platform
import subprocess

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ['docker', 'compose', '-f', 'docker-compose.db.yml', '-f', 'docker-compose.app.yml', '--profile', 'tools']

def run(protocol, vus, duration):
    cmd = COMPOSE + ['run', '--rm', '-T', '--no-deps', '-e', f'VUS={vus}', '-e', f'DURATION={duration}',
                     'k6', 'run', f'k6-{protocol}-test.js']
    result = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    lines = [line.removeprefix('MEDCORE_SUMMARY=') for line in result.stdout.splitlines() if line.startswith('MEDCORE_SUMMARY=')]
    if result.returncode or len(lines) != 1:
        raise RuntimeError(f'k6 {protocol}/{vus} gagal:\n{result.stderr}\n{result.stdout[-6000:]}')
    return json.loads(lines[0])

def values(data, name):
    return data['metrics'].get(name, {}).get('values', {})

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--duration', default='20s')
    parser.add_argument('--vus', default='50,200,500')
    args = parser.parse_args()
    loads = [int(v) for v in args.vus.split(',')]
    if any(v <= 0 for v in loads):
        parser.error('VUS harus positif')
    output = ROOT/'tests/benchmark/results'
    output.mkdir(parents=True, exist_ok=True)
    metadata = {'started_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'duration_per_run': args.duration, 'vus': loads, 'cpu_count': os.cpu_count(),
                'platform': platform.platform(), 'warmup': '5 VUs, 3s per protocol, excluded from recorded results'}
    print('Warmup REST dan gRPC...', flush=True)
    for protocol in ('rest', 'grpc'):
        run(protocol, 5, '3s')
    rows = []
    for index, vus in enumerate(loads):
        # Tukar urutan tiap level untuk mengurangi bias urutan pemanasan.
        protocols = ('rest', 'grpc') if index % 2 == 0 else ('grpc', 'rest')
        for protocol in protocols:
            print(f'Benchmark {protocol.upper()}: {vus} VUs, {args.duration}', flush=True)
            data = run(protocol, vus, args.duration)
            data['medcore_run'] = {'protocol': protocol, 'vus': vus, 'duration': args.duration}
            (output/f'{protocol}-{vus}.json').write_text(json.dumps(data, indent=2)+'\n')
            duration = values(data, 'http_req_duration' if protocol == 'rest' else 'grpc_req_duration')
            request = values(data, 'medcore_requests')
            error = values(data, 'medcore_errors')
            sent = values(data, 'data_sent').get('count')
            received = values(data, 'data_received').get('count')
            rows.append({'protocol':protocol,'vus':vus,'p50':duration['med'],'p95':duration['p(95)'],
                         'p99':duration['p(99)'],'p90':duration['p(90)'],'avg':duration['avg'],'rps':request['rate'],
                         'requests':request['count'],'error_rate':error['rate'],
                         'data_sent':sent,'data_received':received})
    metadata['finished_at_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (output/'environment.json').write_text(json.dumps(metadata, indent=2)+'\n')
    text = ['# Hasil benchmark Mahasiswa D', '', f"Diukur: {metadata['started_at_utc']}.", '',
      f"Setiap protokol diuji dengan VU tetap selama {args.duration}; warmup 5 VU/3 detik dikecualikan. "
      'Satu iterasi mengirim satu permintaan untuk MED-AMX-500, quantity_needed=10. '
      'REST memakai HTTP/1.1 keep-alive; gRPC memakai satu channel HTTP/2 per VU. '
      'Keduanya mengakses fungsi bisnis, indeks, dokumen MongoDB, dan server yang sama tanpa delay injeksi.', '',
      '| VU | Protokol | Avg ms | p50 ms | p90 ms | p95 ms | p99 ms | RPS | Error | Sent bytes | Received bytes |',
      '|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
    for row in sorted(rows, key=lambda r:(r['vus'],r['protocol'])):
        sent = row['data_sent'] if row['data_sent'] is not None else 'N/A'
        received = row['data_received'] if row['data_received'] is not None else 'N/A'
        text.append(f"| {row['vus']} | {row['protocol'].upper()} | {row['avg']:.3f} | {row['p50']:.3f} | {row['p90']:.3f} | {row['p95']:.3f} | {row['p99']:.3f} | {row['rps']:.1f} | {row['error_rate']:.2%} | {sent} | {received} |")
    text += ['', 'Total transfer dinormalisasi karena jumlah permintaan per run berbeda:', '',
      '| VU | Protokol | Permintaan | Sent bytes/request | Received bytes/request |',
      '|---:|---|---:|---:|---:|']
    for row in sorted(rows, key=lambda r:(r['vus'],r['protocol'])):
        sent = f"{row['data_sent']/row['requests']:.2f}" if row['data_sent'] is not None and row['requests'] else 'N/A'
        received = f"{row['data_received']/row['requests']:.2f}" if row['data_received'] is not None and row['requests'] else 'N/A'
        text.append(f"| {row['vus']} | {row['protocol'].upper()} | {row['requests']} | {sent} | {received} |")
    text += ['', 'Data JSON mentah: `tests/benchmark/results/`. RPS berasal dari counter permintaan, bukan penjumlahan VU.', '',
      'Hasil ini berasal dari satu workstation dengan load generator, aplikasi, dan database yang berbagi CPU. '
      'Tidak ada TLS, simulasi jaringan WAN, atau replikasi; angka ini tidak membuktikan satu protokol selalu lebih cepat. '
      'Total transfer k6 mencakup data yang diinstrumentasikan oleh k6, bukan ukuran paket TCP/IP hasil packet capture. '
      'Ukuran body JSON/Protobuf dilaporkan terpisah dalam `docs/evidence/payload.json`.', '',
      'Konfigurasi dan interpretasi metrik mengikuti [dokumentasi gRPC k6](https://grafana.com/docs/k6/latest/using-k6/protocols/grpc/) '
      'dan [opsi statistik k6](https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/#summary-trend-stats).', '']
    (ROOT/'docs/benchmark-results.md').write_text('\n'.join(text))
    print('Selesai: docs/benchmark-results.md', flush=True)

if __name__ == '__main__':
    main()
