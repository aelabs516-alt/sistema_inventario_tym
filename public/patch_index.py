import re

path = "c:/Users/Falcon/Documents/inventario/sistema_inventario_tym/public/index.html"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_alert_html = """  <div id="modal-custom-alert" class="modal-wrapper hidden" style="z-index: 10100;">
    <div class="modal-card" style="max-width: 450px;">
      <div class="modal-header">
        <h4 style="display: flex; align-items: center; gap: 8px;"><i data-lucide="alert-triangle" style="color: var(--danger);"></i> Atencin</h4>
        <button class="modal-close-btn" onclick="document.getElementById('modal-custom-alert').classList.add('hidden')"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">
        <p id="modal-custom-alert-msg" style="font-size: 0.95rem; line-height: 1.5;"></p>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: flex-end; margin-top: 15px;">
        <button class="btn btn-primary" onclick="document.getElementById('modal-custom-alert').classList.add('hidden')">Aceptar</button>
      </div>
    </div>
  </div>"""

# Fallback pattern if encoding issues
old_alert_pattern = r'<div id="modal-custom-alert".*?</div>\s*</div>\s*</div>'

new_modals_html = """  <!-- ALERTS MODAL -->
  <div id="modal-custom-alert" class="modal-wrapper hidden" style="z-index: 10100;">
    <div class="modal-card" style="max-width: 400px; text-align: center;">
      <div class="modal-header" style="justify-content: flex-end; border-bottom: none; padding-bottom: 0;">
        <button class="modal-close-btn" onclick="document.getElementById('modal-custom-alert').classList.add('hidden')"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; align-items: center; gap: 15px; padding-top: 0;">
        <div id="modal-custom-alert-icon" style="background: var(--bg-primary); padding: 15px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">
          <i data-lucide="info" style="color: var(--primary); width: 32px; height: 32px;"></i>
        </div>
        <h3 id="modal-custom-alert-title" style="margin: 0; font-size: 1.5rem; color: var(--text-primary);">Información</h3>
        <p id="modal-custom-alert-msg" style="font-size: 1rem; line-height: 1.5; color: var(--text-secondary); margin: 0;"></p>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: center; border-top: none; padding-top: 10px; padding-bottom: 24px;">
        <button class="btn btn-primary" style="width: 120px; font-weight: 600;" onclick="document.getElementById('modal-custom-alert').classList.add('hidden')">Aceptar</button>
      </div>
    </div>
  </div>

  <!-- CONFIRM MODAL -->
  <div id="modal-custom-confirm" class="modal-wrapper hidden" style="z-index: 10100;">
    <div class="modal-card" style="max-width: 400px; text-align: center;">
      <div class="modal-header" style="justify-content: flex-end; border-bottom: none; padding-bottom: 0;">
        <button class="modal-close-btn" onclick="document.getElementById('modal-custom-confirm').classList.add('hidden')"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; align-items: center; gap: 15px; padding-top: 0;">
        <div style="background: var(--bg-primary); padding: 15px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">
          <i data-lucide="help-circle" style="color: var(--primary); width: 32px; height: 32px;"></i>
        </div>
        <h3 style="margin: 0; font-size: 1.5rem; color: var(--text-primary);">Confirmación</h3>
        <p id="modal-custom-confirm-msg" style="font-size: 1rem; line-height: 1.5; color: var(--text-secondary); margin: 0;"></p>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: center; gap: 15px; border-top: none; padding-top: 10px; padding-bottom: 24px;">
        <button id="btn-custom-confirm-no" class="btn btn-secondary" style="width: 100px; font-weight: 500;">Cancelar</button>
        <button id="btn-custom-confirm-yes" class="btn btn-primary" style="width: 100px; font-weight: 500;">Sí</button>
      </div>
    </div>
  </div>"""

if "modal-custom-confirm" not in content:
    content = re.sub(r'<div id="modal-custom-alert".*?</div>\s*</div>\s*</div>', new_modals_html, content, flags=re.DOTALL)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("index.html updated.")
else:
    print("index.html already updated.")

