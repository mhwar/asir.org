#!/usr/bin/env python3
"""Generate SQL to import contacts & leadership from the council's original file (never committed).

  python3 tools/import_contacts.py /path/to/internal.json  -> seed/contacts_NN.sql

Fills only empty values: anything already entered in the platform is kept.
"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
q = lambda v: 'NULL' if v in (None, '') else "'" + str(v).replace("'", "''") + "'"
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'internal.json')
I = json.load(open(src, encoding='utf8'))['internal']
os.makedirs(os.path.join(ROOT, 'seed'), exist_ok=True)
rows, uids = [], []
for r in I:
    notes = [x for x in (r[22] or '').split('؛ ') if 'test.com' in x]
    rows.append(f"({r[0]},{q(r[15])},{q(r[16])},{q(r[17])},{q(r[18])},{q(r[19])},{q(r[20])},{q('؛ '.join(notes))})")
    if r[3]: uids.append(f"WHEN {r[0]} THEN {q(r[3])}")
B = 180
for i in range(0, len(rows), B):
    open(os.path.join(ROOT, 'seed', f'contacts_{i // B + 1:02d}.sql'), 'w', encoding='utf8').write(
        "INSERT INTO association_contacts(association_id,email,mobile,delegate_name,delegate_email,president_name,president_email,import_notes)VALUES\n"
        + ",\n".join(rows[i:i + B]) +
        "\nON CONFLICT(association_id)DO UPDATE SET email=COALESCE(association_contacts.email,excluded.email),mobile=COALESCE(association_contacts.mobile,excluded.mobile),"
        "delegate_name=COALESCE(association_contacts.delegate_name,excluded.delegate_name),delegate_email=COALESCE(association_contacts.delegate_email,excluded.delegate_email),"
        "president_name=COALESCE(association_contacts.president_name,excluded.president_name),president_email=COALESCE(association_contacts.president_email,excluded.president_email),"
        "import_notes=excluded.import_notes;\n")
open(os.path.join(ROOT, 'seed', 'unified_no.sql'), 'w', encoding='utf8').write(
    "UPDATE associations SET unified_no=CASE id " + " ".join(uids) + " END WHERE unified_no IS NULL AND id IN (" + ",".join(str(r[0]) for r in I if r[3]) + ");\n")
print(len(rows), 'contacts,', len(uids), 'unified numbers -> seed/')
