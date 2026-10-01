import json
import re

with open('b64.json', 'r') as f:
    b64 = json.load(f)

content = open(r'public\rotulo_templates.js', 'r', encoding='utf-8').read()
content = re.sub(r"const ROTULO_TEMPLATE_TYM_B64 = ['.\x22].*?['.\x22];", 'const ROTULO_TEMPLATE_TYM_B64 = "' + b64['TM'] + '";', content, flags=re.DOTALL)
content = re.sub(r"const ROTULO_TEMPLATE_ME_B64 = ['.\x22].*?['.\x22];", 'const ROTULO_TEMPLATE_ME_B64 = "' + b64['ME'] + '";', content, flags=re.DOTALL)
open(r'public\rotulo_templates.js', 'w', encoding='utf-8').write(content)
print('Updated TYM and ME templates.')
