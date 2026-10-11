#!/usr/bin/env python3
"""Verifikasi scope D; pengujian integrasi menunggu implementasi A/B/C."""
import argparse
import datetime
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ['docker', 'compose', '-f', 'docker-compose.db.yml']
TOOLS = ['docker', 'compose', '-f', 'docker-compose.tools.yml']
EVIDENCE = ROOT/'tests/evidence'
records = []

def command(args, expect_success=True):
    p = subprocess.run(COMPOSE+args, cwd=ROOT, capture_output=True, text=True, timeout=60)
    if expect_success and p.returncode:
        raise RuntimeError(p.stderr+p.stdout)
    return p

def pg_args(service, sql):
    return ['exec', '-T', service, 'sh', '-c',
            'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"', 'sh', sql]

def pg(service, sql):
    return command(pg_args(service, sql)).stdout.strip()

def mysql(sql):
    return command(['exec','-T','billing-db','sh','-c',
                    'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -N -B -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "$1"','sh',sql]).stdout.strip()

def record(name, data):
    records.append({'test':name,'passed':True,'evidence':data})
    print('PASS:', name, flush=True)

def verify_lock():
    sql = "BEGIN; SELECT appointment_id FROM appointments WHERE appointment_id='b1111111-1111-1111-1111-111111111111' FOR UPDATE; SELECT pg_sleep(4); ROLLBACK;"
    args = pg_args('appointment-db',sql)
    args[5] = 'PGAPPNAME=medcore-lock-holder '+args[5]
    holder = subprocess.Popen(COMPOSE+args,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        for _ in range(30):
            if pg('appointment-db',"SELECT count(*) FROM pg_stat_activity WHERE application_name='medcore-lock-holder' AND wait_event='PgSleep'") == '1':
                break
            time.sleep(.1)
        else:
            raise RuntimeError('lock holder tidak siap')
        started = time.monotonic()
        contender = command(pg_args('appointment-db',"BEGIN; SET LOCAL lock_timeout='500ms'; UPDATE appointments SET consultation_status='CANCELLED' WHERE appointment_id='b1111111-1111-1111-1111-111111111111'; ROLLBACK;"),False)
        elapsed = round((time.monotonic()-started)*1000,1)
        assert contender.returncode != 0 and 'lock timeout' in contender.stderr, contender.stderr
        stdout, stderr = holder.communicate(timeout=8)
        assert holder.returncode == 0, stderr
        state = pg('appointment-db',"SELECT consultation_status FROM appointments WHERE appointment_id='b1111111-1111-1111-1111-111111111111'")
        assert state == 'SCHEDULED', state
        record('row_lock_contention', {'holder':stdout,'contender':contender.stderr.strip(),'elapsed_ms':elapsed,'final_status':state})
    finally:
        if holder.poll() is None:
            # Disconnecting psql rolls its open transaction back.
            holder.terminate()
            holder.communicate(timeout=8)

def require_file(relative, owner):
    path = ROOT/relative
    if not path.is_file() or not path.stat().st_size:
        raise RuntimeError(f'Menunggu {relative} dari Mahasiswa {owner}.')

def verify_billing():
    invoice = mysql("SELECT i.patient_id,i.appointment_id,i.total_amount,SUM(it.amount),COUNT(*) FROM invoices i JOIN invoice_items it USING(invoice_id) WHERE i.invoice_id='inv-0001' GROUP BY i.invoice_id")
    assert invoice == 'a0000000-0000-0000-0000-000000000001\tb1111111-1111-1111-1111-111111111111\t150000.00\t150000.00\t2', invoice
    record('billing_seed_and_item_total', invoice)
    foreign_keys = mysql("SELECT CONCAT(TABLE_NAME,' -> ',REFERENCED_TABLE_NAME) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL")
    assert foreign_keys == 'invoice_items -> invoices', foreign_keys
    record('billing_only_local_foreign_key',foreign_keys)
    logical_ids = mysql("SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME IN ('patient_id','appointment_id') AND REFERENCED_TABLE_NAME IS NOT NULL")
    assert logical_ids == '0', logical_ids
    record('billing_patient_and_appointment_logical_ids',logical_ids)

def verify_databases():
    foreign_keys = {s:pg(s,"SELECT conrelid::regclass || ' -> ' || confrelid::regclass FROM pg_constraint WHERE contype='f' ORDER BY 1") for s in ('patient-db','appointment-db')}
    assert foreign_keys == {'patient-db':'user_credentials -> patients','appointment-db':'appointments -> doctors'}, foreign_keys
    record('postgres_only_local_foreign_keys',foreign_keys)
    name = command(['exec','-T','appointment-db','printenv','POSTGRES_DB']).stdout.strip()
    denial = command(['exec','-T','patient-db','sh','-c',
      'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h appointment-db -U "$POSTGRES_USER" -d "$1" -c "SELECT 1"','sh',name],False)
    assert denial.returncode != 0 and 'password authentication failed' in denial.stderr, denial.stderr
    record('cross_database_credential_rejected',denial.stderr.strip())
    verify_lock()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['billing','databases','payload'], default='billing')
    args = parser.parse_args()
    try:
        if args.mode == 'databases':
            for path, owner in [('services/patient-service/ddl/init.sql','A'), ('services/appointment-service/ddl/init.sql','B'), ('services/pharmacy-service/ddl/init.js','C')]:
                require_file(path, owner)
        if args.mode == 'payload':
            for path in ['services/pharmacy-service/go.mod','services/pharmacy-service/pb/pharmacy.pb.go']:
                require_file(path, 'C')
            payload = subprocess.run(TOOLS+['run','--rm','-T','--no-deps','tools','sh','-c','cd tests/benchmark && go run inspect_payload.go'], cwd=ROOT, capture_output=True, text=True, timeout=120)
            if payload.returncode:
                raise RuntimeError(payload.stderr+payload.stdout)
            data = json.loads(payload.stdout)
            assert data['protobuf_bytes'] < data['json_bytes'], data
            record('payload_serialization_size',data)
        else:
            states = command(['ps','--format','json']).stdout
            parsed = json.loads(states) if states.lstrip().startswith('[') else [json.loads(line) for line in states.splitlines() if line.startswith('{')]
            dbs = [r for r in parsed if r['Service'].endswith('-db')]
            assert len(dbs)==4 and all(r['State']=='running' and r['Health']=='healthy' for r in dbs), states
            record('four_healthy_databases', [{'service':r['Service'],'state':r['State'],'health':r['Health']} for r in dbs])
            verify_billing()
            if args.mode == 'databases':
                verify_databases()
    except (RuntimeError, AssertionError, subprocess.TimeoutExpired) as error:
        parser.exit(1, f'Verifikasi belum selesai: {error}\n')
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    data = {'verified_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':args.mode,'checks':records}
    (EVIDENCE/f'{args.mode}.json').write_text(json.dumps(data,indent=2)+'\n')
    print(f'Bukti pengujian: tests/evidence/{args.mode}.json',flush=True)

if __name__=='__main__':
    main()
