import re
import os

path = "c:/Users/Falcon/Documents/inventario/sistema_inventario_tym/public/app.js"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Make sure we don't double patch
if "showCustomConfirm(msg)" not in content:
    content = re.sub(r'\balert\(', 'showCustomAlert(', content)

    old_show_custom_alert = """function showCustomAlert(msg) {
  const modal = document.getElementById("modal-custom-alert");
  if (!modal) return alert(msg); // fallback
  document.getElementById("modal-custom-alert-msg").textContent = msg;
  modal.classList.remove("hidden");
}"""
    content = content.replace(old_show_custom_alert, "")

    content = re.sub(r'\bconfirm\(', 'await showCustomConfirm(', content)
    content = re.sub(r'btn\.onclick\s*=\s*function\(\)', 'btn.onclick = async function()', content)
    content = re.sub(r'btnRestoreBackup\.addEventListener\("click",\s*\(\)\s*=>', 'btnRestoreBackup.addEventListener("click", async () =>', content)

    new_functions = """
function showCustomAlert(msg, type = "info") {
  const modal = document.getElementById("modal-custom-alert");
  if (!modal) {
    window.alert(msg);
    return;
  }
  
  const iconEl = document.getElementById("modal-custom-alert-icon");
  const titleEl = document.getElementById("modal-custom-alert-title");
  
  let detectedType = type;
  if (msg.includes("éxito") || msg.includes("xito") || msg.includes("✅")) {
    detectedType = "success";
  } else if (msg.includes("Error") || msg.includes("❌")) {
    detectedType = "error";
  } else if (msg.includes("⚠️") || msg.includes("ADVERTENCIA")) {
    detectedType = "warning";
  }

  iconEl.innerHTML = "";
  if (detectedType === "success") {
    iconEl.innerHTML = '<i data-lucide="check-circle" style="color: var(--success); width: 24px; height: 24px;"></i>';
    titleEl.textContent = "Éxito";
  } else if (detectedType === "error") {
    iconEl.innerHTML = '<i data-lucide="x-circle" style="color: var(--danger); width: 24px; height: 24px;"></i>';
    titleEl.textContent = "Error";
  } else if (detectedType === "warning") {
    iconEl.innerHTML = '<i data-lucide="alert-triangle" style="color: var(--warning); width: 24px; height: 24px;"></i>';
    titleEl.textContent = "Advertencia";
  } else {
    iconEl.innerHTML = '<i data-lucide="info" style="color: var(--primary); width: 24px; height: 24px;"></i>';
    titleEl.textContent = "Información";
  }
  
  // Clean up emojis if desired
  let cleanMsg = msg.replace(/[✅⚠️❌🚨]/g, '').trim();
  
  document.getElementById("modal-custom-alert-msg").textContent = cleanMsg;
  if (typeof lucide !== 'undefined') lucide.createIcons();
  modal.classList.remove("hidden");
}

function showCustomConfirm(msg) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-custom-confirm");
    if (!modal) {
      resolve(window.confirm(msg));
      return;
    }
    
    let cleanMsg = msg.replace(/[✅⚠️❌🚨]/g, '').trim();
    document.getElementById("modal-custom-confirm-msg").textContent = cleanMsg;
    modal.classList.remove("hidden");
    
    const btnYes = document.getElementById("btn-custom-confirm-yes");
    const btnNo = document.getElementById("btn-custom-confirm-no");
    
    const onConfirm = () => {
      cleanup();
      resolve(true);
    };
    
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const cleanup = () => {
      btnYes.removeEventListener("click", onConfirm);
      btnNo.removeEventListener("click", onCancel);
      modal.classList.add("hidden");
    };
    
    btnYes.addEventListener("click", onConfirm);
    btnNo.addEventListener("click", onCancel);
  });
}
"""
    content = content + "\n" + new_functions

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("app.js updated.")
else:
    print("app.js already updated.")

