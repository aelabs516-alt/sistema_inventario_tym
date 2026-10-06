import re
import os

path = "c:/Users/Falcon/Documents/inventario/sistema_inventario_tym/public/app.js"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix event listeners in initRotulosModule to prevent duplication
# Replace:
#   inputs.forEach(input => {
#     input.addEventListener("input", function() {
#       if (this.tagName === "INPUT" && this.type !== "email") {
#         this.value = this.value.toUpperCase();
#       }
#       updateRotuloPreview();
#       checkRotuloFormValidity();
#     });
#   });
old_inputs_listener = """  const inputs = form.querySelectorAll("input, select");
  inputs.forEach(input => {
    input.addEventListener("input", function() {
      if (this.tagName === "INPUT" && this.type !== "email") {
        this.value = this.value.toUpperCase();
      }
      updateRotuloPreview();
      checkRotuloFormValidity();
    });
  });"""

new_inputs_listener = """  const inputs = form.querySelectorAll("input, select");
  inputs.forEach(input => {
    input.oninput = function() {
      if (this.tagName === "INPUT" && this.type !== "email") {
        this.value = this.value.toUpperCase();
      }
      updateRotuloPreview();
      checkRotuloFormValidity();
    };
  });"""
content = content.replace(old_inputs_listener, new_inputs_listener)

# 2. Add checkRotuloFormValidity() to tab switches
content = content.replace("""    applyFieldCoordinates("T&M");
    updateRotuloPreview();
  };""", """    applyFieldCoordinates("T&M");
    updateRotuloPreview();
    checkRotuloFormValidity();
  };""")

content = content.replace("""    applyFieldCoordinates("ME");
    updateRotuloPreview();
  };""", """    applyFieldCoordinates("ME");
    updateRotuloPreview();
    checkRotuloFormValidity();
  };""")

content = content.replace("""    applyFieldCoordinates("Energa Solar");
    updateRotuloPreview();
  };""", """    applyFieldCoordinates("Energa Solar");
    updateRotuloPreview();
    checkRotuloFormValidity();
  };""")
  
# Handle potential encoding issues with Energía
content = content.replace("""    applyFieldCoordinates("Energía Solar");
    updateRotuloPreview();
  };""", """    applyFieldCoordinates("Energía Solar");
    updateRotuloPreview();
    checkRotuloFormValidity();
  };""")

# 3. Add robust try/catch to exportarRotuloPDF and fix possible pdf generation bug
old_exportar = """  html2pdf().from(container).set(opt).save().then(() => {
    btnExportar.disabled = false;
    btnExportar.innerHTML = `<i data-lucide="download-cloud"></i> Exportar en PDF`;
    lucide.createIcons();

    State.rotulos.push(nuevoRotulo);
    State.save();
    
    showCustomAlert(`Rtulo exportado con Ǹxito. Folio registrado: ${folio}`);
    
    document.getElementById("form-rotulo-envio").reset();
    initRotulosModule();
    renderDocumentsHistory();
  }).catch(err => {
    console.error(err);
    showCustomAlert("Hubo un error al generar el PDF.");
    btnExportar.disabled = false;
    btnExportar.innerHTML = `<i data-lucide="download-cloud"></i> Exportar en PDF`;
    lucide.createIcons();
  });"""

# Fallback pattern if encoding is weird
old_exportar_pattern = r'html2pdf\(\)\.from\(container\)\.set\(opt\)\.save\(\)\.then\(\(\) => \{.*?\}\)\.catch\(err => \{.*?\}\);'

new_exportar = """  try {
    // A veces html2canvas se atasca si el canvas no se invalida o hay referencias rotas
    // Pasamos un objeto html2canvas limpio
    opt.html2canvas = { scale: 1.5, useCORS: true, logging: false, allowTaint: true };
    
    html2pdf().from(container).set(opt).save().then(() => {
      btnExportar.disabled = false;
      btnExportar.innerHTML = `<i data-lucide="download-cloud"></i> Exportar en PDF`;
      if (typeof lucide !== 'undefined') lucide.createIcons();

      State.rotulos.push(nuevoRotulo);
      State.save();
      
      showCustomAlert(`Rótulo exportado con éxito. Folio registrado: ${folio}`, "success");
      
      document.getElementById("form-rotulo-envio").reset();
      initRotulosModule();
      renderDocumentsHistory();
    }).catch(err => {
      console.error("Error en html2pdf:", err);
      showCustomAlert("Hubo un error interno al generar el PDF.", "error");
      btnExportar.disabled = false;
      btnExportar.innerHTML = `<i data-lucide="download-cloud"></i> Exportar en PDF`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  } catch (e) {
    console.error("Excepción síncrona en exportarRotuloPDF:", e);
    showCustomAlert("Hubo un error al preparar la generación del PDF.", "error");
    btnExportar.disabled = false;
    btnExportar.innerHTML = `<i data-lucide="download-cloud"></i> Exportar en PDF`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }"""

content = re.sub(old_exportar_pattern, new_exportar, content, flags=re.DOTALL)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied")
