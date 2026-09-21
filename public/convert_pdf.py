import base64

pdf_path = r'C:\Users\Falcon\.gemini\antigravity\brain\cae944c2-9a88-451e-ae50-da9870aa8749\.user_uploaded\media_1790010301972.pdf'

with open(pdf_path, 'rb') as f:
    pdf_bytes = f.read()

b64_str = base64.b64encode(pdf_bytes).decode('utf-8')

with open('rotulo_templates.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('rotulo_templates.js', 'w', encoding='utf-8') as f:
    for line in lines:
        if 'ROTULO_TEMPLATE_ENERGIA_B64' not in line:
            f.write(line)
    f.write('\nconst ROTULO_TEMPLATE_ENERGIA_B64 = "' + b64_str + '";\n')

print('DONE')
