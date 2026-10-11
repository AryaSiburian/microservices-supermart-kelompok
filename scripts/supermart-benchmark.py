#!/usr/bin/env python3
"""Run the four required read-only tests and sample only the Inventory container."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import socket
import statistics
import subprocess
import threading

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ["docker", "compose", "-f", str(ROOT / "docker-compose.supermart-grpc.yml")]

def command(args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()

def memory_bytes(value):
    match = re.fullmatch(r"([0-9.]+)([A-Za-z]+)", value.split(" / ")[0].strip())
    scales = {"B": 1, "kB": 1000, "MB": 10**6, "GB": 10**9,
              "KiB": 1024, "MiB": 1024**2, "GiB": 1024**3}
    if not match or match[2] not in scales:
        raise ValueError(f"unknown Docker memory unit: {value}")
    return float(match[1]) * scales[match[2]]

def monitor(container, rows):
    process = subprocess.Popen(["docker", "stats", "--format", "{{json .}}", container],
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    def collect():
        for line in process.stdout:
            # Docker emits terminal-clear ANSI sequences even when stdout is piped.
            clean = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", line).strip()
            if not clean:
                continue
            raw = json.loads(clean)
            rows.append({"at": dt.datetime.now(dt.timezone.utc).isoformat(),
                         "cpu_percent_one_core": float(raw["CPUPerc"].rstrip("%")),
                         "memory_bytes": memory_bytes(raw["MemUsage"]), "raw": raw})
    thread = threading.Thread(target=collect, daemon=True)
    thread.start()
    return process, thread

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default=dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_-]+", args.run_id):
        parser.error("run-id must use letters, digits, underscore or hyphen")
    result_dir = ROOT / "benchmarks/supermart/results" / args.run_id
    result_dir.mkdir(parents=True, exist_ok=False)
    container = command(COMPOSE + ["ps", "-q", "inventory"])
    if not container:
        raise SystemExit("Start the Inventory provider before benchmarking")
    cpu_model = platform.processor()
    if Path("/proc/cpuinfo").exists():
        cpu_model = next((line.split(":", 1)[1].strip() for line in Path("/proc/cpuinfo").read_text().splitlines()
                          if line.startswith("model name")), cpu_model)
    environment = {"hostname": socket.gethostname(), "platform": platform.platform(),
                   "os_release": platform.freedesktop_os_release() if hasattr(platform, "freedesktop_os_release") else {},
                   "logical_cpu_count": os.cpu_count(), "cpu_model": cpu_model,
                   "ram_bytes": os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") if hasattr(os, "sysconf") else None,
                   "git_commit": command(["git", "rev-parse", "HEAD"]),
                   "git_branch": command(["git", "branch", "--show-current"]),
                   "working_tree_modified": bool(command(["git", "status", "--porcelain"])),
                   "proto_sha256": hashlib.sha256((ROOT/"proto/inventory/v1/inventory.proto").read_bytes()).hexdigest(),
                   "server_image": command(["docker", "inspect", container, "--format", "{{.Image}}"]),
                   "other_running_containers": command(["docker", "ps", "--format", "{{.Names}}"]).splitlines(),
                   "method": "closed-loop workers; REST HTTP/1.1 keep-alive; gRPC one persistent HTTP/2 channel; 2s warmup excluded",
                   "payload_definition": "JSON body vs serialized Protobuf message; excludes HTTP headers, TLS, HTTP/2 frames and gRPC 5-byte envelope",
                   "resource_definition": "docker stats Inventory only; CPU % of one logical core; normalized host % = CPU / logical_cpu_count; memory = Docker working set excluding reclaimable cache"}
    (result_dir / "environment.json").write_text(json.dumps(environment, indent=2)+"\n")
    records = {}
    # Alternate order at the second load level to reduce one-sided order bias.
    for workers, duration, protocols in [(50, "30s", ("rest", "grpc")), (200, "60s", ("grpc", "rest"))]:
        for protocol in protocols:
            stem = f"{protocol}-{workers}"
            print(f"Hostname: {socket.gethostname()} | {protocol.upper()}: {workers} workers / {duration}", flush=True)
            samples = []
            sampler, thread = monitor(container, samples)
            try:
                proc = subprocess.run(COMPOSE + ["run", "--rm", "-T", "--no-deps", "--user", f"{os.getuid()}:{os.getgid()}",
                    "-e", f"BENCHMARK_HOSTNAME={socket.gethostname()}", "benchmark", "stock-benchmark",
                    "--protocol", protocol, "--concurrency", str(workers), "--duration", duration,
                    "--out", f"/results/{args.run_id}/{stem}.json"], cwd=ROOT, text=True, capture_output=True)
            finally:
                sampler.terminate()
                try:
                    sampler.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    sampler.kill()
                thread.join(timeout=5)
            (result_dir / f"{stem}.log").write_text(proc.stdout+proc.stderr)
            print(proc.stdout, end="", flush=True)
            (result_dir / f"{stem}-resources.json").write_text(json.dumps(samples, indent=2)+"\n")
            if proc.returncode:
                raise SystemExit(f"Benchmark failed; inspect {result_dir / (stem+'.log')}: {proc.stderr}")
            record = json.loads((result_dir / f"{stem}.json").read_text())
            start, end = (dt.datetime.fromisoformat(record[key]) for key in ("started_at", "finished_at"))
            measured = [row for row in samples if start <= dt.datetime.fromisoformat(row["at"]) <= end]
            record["resources"] = {"sample_count": len(measured)}
            if measured:
                cpu = statistics.mean(row["cpu_percent_one_core"] for row in measured)
                record["resources"].update({"cpu_percent_one_core_mean": cpu,
                    "cpu_percent_host_mean": cpu / (os.cpu_count() or 1),
                    "memory_mib_mean": statistics.mean(row["memory_bytes"] for row in measured) / 1024**2,
                    "memory_mib_peak": max(row["memory_bytes"] for row in measured) / 1024**2})
            (result_dir / f"{stem}.json").write_text(json.dumps(record, indent=2)+"\n")
            records[stem] = record
    if any(r["response"] != records["rest-50"]["response"] for r in records.values()):
        raise SystemExit("Response data differed between protocols/runs; do not use a protocol comparison")
    lines = ["# Hasil benchmark Supermart", "", f"Hostname: `{socket.gethostname()}`. Run: `{args.run_id}`.", "",
             "Data diukur langsung; latensi mencakup perjalanan jaringan dan decoding klien. Throughput = permintaan sukses / durasi aktual.", "",
             "| Workers | Protokol | Durasi s | Mean ms | p50 ms | p95 ms | p99 ms | RPS sukses | Payload bytes | CPU host % | Memory MiB | Error |",
             "|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
    for workers in (50, 200):
        for protocol in ("rest", "grpc"):
            r = records[f"{protocol}-{workers}"]
            cpu = r["resources"].get("cpu_percent_host_mean")
            mem = r["resources"].get("memory_mib_mean")
            cpu_text = f"{cpu:.3f}" if cpu is not None else "Tidak terukur"
            mem_text = f"{mem:.2f}" if mem is not None else "Tidak terukur"
            lines.append(f"| {workers} | {protocol.upper()} | {r['actual_duration_seconds']:.3f} | {r['mean_ms']:.3f} | {r['p50_ms']:.3f} | {r['p95_ms']:.3f} | {r['p99_ms']:.3f} | {r['rps']:.2f} | {r['response_bytes_mean']:.0f} | {cpu_text} | {mem_text} | {r['failed_requests']} |")
    lines += ["", "Persentase perubahan dihitung terhadap REST; positif pada pengurangan latensi/payload berarti gRPC lebih kecil/cepat.", "",
              "| Workers | Payload lebih kecil % | Mean lebih cepat % | p50 lebih cepat % | p95 lebih cepat % | p99 lebih cepat % | RPS lebih tinggi % |", "|---:|---:|---:|---:|---:|---:|---:|"]
    for workers in (50, 200):
        rest, rpc = records[f"rest-{workers}"], records[f"grpc-{workers}"]
        reductions = [(rest[k]-rpc[k])/rest[k]*100 for k in ("response_bytes_mean", "mean_ms", "p50_ms", "p95_ms", "p99_ms")]
        gain = (rpc["rps"]-rest["rps"])/rest["rps"]*100
        lines.append(f"| {workers} | " + " | ".join(f"{v:.2f}" for v in reductions+[gain]) + " |")
    lines += ["", "Batas interpretasi: satu putaran per skenario pada satu host dengan klien, provider, database, dan workload lain berbagi sumber daya. "
              "CPU/memori adalah seluruh proses provider Inventory, bukan database/klien. CPU host dinormalisasi terhadap jumlah logical CPU. "
              "Ukuran payload tidak mengukur seluruh byte jaringan. Tidak ada TLS, kompresi payload, simulasi WAN, atau klaim bahwa gRPC selalu lebih cepat. "
              "Memory dapat terbawa dari run sebelumnya karena allocator Go. Ulangi beberapa putaran untuk menilai variasi.", "",
              "Log asli memuat hostname dan metrik. Screenshot terminal harus diambil sendiri; tidak dibuat dari angka simulasi.", ""]
    (result_dir / "summary.md").write_text("\n".join(lines))
    print(f"Hasil: {result_dir / 'summary.md'}", flush=True)

if __name__ == "__main__":
    main()
