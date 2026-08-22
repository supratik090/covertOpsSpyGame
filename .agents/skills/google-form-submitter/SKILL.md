---
name: google-form-submitter
description: >-
  Scans user-uploaded images of handwritten customer names/numbers, formats them with a 40/40/20 product distribution rule, and submits the records to the Mongonis Google Form.
---

# Form Submission & Image Scanning Runbook

Use this skill when a user uploads handwritten images of names and phone numbers and requests they be submitted to the Monginis Google Form.

## Process Workflow

### Step 1: Scan and Transcribe
1. Use vision capability to scan the handwritten lists.
2. Transcribe names and 10-digit phone numbers exactly as written.
3. Deduplicate entries by phone number (if a phone number already exists, skip it).

### Step 2: Calculate Product Choices
Assign one of the three pastry options based on a **40% / 40% / 20%** ratio across the entries:
*   **Choice 1 (40%)**: `RAJBHOG PASTRY`
*   **Choice 2 (40%)**: `DATE AND WALNUT PASTRY`
*   **Choice 3 (20%)**: `PANEER CHILLI PUFF`

### Step 3: Google Form Parameter Mapping
*   **Base URL**: `https://docs.google.com/forms/d/e/1FAIpQLSdRsimTuESmrpmIt2dOZs5lNicffAqtmg9ETtFvazUslO9YhQ/formResponse`
*   **Full Name Field ID**: `entry.1682775785`
*   **Contact Number Field ID**: `entry.268071987`
*   **Pre-Product Choice Field ID**: `entry.1175071046`
*   **Shop R-Code Field ID**: `entry.1728397887` (Value: `"House of supr R3701 vikhroli east"`)

### Step 4: Form Submission Method
Use the Python script below to perform batch POST requests directly to the form's `formResponse` endpoint.

```python
import urllib.request
import urllib.parse
import time

url = "https://docs.google.com/forms/d/e/1FAIpQLSdRsimTuESmrpmIt2dOZs5lNicffAqtmg9ETtFvazUslO9YhQ/formResponse"

# Array containing parsed dict objects: {"name": "Name", "phone": "10-digit number", "choice": "Pastry Choice"}
data = [
    # Insert entries here
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded"
}

for i, entry in enumerate(data):
    form_data = {
        "entry.1682775785": entry["name"],
        "entry.268071987": entry["phone"],
        "entry.1175071046": entry["choice"],
        "entry.1728397887": "House of supr R3701 vikhroli east"
    }
    encoded_data = urllib.parse.urlencode(form_data).encode("utf-8")
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            print(f"[{i+1}/{len(data)}] Submitted for {entry['name']} - Status: {response.status}")
    except Exception as e:
        print(f"[{i+1}/{len(data)}] Failed to submit for {entry['name']}: {e}")
    time.sleep(0.5)
```
