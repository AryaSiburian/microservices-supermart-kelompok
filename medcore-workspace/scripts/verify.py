#!/usr/bin/env python3
"""Bukti database, logical ID, error gRPC, REST, dan deadline untuk logbook."""
import datetime
import json
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ['docker', 'compose', '-f', 'docker-compose.db.yml', '-f', 'docker-compose.app.yml', '--profile', 'tools']
EVIDENCE = ROOT/'docs/evidence'
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

def mongo(js):
    return command(['exec','-T','pharmacy-db','sh','-c',
      'exec mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_INITDB_DATABASE" --eval "$1"','sh',js]).stdout.strip()

def record(name, data):
    records.append({'test':name,'passed':True,'evidence':data})
    print('PASS:', name, flush=True)

def client(*args):
    p = command(['run','--rm','-T','--no-deps','appointment-client',*args])
    return json.loads(p.stdout)

def rest(code='MED-AMX-500', qty='20', method='GET'):
    env = dict(line.split('=',1) for line in (ROOT/'.env').read_text().splitlines() if line and not line.startswith('#'))
    port = env.get('HOST_PORT_PHARMACY_REST','8081')
    url = f'http://127.0.0.1:{port}/api/v1/drugs/check?drug_code={code}&quantity_needed={qty}'
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method=method), timeout=3) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)

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

def emergency():
    temp = '00000000-9999-9999-9999-000000000000'
    real = 'a0000000-0000-0000-0000-000000000003'
    appt = 'b2222222-2222-2222-2222-222222222222'
    absent = pg('patient-db', f"SELECT count(*) FROM patients WHERE patient_id='{temp}'")
    assert absent == '0'
    pg('appointment-db', f"INSERT INTO appointments(appointment_id,patient_id,doctor_id,schedule_time,queue_number,consultation_status,clinical_notes) VALUES('{appt}','{temp}','b0000000-0000-0000-0000-000000000001',now(),99,'IN_PROGRESS','EMERGENCY UNIDENTIFIED PATIENT') ON CONFLICT(appointment_id) DO UPDATE SET patient_id=EXCLUDED.patient_id,clinical_notes=EXCLUDED.clinical_notes")
    mongo(f"db.prescriptions.updateOne({{prescription_id:'RX-EMG-2026-0001'}},{{$set:{{appointment_id:'{appt}',patient_id:'{temp}',items:[{{drug_code:'MED-PCT-500',quantity:10}}],status:'ISSUED'}}}},{{upsert:true}})")
    before = pg('appointment-db',f"SELECT patient_id FROM appointments WHERE appointment_id='{appt}'")
    assert before == temp
    # Simulated registration; ten-minute delay is discussed, not slept in automation.
    pg('patient-db',f"INSERT INTO patients(patient_id,national_id,medical_record_no,full_name,date_of_birth,gender,phone_number) VALUES('{real}','5171099999990001','RM-2026-0003','Pasien Demo IGD','1999-01-01','MALE','+6281000000000') ON CONFLICT(patient_id) DO NOTHING")
    pg('appointment-db',f"UPDATE appointments SET patient_id='{real}' WHERE appointment_id='{appt}' AND patient_id='{temp}'")
    mongo(f"db.prescriptions.updateMany({{patient_id:'{temp}',appointment_id:'{appt}'}},{{$set:{{patient_id:'{real}'}}}})")
    after = pg('appointment-db',f"SELECT patient_id FROM appointments WHERE appointment_id='{appt}'")
    pharmacy = mongo("print(db.prescriptions.findOne({prescription_id:'RX-EMG-2026-0001'}).patient_id)")
    assert after == real and pharmacy == real
    record('break_the_glass_reconciliation', {'unregistered_temporary_patient':before,'appointment_patient_after':after,'prescription_patient_after':pharmacy,'simulation':'synthetic patient; registration delay skipped'})

