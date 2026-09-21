from PIL import Image
import base64

img_path = r'C:\Users\Falcon\.gemini\antigravity\brain\cae944c2-9a88-451e-ae50-da9870aa8749\.user_uploaded\media_1790010376305.png'
pdf_path = r'C:\Users\Falcon\Documents\inventario\sistema_inventario_tym\public\temp_energia.pdf'

img = Image.open(img_path)
img = img.convert('RGB')
img.save(pdf_path, 'PDF', resolution=100.0)

with open(pdf_path, 'rb') as f:
    pdf_bytes = f.read()

b64_str = base64.b64encode(pdf_bytes).decode('utf-8')
with open(r'C:\Users\Falcon\Documents\inventario\sistema_inventario_tym\public\rotulo_energia_b64.txt', 'w') as f:
    f.write('const ROTULO_TEMPLATE_ENERGIA_B64 = "' + b64_str + '";\n')
print('DONE')
