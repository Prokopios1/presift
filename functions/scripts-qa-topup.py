#!/usr/bin/env python3
"""A2 QA fixture: grant 10 test credits to ghost-test recruiter via Firestore REST (gcloud token)."""
import json, subprocess, urllib.request, datetime

UID = "qcPA4GXjV6RpUHVIeTbYm0INKJX2"
token = subprocess.run(["gcloud", "auth", "print-access-token"], capture_output=True, text=True).stdout.strip()
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

commit = {
    "writes": [
        {
            "update": {
                "name": f"projects/presift/databases/(default)/documents/users/{UID}",
                "fields": {"credits": {"integerValue": "10"}},
            },
            "updateMask": {"fieldPaths": ["credits"]},
            "currentDocument": {"exists": True},
        },
        {
            "update": {
                "name": f"projects/presift/databases/(default)/documents/users/{UID}/creditAuditLog/a2-ghost-fixture",
                "fields": {
                    "amount": {"integerValue": "10"},
                    "reason": {"stringValue": "A2 ghost-test fixture"},
                    "adjustedBy": {"stringValue": "admin-sdk"},
                    "previousBalance": {"integerValue": "0"},
                    "newBalance": {"integerValue": "10"},
                    "createdAt": {"timestampValue": now},
                },
            }
        },
    ]
}

req = urllib.request.Request(
    "https://firestore.googleapis.com/v1/projects/presift/databases/(default)/documents:commit",
    data=json.dumps(commit).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode())
        print("COMMIT OK, writeResults:", len(body.get("writeResults", [])))
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:500])
