import requests

PROJECT_ID = "statsmvg"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

def main():
    missing_names = [
        "MICHELLE", "ISA", "TOÑO", "GALAOR", "JOSEFINA", 
        "ANDRES A", "LEONARDO", "PAOLO", "BRUNO", "RICARDO"
    ]
    
    count = 0
    for name in missing_names:
        clean_name = name.replace(' ', '_').replace('/', '_').replace('Ñ', '')
        if name == "TOÑO":
            clean_name = "TOO"
            
        # We also can just query all and match by string, to be safe against encoding issues.
        pass

    # Safe way: fetch all, match, and patch
    url = f"{BASE_URL}/users?pageSize=200"
    res = requests.get(url).json()
    
    for doc in res.get('documents', []):
        fields = doc.get('fields', {})
        name = fields.get('name', {}).get('stringValue', '')
        
        # Check against normal and replaced versions
        if name in missing_names or name.replace('', 'Ñ') in missing_names or name == 'TOO':
            doc_url = f"{BASE_URL}/users/{doc['name'].split('/')[-1]}?updateMask.fieldPaths=active"
            patch_data = {"fields": {"active": {"integerValue": 1}}}
            r = requests.patch(doc_url, json=patch_data)
            if r.status_code == 200:
                print(f"Reactivated: {name}")
                count += 1
            else:
                print(f"Failed {name}: {r.text}")
                
    print(f"Total reactivated: {count}")

if __name__ == "__main__":
    main()
