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
COMPOSE = ['docker', 'compose', '-f', 'docker-compose.tools.yml']

def run(protocol, vus, duration):
    cmd = COMPOSE + ['run', '--rm', '-T', '--no-deps', '-e', f'VUS={vus}', '-e', f'DURATION={duration}',
                     'k6', 'run', f'k6-{protocol}-test.js']
    result = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    lines = [line.removeprefix('MEDCORE_SUMMARY=') for line in result.stdout.splitlines() if line.startswith('MEDCORE_SUMMARY=')]
    if result.returncode or len(lines) != 1:
        raise RuntimeError(f'k6 {protocol}/{vus} gagal:\n{result.stderr}\n{result.stdout[-6000:]}')
    return json.loads(lines[0])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--duration', default='20s')
    parser.add_argument('--vus', default='50,200,500')
    args = parser.parse_args()
    loads = [int(v) for v in args.vus.split(',')]
    if any(v <= 0 for v in loads):
        parser.error('VUS harus positif')
    proto = ROOT/'proto/pharmacy.proto'
    if not proto.is_file() or not proto.stat().st_size:
        parser.error('Menunggu proto/pharmacy.proto dari Mahasiswa B/C dan server Pharmacy dari Mahasiswa C. Jalankan kedua endpoint sebelum benchmark.')
    output = ROOT/'tests/benchmark/results'
    output.mkdir(parents=True, exist_ok=True)
    metadata = {'started_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'duration_per_run': args.duration, 'vus': loads, 'cpu_count': os.cpu_count(),
                'platform': platform.platform(), 'warmup': '5 VUs, 3s per protocol, excluded from recorded results'}
    print('Warmup REST dan gRPC...', flush=True)
    for protocol in ('rest', 'grpc'):
        run(protocol, 5, '3s')
    for index, vus in enumerate(loads):
        # Tukar urutan tiap level untuk mengurangi bias urutan pemanasan.
        protocols = ('rest', 'grpc') if index % 2 == 0 else ('grpc', 'rest')
        for protocol in protocols:
            print(f'Benchmark {protocol.upper()}: {vus} VUs, {args.duration}', flush=True)
            data = run(protocol, vus, args.duration)
            data['medcore_run'] = {'protocol': protocol, 'vus': vus, 'duration': args.duration}
            (output/f'{protocol}-{vus}.json').write_text(json.dumps(data, indent=2)+'\n')
    metadata['finished_at_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (output/'environment.json').write_text(json.dumps(metadata, indent=2)+'\n')
    print('Selesai: tests/benchmark/results/*.json', flush=True)

if __name__ == '__main__':
    main()
