import json
import re

with open('b64.json', 'r') as f:
    b64 = json.load(f)

# 1. Update rotulo_templates.js
content = open(r'public\rotulo_templates.js', 'r', encoding='utf-8').read()
content = re.sub(r'const ROTULO_TEMPLATE_TYM_B64 = \x22[^\x22]+\x22;', f'const ROTULO_TEMPLATE_TYM_B64 = \x22{b64["TM"]}\x22;', content)
content = re.sub(r'const ROTULO_TEMPLATE_ME_B64 = \x22[^\x22]+\x22;', f'const ROTULO_TEMPLATE_ME_B64 = \x22{b64["ME"]}\x22;', content)
content = re.sub(r'const ROTULO_TEMPLATE_ENERGIA_B64 = \x22[^\x22]+\x22;', f'const ROTULO_TEMPLATE_ENERGIA_B64 = \x22{b64["Energia"]}\x22;', content)
open(r'public\rotulo_templates.js', 'w', encoding='utf-8').write(content)

# 2. Update index.html
html = open(r'public\index.html', 'r', encoding='utf-8').read()
html = re.sub(r'<span id=\x22rotulo-sender-ciudad\x22[^>]+>.*?</span>\s*', '', html)
html = re.sub(r'<span id=\x22rotulo-sender-direccion\x22[^>]+>.*?</span>\s*', '', html)
open(r'public\index.html', 'w', encoding='utf-8').write(html)

# 3. Update app.js
js = open(r'public\app.js', 'r', encoding='utf-8').read()
js = re.sub(r',\s*senderCiudad: \{.*?\}', '', js)
js = re.sub(r',\s*senderDir: \{.*?\}', '', js)
js = re.sub(r'\s*const senderFields = \[\x22senderCiudad\x22, \x22senderDir\x22\];.*?el\.style\.fontSize = senderFontSize;\s*\}\s*\}\);', '', js, flags=re.DOTALL)
open(r'public\app.js', 'w', encoding='utf-8').write(js)

print('Done updating files.')
