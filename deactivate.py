import requests

PROJECT_ID = "statsmvg"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

def main():
    active_names = ["ADRIAN", "ALEX", "ANA M", "ANDERSON", "ANDRES G", "BONJO", "CHRIS", "ERICK", "GALA", "GONZALO", "JP", "JUANJO JJ", "MIKE", "MONTSE", "NANCY", "NONO", "PANCHO", "RICKY", "SEBASTIAN", "SERGIO", "TONY"]
    
    url = f"{BASE_URL}/users?pageSize=200"
    res = requests.get(url).json()
    
    count = 0
    for doc in res.get('documents', []):
        fields = doc.get('fields', {})
        name = fields.get('name', {}).get('stringValue', '')
        
        if not name or name == "ADMIN":
            continue
            
        if name not in active_names:
            clean_name = name.replace(' ', '_').replace('/', '_')
            doc_url = f"{BASE_URL}/users/{clean_name}?updateMask.fieldPaths=active"
            patch_data = {"fields": {"active": {"integerValue": 0}}}
            r = requests.patch(doc_url, json=patch_data)
            if r.status_code == 200:
                print(f"Deactivated: {name}")
                count += 1
            else:
                print(f"Failed {name}: {r.text}")
                
    print(f"Total deactivated: {count}")

if __name__ == "__main__":
    main()
