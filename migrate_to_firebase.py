import json
import requests
import time
from concurrent.futures import ThreadPoolExecutor

PROJECT_ID = "statsmvg"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

def upload_user(user_name):
    clean_name = user_name.replace(' ', '_').replace('/', '_')
    doc_data = {
        "fields": {
            "name": {"stringValue": user_name},
            "pin": {"stringValue": "1234"},
            "role": {"stringValue": "rep"},
            "active": {"integerValue": 1}
        }
    }
    url = f"{BASE_URL}/users/{clean_name}"
    res = requests.patch(url, json=doc_data)
    return res.status_code == 200

def upload_stat(s):
    clean_name = s['name'].replace(' ', '_').replace('/', '_')
    doc_id = f"{clean_name}_{s['date']}"
    doc_data = {
        "fields": {
            "name": {"stringValue": s['name']},
            "date": {"stringValue": s['date']},
            "shots": {"integerValue": s.get('shots', 0)},
            "ventas": {"integerValue": s.get('ventas', 0)},
            "ads": {"integerValue": s.get('ads', 0)},
            "links": {"integerValue": s.get('links', 0)},
            "cxl": {"integerValue": s.get('cxl', 0)}
        }
    }
    url = f"{BASE_URL}/stats/{doc_id}"
    res = requests.patch(url, json=doc_data)
    return res.status_code == 200

def migrate():
    with open('initial_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    stats_list = data.get('stats', data)
    
    users = set()
    for s in stats_list:
        users.add(s['name'])
        
    print(f"Found {len(users)} unique users.")
    
    with ThreadPoolExecutor(max_workers=50) as executor:
        list(executor.map(upload_user, users))
        
    admin_data = {
        "fields": {
            "name": {"stringValue": "ADMIN"},
            "pin": {"stringValue": "7777"},
            "role": {"stringValue": "admin"},
            "active": {"integerValue": 1}
        }
    }
    requests.patch(f"{BASE_URL}/users/ADMIN", json=admin_data)
    print("Uploaded ADMIN user")
    
    print(f"Uploading {len(stats_list)} stats...")
    with ThreadPoolExecutor(max_workers=50) as executor:
        results = list(executor.map(upload_stat, stats_list))
    
    print(f"Uploaded {sum(results)}/{len(stats_list)} stats successfully.")
            
if __name__ == "__main__":
    migrate()
