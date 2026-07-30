import urllib.request
import json

url = 'https://raw.githubusercontent.com/marcovega/colombia-json/master/colombia.min.json'
try:
    req = urllib.request.urlopen(url)
    data = json.loads(req.read().decode('utf-8'))
    
    geodata = {}
    for item in data:
        depto = item.get('departamento')
        ciudades = item.get('ciudades', [])
        if depto and ciudades:
            geodata[depto] = ciudades
            
    js_content = f"const COLOMBIA_GEODATA = {json.dumps(geodata, ensure_ascii=False, indent=2)};"
    
    with open('public/colombia_geodata.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print(f"Successfully generated colombia_geodata.js with {len(geodata)} departments.")
except Exception as e:
    print(f"Error: {e}")