def main():
    states = command(['ps','--format','json']).stdout
    parsed = json.loads(states) if states.lstrip().startswith('[') else [json.loads(line) for line in states.splitlines() if line.startswith('{')]
    dbs = [r for r in parsed if r['Service'].endswith('-db')]
    assert len(dbs)==4 and all(r['State']=='running' and r['Health']=='healthy' for r in dbs)
    record('four_healthy_databases', [{'service':r['Service'],'state':r['State'],'health':r['Health']} for r in dbs])
    assert int(pg('patient-db','SELECT count(*) FROM patients')) >= 2
    assert pg('appointment-db','SELECT count(*) FROM doctors') == '2'
    invoice = mysql("SELECT i.total_amount, SUM(it.amount) FROM invoices i JOIN invoice_items it USING(invoice_id) WHERE i.invoice_id='inv-0001' GROUP BY i.invoice_id,i.total_amount")
    assert invoice == '150000.00\t150000.00', invoice
    assert mongo("print(db.drugs.findOne({drug_code:'MED-AMX-500'}).total_stock)") == '500'
    record('seed_data_and_billing_total', invoice)
    foreign_keys = {s:pg(s,"SELECT conrelid::regclass || ' -> ' || confrelid::regclass FROM pg_constraint WHERE contype='f' ORDER BY 1") for s in ('patient-db','appointment-db')}
    foreign_keys['billing-db'] = mysql("SELECT CONCAT(TABLE_NAME,' -> ',REFERENCED_TABLE_NAME) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL")
    assert foreign_keys == {'patient-db':'user_credentials -> patients','appointment-db':'appointments -> doctors','billing-db':'invoice_items -> invoices'}, foreign_keys
    record('only_local_foreign_keys',foreign_keys)
    denial = command(['exec','-T','patient-db','sh','-c',
      'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h appointment-db -U "$POSTGRES_USER" -d medcore_appointment_db -c "SELECT 1"'],False)
    assert denial.returncode != 0 and 'password authentication failed' in denial.stderr, denial.stderr
    record('cross_database_credential_rejected',denial.stderr.strip())
    verify_lock()
    good = client('--quantity','20')
    assert good['response']['is_available'] and good['response']['current_stock']==500
    record('grpc_valid', good)
    insufficient = client('--quantity','600')
    assert not insufficient['response'].get('is_available',False)
    record('grpc_insufficient_stock_business_response',insufficient)
    for args in [('--drug-code','MED-TIDAK-ADA','--expect','NotFound'),('--quantity','10000','--expect','ResourceExhausted'),('--drug-code','','--expect','InvalidArgument')]:
        result = client(*args)
        record('grpc_'+result['status'],result)
    delayed = client('--delay-ms','2000','--timeout','500ms','--expect','DeadlineExceeded')
    assert 450<=delayed['elapsed_ms']<1500, delayed
    record('grpc_DeadlineExceeded',delayed)
    record('grpc_recovers_after_timeout',client('--quantity','10'))
    http_code, http_response = rest()
    assert http_code==200 and http_response==good['response'], http_response
    record('rest_grpc_same_business_response',http_response)
    for code,qty,expected in [('MED-TIDAK-ADA','20',404),('MED-AMX-500','10000',429),('MED-AMX-500','0',400),('MED-AMX-500','2147483648',400)]:
        status_code, response = rest(code,qty)
        assert status_code==expected,(status_code,response)
    status_code,_ = rest(method='POST')
    assert status_code==405
    record('rest_errors_400_404_405_429','passed')
    emergency()
    payload = command(['run','--rm','-T','--no-deps','tools','sh','-c','cd tests/benchmark && go run inspect_payload.go'])
    payload_data = json.loads(payload.stdout)
    assert payload_data['protobuf_bytes'] < payload_data['json_bytes']
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    (EVIDENCE/'payload.json').write_text(json.dumps(payload_data,indent=2)+'\n')
    record('payload_serialization_size',payload_data)
    data = {'verified_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':records}
    (EVIDENCE/'verification.json').write_text(json.dumps(data,indent=2)+'\n')
    (EVIDENCE/'verification.md').write_text('# Bukti verifikasi Mahasiswa D\n\n'+data['verified_at_utc']+'\n\n'+
      '\n'.join(f"- PASS: `{r['test']}`" for r in records)+'\n\nDetail respons dan terminal tersimpan dalam `verification.json`.\n')
    print('Bukti tersimpan di docs/evidence/',flush=True)

if __name__=='__main__':
    main()
