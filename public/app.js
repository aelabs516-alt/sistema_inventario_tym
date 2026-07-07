/* ==========================================================================
   LÓGICA PRINCIPAL DEL SISTEMA - INVENTARIO 360°
   ========================================================================== */
// --- DATOS DE SEMILLA E INICIALIZACIÓN ---
const DEFAULT_USER = {
  email: "admin@inventario.com",
  username: "ADMIN",
  password: "123456",
  name: "Administrador",
  role: "Administrador",
  perms: []
};

// Se reestablecen todas las listas a vacío para iniciar desde cero a ingresar información
const DEFAULT_WAREHOUSES = [];
const DEFAULT_CARRIERS = [];
const DEFAULT_PRODUCTS = [];
const DEFAULT_SELLERS = [];
const DEFAULT_INGRESOS = [];
const DEFAULT_SALIDAS = [];
const DEFAULT_TRASLADOS = [];

const DEFAULT_PVE = [
  "Descuento Nómina",
  "Local",
  "MasterShop",
  "Mercado Libre Despacho",
  "Mercado Libre Flex",
  "Mercado Libre Full",
  "Bogotá Eladio",
  "Falabella",
  "Los Pinos"
];

// Rutina de Limpieza para forzar inicio limpio conservando credenciales
(function() {
  if (localStorage.getItem("inv360_reset_v8") !== "true") {
    // Eliminar datos antiguos de localStorage
    localStorage.removeItem("inv360_users");
    localStorage.removeItem("inv360_active_user");
    localStorage.removeItem("inv360_products");
    localStorage.removeItem("inv360_warehouses");
    localStorage.removeItem("inv360_carriers");
    localStorage.removeItem("inv360_sellers");
    localStorage.removeItem("inv360_ingresos");
    localStorage.removeItem("inv360_salidas");
    localStorage.removeItem("inv360_traslados");
    localStorage.removeItem("inv360_simulations");
    localStorage.removeItem("inv360_pve");

    // Reestablecer usuario administrador base
    const adminUser = { ...DEFAULT_USER };
    
    // Marcar como ya configurada para evitar la alerta de primer inicio
    localStorage.setItem("inv360_admin_password_set", "true");
    
    localStorage.setItem("inv360_users", JSON.stringify([adminUser]));
    localStorage.setItem("inv360_reset_v8", "true");
  }
})();

// --- GESTIÓN DE STATE EN LOCALSTORAGE Y BACKEND ---
// Variables globales para fotos y rastreo de edición
let productPhotoBase64 = "";
let userPhotoBase64 = "";
let editingProductSku = null;
let editingUserEmail = null;
let editingSellerName = null;
let isSubmittingProduct = false;

const State = {
  users: [DEFAULT_USER],
  activeUser: JSON.parse(localStorage.getItem("inv360_active_user")) || null,
  products: DEFAULT_PRODUCTS,
  warehouses: DEFAULT_WAREHOUSES,
  carriers: DEFAULT_CARRIERS,
  sellers: DEFAULT_SELLERS,
  pve: DEFAULT_PVE,
  backup: { frequency: "Mensual", time: "02:00", emails: "operaciones@tecnologiaymovilidad.com" },
  ingresos: DEFAULT_INGRESOS,
  salidas: DEFAULT_SALIDAS,
  traslados: DEFAULT_TRASLADOS,
  simulations: [],
  reservas: [],
  backupsLog: [],
  garantias: [],
  pedidosAccesorios: [],
  rotulos: [],
  facturacion: [],
  
  save() {
    const metadataState = {
      backup: this.backup,
      backupsLog: this.backupsLog,
      pedidosAccesorios: this.pedidosAccesorios,
      rotulos: this.rotulos,
      simulations: this.simulations
    };
    fetch('/api/sync-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadataState)
    }).then(res => {
      if (res.status === 401) {
         State.activeUser = null;
         if (typeof showLogin === 'function') showLogin();
      }
    }).catch(e => console.error("Error al sincronizar metadata:", e));

    if (typeof previousStateSnapshot === 'undefined' || !previousStateSnapshot) return;

    const models = [
      { key: 'users', idField: 'email' },
      { key: 'products', idField: 'sku' },
      { key: 'warehouses', idField: null },
      { key: 'pve', idField: null },
      { key: 'carriers', idField: null },
      { key: 'sellers', idField: 'name' },
      { key: 'ingresos', idField: 'id' },
      { key: 'salidas', idField: 'id' },
      { key: 'traslados', idField: 'id' },
      { key: 'reservas', idField: 'id' },
      { key: 'facturacion', idField: 'id' },
      { key: 'garantias', idField: 'id' }
    ];

    models.forEach(model => {
      const currentList = this[model.key] || [];
      const previousList = previousStateSnapshot[model.key] || [];
      
      if (model.idField === null) {
        const currentSet = new Set(currentList);
        const previousSet = new Set(previousList);
        currentList.forEach(item => {
           if (!previousSet.has(item)) {
              fetch(`/api/${model.key}/${encodeURIComponent(item)}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(item) });
           }
        });
        previousList.forEach(item => {
           if (!currentSet.has(item)) {
              fetch(`/api/${model.key}/${encodeURIComponent(item)}`, { method: 'DELETE' });
           }
        });
        return;
      }

      const currentMap = new Map();
      currentList.forEach(item => {
        if (item && item[model.idField]) currentMap.set(item[model.idField], item);
      });
      
      const previousMap = new Map();
      previousList.forEach(item => {
        if (item && item[model.idField]) previousMap.set(item[model.idField], item);
      });

      currentMap.forEach((item, id) => {
        const prevItem = previousMap.get(id);
        if (!prevItem || JSON.stringify(item) !== JSON.stringify(prevItem)) {
          fetch(`/api/${model.key}/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          });
        }
      });

      previousMap.forEach((item, id) => {
        if (!currentMap.has(id)) {
          fetch(`/api/${model.key}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        }
      });
    });

    previousStateSnapshot = JSON.parse(JSON.stringify(this));
  }
};

let previousStateSnapshot = null;

async function fetchInitialState(triggerAppShow = true) {
  try {
    const res = await fetch('/api/init-state');
    if (res.ok) {
      const data = await res.json();
      Object.assign(State, data);
      
      previousStateSnapshot = JSON.parse(JSON.stringify(State));
      
      if (triggerAppShow && State.activeUser) {
        if (typeof showApp === 'function') showApp();
      }
    } else if (res.status === 401) {
      State.activeUser = null;
      if (typeof showLogin === 'function') showLogin();
    }
  } catch (error) {
    console.error("Error al cargar estado del backend:", error);
  }
}

async function checkAuthAndInit() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      State.activeUser = data.user;
      await fetchInitialState(true);
    } else {
      State.activeUser = null;
      if (typeof showLogin === 'function') showLogin();
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    if (typeof showLogin === 'function') showLogin();
  }
}
checkAuthAndInit();

setInterval(() => {
  if (window.location.hostname !== 'localhost' && window.location.protocol !== 'file:') {
    fetchInitialState(false);
  }
}, 300000);

// --- CALCULADORES DE INVENTARIO EN TIEMPO REAL ---
// Calcula el stock físico neto de cada producto agrupado por bodega
function getInventoryStock() {
  const stock = {}; // Estructura: { sku: { warehouse: qty } }

  // Inicializar todo a 0
  State.products.forEach(p => {
    stock[p.sku] = {};
    State.warehouses.forEach(w => {
      stock[p.sku][w] = 0;
    });
  });

  // Helper para inicializar skus huérfanos
  const ensureSku = (sku, wh) => {
    if (!stock[sku]) stock[sku] = {};
    if (stock[sku][wh] === undefined) stock[sku][wh] = 0;
  };

  // Procesar ingresos
  State.ingresos.forEach(doc => {
    const wh = doc.warehouse;
    if (doc.items && doc.condition !== "Dañado") { // Solo suma stock sano
      doc.items.forEach(item => {
        ensureSku(item.sku, wh);
        stock[item.sku][wh] += parseInt(item.qty || 0);
      });
    }
  });

  // Procesar traslados
  State.traslados.forEach(doc => {
    const orig = doc.originWarehouse;
    const dest = doc.destWarehouse;
    if (doc.items) {
      doc.items.forEach(item => {
        ensureSku(item.sku, orig);
        ensureSku(item.sku, dest);
        stock[item.sku][orig] -= parseInt(item.qty || 0);
        stock[item.sku][dest] += parseInt(item.qty || 0);
      });
    }
  });

  // Procesar salidas
  State.salidas.forEach(doc => {
    const wh = doc.warehouse;
    if (doc.items) {
      doc.items.forEach(item => {
        ensureSku(item.sku, wh);
        stock[item.sku][wh] -= parseInt(item.qty || 0);
      });
    }
  });

  return stock;
}

// --- CURRENCY & CBM HELPERS ---
function formatCurrency(val) {
  if (val === undefined || val === null || isNaN(val)) return "$ 0";
  // Si el usuario tiene rol con restricción monetaria, retornar enmascarado
  if (State.activeUser && (State.activeUser.role === "Ventas" || State.activeUser.role === "Visualización")) {
    return "$ ***.***";
  }
  const str = Math.round(val).toString();
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$ ${formatted}`;
}

// CBM = Alto(cm) * Ancho(cm) * Largo(cm) * Cantidad por caja / 1,000,000
function calculateProductCBM(h, w, l, boxQty = 1) {
  return (parseFloat(h) * parseFloat(w) * parseFloat(l) * parseInt(boxQty)) / 1000000;
}

// --- RELOJES GLOBALES ---
function getOffsetDate(date, offsetHours) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * offsetHours));
}

function formatTime(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDate(date) {
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const dd = String(date.getDate()).padStart(2, '0');
  const mmmm = months[date.getMonth()];
  const yyyy = date.getFullYear();
  return `${dd} ${mmmm} ${yyyy}`;
}

function updateClocks() {
  const now = new Date();
  
  // Medellín (UTC -5)
  const medellinTime = getOffsetDate(now, -5);
  document.getElementById("clock-medellin-time").textContent = formatTime(medellinTime);
  document.getElementById("clock-medellin-date").textContent = formatDate(medellinTime);

  // China (UTC +8)
  const chinaTime = getOffsetDate(now, 8);
  document.getElementById("clock-china-time").textContent = formatTime(chinaTime);
  document.getElementById("clock-china-date").textContent = formatDate(chinaTime);
}

// --- CONTROL DE VISTAS Y AUTENTICACIÓN ---
document.getElementById("login-email").addEventListener("input", function() {
  const emailVal = this.value.trim().toLowerCase();
  const tip = document.getElementById("first-login-tip");
  
  if (emailVal === "admin@inventario.com" || emailVal === "admin") {
    tip.classList.remove("hidden");
  } else {
    tip.classList.add("hidden");
  }
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const loginInput = document.getElementById("login-email").value.trim().toLowerCase();
  const pass = document.getElementById("login-password").value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginInput, password: pass })
    });
    
    if (res.ok) {
      const data = await res.json();
      State.activeUser = data.user;
      document.getElementById("first-login-tip").classList.add("hidden");
      await fetchInitialState(true);
    } else {
      const errorBlock = document.getElementById("login-error");
      errorBlock.classList.remove("hidden");
      setTimeout(() => errorBlock.classList.add("hidden"), 4000);
    }
  } catch(error) {
    console.error("Error en login:", error);
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch(e) {}
  State.activeUser = null;
  localStorage.removeItem("inv360_active_user");
  showLogin();
});

function showLogin() {
  document.getElementById("login-container").classList.remove("hidden");
  document.getElementById("app-container").classList.add("hidden");
}

function showApp() {
  document.getElementById("login-container").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");

  // Colocar datos del usuario activo
  document.getElementById("user-display-name").textContent = State.activeUser.name;
  document.getElementById("user-display-role").textContent = State.activeUser.role;
  const avatarEl = document.getElementById("user-avatar");
  if (avatarEl) {
    avatarEl.src = State.activeUser.photo || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop";
  }

  // Filtrar visibilidad del menú por rol
  applyRolePermissions();

  // Actualizar dashboard inicial
  updateSummaryWidget();
  initDashboardFilters();
  renderDashboardCharts();
  
  // Iniciar timer de relojes
  updateClocks();
  setInterval(updateClocks, 1000);
  
  // Registrar listeners de navegación
  initNavigation();
  initModules();

  // Establecer página principal
  const role = State.activeUser.role;
  if (role !== "Administrador") {
    const ventasNav = document.querySelector(".sidebar-nav .nav-item[data-target='module-salida']");
    if (ventasNav && !ventasNav.classList.contains("hidden")) {
      ventasNav.click();
    } else {
      const firstVisibleNav = document.querySelector(".sidebar-nav .nav-item:not(.hidden)");
      if (firstVisibleNav) firstVisibleNav.click();
    }
  } else {
    const dashboardNav = document.querySelector(".sidebar-nav .nav-item[data-target='module-dashboard']");
    if (dashboardNav) dashboardNav.click();
  }
}

function applyRolePermissions() {
  const role = State.activeUser.role;
  const navItems = document.querySelectorAll(".sidebar-nav .nav-item");

  navItems.forEach(item => {
    const target = item.getAttribute("data-target");
    let isVisible = true;

    if (role === "Ventas") {
      // Ventas: Salida Mercancía, Dashboard, Stock Global, Stock, Documentos Creados, Rótulos
      const allowed = ["module-dashboard", "module-salida", "module-stock", "module-stock-basic", "module-documentos", "module-rotulos"];
      isVisible = allowed.includes(target);
    } else if (role === "Visualización") {
      // Visualización: Dashboard, Stock Global, Stock
      const allowed = ["module-dashboard", "module-stock", "module-stock-basic"];
      isVisible = allowed.includes(target);
    } else if (role === "Personalizado") {
      // Personalizado: según perms configurados
      const perms = State.activeUser.perms || [];
      isVisible = perms.includes(target);
    }

    if (isVisible) {
      item.classList.remove("hidden");
    } else {
      item.classList.add("hidden");
    }
  });

  // Habilitar o deshabilitar pestañas internas en Creación (solo admin)
  if (role !== "Administrador") {
    // Si no es admin y de casualidad accede por rol personalizado, bloquear creación de usuarios
    const userTabHeader = document.querySelector(".tab-btn[data-tab='tab-usuarios']");
    if (userTabHeader) userTabHeader.classList.add("hidden");
  } else {
    const userTabHeader = document.querySelector(".tab-btn[data-tab='tab-usuarios']");
    if (userTabHeader) userTabHeader.classList.remove("hidden");
  }

  // Si el rol activo no tiene acceso al módulo seleccionado actual, redireccionar a Dashboard
  const activeNavItem = document.querySelector(".sidebar-nav .nav-item.active");
  if (activeNavItem && activeNavItem.classList.contains("hidden")) {
    const dashboardNav = document.querySelector(".sidebar-nav .nav-item[data-target='module-dashboard']");
    if (dashboardNav) dashboardNav.click();
  }
}

// --- SISTEMA DE NAVEGACIÓN ---
function initNavigation() {
  const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
  const modules = document.querySelectorAll(".app-module");

  navItems.forEach(item => {
    item.onclick = function() {
      navItems.forEach(i => i.classList.remove("active"));
      this.classList.add("active");

      const target = this.getAttribute("data-target");
      modules.forEach(m => m.classList.add("hidden"));
      
      const targetModule = document.getElementById(target);
      if (targetModule) {
        targetModule.classList.remove("hidden");
        // Disparar recargas específicas de módulo
        onModuleOpen(target);
      }
    };
  });
}

function onModuleOpen(moduleId) {
  if (moduleId === "module-dashboard") {
    initDashboardFilters();
    renderDashboardCharts();
  } else if (moduleId === "module-creacion") {
    renderProductsList();
    renderWarehouseList();
    renderCarriersList();
    renderUsersList();
    renderSellersList();
  } else if (moduleId === "module-ingreso") {
    resetStockEntryForm();
  } else if (moduleId === "module-salida") {
    resetStockExitForm();
  } else if (moduleId === "module-traslado") {
    resetStockTransferForm();
  } else if (moduleId === "module-pedido") {
    renderSimulationTable();
  } else if (moduleId === "module-stock") {
    initStockFilters();
    renderStockProjectionsTable();
  } else if (moduleId === "module-stock-basic") {
    initStockBasicFilters();
    renderStockBasicTable();
  } else if (moduleId === "module-documentos") {
    renderDocumentsHistory();
  } else if (moduleId === "module-reservas") {
    initReservasModule();
  } else if (moduleId === "module-garantias") {
    initGarantiasModule();
  } else if (moduleId === "module-pedidos-accesorios") {
    initPedidosAccesoriosModule();
  } else if (moduleId === "module-rotulos") {
    initRotulosModule();
  } else if (moduleId === "module-facturacion") {
    initFacturacionModule();
  }
  
  // Re-iniciar iconos de Lucide
  lucide.createIcons();
}

// --- ACTUALIZACIÓN SUMMARY HEADER ---
function updateSummaryWidget() {
  const stockData = getInventoryStock();
  
  // Total Productos registrados
  const totalProducts = State.products.length;
  document.getElementById("summary-total-products").textContent = totalProducts;

  // Bodegas activas
  const totalWarehouses = State.warehouses.length;
  document.getElementById("summary-total-warehouses").textContent = totalWarehouses;

  // Stock físico total
  let totalStockUnits = 0;
  const whStocks = {}; // w -> qty
  const catStocks = { "T&M": 0, "ME": 0, "Accesorios ME": 0 };

  State.products.forEach(p => {
    State.warehouses.forEach(w => {
      const qty = stockData[p.sku]?.[w] || 0;
      totalStockUnits += qty;
      whStocks[w] = (whStocks[w] || 0) + qty;
      catStocks[p.category] = (catStocks[p.category] || 0) + qty;
    });
  });

  document.getElementById("summary-total-stock").textContent = totalStockUnits.toLocaleString();

  // Renderizar la lista de hover del resumen
  const whListHTML = Object.entries(whStocks).map(([w, q]) => `
    <li><span>${w}</span> <span class="val">${q.toLocaleString()} uds</span></li>
  `).join("");
  document.getElementById("summary-dropdown-warehouses-list").innerHTML = whListHTML;

  const catListHTML = Object.entries(catStocks).map(([c, q]) => `
    <li><span>${c}</span> <span class="val">${q.toLocaleString()} uds</span></li>
  `).join("");
  document.getElementById("summary-dropdown-categories-list").innerHTML = catListHTML;
}

// --- MODULO: CREACIÓN ---
function initModules() {
  // Tabs internas Creación
  const tabs = document.querySelectorAll("#module-creacion .tab-btn");
  tabs.forEach(tab => {
    tab.onclick = function() {
      tabs.forEach(t => t.classList.remove("active"));
      this.classList.add("active");

      const targetTab = this.getAttribute("data-tab");
      const panels = document.querySelectorAll("#module-creacion .tab-panel");
      panels.forEach(p => p.classList.remove("active"));
      document.getElementById(targetTab).classList.add("active");
    };
  });

  // Foto base64
  const photoInput = document.getElementById("prod-photo-file");
  const photoPreview = document.getElementById("prod-photo-preview");
  const deletePhotoBtn = document.getElementById("btn-delete-photo");

  document.getElementById("btn-import-photo").onclick = () => photoInput.click();

  photoInput.onchange = async function(e) {
    const file = e.target.files[0];
    if (file) {
      try {
        productPhotoBase64 = await compressImageToBase64(file);
        photoPreview.innerHTML = `<img src="${productPhotoBase64}" alt="Preview">`;
        deletePhotoBtn.classList.remove("hidden");
      } catch (err) {
        console.error("Error al procesar foto del producto:", err);
        alert("❌ Error al procesar la foto del producto: " + err.message);
      }
    }
  };

  deletePhotoBtn.onclick = function() {
    productPhotoBase64 = "";
    photoPreview.innerHTML = `<span class="no-photo-text">Sin Foto</span>`;
    photoInput.value = "";
    this.classList.add("hidden");
  };

  // Auto cubicaje CBM
  const pHeight = document.getElementById("prod-height");
  const pWidth = document.getElementById("prod-width");
  const pLength = document.getElementById("prod-length");
  const pCbmDisp = document.getElementById("prod-cbm-display");

  function refreshFormCbm() {
    const h = parseFloat(pHeight.value) || 0;
    const w = parseFloat(pWidth.value) || 0;
    const l = parseFloat(pLength.value) || 0;
    const boxQty = parseInt(document.getElementById("prod-box-qty").value) || 1;
    const cbm = calculateProductCBM(h, w, l, boxQty);
    pCbmDisp.value = `${cbm.toFixed(6)} m³`;
  }
  pHeight.addEventListener("input", refreshFormCbm);
  pWidth.addEventListener("input", refreshFormCbm);
  pLength.addEventListener("input", refreshFormCbm);
  document.getElementById("prod-box-qty").addEventListener("input", refreshFormCbm);

  // Formulario Crear Producto
  document.getElementById("form-create-product").addEventListener("submit", (e) => {
    e.preventDefault();
    if (isSubmittingProduct) return;
    
    const sku = document.getElementById("prod-sku").value.trim().toUpperCase();
    if (!sku) {
      alert("El SKU es obligatorio.");
      return;
    }
    
    isSubmittingProduct = true;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const barcode = document.getElementById("prod-barcode").value.trim();
    const name = document.getElementById("prod-name").value.trim();
    const category = document.getElementById("prod-category").value;
    const height = parseFloat(pHeight.value) || 0;
    const width = parseFloat(pWidth.value) || 0;
    const length = parseFloat(pLength.value) || 0;
    const boxQty = parseInt(document.getElementById("prod-box-qty").value) || 1;

    // Verificar edición vs creación
    if (editingProductSku) {
      if (sku !== editingProductSku && State.products.some(p => p.sku === sku)) {
        alert("El nuevo SKU ingresado ya pertenece a otro producto. No se permiten duplicados.");
        isSubmittingProduct = false;
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      const existIndex = State.products.findIndex(p => p.sku === editingProductSku);
      if (existIndex > -1) {
        State.products[existIndex] = { sku, barcode, name, category, height, width, length, boxQty, photo: productPhotoBase64 };
      }
      editingProductSku = null; // Limpiar estado de edición
    } else {
      if (State.products.some(p => p.sku === sku)) {
        alert("El SKU ya existe. No se puede crear un producto duplicado.");
        isSubmittingProduct = false;
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      State.products.push({ sku, barcode, name, category, height, width, length, boxQty, photo: productPhotoBase64 });
    }

    State.save();
    updateSummaryWidget();
    renderProductsList();
    
    // Resetear formulario
    e.target.reset();
    productPhotoBase64 = "";
    photoPreview.innerHTML = `<span class="no-photo-text">Sin Foto</span>`;
    deletePhotoBtn.classList.add("hidden");
    pCbmDisp.value = "0.000000 m³";
    
    // Alerta bloqueante
    alert("Producto guardado correctamente.");
    
    // Anti-rebote: Liberar el botón y la bandera 500ms después
    // de que el usuario cierre la alerta, para descartar clics encolados.
    setTimeout(() => {
      if (submitBtn) submitBtn.disabled = false;
      isSubmittingProduct = false;
    }, 500);
  });

  // Buscar en lista de productos
  document.getElementById("search-products-list").addEventListener("input", function() {
    renderProductsList(this.value.trim());
  });

  // Crear Bodega
  document.getElementById("form-create-warehouse").addEventListener("submit", (e) => {
    e.preventDefault();
    const whName = document.getElementById("wh-name").value.trim();
    if (whName && !State.warehouses.includes(whName)) {
      State.warehouses.push(whName);
      State.save();
      updateSummaryWidget();
      renderWarehouseList();
      e.target.reset();
    }
  });

  // Crear / Editar Transportadora
  document.getElementById("form-create-carrier").addEventListener("submit", (e) => {
    e.preventDefault();
    const cName = document.getElementById("carrier-name").value.trim();
    const editName = document.getElementById("carrier-edit-name").value;

    if (!cName) return;

    if (editName) {
      // Editar
      if (cName !== editName && State.carriers.includes(cName)) {
        alert("Esta transportadora ya se encuentra registrada.");
        return;
      }
      const idx = State.carriers.indexOf(editName);
      if (idx > -1) {
        State.carriers[idx] = cName;
        
        // Actualizar salidas históricas que usaban esta transportadora para consistencia
        State.salidas.forEach(doc => {
          if (doc.carrier === editName) {
            doc.carrier = cName;
          }
        });
        
        alert("Transportadora actualizada con éxito.");
      }
    } else {
      // Registrar nueva
      if (State.carriers.includes(cName)) {
        alert("Esta transportadora ya se encuentra registrada.");
        return;
      }
      State.carriers.push(cName);
      alert("Transportadora registrada correctamente.");
    }

    State.save();
    renderCarriersList();
    e.target.reset();
    
    // Resetear formulario a su estado de registro
    document.getElementById("carrier-edit-name").value = "";
    document.getElementById("carrier-form-title").textContent = "Parametrizar Transportadora";
    document.getElementById("btn-save-carrier").innerHTML = `<i data-lucide="plus"></i> Registrar`;
    lucide.createIcons();
  });

  // Registrar / Editar Punto de Venta
  document.getElementById("form-create-pve").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("pve-name").value.trim();
    const editName = document.getElementById("pve-edit-name").value;

    if (!name) return;

    if (editName) {
      // Editar
      if (name !== editName && State.pve.includes(name)) {
        alert("Este punto de venta ya se encuentra registrado.");
        return;
      }
      const idx = State.pve.indexOf(editName);
      if (idx > -1) {
        State.pve[idx] = name;
        
        // Actualizar salidas históricas que usaban este PVE para consistencia
        State.salidas.forEach(doc => {
          if (doc.pve === editName) {
            doc.pve = name;
          }
        });
        
        alert("Punto de venta actualizado con éxito.");
      }
    } else {
      // Registrar nuevo
      if (State.pve.includes(name)) {
        alert("Este punto de venta ya se encuentra registrado.");
        return;
      }
      State.pve.push(name);
      alert("Punto de venta registrado correctamente.");
    }

    State.save();
    renderPveList();
    e.target.reset();
    
    // Resetear formulario a su estado de registro
    document.getElementById("pve-edit-name").value = "";
    document.getElementById("pve-form-title").textContent = "Registrar Punto de Venta";
    document.getElementById("btn-save-pve").innerHTML = `<i data-lucide="plus"></i> Registrar`;
    lucide.createIcons();
  });

  // Backup Automático Settings
  const backupForm = document.getElementById("form-backup-settings");
  backupForm.querySelector("#backup-frequency").value = State.backup.frequency;
  backupForm.querySelector("#backup-time").value = State.backup.time || "02:00";
  backupForm.querySelector("#backup-emails").value = State.backup.emails;

  // Cargar historial simulado inicial si está vacío
  if (State.backupsLog.length === 0) {
    const today = new Date();
    const backupTime = State.backup.time || "02:00";
    for (let i = 3; i >= 1; i--) {
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - (i * 30)); // Aproximadamente cada mes
      State.backupsLog.push({
        id: `BCK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        date: pastDate.toISOString().split("T")[0] + " " + backupTime + ":00",
        frequency: State.backup.frequency || "Mensual",
        emails: State.backup.emails || "operaciones@tecnologiaymovilidad.com",
        filename: `backup_inv360_${pastDate.toISOString().split("T")[0]}.json`,
        status: "Enviado con éxito"
      });
    }
    State.save();
  }
  renderBackupsTable();

  backupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    State.backup.frequency = document.getElementById("backup-frequency").value;
    State.backup.time = document.getElementById("backup-time").value;
    State.backup.emails = document.getElementById("backup-emails").value.trim();
    State.save();
    alert("✅ Configuración de backup guardada.");
  });

  // Ejecutar backup manual ahora
  document.getElementById("btn-trigger-backup").onclick = function() {
    const freq = document.getElementById("backup-frequency").value;
    const emails = document.getElementById("backup-emails").value.trim();

    if (!emails) {
      alert("Por favor configure al menos un correo electrónico.");
      return;
    }

    const todayStr = new Date().toISOString().replace("T", " ").substr(0, 19);
    const dateFileStr = new Date().toISOString().split("T")[0];
    const filename = `backup_inv360_${dateFileStr}.json`;

    State.backupsLog.push({
      id: `BCK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      date: todayStr,
      frequency: freq,
      emails: emails,
      filename: filename,
      status: "Enviado con éxito"
    });
    State.save();

    renderBackupsTable();
    downloadSystemBackup(filename);
    alert("✅ Backup manual ejecutado con éxito. Se ha descargado el archivo JSON y simulado el envío a los destinatarios.");
  };

  // Restaurar Backup Manual
  const btnRestoreBackup = document.getElementById("btn-restore-backup");
  const fileRestoreBackup = document.getElementById("file-restore-backup");
  
  if (btnRestoreBackup && fileRestoreBackup) {
    btnRestoreBackup.addEventListener("click", () => {
      if (confirm("⚠️ ADVERTENCIA CRÍTICA: Restaurar un backup sobrescribirá TODA la base de datos actual y eliminará cualquier información ingresada posteriormente a la fecha del backup. ¿Estás absolutamente seguro de continuar?")) {
        fileRestoreBackup.click();
      }
    });

    fileRestoreBackup.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function(event) {
        try {
          const restoredData = JSON.parse(event.target.result);
          
          // Validación básica de que es un backup válido del sistema
          if (!restoredData.users || !restoredData.products || !restoredData.warehouses) {
            alert("❌ El archivo seleccionado no parece ser un backup válido del sistema Inventario 360°.");
            return;
          }

          // Fusionar y reemplazar
          Object.assign(State, restoredData);
          
          // Enviar al servidor para forzar el borrado y reescritura en base de datos
          State.save();
          
          alert("✅ Backup restaurado exitosamente en la base de datos. El sistema se reiniciará para aplicar los cambios.");
          window.location.reload();
          
        } catch (error) {
          console.error("Error procesando archivo de backup:", error);
          alert("❌ Error al procesar el archivo JSON. Verifique que el archivo no esté corrupto.");
        }
      };
      reader.readAsText(file);
      e.target.value = ""; // Limpiar input
    });
  }

  // Crear Usuario
  const uRole = document.getElementById("user-role");
  const customPermsSection = document.getElementById("custom-perms-section");

  const uPhotoFile = document.getElementById("user-photo-file");
  const uPhotoPreview = document.getElementById("user-photo-preview");
  const btnDeleteUPhoto = document.getElementById("btn-delete-user-photo");

  document.getElementById("btn-import-user-photo").onclick = () => uPhotoFile.click();

  uPhotoFile.onchange = async function(e) {
    const file = e.target.files[0];
    if (file) {
      try {
        userPhotoBase64 = await compressImageToBase64(file);
        uPhotoPreview.innerHTML = `<img src="${userPhotoBase64}" alt="Preview">`;
        btnDeleteUPhoto.classList.remove("hidden");
      } catch (err) {
        console.error("Error al procesar foto del usuario:", err);
        alert("❌ Error al procesar la foto del usuario: " + err.message);
      }
    }
  };

  btnDeleteUPhoto.onclick = function() {
    userPhotoBase64 = "";
    uPhotoPreview.innerHTML = `<span class="no-photo-text">Sin Foto</span>`;
    uPhotoFile.value = "";
    btnDeleteUPhoto.classList.add("hidden");
  };

  uRole.onchange = function() {
    if (this.value === "Personalizado") {
      customPermsSection.classList.remove("hidden");
    } else {
      customPermsSection.classList.add("hidden");
    }
  };

  document.getElementById("form-create-user").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const email = document.getElementById("user-email").value.trim().toLowerCase();
    if (!email) {
      alert("El correo electrónico es obligatorio.");
      return;
    }
    
    const submitBtn = document.getElementById("btn-save-user");
    submitBtn.disabled = true;

    const username = document.getElementById("user-username").value.trim();
    const name = document.getElementById("user-name").value.trim();
    const password = document.getElementById("user-password").value;
    const role = uRole.value;
    const editEmail = document.getElementById("user-edit-email").value;
    
    let perms = [];
    if (role === "Personalizado") {
      const checkedBoxes = document.querySelectorAll(".custom-module-perm:checked");
      checkedBoxes.forEach(cb => perms.push(cb.value));
    }

    if (editEmail) {
      // Editar
      // Si cambia de email, validar que el nuevo email no esté ocupado por otro usuario
      if (email !== editEmail) {
        const existUser = State.users.find(u => u.email === email);
        if (existUser) {
          alert("El nuevo correo electrónico ya se encuentra registrado por otro usuario.");
          return;
        }
      }
      
      const user = State.users.find(u => u.email === editEmail);
      if (user) {
        const isActiveUserBeingEdited = State.activeUser && State.activeUser.email.toLowerCase() === editEmail.toLowerCase();
        
        user.email = email;
        user.username = username;
        user.name = name;
        user.password = password;
        user.role = role;
        user.perms = perms;
        user.photo = userPhotoBase64;

        if (isActiveUserBeingEdited) {
          State.activeUser = user;
        }
        
        alert("Usuario actualizado con éxito.");
      }
    } else {
      // Registrar nuevo
      if (State.users.some(u => u.email === email || (username && u.username === username))) {
        alert("Ya existe un usuario con este correo electrónico o nombre de usuario.");
        return;
      }
      State.users.push({ email, username, name, password, role, perms, photo: userPhotoBase64 });
      alert("Usuario creado correctamente.");
    }

    State.save();
    renderUsersList();
    e.target.reset();
    submitBtn.disabled = false;
    
    // Resetear foto y vista previa
    userPhotoBase64 = "";
    uPhotoPreview.innerHTML = `<span class="no-photo-text">Sin Foto</span>`;
    btnDeleteUPhoto.classList.add("hidden");
    uPhotoFile.value = "";

    // Resetear formulario a su estado de creación
    document.getElementById("user-edit-email").value = "";
    document.getElementById("user-username").value = "";
    document.getElementById("user-form-title").textContent = "Crear Usuario y Permisos";
    document.getElementById("btn-save-user").innerHTML = `<i data-lucide="user-plus"></i> Registrar Usuario`;
    customPermsSection.classList.add("hidden");
    
    // Si editamos el usuario activo y cambió de rol o foto, forzar actualización del layout
    if (editEmail && State.activeUser && State.activeUser.email.toLowerCase() === email.toLowerCase()) {
      applyRolePermissions();
      document.getElementById("user-display-name").textContent = State.activeUser.name;
      document.getElementById("user-display-role").textContent = State.activeUser.role;
      const avatarEl = document.getElementById("user-avatar");
      if (avatarEl) {
        avatarEl.src = State.activeUser.photo || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop";
      }
    }
    lucide.createIcons();
  });

  // Switch de Vendedor Meta / Estado
  const sellerStatusToggle = document.getElementById("seller-status-toggle");
  const sellerStatusLabel = document.getElementById("seller-status-label");

  sellerStatusToggle.onchange = function() {
    sellerStatusLabel.textContent = this.checked ? "Activo" : "Inactivo";
  };

  document.getElementById("form-create-seller").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("seller-name").value.trim();
    const goal = parseInt(document.getElementById("seller-goal").value) || 100;
    const active = sellerStatusToggle.checked;

    if (editingSellerName) {
      if (name !== editingSellerName && State.sellers.some(s => s.name === name)) {
        alert("El nuevo nombre ingresado ya pertenece a otro vendedor. No se permiten duplicados.");
        return;
      }
      const existIndex = State.sellers.findIndex(s => s.name === editingSellerName);
      if (existIndex > -1) {
        State.sellers[existIndex] = { name, goal, active };
      }
      editingSellerName = null;
    } else {
      if (State.sellers.some(s => s.name === name)) {
        alert("El vendedor ya existe. No se puede crear duplicado.");
        return;
      }
      State.sellers.push({ name, goal, active });
    }

    State.save();
    renderSellersList();
    e.target.reset();
    sellerStatusToggle.checked = true;
    sellerStatusLabel.textContent = "Activo";
    alert("Vendedor registrado correctamente.");
  });

  // Switch Global de Modo Oscuro
  const themeToggle = document.getElementById("theme-toggle");
  
  const appFavicon = document.getElementById("app-favicon");
  if (document.body.classList.contains("dark-mode")) {
    if (appFavicon) appFavicon.href = "favicon.png";
  }

  themeToggle.addEventListener("change", function() {
    if (this.checked) {
      document.body.classList.remove("light-mode");
      document.body.classList.add("dark-mode");
      if (appFavicon) appFavicon.href = "favicon.png";
    } else {
      document.body.classList.remove("dark-mode");
      document.body.classList.add("light-mode");
      if (appFavicon) appFavicon.href = "favicon-light.png";
    }
    const prodSelect = document.getElementById("exit-product-select");
    if (prodSelect && prodSelect.value) {
      prodSelect.onchange();
    }
  });

  // Modal handlers
  document.getElementById("btn-close-modal").onclick = function() {
    document.getElementById("modal-container").classList.add("hidden");
  };
}

// RENDER: Productos Registrados
function renderProductsList(searchQuery = "") {
  const tbody = document.querySelector("#table-products-list tbody");
  tbody.innerHTML = "";

  const q = searchQuery.toLowerCase();
  const filtered = State.products
    .filter(p =>
      p.name.toLowerCase().includes(q)
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  filtered.forEach(p => {
    const tr = document.createElement("tr");
    const cbm = calculateProductCBM(p.height, p.width, p.length, p.boxQty);
    const photoImg = p.photo ? `<img src="${p.photo}" class="table-img-thumb" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">` : `<span class="text-muted font-sm">Sin Foto</span>`;

    tr.innerHTML = `
      <td>${photoImg}</td>
      <td>
        <span class="text-bold">${p.sku}</span><br>
        <span class="text-muted font-sm">${p.barcode}</span>
      </td>
      <td>
        <span>${p.name}</span><br>
        <span class="badge badge-teal">${p.category}</span>
      </td>
      <td>
        <span>${cbm.toFixed(6)} m³</span><br>
        <span class="text-muted font-sm">${p.boxQty} uds/caja</span>
      </td>
      <td>
        <button class="btn btn-secondary btn-sm btn-edit-p" data-sku="${p.sku}"><i data-lucide="edit-2"></i></button>
        <button class="btn btn-danger btn-sm btn-del-p" data-sku="${p.sku}"><i data-lucide="trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Listeners de edición/eliminación
  document.querySelectorAll(".btn-edit-p").forEach(btn => {
    btn.onclick = function() {
      const sku = this.getAttribute("data-sku");
      const p = State.products.find(prod => prod.sku === sku);
      if (p) {
        editingProductSku = p.sku; // Registrar que estamos editando
        productPhotoBase64 = p.photo || "";
        document.getElementById("prod-sku").value = p.sku;
        document.getElementById("prod-barcode").value = p.barcode;
        document.getElementById("prod-name").value = p.name;
        document.getElementById("prod-category").value = p.category;
        document.getElementById("prod-height").value = p.height;
        document.getElementById("prod-width").value = p.width;
        document.getElementById("prod-length").value = p.length;
        document.getElementById("prod-box-qty").value = p.boxQty;
        if (p.photo) {
          document.getElementById("prod-photo-preview").innerHTML = `<img src="${p.photo}" alt="Photo">`;
          document.getElementById("btn-delete-photo").classList.remove("hidden");
        } else {
          document.getElementById("prod-photo-preview").innerHTML = `<span class="no-photo-text">Sin Foto</span>`;
          document.getElementById("btn-delete-photo").classList.add("hidden");
        }
        refreshFormCbm();
        document.querySelector(".tab-btn[data-tab='tab-productos']").click();
      }
    };
  });

  document.querySelectorAll(".btn-del-p").forEach(btn => {
    btn.onclick = function() {
      const sku = this.getAttribute("data-sku");
      if (confirm(`¿Está seguro de eliminar el producto con SKU: ${sku}?`)) {
        State.products = State.products.filter(p => p.sku !== sku);
        State.save();
        updateSummaryWidget();
        renderProductsList();
      }
    };
  });
  lucide.createIcons();
}

// RENDER: Bodegas Registradas
function renderWarehouseList() {
  const ul = document.getElementById("list-warehouses");
  ul.innerHTML = "";
  State.warehouses.forEach(wh => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <span><i data-lucide="map-pin" class="text-teal mr-2"></i> ${wh}</span>
      <div class="btn-group-row" style="display: flex; gap: 8px;">
        <button class="btn btn-secondary btn-sm btn-edit-wh" data-name="${wh}"><i data-lucide="edit-2"></i></button>
        <button class="btn btn-danger btn-sm btn-del-wh" data-name="${wh}"><i data-lucide="trash"></i></button>
      </div>
    `;
    ul.appendChild(li);
  });

  document.querySelectorAll(".btn-del-wh").forEach(btn => {
    btn.onclick = function() {
      const name = this.getAttribute("data-name");
      
      // Validar si la bodega tiene stock activo de algún producto
      const stockData = getInventoryStock();
      let hasActiveStock = false;
      for (const sku in stockData) {
        if (stockData[sku][name] && stockData[sku][name] > 0) {
          hasActiveStock = true;
          break;
        }
      }
      
      if (hasActiveStock) {
        alert(`❌ No se puede eliminar la bodega "${name}" porque contiene productos con stock activo. Traslade los productos a otra bodega antes de proceder.`);
        return;
      }

      if (confirm(`¿Eliminar bodega "${name}"? Esto afectará el stock reportado en ella.`)) {
        State.warehouses = State.warehouses.filter(w => w !== name);
        State.save();
        updateSummaryWidget();
        renderWarehouseList();
      }
    };
  });

  document.querySelectorAll(".btn-edit-wh").forEach(btn => {
    btn.onclick = function() {
      const oldName = this.getAttribute("data-name");
      const newName = prompt(`Editar nombre para la bodega "${oldName}":`, oldName);
      if (newName && newName.trim() !== "" && newName !== oldName) {
        const cleanNewName = newName.trim().toUpperCase();
        if (State.warehouses.includes(cleanNewName)) {
          alert("Esa bodega ya existe.");
          return;
        }

        // Update in warehouses array
        const idx = State.warehouses.indexOf(oldName);
        if (idx !== -1) State.warehouses[idx] = cleanNewName;

        // Update past records
        State.ingresos.forEach(doc => { if (doc.warehouse === oldName) doc.warehouse = cleanNewName; });
        State.salidas.forEach(doc => { if (doc.warehouse === oldName) doc.warehouse = cleanNewName; });
        State.traslados.forEach(doc => {
          if (doc.originWarehouse === oldName) doc.originWarehouse = cleanNewName;
          if (doc.destWarehouse === oldName) doc.destWarehouse = cleanNewName;
        });

        State.save();
        alert(`✅ Bodega renombrada a "${cleanNewName}". Las transacciones asociadas han sido actualizadas.`);
        updateSummaryWidget();
        renderWarehouseList();
      }
    };
  });
  lucide.createIcons();
}

// RENDER: Puntos de Venta
function renderPveList() {
  const ul = document.getElementById("list-pve");
  ul.innerHTML = "";
  State.pve.forEach(name => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <span><i data-lucide="store" class="text-teal mr-2"></i> ${name}</span>
      <div>
        <button class="btn btn-secondary btn-sm btn-edit-pve" data-name="${name}"><i data-lucide="edit-2"></i></button>
        <button class="btn btn-danger btn-sm btn-del-pve" data-name="${name}"><i data-lucide="trash"></i></button>
      </div>
    `;
    ul.appendChild(li);
  });

  document.querySelectorAll(".btn-edit-pve").forEach(btn => {
    btn.onclick = function() {
      const name = this.getAttribute("data-name");
      document.getElementById("pve-edit-name").value = name;
      document.getElementById("pve-name").value = name;
      document.getElementById("pve-form-title").textContent = "Editar Punto de Venta";
      document.getElementById("btn-save-pve").innerHTML = `<i data-lucide="save"></i> Actualizar`;
      lucide.createIcons();
      document.getElementById("pve-form-title").scrollIntoView({ behavior: "smooth" });
    };
  });

  document.querySelectorAll(".btn-del-pve").forEach(btn => {
    btn.onclick = function() {
      const name = this.getAttribute("data-name");
      if (confirm(`¿Eliminar punto de venta "${name}"?`)) {
        State.pve = State.pve.filter(item => item !== name);
        State.save();
        renderPveList();
      }
    };
  });
  lucide.createIcons();
}

// RENDER: Transportadoras
function renderCarriersList() {
  const ul = document.getElementById("list-carriers");
  ul.innerHTML = "";

  // Agregadas dinámicas
  State.carriers.forEach(c => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <span><i data-lucide="truck"></i> ${c}</span>
      <div>
        <button class="btn btn-secondary btn-sm btn-edit-car" data-name="${c}"><i data-lucide="edit-2"></i></button>
        <button class="btn btn-danger btn-sm btn-del-car" data-name="${c}"><i data-lucide="trash"></i></button>
      </div>
    `;
    ul.appendChild(li);
  });

  document.querySelectorAll(".btn-edit-car").forEach(btn => {
    btn.onclick = function() {
      const name = this.getAttribute("data-name");
      const c = State.carriers.find(carrier => carrier === name);
      if (c) {
        document.getElementById("carrier-edit-name").value = c;
        document.getElementById("carrier-name").value = c;
        document.getElementById("carrier-form-title").textContent = "Editar Transportadora";
        document.getElementById("btn-save-carrier").innerHTML = `<i data-lucide="save"></i> Actualizar`;
        lucide.createIcons();
      }
    };
  });

  document.querySelectorAll(".btn-del-car").forEach(btn => {
    btn.onclick = function() {
      const name = this.getAttribute("data-name");
      if (confirm(`¿Eliminar transportadora "${name}"?`)) {
        State.carriers = State.carriers.filter(c => c !== name);
        State.save();
        renderCarriersList();
      }
    };
  });
  lucide.createIcons();
}

// RENDER: Usuarios
function renderUsersList() {
  const tbody = document.querySelector("#table-users-list tbody");
  tbody.innerHTML = "";
  State.users.forEach(u => {
    const tr = document.createElement("tr");
    const photoImg = u.photo ? `<img src="${u.photo}" class="table-img-thumb" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%;">` : `<span class="text-muted font-sm">Sin Foto</span>`;
    tr.innerHTML = `
      <td>${photoImg}</td>
      <td>${u.username || '-'}</td>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td><span class="badge badge-teal">${u.role}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm btn-edit-user" data-email="${u.email}"><i data-lucide="edit-2"></i></button>
        <button class="btn btn-danger btn-sm btn-del-user" data-email="${u.email}" ${u.email === DEFAULT_USER.email ? 'disabled' : ''}><i data-lucide="trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-edit-user").forEach(btn => {
    btn.onclick = function() {
      const email = this.getAttribute("data-email");
      const u = State.users.find(user => user.email === email);
      if (u) {
        document.getElementById("user-edit-email").value = u.email;
        document.getElementById("user-email").value = u.email;
        document.getElementById("user-username").value = u.username || "";
        document.getElementById("user-name").value = u.name;
        document.getElementById("user-password").value = u.password;
        
        const roleSelect = document.getElementById("user-role");
        roleSelect.value = u.role;
        
        userPhotoBase64 = u.photo || "";
        const uPhotoPreview = document.getElementById("user-photo-preview");
        const btnDeleteUPhoto = document.getElementById("btn-delete-user-photo");
        if (userPhotoBase64) {
          uPhotoPreview.innerHTML = `<img src="${userPhotoBase64}" alt="Photo">`;
          btnDeleteUPhoto.classList.remove("hidden");
        } else {
          uPhotoPreview.innerHTML = `<span class="no-photo-text">Sin Foto</span>`;
          btnDeleteUPhoto.classList.add("hidden");
        }

        const customPermsSection = document.getElementById("custom-perms-section");
        if (u.role === "Personalizado") {
          customPermsSection.classList.remove("hidden");
          // Desmarcar todos primero
          document.querySelectorAll(".custom-module-perm").forEach(cb => cb.checked = false);
          // Marcar los correspondientes
          if (u.perms) {
            u.perms.forEach(perm => {
              const cb = document.querySelector(`.custom-module-perm[value="${perm}"]`);
              if (cb) cb.checked = true;
            });
          }
        } else {
          customPermsSection.classList.add("hidden");
        }
        
        document.getElementById("user-form-title").textContent = "Editar Usuario y Permisos";
        document.getElementById("btn-save-user").innerHTML = `<i data-lucide="save"></i> Actualizar Usuario`;
        lucide.createIcons();
        
        // Hacer scroll suave al inicio del formulario
        document.getElementById("user-form-title").scrollIntoView({ behavior: "smooth" });
      }
    };
  });

  document.querySelectorAll(".btn-del-user").forEach(btn => {
    btn.onclick = function() {
      const email = this.getAttribute("data-email");
      if (confirm(`¿Está seguro de eliminar al usuario ${email}?`)) {
        State.users = State.users.filter(u => u.email !== email);
        if (State.activeUser && State.activeUser.email.toLowerCase() === email.toLowerCase()) {
          document.getElementById("logout-btn").click();
          return;
        }
        State.save();
        renderUsersList();
      }
    };
  });
  lucide.createIcons();
}

// RENDER: Vendedores
function renderSellersList() {
  const tbody = document.querySelector("#table-sellers-list tbody");
  tbody.innerHTML = "";
  State.sellers.forEach(s => {
    const tr = document.createElement("tr");
    const statusText = s.active ? "Activo" : "Inactivo";
    const statusClass = s.active ? "badge-success" : "badge-danger";
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${s.goal} uds</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm btn-edit-sel" data-name="${s.name}"><i data-lucide="edit-2"></i></button>
        <button class="btn btn-secondary btn-sm btn-toggle-sel" data-name="${s.name}"><i data-lucide="refresh-cw"></i> Cambiar Estado</button>
        <button class="btn btn-danger btn-sm btn-del-sel" data-name="${s.name}"><i data-lucide="trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-toggle-sel").forEach(btn => {
    btn.onclick = function() {
      const name = this.getAttribute("data-name");
      const sel = State.sellers.find(s => s.name === name);
      if (sel) {
        sel.active = !sel.active;
        State.save();
        renderSellersList();
      }
    };
  });

  document.querySelectorAll(".btn-edit-sel").forEach(btn => {
    btn.onclick = function() {
      const name = this.getAttribute("data-name");
      const sel = State.sellers.find(s => s.name === name);
      if (sel) {
        editingSellerName = sel.name;
        document.getElementById("seller-name").value = sel.name;
        document.getElementById("seller-goal").value = sel.goal;
        const toggle = document.getElementById("seller-status-toggle");
        toggle.checked = sel.active;
        document.getElementById("seller-status-label").textContent = sel.active ? "Activo" : "Inactivo";
      }
    };
  });

  document.querySelectorAll(".btn-del-sel").forEach(btn => {
    btn.onclick = function() {
      const name = this.getAttribute("data-name");
      if (confirm(`¿Eliminar al vendedor(a) ${name}?`)) {
        State.sellers = State.sellers.filter(s => s.name !== name);
        State.save();
        renderSellersList();
      }
    };
  });
  lucide.createIcons();
}


// ==========================================================================
// MÓDULO INGRESO MERCANCÍA (TRANSACCIONAL)
// ==========================================================================
let currentEntryItems = []; // [{sku, name, category, qty}]

function resetStockEntryForm() {
  currentEntryItems = [];
  document.getElementById("form-stock-entry").reset();
  
  // Rellenar fecha de hoy
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("entry-date").value = today;

  // Cargar select de Bodegas
  const whSelect = document.getElementById("entry-warehouse");
  whSelect.innerHTML = State.warehouses.map(w => `<option value="${w}">${w}</option>`).join("");



  // Cargar select de productos
  const prodSelect = document.getElementById("entry-product-select");
  const sortedProdsE = [...State.products].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  prodSelect.innerHTML = `<option value="">Seleccione un producto...</option>` + 
    sortedProdsE.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");

  // Limpiar campos automáticos
  document.getElementById("entry-auto-sku").value = "";
  document.getElementById("entry-auto-barcode").value = "";
  document.getElementById("entry-auto-category").value = "";

  renderEntryItemsTable();
}

// Autocompletado del producto al seleccionarlo
document.getElementById("entry-product-select").onchange = function() {
  const sku = this.value;
  const p = State.products.find(prod => prod.sku === sku);
  if (p) {
    document.getElementById("entry-auto-sku").value = p.sku;
    document.getElementById("entry-auto-barcode").value = p.barcode;
    document.getElementById("entry-auto-category").value = p.category;
  } else {
    document.getElementById("entry-auto-sku").value = "";
    document.getElementById("entry-auto-barcode").value = "";
    document.getElementById("entry-auto-category").value = "";
  }
};

// Botón añadir multilínea
document.getElementById("btn-add-entry-item").onclick = function() {
  const sku = document.getElementById("entry-product-select").value;
  const qty = parseInt(document.getElementById("entry-product-qty").value) || 0;

  if (!sku) {
    alert("Por favor seleccione un producto.");
    return;
  }
  if (qty <= 0) {
    alert("Ingrese una cantidad válida mayor a 0.");
    return;
  }

  const p = State.products.find(prod => prod.sku === sku);
  if (p) {
    // Si ya existe en la lista temporal, sumamos cantidad
    if (p.category === "ME") {
      openAssignSerialsModal(p, qty, function(serials) {
        addEntryItemWithSerials(p, qty, serials);
      });
    } else {
      addEntryItemWithSerials(p, qty, null);
    }
  }
};

function addEntryItemWithSerials(p, qty, serials) {
  const exist = currentEntryItems.find(item => item.sku === p.sku);
  if (exist) {
    exist.qty += qty;
    if (serials) exist.serials = (exist.serials || []).concat(serials);
  } else {
    currentEntryItems.push({ sku: p.sku, name: p.name, category: p.category, qty: qty, serials: serials || [] });
  }
  
  // Limpiar select de productos y cantidad en fila
  document.getElementById("entry-product-select").value = "";
  document.getElementById("entry-product-qty").value = "";
  document.getElementById("entry-auto-sku").value = "";
  document.getElementById("entry-auto-barcode").value = "";
  document.getElementById("entry-auto-category").value = "";

  renderEntryItemsTable();
}

function renderEntryItemsTable() {
  const tbody = document.querySelector("#table-entry-items tbody");
  tbody.innerHTML = "";

  currentEntryItems.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.name}</td>
      <td><span class="text-bold">${item.sku}</span></td>
      <td><span class="badge badge-teal">${item.category}</span></td>
      <td>${item.qty} uds</td>
      <td>
        <button type="button" class="btn btn-danger btn-sm btn-del-entry-item" data-index="${index}"><i data-lucide="trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-del-entry-item").forEach(btn => {
    btn.onclick = function() {
      const idx = parseInt(this.getAttribute("data-index"));
      currentEntryItems.splice(idx, 1);
      renderEntryItemsTable();
    };
  });
  lucide.createIcons();
}

// Submit Procesar Ingreso
document.getElementById("form-stock-entry").addEventListener("submit", (e) => {
  e.preventDefault();
  if (currentEntryItems.length === 0) {
    alert("Debe agregar al menos un producto a la lista de ingresos.");
    return;
  }

  const date = document.getElementById("entry-date").value;
  const warehouse = document.getElementById("entry-warehouse").value;
  const condition = document.getElementById("entry-condition").value;
  const notes = document.getElementById("entry-notes").value.trim();

  // Generar Folio
  const folioNum = String(State.ingresos.length + 1).padStart(4, "0");
  const id = `ING-${folioNum}`;

  // Guardar documento
  State.ingresos.push({ id, date, warehouse, condition, notes, items: [...currentEntryItems] });
  State.save();
  updateSummaryWidget();
  resetStockEntryForm();
  alert(`Documento de Ingreso ${id} procesado con éxito.`);
});




// ==========================================================================
// MÓDULO SALIDA MERCANCÍA (TRANSACCIONAL)
// ==========================================================================
let currentExitItems = []; // [{sku, name, category, qty, price, warehouse}]

// --- Helpers de formato de precio con separador de miles ---
function formatPriceDisplay(val) {
  // Convierte 45000 -> "45.000" (puntos como separador de miles, sin decimales)
  if (!val && val !== 0) return "";
  return Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parsePriceInput(str) {
  // Convierte "45.000" o "45000" -> 45000 (número)
  if (typeof str !== "string") str = String(str);
  return parseFloat(str.replace(/\./g, "").replace(/,/g, ".")) || 0;
}

function attachPriceInputFormat(el) {
  // Formatea mientras el usuario escribe: solo deja dígitos y pone separadores
  el.addEventListener("input", function() {
    const raw = this.value.replace(/[^0-9]/g, ""); // solo dígitos
    const num = parseInt(raw, 10);
    if (raw === "") { this.value = ""; return; }
    this.value = isNaN(num) ? "" : num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  });
  el.addEventListener("keydown", function(e) {
    // Permitir: backspace, delete, flechas, tab, ctrl+a/c/v/x
    const allowed = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End"];
    if (allowed.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ["a","c","v","x"].includes(e.key.toLowerCase())) return;
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  });
}

function attachIdCardInputFormat(el) {
  // Formatea mientras el usuario escribe: solo deja dígitos y pone separadores de miles con puntos
  el.addEventListener("input", function() {
    const raw = this.value.replace(/[^0-9]/g, ""); // solo dígitos
    const num = parseInt(raw, 10);
    if (raw === "") { this.value = ""; return; }
    this.value = isNaN(num) ? "" : num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  });
  el.addEventListener("keydown", function(e) {
    const allowed = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End"];
    if (allowed.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ["a","c","v","x"].includes(e.key.toLowerCase())) return;
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  });
}

function attachPhoneInputFormat(el) {
  // Limita el teléfono a solo dígitos y máximo 10 caracteres
  el.addEventListener("input", function() {
    this.value = this.value.replace(/[^0-9]/g, "").slice(0, 12);
  });
  el.addEventListener("keydown", function(e) {
    const allowed = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End"];
    if (allowed.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ["a","c","v","x"].includes(e.key.toLowerCase())) return;
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  });
}

function compressImageToBase64(file, maxWidth = 1000, maxHeight = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("El archivo no es una imagen válida"));
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      // Filtro de seguridad: si la imagen pesa menos de 200 KB, omitir compresión
      if (file.size < 200 * 1024) {
        resolve(event.target.result);
        return;
      }
      
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export as compressed jpeg (removes EXIF metadata automatically)
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

function resetStockExitForm() {
  currentExitItems = [];
  document.getElementById("form-stock-exit").reset();

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("exit-date").value = today;

  // Cargar bodegas
  const whGlobal = document.getElementById("exit-warehouse-global");
  whGlobal.innerHTML = State.warehouses.map(w => `<option value="${w}">${w}</option>`).join("");

  // Cargar Puntos de Venta condicionales según la bodega seleccionada
  updateExitPveOptions();

  // Cargar productos ordenados alfabéticamente
  const prodSelect = document.getElementById("exit-product-select");
  const sortedProds = [...State.products].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  prodSelect.innerHTML = `<option value="">Seleccione un producto...</option>` +
    sortedProds.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");

  // Cargar Transportadoras
  const carrierSelect = document.getElementById("exit-carrier");
  carrierSelect.innerHTML = State.carriers.map(c => `<option value="${c}">${c}</option>`).join("") + `<option value="Otra">Otra</option>`;

  // Cargar Vendedores
  const sellerSelect = document.getElementById("exit-seller");
  sellerSelect.innerHTML = State.sellers.filter(s => s.active).map(s => `<option value="${s.name}">${s.name}</option>`).join("");

  // Resetear sección ME y badges
  document.getElementById("exit-me-fields").classList.add("hidden");
  const catBadge = document.getElementById("exit-badge-category");
  catBadge.textContent = "—";
  catBadge.style.background = "";
  catBadge.style.color = "";
  const stockBadge = document.getElementById("exit-badge-stock");
  stockBadge.textContent = "Stock: —";
  stockBadge.style.background = "";
  stockBadge.style.color = "";

  const msHidden = document.getElementById("exit-mastershop");
  const msBtn = document.getElementById("btn-mastershop-toggle");
  if (msHidden && msBtn) {
    msHidden.value = "No";
    msBtn.textContent = "No";
    msBtn.classList.remove("btn-primary");
    msBtn.classList.add("btn-secondary");
  }

  const feHidden = document.getElementById("exit-factura-electronica");
  const feBtn = document.getElementById("btn-factura-electronica-toggle");
  if (feHidden && feBtn) {
    feHidden.value = "No";
    feBtn.textContent = "No";
    feBtn.classList.remove("btn-primary");
    feBtn.classList.add("btn-secondary");
  }

  // Adjuntar formato al input de precio de la fila de entrada
  const priceInput = document.getElementById("exit-product-price");
  priceInput.value = "";
  // Remover listeners anteriores clonando el nodo
  const freshPrice = priceInput.cloneNode(true);
  priceInput.parentNode.replaceChild(freshPrice, priceInput);
  attachPriceInputFormat(freshPrice);

  renderExitItemsTable();
}

function updateExitPveOptions() {
  const whSelect = document.getElementById("exit-warehouse-global");
  const wh = (whSelect.value || "").trim().toLowerCase();
  const pveSelect = document.getElementById("exit-pve");

  // Almacenar el valor seleccionado actual si lo hay
  const prevVal = pveSelect.value;

  let allowed = [];
  if (wh === "bogotá eladio" || wh === "bogota eladio") {
    allowed = State.pve.filter(pv => {
      const p = pv.trim().toLowerCase();
      return p === "bogotá eladio" || p === "bogota eladio";
    });
  } else if (wh === "mercado libre full") {
    allowed = State.pve.filter(pv => pv.trim().toLowerCase() === "mercado libre full");
  } else {
    // Grupo por defecto: todos los PVEs excepto Bogotá Eladio y Mercado Libre Full
    const targetNames = [
      "falabella",
      "local",
      "mastershop",
      "mercado libre flex",
      "mercado libre despacho",
      "descuento nómina",
      "descuento nomina",
      "los pinos"
    ];
    allowed = State.pve.filter(pv => targetNames.includes(pv.trim().toLowerCase()));
  }

  pveSelect.innerHTML = allowed.map(pv => `<option value="${pv}">${pv}</option>`).join("");

  if (prevVal && allowed.includes(prevVal)) {
    pveSelect.value = prevVal;
  }
}

// Al seleccionar producto — actualizar badges de info
document.getElementById("exit-product-select").onchange = function() {
  const sku = this.value;
  const p = State.products.find(prod => prod.sku === sku);
  const globalWh = document.getElementById("exit-warehouse-global").value;
  const catBadge = document.getElementById("exit-badge-category");
  const stockBadge = document.getElementById("exit-badge-stock");

  if (p && globalWh) {
    catBadge.textContent = p.category;
    catBadge.style.background = "var(--accent-teal)";
    catBadge.style.color = "#fff";
    const stockData = getInventoryStock();
    const stockQty = stockData[p.sku]?.[globalWh] || 0;
    stockBadge.textContent = `Stock: ${stockQty} uds`;
    
    // Responsive dynamic styling for stock badge
    const isDarkMode = document.body.classList.contains("dark-mode");
    if (isDarkMode) {
      stockBadge.style.background = stockQty === 0 ? "#742a2a" : "#22543d";
      stockBadge.style.color = "#ffffff";
    } else {
      stockBadge.style.background = stockQty === 0 ? "#fed7d7" : "#c6f6d5";
      stockBadge.style.color = stockQty === 0 ? "#c53030" : "#276749";
    }
  } else {
    catBadge.textContent = "—"; catBadge.style.background = ""; catBadge.style.color = "";
    stockBadge.textContent = "Stock: —"; stockBadge.style.background = ""; stockBadge.style.color = "";
  }
};

// Al cambiar bodega global
document.getElementById("exit-warehouse-global").onchange = function() {
  document.getElementById("exit-product-select").onchange();
  updateExitPveOptions();
};

// Transportadora — mostrar campo libre si es "Otra"
document.getElementById("exit-carrier").onchange = function() {
  const otherInput = document.getElementById("exit-carrier-other");
  if (this.value === "Otra") {
    otherInput.classList.remove("hidden");
    otherInput.setAttribute("required", "true");
  } else {
    otherInput.classList.add("hidden");
    otherInput.removeAttribute("required");
  }
};

// Botón Añadir ítem al documento
document.getElementById("btn-add-exit-item").onclick = function() {
  const sku = document.getElementById("exit-product-select").value;
  const qty = parseInt(document.getElementById("exit-product-qty").value) || 0;
  const price = parsePriceInput(document.getElementById("exit-product-price").value);
  const globalWh = document.getElementById("exit-warehouse-global").value;

  if (!sku) { alert("Seleccione un producto."); return; }
  if (qty <= 0) { alert("Ingrese una cantidad mayor a 0."); return; }
  if (!globalWh) { alert("Seleccione una Bodega Origen."); return; }

  const p = State.products.find(prod => prod.sku === sku);
  if (!p) return;

  const stockData = getInventoryStock();
  const available = stockData[sku]?.[globalWh] || 0;
  const alreadyAdded = currentExitItems
    .filter(item => item.sku === sku && item.warehouse === globalWh)
    .reduce((sum, item) => sum + item.qty, 0);

  if (qty + alreadyAdded > available) {
    alert(`Stock insuficiente en "${globalWh}". Disponible: ${available} uds, ya añadido: ${alreadyAdded} uds.`);
    return;
  }

  const notes = document.getElementById("exit-product-obs").value.trim();

  if (p.category === "ME") {
    openSelectSerialsModal(p, globalWh, qty, function(serials) {
      addExitItemWithSerials(p, qty, price, globalWh, notes, serials);
    });
  } else {
    addExitItemWithSerials(p, qty, price, globalWh, notes, null);
  }
};

function addExitItemWithSerials(p, qty, price, globalWh, notes, serials) {
  currentExitItems.push({ sku: p.sku, name: p.name, category: p.category, qty, price, warehouse: globalWh, notes, serials: serials || [] });

  // Mostrar sección ME si corresponde
  if (currentExitItems.some(item => item.category === "ME" || item.category === "Accesorios ME" || item.category === "T&M")) {
    document.getElementById("exit-me-fields").classList.remove("hidden");
    const serialsList = currentExitItems
      .filter(item => item.category === "ME" && item.serials)
      .flatMap(item => item.serials)
      .filter((v, i, a) => v && a.indexOf(v) === i);

    const tmBarcodes = currentExitItems
      .filter(item => item.category === "T&M")
      .map(item => {
        const p = State.products.find(prod => prod.sku === item.sku);
        return p ? p.barcode : "";
      })
      .filter((v, i, a) => v && a.indexOf(v) === i);

    document.getElementById("exit-me-serials").value = [...serialsList, ...tmBarcodes].join(", ");
  }

  // Limpiar fila de entrada
  document.getElementById("exit-product-select").value = "";
  document.getElementById("exit-product-qty").value = "";
  document.getElementById("exit-product-price").value = "";
  document.getElementById("exit-product-obs").value = "";
  const cat = document.getElementById("exit-badge-category");
  cat.textContent = "—";
  cat.style.background = "";
  cat.style.color = "";
  const stk = document.getElementById("exit-badge-stock");
  stk.textContent = "Stock: —";
  stk.style.background = "";
  stk.style.color = "";
  // Re-adjuntar formato después de limpiar
  const pp = document.getElementById("exit-product-price");
  const fresh = pp.cloneNode(true);
  pp.parentNode.replaceChild(fresh, pp);
  attachPriceInputFormat(fresh);

  renderExitItemsTable();
};

function renderExitItemsTable() {
  const tbody = document.querySelector("#table-exit-items tbody");
  tbody.innerHTML = "";

  const emptyState = document.getElementById("exit-empty-state");
  const footer = document.getElementById("exit-table-footer");
  const totalEl = document.getElementById("exit-total-value");

  if (currentExitItems.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    if (footer) footer.classList.add("hidden");
    return;
  }
  if (emptyState) emptyState.classList.add("hidden");
  if (footer) footer.classList.remove("hidden");

  let grandTotal = 0;

  currentExitItems.forEach((item, index) => {
    const subtotal = item.qty * item.price;
    grandTotal += subtotal;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <span class="text-bold">${item.name}</span><br>
        <span class="text-muted font-sm">${item.sku}</span>
        ${item.notes ? `<br><small class="text-muted font-sm">Obs: ${item.notes}</small>` : ""}
      </td>
      <td><span class="badge badge-teal">${item.category}</span></td>
      <td>${item.warehouse}</td>
      <td class="text-center"><span class="exit-qty-badge">${item.qty} uds</span></td>
      <td class="text-right">
        <input type="text" class="exit-item-price-input" data-index="${index}"
          inputmode="numeric" autocomplete="off"
          value="${formatPriceDisplay(item.price)}" placeholder="0"
          style="width:110px;padding:4px 8px;text-align:right;border-radius:6px;">
      </td>
      <td class="text-right text-bold" id="exit-subtotal-${index}" style="color:var(--accent-teal);">
        ${formatCurrency(subtotal)}
      </td>
      <td class="text-center">
        <button type="button" class="btn btn-danger btn-sm btn-del-exit-item" data-index="${index}">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (totalEl) totalEl.textContent = formatCurrency(grandTotal);

  // Actualizar subtotal y total en tiempo real al editar precio
  document.querySelectorAll(".exit-item-price-input").forEach(input => {
    // Formato de miles mientras escribe
    attachPriceInputFormat(input);
    input.addEventListener("input", function() {
      const idx = parseInt(this.getAttribute("data-index"));
      currentExitItems[idx].price = parsePriceInput(this.value);
      const sub = currentExitItems[idx].qty * currentExitItems[idx].price;
      const cell = document.getElementById(`exit-subtotal-${idx}`);
      if (cell) cell.textContent = formatCurrency(sub);
      const total = currentExitItems.reduce((s, it) => s + it.qty * it.price, 0);
      if (totalEl) totalEl.textContent = formatCurrency(total);
    });
  });

  document.querySelectorAll(".btn-del-exit-item").forEach(btn => {
    btn.onclick = function() {
      const idx = parseInt(this.getAttribute("data-index"));
      currentExitItems.splice(idx, 1);
      if (!currentExitItems.some(item => item.category === "ME" || item.category === "Accesorios ME" || item.category === "T&M")) {
        document.getElementById("exit-me-fields").classList.add("hidden");
      }
      renderExitItemsTable();
    };
  });
  lucide.createIcons();
}

// Submit Procesar Salida
document.getElementById("form-stock-exit").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (currentExitItems.length === 0) { alert("Agregue al menos un producto."); return; }

  const date = document.getElementById("exit-date").value;
  const pve = document.getElementById("exit-pve").value;
  const whGlobal = document.getElementById("exit-warehouse-global").value;
  const notes = currentExitItems.map(item => item.notes).filter(n => n).join("; ");

  const hasMeProduct = currentExitItems.some(item => item.category === "ME" || item.category === "Accesorios ME" || item.category === "T&M");
  let client = "", carrier = "", shippingCost = 0, seller = "", channel = "", ean = "", mastershop = "No", facturaElectronica = "No", carrierGuide = "";

  if (hasMeProduct) {
    const clNombre = document.getElementById("exit-client-nombre").value.trim().toUpperCase();
    const clCedula = document.getElementById("exit-client-cedula").value.trim();
    const clContacto = document.getElementById("exit-client-contacto").value.trim();
    
    if (!clNombre || !clCedula || !clContacto) {
      alert("Para esta categoría los datos del cliente son requeridos (Nombre, Cédula y Contacto).");
      return;
    }
    client = `Nombre: ${clNombre} | Cédula: ${clCedula} | Contacto: ${clContacto}`;
    
    const carrierVal = document.getElementById("exit-carrier").value;
    carrier = carrierVal === "Otra" ? document.getElementById("exit-carrier-other").value.trim() : carrierVal;
    let scRaw = document.getElementById("exit-shipping-cost").value.replace(/\./g, "");
    shippingCost = parseFloat(scRaw) || 0;
    seller = document.getElementById("exit-seller").value;
    channel = document.getElementById("exit-channel").value;
    mastershop = document.getElementById("exit-mastershop").value;
    facturaElectronica = document.getElementById("exit-factura-electronica").value;
    ean = document.getElementById("exit-me-serials").value;

    const fileInput = document.getElementById("exit-carrier-guide-image");
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert("La imagen de la guía transportadora no puede superar los 10 MB.");
        return;
      }
      try {
        carrierGuide = await compressImageToBase64(file);
      } catch (error) {
        console.error("Error al procesar la imagen de la guía:", error);
        alert("Error al procesar la imagen de la guía transportadora.");
        return;
      }
    }
  }

  const folioNum = String(State.salidas.length + 1).padStart(4, "0");
  const id = `SAL-${folioNum}`;

  State.salidas.push({ id, date, warehouse: whGlobal, pve, items: [...currentExitItems], client, carrier, carrierGuide, shippingCost, seller, channel, mastershop, facturaElectronica, ean, notes });
  State.save();
  updateSummaryWidget();
  resetStockExitForm();
  alert(`✅ Salida ${id} procesada con éxito.`);
});

document.getElementById("btn-mastershop-toggle").addEventListener("click", function() {
  const hiddenInput = document.getElementById("exit-mastershop");
  if (hiddenInput.value === "No") {
    hiddenInput.value = "Si";
    this.textContent = "Sí";
    this.classList.remove("btn-secondary");
    this.classList.add("btn-primary");
  } else {
    hiddenInput.value = "No";
    this.textContent = "No";
    this.classList.remove("btn-primary");
    this.classList.add("btn-secondary");
  }
});

document.getElementById("btn-factura-electronica-toggle").addEventListener("click", function() {
  const hiddenInput = document.getElementById("exit-factura-electronica");
  if (hiddenInput.value === "No") {
    hiddenInput.value = "Si";
    this.textContent = "Sí";
    this.classList.remove("btn-secondary");
    this.classList.add("btn-primary");
  } else {
    hiddenInput.value = "No";
    this.textContent = "No";
    this.classList.remove("btn-primary");
    this.classList.add("btn-secondary");
  }
});


// ==========================================================================
// MÓDULO TRASLADO MERCANCÍA (TRANSACCIONAL Y MODIFICABLE)
// ==========================================================================
let currentTransferItems = []; // [{sku, name, qty}]

function resetStockTransferForm() {
  currentTransferItems = [];
  document.getElementById("form-stock-transfer").reset();

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("transfer-date").value = today;

  // Selects
  const originWh = document.getElementById("transfer-origin-wh");
  originWh.innerHTML = `<option value="">Seleccione origen...</option>` + 
    State.warehouses.map(w => `<option value="${w}">${w}</option>`).join("");

  const destWh = document.getElementById("transfer-dest-wh");
  destWh.innerHTML = `<option value="">Seleccione destino...</option>` + 
    State.warehouses.map(w => `<option value="${w}">${w}</option>`).join("");

  const sortedProdsT = [...State.products].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  const prodSelect = document.getElementById("transfer-product-select");
  prodSelect.innerHTML = `<option value="">Seleccione un producto...</option>` +
    sortedProdsT.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");

  // Botón y Título
  document.getElementById("transfer-form-title").textContent = "Nuevo Registro de Traslado";
  document.getElementById("transfer-edit-id").value = "";
  document.getElementById("btn-save-transfer").innerHTML = `<i data-lucide="save"></i> Procesar Traslado`;

  renderTransferItemsTable();
}

// Al cambiar bodega de origen, filtrar bodega de destino
document.getElementById("transfer-origin-wh").onchange = function() {
  const originVal = this.value;
  const destWh = document.getElementById("transfer-dest-wh");
  const destVal = destWh.value;

  destWh.innerHTML = `<option value="">Seleccione destino...</option>` + 
    State.warehouses
      .filter(w => w !== originVal)
      .map(w => `<option value="${w}">${w}</option>`).join("");
      
  if (destVal && destVal !== originVal) {
    destWh.value = destVal;
  }
};

// Al cambiar bodega de destino, filtrar bodega de origen
document.getElementById("transfer-dest-wh").onchange = function() {
  const destVal = this.value;
  const originWh = document.getElementById("transfer-origin-wh");
  const originVal = originWh.value;

  originWh.innerHTML = `<option value="">Seleccione origen...</option>` + 
    State.warehouses
      .filter(w => w !== destVal)
      .map(w => `<option value="${w}">${w}</option>`).join("");
      
  if (originVal && originVal !== destVal) {
    originWh.value = originVal;
  }
};

// Botón añadir producto a traslado
document.getElementById("btn-add-transfer-item").onclick = function() {
  const sku = document.getElementById("transfer-product-select").value;
  const qty = parseInt(document.getElementById("transfer-product-qty").value) || 0;
  const orig = document.getElementById("transfer-origin-wh").value;

  if (!orig) {
    alert("Por favor seleccione primero la bodega de origen.");
    return;
  }
  if (!sku) {
    alert("Por favor seleccione un producto.");
    return;
  }
  if (qty <= 0) {
    alert("Ingrese una cantidad válida.");
    return;
  }

  const p = State.products.find(prod => prod.sku === sku);
  if (p) {
    // Validar stock disponible
    const stockData = getInventoryStock();
    const available = stockData[sku]?.[orig] || 0;

    const alreadyAdded = currentTransferItems
      .filter(item => item.sku === sku)
      .reduce((sum, item) => sum + item.qty, 0);

    if (qty + alreadyAdded > available) {
      alert(`Stock insuficiente en bodega origen "${orig}". Disponible: ${available} uds.`);
      return;
    }

    if (p.category === "ME") {
      openSelectSerialsModal(p, orig, qty, function(serials) {
        addTransferItemWithSerials(p, qty, serials);
      });
    } else {
      addTransferItemWithSerials(p, qty, null);
    }
  }
};

function addTransferItemWithSerials(p, qty, serials) {
  const exist = currentTransferItems.find(item => item.sku === p.sku);
  if (exist) {
    exist.qty += qty;
    if (serials) exist.serials = (exist.serials || []).concat(serials);
  } else {
    currentTransferItems.push({ sku: p.sku, name: p.name, qty: qty, serials: serials || [] });
  }
  
  // Reset fila
  document.getElementById("transfer-product-select").value = "";
  document.getElementById("transfer-product-qty").value = "";

  renderTransferItemsTable();
}

function renderTransferItemsTable() {
  const tbody = document.querySelector("#table-transfer-items tbody");
  tbody.innerHTML = "";

  currentTransferItems.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.name}</td>
      <td><span class="text-bold">${item.sku}</span></td>
      <td>${item.qty} uds</td>
      <td>
        <button type="button" class="btn btn-danger btn-sm btn-del-transfer-item" data-index="${index}"><i data-lucide="trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-del-transfer-item").forEach(btn => {
    btn.onclick = function() {
      const idx = parseInt(this.getAttribute("data-index"));
      currentTransferItems.splice(idx, 1);
      renderTransferItemsTable();
    };
  });
  lucide.createIcons();
}

// Submit Procesar Traslado (Creación / Modificación)
document.getElementById("form-stock-transfer").addEventListener("submit", (e) => {
  e.preventDefault();
  if (currentTransferItems.length === 0) {
    alert("Agregue al menos un producto a trasladar.");
    return;
  }

  const date = document.getElementById("transfer-date").value;
  const origin = document.getElementById("transfer-origin-wh").value;
  const dest = document.getElementById("transfer-dest-wh").value;
  const editId = document.getElementById("transfer-edit-id").value;

  if (origin === dest) {
    alert("Las bodegas de origen y destino deben ser diferentes.");
    return;
  }

  if (editId) {
    // Si estamos editando, actualizamos el traslado existente
    const index = State.traslados.findIndex(t => t.id === editId);
    if (index > -1) {
      State.traslados[index] = { id: editId, date, originWarehouse: origin, destWarehouse: dest, items: [...currentTransferItems] };
      alert(`Traslado ${editId} modificado con éxito.`);
    }
  } else {
    // Creación normal
    const folioNum = String(State.traslados.length + 1).padStart(4, "0");
    const id = `TRA-${folioNum}`;
    State.traslados.push({ id, date, originWarehouse: origin, destWarehouse: dest, items: [...currentTransferItems] });
    alert(`Documento de Traslado ${id} creado con éxito.`);
  }

  State.save();
  updateSummaryWidget();
  resetStockTransferForm();
});


// ==========================================================================
// MÓDULO PEDIDO - SIMULADOR LOGÍSTICO Y SEMÁFORO
// ==========================================================================
let currentSimItems = []; // [{sku, name, cbmPerBox, boxQty, qtyRequested, boxesReq, totalCbm}]

function renderSimulationTable() {
  const tbody = document.querySelector("#table-sim-items tbody");
  tbody.innerHTML = "";

  let totalSimCbm = 0;
  let totalSimBoxes = 0;

  currentSimItems.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.name} (${item.sku})</td>
      <td>${item.cbmPerBox.toFixed(6)} m³</td>
      <td>${item.boxQty} uds</td>
      <td>
        <input type="number" class="sim-qty-input" data-index="${index}" value="${item.qtyRequested}" style="width: 100px; padding: 4px 8px;" min="1">
      </td>
      <td>${item.boxesReq}</td>
      <td class="text-bold">${item.totalCbm.toFixed(6)} m³</td>
      <td>
        <button type="button" class="btn btn-danger btn-sm btn-del-sim-item" data-index="${index}"><i data-lucide="trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);

    totalSimCbm += item.totalCbm;
    totalSimBoxes += item.boxesReq;
  });

  document.getElementById("sim-total-cbm").textContent = `${totalSimCbm.toFixed(6)} m³`;
  document.getElementById("sim-total-boxes").textContent = totalSimBoxes;

  // Actualizar semáforo in-line
  updateLogisticsTrafficLight(totalSimCbm);

  // Load select of products for simulation
  const select = document.getElementById("sim-product-select");
  const sortedProdsSim = [...State.products].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  select.innerHTML = `<option value="">Seleccione un producto...</option>` +
    sortedProdsSim.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");

  // Listeners de cantidad in-line
  document.querySelectorAll(".sim-qty-input").forEach(input => {
    input.onchange = function() {
      const idx = parseInt(this.getAttribute("data-index"));
      const newQty = parseInt(this.value) || 1;
      
      const item = currentSimItems[idx];
      item.qtyRequested = newQty;
      item.boxesReq = Math.ceil(newQty / item.boxQty);
      item.totalCbm = item.boxesReq * item.cbmPerBox;
      
      renderSimulationTable();
    };
  });

  document.querySelectorAll(".btn-del-sim-item").forEach(btn => {
    btn.onclick = function() {
      const idx = parseInt(this.getAttribute("data-index"));
      currentSimItems.splice(idx, 1);
      renderSimulationTable();
    };
  });

  renderSavedSimulationsList();
  lucide.createIcons();
}

// Añadir item a la simulación
document.getElementById("btn-add-sim-item").onclick = function() {
  const sku = document.getElementById("sim-product-select").value;
  const qty = parseInt(document.getElementById("sim-product-qty").value) || 0;

  if (!sku) {
    alert("Por favor seleccione un producto.");
    return;
  }
  if (qty <= 0) {
    alert("Ingrese una cantidad válida mayor a 0.");
    return;
  }

  const p = State.products.find(prod => prod.sku === sku);
  if (p) {
    const cbmBox = calculateProductCBM(p.height, p.width, p.length, p.boxQty);
    const boxes = Math.ceil(qty / p.boxQty);
    const totalCbm = boxes * cbmBox;

    const exist = currentSimItems.find(item => item.sku === sku);
    if (exist) {
      exist.qtyRequested += qty;
      exist.boxesReq = Math.ceil(exist.qtyRequested / p.boxQty);
      exist.totalCbm = exist.boxesReq * exist.cbmPerBox;
    } else {
      currentSimItems.push({
        sku: p.sku,
        name: p.name,
        cbmPerBox: cbmBox,
        boxQty: p.boxQty,
        qtyRequested: qty,
        boxesReq: boxes,
        totalCbm: totalCbm
      });
    }

    document.getElementById("sim-product-select").value = "";
    document.getElementById("sim-product-qty").value = "";

    renderSimulationTable();
  }
};

// Lógica de semáforo logística e iconos didácticos
function updateLogisticsTrafficLight(cbm) {
  const tl = document.getElementById("sim-traffic-light");
  const icon = document.getElementById("sim-traffic-icon");
  const title = document.getElementById("sim-traffic-title");
  const desc = document.getElementById("sim-traffic-desc");

  // Resetear clases
  tl.className = "traffic-light-widget";

  if (cbm <= 0) {
    icon.textContent = "📦";
    title.textContent = "Sin Carga";
    desc.textContent = "Ingrese productos al simulador para iniciar el cálculo volumétrico.";
    tl.classList.add("traffic-green");
    return;
  }

  if (cbm < 15.00) {
    // 0 a 14.99 CBM -> Paquete Suelto (Green)
    icon.textContent = "📦";
    title.textContent = "Paquete Suelto (Consolidado LCL)";
    desc.textContent = `Eficiente para consolidado LCL. El volumen total es ${cbm.toFixed(3)} m³.`;
    tl.classList.add("traffic-green");
  } else if (cbm >= 15.00 && cbm < 20.00) {
    // 15 a 19.99 CBM -> Transición (Yellow)
    icon.textContent = "⚠️";
    title.textContent = "Zona de Transición Ineficiente";
    desc.textContent = `Demasiado grande para consolidado rentable pero inferior a un contenedor completo 20 FT (${cbm.toFixed(3)} m³). Considere subir a 20 CBM.`;
    tl.classList.add("traffic-yellow");
  } else if (cbm >= 20.00 && cbm < 34.00) {
    // 20 a 33.99 CBM -> Contenedor 20 FT (Green, reset to green)
    icon.textContent = "🛳️";
    title.textContent = "Contenedor 20 FT (FCL)";
    desc.textContent = `Óptimo para 1 Contenedor Completo de 20 FT. Capacidad recomendada: 33 CBM. Volumen actual: ${cbm.toFixed(3)} m³.`;
    tl.classList.add("traffic-green");
  } else if (cbm >= 34.00 && cbm < 68.00) {
    // 34 a 67.99 CBM -> Contenedor 40 FT (Green)
    icon.textContent = "🚢";
    title.textContent = "Contenedor 40 FT High Cube (FCL)";
    desc.textContent = `Óptimo para 1 Contenedor Completo de 40 FT. Capacidad recomendada: 68 CBM. Volumen actual: ${cbm.toFixed(3)} m³.`;
    tl.classList.add("traffic-green");
  } else {
    // 68+ CBM -> Contenedores múltiples (Blue / Especial)
    icon.textContent = "⛴️⛴️";
    title.textContent = "Múltiples Contenedores";
    desc.textContent = `El volumen de ${cbm.toFixed(3)} m³ requiere combinación de contenedores de 40 FT y 20 FT.`;
    tl.classList.add("traffic-blue");
  }
}

// Botón Limpiar simulación
document.getElementById("btn-clear-sim").onclick = function() {
  currentSimItems = [];
  renderSimulationTable();
};

// Botón Guardar simulación
document.getElementById("btn-save-sim").onclick = function() {
  if (currentSimItems.length === 0) {
    alert("Simulación vacía. Agregue productos antes de guardar.");
    return;
  }

  const cbmStr = document.getElementById("sim-total-cbm").textContent;
  const boxes = parseInt(document.getElementById("sim-total-boxes").textContent);
  
  // Extraer estado actual del semáforo
  const title = document.getElementById("sim-traffic-title").textContent;
  const icon = document.getElementById("sim-traffic-icon").textContent;

  const simName = prompt("Ingrese un nombre para esta simulación:", "Simulación");
  if (simName === null) return; // Cancelado

  const simId = `SIM-${Date.now().toString().substring(8)}`;
  State.simulations.push({
    id: simId,
    name: simName.trim() || "Simulación",
    date: new Date().toISOString().split("T")[0],
    cbm: cbmStr,
    boxes: boxes,
    method: title,
    icon: icon,
    items: [...currentSimItems]
  });

  State.save();
  renderSavedSimulationsList();
  alert(`Simulación ${simId} guardada con éxito.`);
};

function renderSavedSimulationsList() {
  const ul = document.getElementById("list-saved-simulations");
  ul.innerHTML = "";

  State.simulations.forEach(sim => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <div>
        <strong>${sim.name || sim.id}</strong> <span class="text-muted font-sm">(${sim.id})</span> - ${sim.date}<br>
        <span class="font-sm text-muted">${sim.icon} ${sim.method} | ${sim.cbm}</span>
      </div>
      <div>
        <button class="btn btn-secondary btn-sm btn-load-sim" data-id="${sim.id}"><i data-lucide="folder-open"></i></button>
        <button class="btn btn-danger btn-sm btn-del-sim" data-id="${sim.id}"><i data-lucide="trash"></i></button>
      </div>
    `;
    ul.appendChild(li);
  });

  document.querySelectorAll(".btn-load-sim").forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute("data-id");
      const sim = State.simulations.find(s => s.id === id);
      if (sim) {
        currentSimItems = [...sim.items];
        renderSimulationTable();
        alert(`Cargada la simulación ${id}`);
      }
    };
  });

  document.querySelectorAll(".btn-del-sim").forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute("data-id");
      if (confirm(`¿Eliminar la simulación ${id}?`)) {
        State.simulations = State.simulations.filter(s => s.id !== id);
        State.save();
        renderSavedSimulationsList();
      }
    };
  });
  lucide.createIcons();
}

// ==========================================================================
// MÓDULO STOCK BÁSICO
// ==========================================================================
let activeStockBasicFilters = { categories: [], warehouses: [], products: [] };

function initStockBasicFilters() {
  const whSelect = document.getElementById("stock-basic-filter-warehouses");
  whSelect.innerHTML = State.warehouses.map(w => `<option value="${w}">${w}</option>`).join("");

  const prodSelect = document.getElementById("stock-basic-filter-products");
  const sortedProds = [...State.products].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  prodSelect.innerHTML = sortedProds.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");
}

function renderStockBasicTable() {
  const tbody = document.querySelector("#table-stock-basic tbody");
  tbody.innerHTML = "";

  const stockData = getInventoryStock();

  let productsToDisplay = [...State.products].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  if (activeStockBasicFilters.products.length > 0) {
    productsToDisplay = productsToDisplay.filter(p => activeStockBasicFilters.products.includes(p.sku));
  }
  if (activeStockBasicFilters.categories.length > 0) {
    productsToDisplay = productsToDisplay.filter(p => activeStockBasicFilters.categories.includes(p.category));
  }

  const isConsolidated = activeStockBasicFilters.warehouses.length === 0;
  let warehousesToList = State.warehouses;
  if (!isConsolidated) {
    warehousesToList = warehousesToList.filter(w => activeStockBasicFilters.warehouses.includes(w));
  }

  const viewModeLabel = document.getElementById("stock-basic-view-mode-label");
  if (isConsolidated) {
    viewModeLabel.textContent = "Vista Consolidada";
    viewModeLabel.className = "badge badge-success font-sm";
  } else {
    viewModeLabel.textContent = `Filtrado por: ${activeStockBasicFilters.warehouses.join(", ")}`;
    viewModeLabel.className = "badge badge-primary font-sm";
  }

  productsToDisplay.forEach(p => {
    let htmlStock = "";
    if (isConsolidated) {
      const totalStock = State.warehouses.reduce((sum, w) => sum + (stockData[p.sku]?.[w] || 0), 0);
      htmlStock = `<span class="badge ${totalStock > 0 ? 'badge-primary' : 'badge-danger'} font-md">${totalStock}</span>`;
    } else {
      let lines = [];
      warehousesToList.forEach(w => {
        const whStock = (stockData[p.sku] && stockData[p.sku][w]) ? stockData[p.sku][w] : 0;
        lines.push(`${w}: <strong class="${whStock > 0 ? 'text-teal' : 'text-danger'}">${whStock}</strong>`);
      });
      htmlStock = lines.join("<br>");
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.photo ? `<img src="${p.photo}" class="stock-item-img" style="width:40px; height:40px; object-fit:cover; border-radius:4px;" alt="${p.name}">` : '<div style="width:40px; height:40px; background:#f1f5f9; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#94a3b8;"><i data-lucide="image" style="width:20px; height:20px;"></i></div>'}</td>
      <td class="font-bold">${p.name}<br><small class="text-slate-500">${p.sku}</small></td>
      <td><span class="badge badge-secondary">${p.category}</span></td>
      <td>${isConsolidated ? "GLOBAL" : warehousesToList.join(", ")}</td>
      <td>${htmlStock}</td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-apply-stock-basic-filters").addEventListener("click", () => {
    activeStockBasicFilters.categories = Array.from(document.getElementById("stock-basic-filter-categories").selectedOptions).map(o => o.value);
    activeStockBasicFilters.warehouses = Array.from(document.getElementById("stock-basic-filter-warehouses").selectedOptions).map(o => o.value);
    activeStockBasicFilters.products = Array.from(document.getElementById("stock-basic-filter-products").selectedOptions).map(o => o.value);
    renderStockBasicTable();
  });

  document.getElementById("btn-clear-stock-basic-filters").addEventListener("click", () => {
    document.getElementById("stock-basic-filter-categories").value = "";
    document.getElementById("stock-basic-filter-warehouses").value = "";
    document.getElementById("stock-basic-filter-products").value = "";
    activeStockBasicFilters = { categories: [], warehouses: [], products: [] };
    renderStockBasicTable();
  });
});


// ==========================================================================
// MÓDULO STOCK E INTELIGENCIA DE DATOS (PROYECCIONES)
// ==========================================================================
let activeStockFilters = { categories: [], warehouses: [], products: [] };

function initStockFilters() {
  // Cargar select múltiple de bodegas
  const whSelect = document.getElementById("stock-filter-warehouses");
  whSelect.innerHTML = State.warehouses.map(w => `<option value="${w}">${w}</option>`).join("");

  // Cargar select múltiple de productos ordenados alfabéticamente
  const prodSelect = document.getElementById("stock-filter-products");
  const sortedProds = [...State.products].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  prodSelect.innerHTML = sortedProds.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");

  // Asignar fechas por defecto: últimos 3 meses
  const todayStr = new Date().toISOString().split("T")[0];
  const dateThreeMonthsAgo = new Date();
  dateThreeMonthsAgo.setMonth(dateThreeMonthsAgo.getMonth() - 3);
  const startStr = dateThreeMonthsAgo.toISOString().split("T")[0];

  const startDateInput = document.getElementById("stock-filter-start-date");
  const endDateInput = document.getElementById("stock-filter-end-date");
  const calcThreeMonthsCheck = document.getElementById("stock-calc-three-months");

  startDateInput.value = startStr;
  endDateInput.value = todayStr;

  // Sincronizar el estado del checkbox con la habilitación de los campos de fecha
  startDateInput.disabled = calcThreeMonthsCheck.checked;
  endDateInput.disabled = calcThreeMonthsCheck.checked;

  calcThreeMonthsCheck.onchange = function() {
    const isThreeMonths = this.checked;
    startDateInput.disabled = isThreeMonths;
    endDateInput.disabled = isThreeMonths;
    if (isThreeMonths) {
      startDateInput.value = startStr;
      endDateInput.value = todayStr;
      renderStockProjectionsTable();
    }
  };
}

// Botones aplicar filtros de stock
document.getElementById("btn-apply-stock-filters").onclick = function() {
  const cats = Array.from(document.getElementById("stock-filter-categories").selectedOptions).map(opt => opt.value);
  const whs = Array.from(document.getElementById("stock-filter-warehouses").selectedOptions).map(opt => opt.value);
  const prods = Array.from(document.getElementById("stock-filter-products").selectedOptions).map(opt => opt.value);

  activeStockFilters = { categories: cats, warehouses: whs, products: prods };
  renderStockProjectionsTable();
};

document.getElementById("btn-clear-stock-filters").onclick = function() {
  document.getElementById("stock-filter-categories").selectedIndex = -1;
  document.getElementById("stock-filter-warehouses").selectedIndex = -1;
  document.getElementById("stock-filter-products").selectedIndex = -1;

  // Restablecer checkbox y fechas por defecto
  const calcThreeMonthsCheck = document.getElementById("stock-calc-three-months");
  calcThreeMonthsCheck.checked = true;

  const todayStr = new Date().toISOString().split("T")[0];
  const dateThreeMonthsAgo = new Date();
  dateThreeMonthsAgo.setMonth(dateThreeMonthsAgo.getMonth() - 3);
  const startStr = dateThreeMonthsAgo.toISOString().split("T")[0];

  const startDateInput = document.getElementById("stock-filter-start-date");
  const endDateInput = document.getElementById("stock-filter-end-date");
  startDateInput.value = startStr;
  endDateInput.value = todayStr;
  startDateInput.disabled = true;
  endDateInput.disabled = true;

  activeStockFilters = { categories: [], warehouses: [], products: [] };
  renderStockProjectionsTable();
};

// Algoritmo de Inteligencia de Datos: Proyecciones de compra
function renderStockProjectionsTable() {
  const tbody = document.querySelector("#table-stock-projections tbody");
  tbody.innerHTML = "";

  const stockData = getInventoryStock();
  const today = new Date();

  // Filtrar productos y ordenarlos alfabéticamente
  let productsToDisplay = [...State.products].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  if (activeStockFilters.products.length > 0) {
    productsToDisplay = productsToDisplay.filter(p => activeStockFilters.products.includes(p.sku));
  }
  if (activeStockFilters.categories.length > 0) {
    productsToDisplay = productsToDisplay.filter(p => activeStockFilters.categories.includes(p.category));
  }

  // Determinar si mostrar vista consolidada (sin filtro de bodega) o detallada por bodega
  const isConsolidated = activeStockFilters.warehouses.length === 0;
  let warehousesToList = State.warehouses;
  if (!isConsolidated) {
    warehousesToList = warehousesToList.filter(w => activeStockFilters.warehouses.includes(w));
  }

  // Actualizar encabezado para indicar modo
  const modeLabel = document.getElementById("stock-view-mode-label");
  if (modeLabel) {
    modeLabel.textContent = isConsolidated
      ? "Vista Consolidada (Total todas las bodegas)"
      : `Vista Detallada por Bodega (${warehousesToList.join(", ") || "Ninguna"})")`;
  }

  // Función auxiliar: calcular datos de ventas para un producto en un conjunto de bodegas
  function calcSalesData(sku, warehouses) {
    let totalUnitsSold = 0;
    const startDateVal = document.getElementById("stock-filter-start-date").value;
    const endDateVal = document.getElementById("stock-filter-end-date").value;

    State.salidas.forEach(doc => {
      if ((warehouses === null || warehouses.includes(doc.warehouse)) && doc.items) {
        // Filtrar por fecha
        if (startDateVal && doc.date < startDateVal) return;
        if (endDateVal && doc.date > endDateVal) return;

        doc.items.forEach(item => {
          if (item.sku === sku) {
            totalUnitsSold += item.qty;
          }
        });
      }
    });

    let daysInterval = 90; // Fallback
    if (startDateVal && endDateVal) {
      const start = new Date(startDateVal);
      const end = new Date(endDateVal);
      if (end >= start) {
        const diffMs = end - start;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1; // Incluir ambos días
        daysInterval = diffDays > 0 ? diffDays : 1;
      } else {
        daysInterval = 1;
      }
    }
    return { totalUnitsSold, daysInterval };
  }

  function buildProjectionRow(p, stockQty, warehouseLabel, salesWarehouses) {
    const { totalUnitsSold, daysInterval } = calcSalesData(p.sku, salesWarehouses);
    const avgDailySales = totalUnitsSold / daysInterval;

    let stockOutText = "Sin Ventas";
    let limitBuyText = "-";
    let alertClass = "";
    let suggestQty = 0;

    if (avgDailySales > 0) {
      const daysRemaining = stockQty / avgDailySales;
      const stockOutDate = new Date();
      stockOutDate.setDate(today.getDate() + daysRemaining);

      const limitBuyDate = new Date(stockOutDate.getTime());
      limitBuyDate.setMonth(limitBuyDate.getMonth() - 2);

      stockOutText = `${Math.ceil(daysRemaining)} días (${stockOutDate.toISOString().split("T")[0]})`;
      limitBuyText = limitBuyDate.toISOString().split("T")[0];

      if (limitBuyDate < today) {
        alertClass = "text-danger text-bold";
        limitBuyText = `⚠️ EXPIRÓ (${limitBuyText})`;
      }

      suggestQty = Math.ceil(avgDailySales * 120);
    }

    const photoImg = p.photo
      ? `<img src="${p.photo}" class="table-img-thumb" style="width: 35px; height: 35px; object-fit: cover; border-radius: 4px;">`
      : `<span class="text-muted font-sm">-</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${photoImg}</td>
      <td>
        <span class="text-bold">${p.sku}</span><br>
        <span class="text-muted font-sm">${p.name}</span>
      </td>
      <td><span class="badge badge-teal">${p.category}</span></td>
      <td>${warehouseLabel}</td>
      <td class="text-bold">${stockQty.toLocaleString()}</td>
      <td class="text-bold">${totalUnitsSold.toLocaleString()} uds</td>
      <td>${avgDailySales.toFixed(2)} uds/día</td>
      <td>${stockOutText}</td>
      <td class="${alertClass}">${limitBuyText}</td>
      <td><span class="badge badge-success">${suggestQty > 0 ? suggestQty + ' uds' : '-'}</span></td>
    `;
    tbody.appendChild(tr);
  }

  productsToDisplay.forEach(p => {
    if (isConsolidated) {
      // Vista consolidada: una fila por producto con stock total de TODAS las bodegas
      const totalStock = State.warehouses.reduce((sum, w) => sum + (stockData[p.sku]?.[w] || 0), 0);
      const warehouseBreakdown = State.warehouses
        .filter(w => (stockData[p.sku]?.[w] || 0) > 0)
        .map(w => `${w}: ${stockData[p.sku][w]}`)
        .join(" | ");
      const label = warehouseBreakdown
        ? `<span class="badge badge-success">TOTAL</span><br><small class="text-muted">${warehouseBreakdown}</small>`
        : `<span class="badge badge-success">TOTAL</span>`;
      buildProjectionRow(p, totalStock, label, null);
    } else {
      // Vista detallada: una fila por bodega seleccionada
      warehousesToList.forEach(w => {
        const stockQty = stockData[p.sku]?.[w] || 0;
        buildProjectionRow(p, stockQty, w, [w]);
      });
    }
  });
}


// ==========================================================================
// MÓDULO DASHBOARD & REPORTES
// ==========================================================================
let activeDbFilters = { years: [], months: [], days: [], categories: [], warehouses: [], products: [] };
let salesChartInst = null;
let stockChartInst = null;
let ingresosChartInst = null;
let sellersChartInst = null;

function initDashboardFilters() {
  // Extraer todos los años y días disponibles de las fechas de ingresos/salidas para el filtro
  const dates = new Set();
  State.ingresos.forEach(doc => dates.add(doc.date));
  State.salidas.forEach(doc => dates.add(doc.date));

  const years = new Set();
  const days = new Set();

  dates.forEach(dStr => {
    const parts = dStr.split("-");
    if (parts.length === 3) {
      years.add(parts[0]);
      days.add(parseInt(parts[2]));
    }
  });

  const selectYears = document.getElementById("db-filter-years");
  selectYears.innerHTML = Array.from(years).sort().map(y => `<option value="${y}">${y}</option>`).join("");

  const selectDays = document.getElementById("db-filter-days");
  selectDays.innerHTML = Array.from(days).sort((a,b) => a-b).map(d => `<option value="${d}">${d}</option>`).join("");

  const selectWh = document.getElementById("db-filter-warehouses");
  selectWh.innerHTML = State.warehouses.map(w => `<option value="${w}">${w}</option>`).join("");

  // Al cambiar categorías en el dashboard, actualizar y filtrar el listado de productos
  document.getElementById("db-filter-categories").onchange = function() {
    updateDashboardProductFilterOptions();
  };

  updateDashboardProductFilterOptions();
}

function updateDashboardProductFilterOptions() {
  const categorySelect = document.getElementById("db-filter-categories");
  const selectedCategories = Array.from(categorySelect.selectedOptions).map(opt => opt.value);
  
  const productSelect = document.getElementById("db-filter-products");
  const previousSelected = Array.from(productSelect.selectedOptions).map(opt => opt.value);

  // Filtrar productos según las categorías seleccionadas
  let filteredProds = State.products;
  if (selectedCategories.length > 0) {
    filteredProds = State.products.filter(p => selectedCategories.includes(p.category));
  }

  // Ordenar alfabéticamente
  const sortedProds = [...filteredProds].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  productSelect.innerHTML = sortedProds.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");

  // Mantener las selecciones previas si aún existen en la lista filtrada
  Array.from(productSelect.options).forEach(opt => {
    if (previousSelected.includes(opt.value)) {
      opt.selected = true;
    }
  });
}

// Botones Filtros Dashboard
document.getElementById("btn-apply-db-filters").onclick = function() {
  activeDbFilters.years = Array.from(document.getElementById("db-filter-years").selectedOptions).map(opt => opt.value);
  activeDbFilters.months = Array.from(document.getElementById("db-filter-months").selectedOptions).map(opt => parseInt(opt.value));
  activeDbFilters.days = Array.from(document.getElementById("db-filter-days").selectedOptions).map(opt => parseInt(opt.value));
  activeDbFilters.categories = Array.from(document.getElementById("db-filter-categories").selectedOptions).map(opt => opt.value);
  activeDbFilters.warehouses = Array.from(document.getElementById("db-filter-warehouses").selectedOptions).map(opt => opt.value);
  activeDbFilters.products = Array.from(document.getElementById("db-filter-products").selectedOptions).map(opt => opt.value);

  renderDashboardCharts();
};

document.getElementById("btn-clear-db-filters").onclick = function() {
  document.getElementById("db-filter-years").selectedIndex = -1;
  document.getElementById("db-filter-months").selectedIndex = -1;
  document.getElementById("db-filter-days").selectedIndex = -1;
  document.getElementById("db-filter-categories").selectedIndex = -1;
  document.getElementById("db-filter-warehouses").selectedIndex = -1;

  // Reestablecer listado a todos los productos y deseleccionar
  updateDashboardProductFilterOptions();
  document.getElementById("db-filter-products").selectedIndex = -1;

  activeDbFilters = { years: [], months: [], days: [], categories: [], warehouses: [], products: [] };
  renderDashboardCharts();
};

function filterDocuments(docList) {
  return docList.filter(doc => {
    const docDate = new Date(doc.date);
    const docYear = String(docDate.getFullYear());
    const docMonth = docDate.getMonth();
    const docDay = docDate.getDate() + 1; // 1-indexed date check correction

    if (activeDbFilters.years.length > 0 && !activeDbFilters.years.includes(docYear)) return false;
    if (activeDbFilters.months.length > 0 && !activeDbFilters.months.includes(docMonth)) return false;
    if (activeDbFilters.days.length > 0 && !activeDbFilters.days.includes(docDay)) return false;
    if (activeDbFilters.warehouses.length > 0 && !activeDbFilters.warehouses.includes(doc.warehouse)) return false;

    return true;
  });
}

function renderDashboardCharts() {
  const filteredSalidas = filterDocuments(State.salidas);
  const filteredIngresos = filterDocuments(State.ingresos);
  const stockData = getInventoryStock();

  // --- CHART 1: VENTAS/SALIDAS POR CATEGORÍA ---
  const catSales = { "T&M": 0, "ME": 0, "Accesorios ME": 0 };
  filteredSalidas.forEach(doc => {
    if (doc.items) {
      doc.items.forEach(item => {
        const categoryMatch = activeDbFilters.categories.length === 0 || activeDbFilters.categories.includes(item.category);
        const productMatch = activeDbFilters.products.length === 0 || activeDbFilters.products.includes(item.sku);
        if (categoryMatch && productMatch) {
          catSales[item.category] = (catSales[item.category] || 0) + item.qty;
        }
      });
    }
  });

  const ctxSales = document.getElementById("chart-sales-category").getContext("2d");
  if (salesChartInst) salesChartInst.destroy();
  salesChartInst = new Chart(ctxSales, {
    type: 'doughnut',
    data: {
      labels: Object.keys(catSales),
      datasets: [{
        label: 'Unidades Vendidas',
        data: Object.values(catSales),
        backgroundColor: ['#018C8C', '#f59e0b', '#38bdf8'],
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Poppins' } } }
      }
    }
  });

  // --- CHART 2: NIVEL DE STOCK POR BODEGA ---
  // Filtrar bodegas a graficar
  let whsToGraph = State.warehouses;
  if (activeDbFilters.warehouses.length > 0) {
    whsToGraph = whsToGraph.filter(w => activeDbFilters.warehouses.includes(w));
  }

  // Agrupado por categoría para gráfico de barras apiladas
  const datasetTM = [];
  const datasetME = [];
  const datasetAcc = [];

  whsToGraph.forEach(wh => {
    let tmQty = 0, meQty = 0, accQty = 0;
    State.products.forEach(p => {
      const categoryMatch = activeDbFilters.categories.length === 0 || activeDbFilters.categories.includes(p.category);
      const productMatch = activeDbFilters.products.length === 0 || activeDbFilters.products.includes(p.sku);
      if (categoryMatch && productMatch) {
        const qty = stockData[p.sku]?.[wh] || 0;
        if (p.category === "T&M") tmQty += qty;
        else if (p.category === "ME") meQty += qty;
        else if (p.category === "Accesorios ME") accQty += qty;
      }
    });
    datasetTM.push(tmQty);
    datasetME.push(meQty);
    datasetAcc.push(accQty);
  });

  const ctxStock = document.getElementById("chart-stock-warehouse").getContext("2d");
  if (stockChartInst) stockChartInst.destroy();
  stockChartInst = new Chart(ctxStock, {
    type: 'bar',
    data: {
      labels: whsToGraph,
      datasets: [
        { label: 'T&M', data: datasetTM, backgroundColor: '#018C8C' },
        { label: 'ME', data: datasetME, backgroundColor: '#f59e0b' },
        { label: 'Accesorios ME', data: datasetAcc, backgroundColor: '#38bdf8' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true }
      },
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  // --- CHART 3: VOLUMEN DE INGRESOS POR BODEGA ---
  const whIngresos = {};
  whsToGraph.forEach(w => whIngresos[w] = 0);

  State.ingresos.forEach(doc => {
    if (activeDbFilters.years.length > 0 && !activeDbFilters.years.includes(doc.date.split("-")[0])) return;
    // Month is 0-indexed in JS dates, but our split("-")[1] is 1-12
    const docMonth = parseInt(doc.date.split("-")[1]) - 1;
    if (activeDbFilters.months.length > 0 && !activeDbFilters.months.includes(docMonth.toString())) return;
    if (activeDbFilters.days.length > 0 && !activeDbFilters.days.includes(parseInt(doc.date.split("-")[2]).toString())) return;
    if (activeDbFilters.warehouses.length > 0 && !activeDbFilters.warehouses.includes(doc.warehouse)) return;

    if (doc.items && doc.condition !== "Dañado") {
      doc.items.forEach(item => {
        const p = State.products.find(prod => prod.sku === item.sku);
        const categoryMatch = !p || activeDbFilters.categories.length === 0 || activeDbFilters.categories.includes(p.category);
        const productMatch = activeDbFilters.products.length === 0 || activeDbFilters.products.includes(item.sku);
        if (categoryMatch && productMatch) {
          whIngresos[doc.warehouse] = (whIngresos[doc.warehouse] || 0) + item.qty;
        }
      });
    }
  });

  const ctxIngresos = document.getElementById("chart-ingresos-warehouse").getContext("2d");
  if (ingresosChartInst) ingresosChartInst.destroy();
  ingresosChartInst = new Chart(ctxIngresos, {
    type: 'bar',
    data: {
      labels: Object.keys(whIngresos),
      datasets: [{
        label: 'Unidades Ingresadas',
        data: Object.values(whIngresos),
        backgroundColor: '#10b981'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Poppins' } } }
      }
    }
  });

  // --- CHART 4: KPI DE VENDEDORES ---
  // Unidades vendidas por cada vendedor en las salidas filtradas
  const sellerSales = {};
  State.sellers.forEach(s => sellerSales[s.name] = 0);

  filteredSalidas.forEach(doc => {
    if (doc.seller && sellerSales[doc.seller] !== undefined) {
      const docQty = doc.items ? doc.items.reduce((sum, item) => {
        const categoryMatch = activeDbFilters.categories.length === 0 || activeDbFilters.categories.includes(item.category);
        const productMatch = activeDbFilters.products.length === 0 || activeDbFilters.products.includes(item.sku);
        if (categoryMatch && productMatch) {
          return sum + item.qty;
        }
        return sum;
      }, 0) : 0;
      sellerSales[doc.seller] += docQty;
    }
  });

  const sellerLabels = State.sellers.map(s => s.name);
  const sellerUnits = State.sellers.map(s => sellerSales[s.name] || 0);
  const sellerGoals = State.sellers.map(s => s.goal);

  const ctxSellers = document.getElementById("chart-sellers-kpi").getContext("2d");
  if (sellersChartInst) sellersChartInst.destroy();
  
  // Ocultar datos de gráficos financieros o monetarios
  // El KPI de vendedores evalúa solo cantidades físicas (volumen)
  sellersChartInst = new Chart(ctxSellers, {
    type: 'bar',
    data: {
      labels: sellerLabels,
      datasets: [
        { label: 'Unidades Vendidas', data: sellerUnits, backgroundColor: '#018C8C' },
        { label: 'Meta Mensual (Uds)', data: sellerGoals, backgroundColor: '#cbd5e1' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y', // Barra horizontal
      scales: {
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}


// ==========================================================================
// MÓDULO IMPORTACIÓN / EXPORTACIÓN (TEMPLATES & SHEETS)
// ==========================================================================

// Descargar Plantilla Ingresos General
document.getElementById("btn-download-tpl-ingreso").onclick = function() {
  const data = [
    { "Fecha (AAAA-MM-DD)": "2026-06-16", "Bodega": "Bodega 1", "Condicion": "Nuevo", "Observaciones": "Ingreso marítimo", "SKU": "TM-001", "Cantidad": 100, "Seriales": "" },
    { "Fecha (AAAA-MM-DD)": "2026-06-16", "Bodega": "Bodega 1", "Condicion": "Nuevo", "Observaciones": "Ingreso marítimo", "SKU": "ME-001", "Cantidad": 2, "Seriales": "SER001, SER002" }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Ingresos");
  XLSX.writeFile(wb, "plantilla_carga_ingresos.xlsx");
};

// Descargar Plantilla Salidas General
document.getElementById("btn-download-tpl-salida").onclick = function() {
  const data = [
    { "Fecha (AAAA-MM-DD)": "2026-06-16", "Bodega": "Bodega 1", "Punto_de_Venta": "Local", "SKU": "TM-001", "Cantidad": 10, "Valor_Venta": 45000, "Cliente": "", "Transportadora": "", "Valor_Envio": "", "Vendedor": "", "Canal_Ventas": "", "Seriales": "" },
    { "Fecha (AAAA-MM-DD)": "2026-06-16", "Bodega": "Bodega 1", "Punto_de_Venta": "Mercado Libre Flex", "SKU": "ME-001", "Cantidad": 2, "Valor_Venta": 850000, "Cliente": "Sofía Pérez", "Transportadora": "Coordinadora", "Valor_Envio": 12000, "Vendedor": "Andrea Gómez", "Canal_Ventas": "WhatsApp", "Seriales": "SER001, SER002" }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Salidas");
  XLSX.writeFile(wb, "plantilla_carga_salidas.xlsx");
};

// Carga masiva General (Ingresos / Salidas)
document.getElementById("form-import-general-xls").addEventListener("submit", (e) => {
  e.preventDefault();
  const type = document.getElementById("import-general-type").value;
  const fileInput = document.getElementById("file-import-general");
  const file = fileInput.files[0];

  if (!file) {
    alert("Seleccione un archivo.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let successCount = 0;

    if (type === "ingreso") {
      // Agrupar filas por fecha/bodega/observaciones/condición para meterlas en un solo documento de ingreso si coinciden
      const docs = {};
      let hasError = false;

      for (let i = 0; i < json.length; i++) {
        const row = json[i];
        const date = row["Fecha (AAAA-MM-DD)"] || new Date().toISOString().split("T")[0];
        const wh = row["Bodega"] || "Bodega";
        const cond = row["Condicion"] || "Nuevo";
        const obs = row["Observaciones"] || "Importación XLS masiva";
        const sku = String(row["SKU"] || "").trim();
        const qty = parseInt(row["Cantidad"] || 0);

        const serialsStr = row["Seriales"] || "";
        let serialsList = [];
        if (serialsStr) {
          serialsList = String(serialsStr).split(/[\n,]+/).map(s => s.trim()).filter(s => s);
        }

        if (sku && qty > 0) {
          const p = State.products.find(prod => prod.sku === sku);
          if (p) {
            if (p.category === "ME" && serialsList.length !== qty) {
              alert(`❌ Error en fila ${i + 2} (SKU ${sku}): La cantidad de ingresos es ${qty} pero se ingresaron ${serialsList.length} seriales.`);
              hasError = true;
              break;
            }
            const key = `${date}_${wh}_${cond}_${obs}`;
            if (!docs[key]) {
              docs[key] = { date, warehouse: wh, condition: cond, notes: obs, items: [] };
            }
            docs[key].items.push({ sku: p.sku, name: p.name, category: p.category, qty, serials: serialsList });
            successCount++;
          }
        }
      }

      if (hasError) return;

      // Guardar documentos de ingreso creados masivamente
      Object.values(docs).forEach(doc => {
        const folioNum = String(State.ingresos.length + 1).padStart(4, "0");
        doc.id = `ING-XLS-${folioNum}`;
        State.ingresos.push(doc);
      });

    } else {
      // Salidas
      const docs = {};
      let hasError = false;

      for (let i = 0; i < json.length; i++) {
        const row = json[i];
        const date = row["Fecha (AAAA-MM-DD)"] || new Date().toISOString().split("T")[0];
        const wh = row["Bodega"] || "Bodega";
        const pve = row["Punto_de_Venta"] || "Local";
        const sku = String(row["SKU"] || "").trim();
        const qty = parseInt(row["Cantidad"] || 0);
        const price = parseFloat(row["Valor_Venta"] || 0);

        const client = row["Cliente"] || "";
        const carrier = row["Transportadora"] || "";
        const shippingCost = parseFloat(row["Valor_Envio"] || 0);
        const seller = row["Vendedor"] || "";
        const channel = row["Canal_Ventas"] || "";

        const serialsStr = row["Seriales"] || "";
        let serialsList = [];
        if (serialsStr) {
          serialsList = String(serialsStr).split(/[\n,]+/).map(s => s.trim()).filter(s => s);
        }

        if (sku && qty > 0) {
          const p = State.products.find(prod => prod.sku === sku);
          if (p) {
            if (p.category === "ME" && serialsList.length !== qty) {
              alert(`❌ Error en fila ${i + 2} (SKU ${sku}): La cantidad de egresos es ${qty} pero se ingresaron ${serialsList.length} seriales.`);
              hasError = true;
              break;
            }
            if (p.category === "ME") {
              const availableSerials = getAvailableSerials(p.sku, wh);
              const missing = serialsList.filter(s => !availableSerials.includes(s));
              if (missing.length > 0) {
                alert(`❌ Error en fila ${i + 2} (SKU ${sku}): Los seriales (${missing.join(", ")}) no están disponibles en la bodega ${wh}.`);
                hasError = true;
                break;
              }
            }
            const key = `${date}_${wh}_${pve}_${client}_${carrier}`;
            if (!docs[key]) {
              docs[key] = {
                date, warehouse: wh, pve, client, carrier, shippingCost, seller, channel,
                items: [], ean: ""
              };
            }
            docs[key].items.push({ sku: p.sku, name: p.name, category: p.category, qty, price, serials: serialsList });
            successCount++;
          }
        }
      }

      if (hasError) return;

      // Guardar
      Object.values(docs).forEach(doc => {
        const folioNum = String(State.salidas.length + 1).padStart(4, "0");
        doc.id = `SAL-XLS-${folioNum}`;
        // Llenar EAN concatenados
        doc.ean = doc.items.map(item => {
          if (item.category === "ME" && item.serials && item.serials.length > 0) {
            return item.serials.join(", ");
          }
          const p = State.products.find(prod => prod.sku === item.sku);
          return p ? p.barcode : "";
        }).join(", ");
        State.salidas.push(doc);
      });
    }

    if (successCount > 0) {
      State.save();
      updateSummaryWidget();
      fileInput.value = "";
      alert(`Importación masiva completada. ${successCount} registros de fila procesados.`);
    } else {
      alert("No se encontraron registros de fila válidos.");
    }
  };
  reader.readAsArrayBuffer(file);
});

// EXPORTACIONES RESPETANDO FILTROS ACTIVOS
function getFilteredExportData(type) {
  const stockData = getInventoryStock();
  const data = [];

  if (type === "stock") {
    // Reporte de stock respetando filtros activos de stock
    let prods = State.products;
    if (activeStockFilters.products.length > 0) prods = prods.filter(p => activeStockFilters.products.includes(p.sku));
    if (activeStockFilters.categories.length > 0) prods = prods.filter(p => activeStockFilters.categories.includes(p.category));

    let whs = State.warehouses;
    if (activeStockFilters.warehouses.length > 0) whs = whs.filter(w => activeStockFilters.warehouses.includes(w));

    prods.forEach(p => {
      whs.forEach(w => {
        const qty = stockData[p.sku]?.[w] || 0;
        data.push({
          "SKU": p.sku,
          "Código de Barras": p.barcode,
          "Producto": p.name,
          "Categoría": p.category,
          "Bodega": w,
          "Stock Físico": qty
        });
      });
    });
  } else if (type === "me_serials") {
    const prods = State.products.filter(p => p.category === "ME");
    prods.forEach(p => {
      State.warehouses.forEach(w => {
        const qty = stockData[p.sku]?.[w] || 0;
        const serials = getAvailableSerials(p.sku, w);
        data.push({
          "SKU": p.sku,
          "Código de Barras": p.barcode,
          "Producto": p.name,
          "Bodega": w,
          "Stock Físico": qty,
          "Seriales Disponibles": serials.length > 0 ? serials.join(", ") : "Ninguno"
        });
      });
    });

  } else if (type === "history") {
    // Historial cruzando filtros del dashboard
    const filteredSalidas = filterDocuments(State.salidas);
    const filteredIngresos = filterDocuments(State.ingresos);

    filteredIngresos.forEach(doc => {
      doc.items.forEach(item => {
        data.push({
          "Folio": doc.id,
          "Fecha": doc.date,
          "Tipo": "Ingreso",
          "Bodega": doc.warehouse,
          "SKU": item.sku,
          "Producto": item.name,
          "Cantidad": item.qty,
          "Detalle / Observaciones": doc.notes
        });
      });
    });

    filteredSalidas.forEach(doc => {
      doc.items.forEach(item => {
        data.push({
          "Folio": doc.id,
          "Fecha": doc.date,
          "Tipo": "Salida / Despacho",
          "Bodega": doc.warehouse,
          "SKU": item.sku,
          "Producto": item.name,
          "Cantidad": item.qty,
          "Valor Venta": formatCurrency(item.price),
          "Punto de Venta": doc.pve,
          "Cliente": doc.client,
          "Vendedor": doc.seller,
          "Detalle / Observaciones": doc.notes
        });
      });
    });

  } else if (type === "sellers") {
    // KPI de vendedores respetando fechas de dashboard
    const filteredSalidas = filterDocuments(State.salidas);
    const sellerSales = {};
    State.sellers.forEach(s => sellerSales[s.name] = 0);

    filteredSalidas.forEach(doc => {
      if (doc.seller && sellerSales[doc.seller] !== undefined) {
        const docQty = doc.items ? doc.items.reduce((sum, i) => sum + i.qty, 0) : 0;
        sellerSales[doc.seller] += docQty;
      }
    });

    State.sellers.forEach(s => {
      data.push({
        "Vendedor(a)": s.name,
        "Unidades Vendidas": sellerSales[s.name] || 0,
        "Meta de Rendimiento (Uds)": s.goal,
        "Cumplimiento Meta": `${((sellerSales[s.name] || 0) / s.goal * 100).toFixed(1)}%`,
        "Estado": s.active ? "Activo" : "Inactivo"
      });
    });
  }

  return data;
}

// Descargar en XLS, CSV, XLSX
document.getElementById("btn-export-csv").onclick = function() {
  const type = document.getElementById("export-report-type").value;
  const data = getFilteredExportData(type);
  if (data.length === 0) {
    alert("No hay datos filtrados disponibles para exportar.");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte_inventario360_${type}_${Date.now()}.csv`;
  a.click();
};

document.getElementById("btn-export-xls").onclick = function() {
  const type = document.getElementById("export-report-type").value;
  const data = getFilteredExportData(type);
  if (data.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  
  // Guardar como XLS (97-2003)
  XLSX.writeFile(wb, `reporte_inventario360_${type}_${Date.now()}.xls`, { bookType: 'xls' });
};

document.getElementById("btn-export-xlsx").onclick = function() {
  const type = document.getElementById("export-report-type").value;
  const data = getFilteredExportData(type);
  if (data.length === 0) {
    alert("No hay datos.");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  
  // Guardar como XLSX
  XLSX.writeFile(wb, `reporte_inventario360_${type}_${Date.now()}.xlsx`, { bookType: 'xlsx' });
};


// ==========================================================================
// MÓDULO DOCUMENTOS CREADOS (HISTORIAL Y EDICIÓN/ELIMINACIÓN)
// ==========================================================================
let docsSortCol = 'fecha';
let docsSortOrder = 'desc';

window.toggleDocsSort = function(col) {
  if (docsSortCol === col) {
    docsSortOrder = docsSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    docsSortCol = col;
    docsSortOrder = 'asc';
  }
  
  // Update icons
  ['folio', 'fecha', 'tipo', 'producto'].forEach(c => {
    const iconEl = document.getElementById(`sort-icon-${c}`);
    if (iconEl) {
      if (c === docsSortCol) {
        iconEl.textContent = docsSortOrder === 'asc' ? '▲' : '▼';
      } else {
        iconEl.textContent = '';
      }
    }
  });

  renderDocumentsHistory();
};

function renderDocumentsHistory() {
  const tbody = document.querySelector("#table-docs-history tbody");
  tbody.innerHTML = "";

  const typeFilter = document.getElementById("filter-docs-type").value;
  const searchQ = document.getElementById("search-docs-input").value.toLowerCase().trim();

  // Consolidar todos los documentos en una sola lista
  let allDocs = [];

  if (typeFilter === "Todos" || typeFilter === "Ingreso") {
    State.ingresos.forEach(d => allDocs.push({ ...d, docType: "Ingreso" }));
  }
  if (typeFilter === "Todos" || typeFilter === "Salida") {
    State.salidas.forEach(d => allDocs.push({ ...d, docType: "Salida" }));
  }
  if (typeFilter === "Todos" || typeFilter === "Traslado") {
    State.traslados.forEach(d => allDocs.push({ ...d, docType: "Traslado" }));
  }
  if (typeFilter === "Todos" || typeFilter === "Reserva") {
    State.reservas.forEach((d, idx) => {
      if (d.archived) {
        allDocs.push({
          ...d,
          id: d.id || `RES-${String(idx + 1).padStart(4, "0")}`,
          docType: "Reserva",
          date: d.shipDate || d.date || ""
        });
      }
    });
  }
  if (typeFilter === "Todos" || typeFilter === "Rotulo") {
    State.rotulos.forEach(d => allDocs.push({ ...d, docType: "Rótulo" }));
  }
  if (typeFilter === "Todos" || typeFilter === "Facturación") {
    State.facturacion.forEach(d => {
      allDocs.push({
        ...d,
        docType: "Facturación",
        subType: d.docType
      });
    });
  }

  // Ordenar según configuración
  allDocs.sort((a, b) => {
    let valA, valB;
    
    if (docsSortCol === 'fecha') {
      valA = new Date(a.date).getTime();
      valB = new Date(b.date).getTime();
      if (isNaN(valA)) valA = 0;
      if (isNaN(valB)) valB = 0;
    } else if (docsSortCol === 'folio') {
      valA = (a.id || "").toString().toLowerCase();
      valB = (b.id || "").toString().toLowerCase();
    } else if (docsSortCol === 'tipo') {
      valA = (a.docType || "").toString().toLowerCase();
      valB = (b.docType || "").toString().toLowerCase();
    } else if (docsSortCol === 'producto') {
      const getProdName = (doc) => {
        if (doc.prodName) return doc.prodName;
        if (doc.sku) {
          const p = State.products.find(prod => prod.sku === doc.sku);
          if (p) return p.name;
          return doc.sku;
        }
        if (doc.items && doc.items.length > 0) {
          const item = doc.items[0];
          if (item.name) return item.name;
          if (item.desc) return item.desc;
          if (item.sku) {
            const p = State.products.find(prod => prod.sku === item.sku);
            return p ? p.name : item.sku;
          }
        }
        return "";
      };
      valA = getProdName(a).toString().toLowerCase();
      valB = getProdName(b).toString().toLowerCase();
    }

    if (valA < valB) return docsSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return docsSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Aplicar búsqueda por SKU, Folio, Bodega, etc.
  if (searchQ) {
    const searchClean = searchQ.replace(/[^a-z0-9]/gi, ""); // keep only alphanumeric for smart ID/phone/name matching
    
    allDocs = allDocs.filter(doc => {
      const matchId = (doc.id || "").toLowerCase().includes(searchQ);
      const matchWh = (doc.warehouse || doc.originWarehouse || "").toLowerCase().includes(searchQ);
      
      const clientClean = (doc.client || "").toLowerCase().replace(/[^a-z0-9]/gi, "");
      const matchClient = (doc.client || "").toLowerCase().includes(searchQ) ||
                          (clientClean && searchClean && clientClean.includes(searchClean)) ||
                          (doc.name || "").toLowerCase().includes(searchQ) ||
                          (doc.name || "").toLowerCase().replace(/[^a-z0-9]/gi, "").includes(searchClean) ||
                          (doc.idCard || "").toLowerCase().includes(searchQ) ||
                          (doc.idCard || "").replace(/[^0-9]/g, "").includes(searchQ.replace(/[^0-9]/g, "")) ||
                          (doc.cc || "").toLowerCase().includes(searchQ) ||
                          (doc.cc || "").replace(/[^0-9]/g, "").includes(searchQ.replace(/[^0-9]/g, "")) ||
                          (doc.nit || "").toLowerCase().includes(searchQ) ||
                          (doc.nit || "").replace(/[^0-9]/g, "").includes(searchQ.replace(/[^0-9]/g, "")) ||
                          (doc.phone || "").toLowerCase().includes(searchQ) ||
                          (doc.phone || "").replace(/[^0-9]/g, "").includes(searchQ.replace(/[^0-9]/g, "")) ||
                          (doc.telefono || "").toLowerCase().includes(searchQ) ||
                          (doc.telefono || "").replace(/[^0-9]/g, "").includes(searchQ.replace(/[^0-9]/g, ""));
                          
      const matchObs = (doc.notes || doc.observaciones || doc.shipEan || doc.shipInvoice || doc.city || doc.address || "").toLowerCase().includes(searchQ);
      
      const matchSku = (doc.sku || "").toLowerCase().includes(searchQ) || 
                       (doc.items && doc.items.some(item => item.sku && item.sku.toLowerCase().includes(searchQ)));
      
      const matchProduct = (doc.prodName || "").toLowerCase().includes(searchQ) ||
                           (doc.sku && (State.products.find(p => p.sku === doc.sku)?.name || "").toLowerCase().includes(searchQ)) ||
                           (doc.items && doc.items.some(item => {
                             const pName = item.name || item.desc || (item.sku ? (State.products.find(p => p.sku === item.sku)?.name || "") : "");
                             return pName.toLowerCase().includes(searchQ);
                           }));
                           
      const matchSerial = (doc.serial || "").toLowerCase().includes(searchQ) || 
                          (doc.items && doc.items.some(item => item.serials && item.serials.some(s => s.toLowerCase().includes(searchQ))));
      
      return matchId || matchWh || matchClient || matchObs || matchSku || matchProduct || matchSerial;
    });
  }

  allDocs.forEach(doc => {
    const tr = document.createElement("tr");

    let badgeClass = "badge-teal";
    if (doc.docType === "Salida") badgeClass = "badge-warning";
    if (doc.docType === "Traslado") badgeClass = "badge-success";
    if (doc.docType === "Reserva") badgeClass = "badge-teal";
    if (doc.docType === "Rótulo") badgeClass = "badge-teal";

    const itemsCount = (doc.docType === "Reserva" || doc.docType === "Rótulo") ? 1 : (doc.items ? doc.items.length : 0);
    
    // Detalle descriptivo de cabecera
    let detailText = "";
    let costText = "-";

    if (doc.docType === "Ingreso") {
      detailText = `A Bodega: <span class="badge badge-teal">${doc.warehouse}</span> | Cond: ${doc.condition}<br><span class="text-muted font-sm">${doc.notes || 'Sin obs'}</span>`;
    } else if (doc.docType === "Salida") {
      detailText = `Punto Venta: <span class="badge badge-teal">${doc.pve}</span> | Cliente: ${doc.client || 'General'}<br><span class="text-muted font-sm">${doc.notes || 'Sin obs'}</span>`;
      
      // Calcular valor total salida
      if (doc.items) {
        const totalAmount = doc.items.reduce((sum, item) => sum + (item.qty * (item.price || 0)), 0);
        costText = formatCurrency(totalAmount);
      }
    } else if (doc.docType === "Reserva") {
      detailText = `Cliente: <strong>${doc.name}</strong> | EAN: ${doc.shipEan || '-'} | Factura: ${doc.shipInvoice || '-'}`;
      costText = formatCurrency(doc.amount);
    } else if (doc.docType === "Rótulo") {
      detailText = `Marca: <span class="badge badge-teal">${doc.labelType}</span> | Destinatario: <strong>${doc.name}</strong> | Ciudad: ${doc.city}<br><span class="text-muted font-sm">${doc.address}</span>`;
      costText = "-";
    } else if (doc.docType === "Facturación") {
      const docSubTipo = doc.subType || "Factura";
      detailText = `Tipo: <span class="badge badge-teal">${docSubTipo}</span> | Cliente: <strong>${doc.client}</strong><br><span class="text-muted font-sm">${doc.observaciones || doc.notes || 'Sin observaciones'}</span>`;
      costText = formatCurrency(doc.total);
    } else {
      detailText = `Origen: <strong>${doc.originWarehouse}</strong> ➔ Destino: <strong>${doc.destWarehouse}</strong>`;
    }

    // Botones de acción (solo Administrador puede editar/eliminar)
    let actionButtons = `
      <button class="btn btn-secondary btn-sm btn-view-doc" data-id="${doc.id}" data-type="${doc.docType}" title="Visualizar"><i data-lucide="eye"></i></button>
    `;

    if (State.activeUser && State.activeUser.role === "Administrador") {
      actionButtons = `
        <button class="btn btn-secondary btn-sm btn-view-doc" data-id="${doc.id}" data-type="${doc.docType}" title="Visualizar"><i data-lucide="eye"></i></button>
        <button class="btn btn-danger btn-sm btn-delete-doc" data-id="${doc.id}" data-type="${doc.docType}" title="Eliminar"><i data-lucide="trash"></i></button>
      `;

      if (doc.docType === "Traslado") {
        actionButtons = `
          <button class="btn btn-secondary btn-sm btn-view-doc" data-id="${doc.id}" data-type="${doc.docType}" title="Visualizar"><i data-lucide="eye"></i></button>
          <button class="btn btn-secondary btn-sm btn-edit-transfer-doc" data-id="${doc.id}" title="Editar"><i data-lucide="edit-2"></i></button>
          <button class="btn btn-danger btn-sm btn-delete-doc" data-id="${doc.id}" data-type="${doc.docType}" title="Eliminar"><i data-lucide="trash"></i></button>
        `;
      }
    }

    let productText = "-";
    if (doc.docType === "Reserva") {
      productText = `<span class="badge badge-teal font-sm">${doc.sku}</span>`;
    } else if (doc.docType === "Rótulo") {
      productText = '<span class="text-muted">-</span>';
    } else if (doc.items && doc.items.length > 0) {
      const uniqueSkus = [...new Set(doc.items.map(item => {
        let name = item.sku || item.desc || "";
        if (name.length > 15) {
          name = name.substring(0, 15) + "...";
        }
        return name;
      }))].filter(Boolean);
      if (uniqueSkus.length <= 2) {
        productText = uniqueSkus.map(sku => `<span class="badge badge-secondary font-sm" style="margin: 2px;">${sku}</span>`).join("");
      } else {
        productText = uniqueSkus.slice(0, 2).map(sku => `<span class="badge badge-secondary font-sm" style="margin: 2px;">${sku}</span>`).join("") + 
                      ` <span class="badge badge-secondary font-sm" style="margin: 2px; opacity: 0.8;">+${uniqueSkus.length - 2}</span>`;
      }
    }

    tr.innerHTML = `
      <td><span class="text-bold">${doc.id}</span></td>
      <td>${doc.date}</td>
      <td><span class="badge ${badgeClass}">${doc.docType}</span></td>
      <td>${productText}</td>
      <td>${detailText}</td>
      <td>${itemsCount} ítems</td>
      <td class="text-bold">${costText}</td>
      <td>
        <div class="btn-group-row">${actionButtons}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Listeners
  document.querySelectorAll(".btn-view-doc").forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute("data-id");
      const type = this.getAttribute("data-type");
      openDocumentDetailModal(id, type);
    };
  });

  document.querySelectorAll(".btn-edit-transfer-doc").forEach(btn => {
    btn.onclick = function() {
      if (!State.activeUser || State.activeUser.role !== "Administrador") {
        alert("No tiene permisos para editar documentos.");
        return;
      }
      const id = this.getAttribute("data-id");
      const doc = State.traslados.find(t => t.id === id);
      if (doc) {
        // Cargar en formulario de traslado
        document.getElementById("transfer-edit-id").value = doc.id;
        document.getElementById("transfer-date").value = doc.date;
        document.getElementById("transfer-origin-wh").value = doc.originWarehouse;
        document.getElementById("transfer-origin-wh").onchange();
        document.getElementById("transfer-dest-wh").value = doc.destWarehouse;
        document.getElementById("transfer-dest-wh").onchange();
        
        currentTransferItems = [...doc.items];
        renderTransferItemsTable();

        document.getElementById("transfer-form-title").textContent = `Editar Registro de Traslado: ${doc.id}`;
        document.getElementById("btn-save-transfer").innerHTML = `<i data-lucide="save"></i> Actualizar Traslado`;

        // Navegar a modulo traslado
        const navItem = document.querySelector(".sidebar-nav .nav-item[data-target='module-traslado']");
        if (navItem) navItem.click();
      }
    };
  });

  document.querySelectorAll(".btn-delete-doc").forEach(btn => {
    btn.onclick = function() {
      if (!State.activeUser || State.activeUser.role !== "Administrador") {
        alert("No tiene permisos para eliminar o anular documentos.");
        return;
      }
      const id = this.getAttribute("data-id");
      const type = this.getAttribute("data-type");

      const isReserva = type === "Reserva";
      const isRotulo = type === "Rótulo" || type === "Rotulo";
      let confirmMsg = `¿Está seguro de anular y eliminar el documento ${id}? Se revertirán los movimientos en el stock.`;
      if (isReserva) {
        confirmMsg = `¿Está seguro de eliminar el registro de reserva ${id}?`;
      } else if (isRotulo) {
        confirmMsg = `¿Está seguro de eliminar el registro del rótulo ${id}?`;
      } else if (type === "Facturación" || type === "Facturacion") {
        confirmMsg = `¿Está seguro de eliminar el documento de facturación ${id}?`;
      }

      if (confirm(confirmMsg)) {
        if (type === "Ingreso") {
          State.ingresos = State.ingresos.filter(d => d.id !== id);
        } else if (type === "Salida") {
          State.salidas = State.salidas.filter(d => d.id !== id);
        } else if (type === "Traslado") {
          State.traslados = State.traslados.filter(d => d.id !== id);
        } else if (type === "Reserva") {
          State.reservas = State.reservas.filter(d => d.id !== id);
        } else if (type === "Rótulo" || type === "Rotulo") {
          State.rotulos = State.rotulos.filter(d => d.id !== id);
        } else if (type === "Facturación" || type === "Facturacion") {
          State.facturacion = State.facturacion.filter(d => d.id !== id);
        }
        State.save();
        updateSummaryWidget();
        renderDocumentsHistory();
      }
    };
  });
  lucide.createIcons();
}

// Buscar en historial
document.getElementById("search-docs-input").addEventListener("input", renderDocumentsHistory);
document.getElementById("filter-docs-type").onchange = renderDocumentsHistory;

// Detalle Modal
function openDocumentDetailModal(id, type) {
  const modal = document.getElementById("modal-container");
  const modalTitle = document.getElementById("modal-title");
  const modalContent = document.getElementById("modal-content");

  modalTitle.textContent = `Detalles del Documento: ${id}`;
  modalContent.innerHTML = "";

  let doc = null;
  if (type === "Ingreso") {
    doc = State.ingresos.find(d => d.id === id);
  } else if (type === "Salida") {
    doc = State.salidas.find(d => d.id === id);
  } else if (type === "Reserva") {
    doc = State.reservas.find((d, idx) => d.id === id || `RES-${String(idx + 1).padStart(4, "0")}` === id);
  } else if (type === "Rótulo" || type === "Rotulo") {
    doc = State.rotulos.find(d => d.id === id);
  } else if (type === "Facturación" || type === "Facturacion" || (type && type.toLowerCase().includes("factur"))) {
    doc = State.facturacion.find(d => d.id === id);
  } else {
    doc = State.traslados.find(d => d.id === id);
  }

  if (!doc) {
    modalContent.innerHTML = "<p>No se encontró información del documento.</p>";
    modal.classList.remove("hidden");
    return;
  }

  if (type === "Facturación" || type === "Facturacion" || (type && type.toLowerCase().includes("factur"))) {
    const logoSrc = document.getElementById("print-logo")?.src || "logo.png";
    const subtotalCalc = doc.items ? doc.items.reduce((sum, i) => sum + (i.qty * i.unitPrice), 0) : doc.total;
    const totalDctoCalc = doc.items ? doc.items.reduce((sum, i) => sum + (i.qty * i.discount), 0) : 0;
    
    modalContent.innerHTML = `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); color: #333;">
        <!-- Top Actions Bar in modal -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 20px; gap: 8px;">
          <button class="btn btn-primary" id="btn-re-export-pdf" style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="download"></i> Exportar PDF (A4)
          </button>
        </div>
        
        <!-- Printable area inside modal -->
        <div id="modal-invoice-print-area" style="background: white; padding: 30px; border: 1px solid #cbd5e1; box-sizing: border-box;">
          <!-- Cabecera -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 15px;">
            <div>
              <h2 style="margin: 0 0 5px 0; font-size: 22px; font-weight: 300;">${doc.subType || doc.docType || 'Factura'} No. <span style="font-weight: bold; color: #0f766e;">${doc.id}</span></h2>
              <h4 style="margin: 0 0 5px 0; color: #0f766e; font-size: 13px;">TECNOLOGÍA Y MOVILIDAD SAS</h4>
              <div style="font-size: 11px; line-height: 1.4;">
                <div>NIT 901.818.992-1</div>
                <div>CEL: (57) 3247772247</div>
                <div>CRA 43A # 18SUR-174 Local 252</div>
                <div>Medellín - Colombia</div>
              </div>
            </div>
            <div style="text-align: right;">
              <img src="${logoSrc}" style="max-width: 140px; max-height: 80px; object-fit: contain;">
            </div>
          </div>
          
          <!-- Datos Cliente -->
          <div style="margin-bottom: 15px; font-size: 12px; line-height: 1.5;">
            <div style="display: flex; margin-bottom: 3px;">
              <div style="width: 80px; font-weight: bold;">Fecha:</div>
              <div style="text-transform: uppercase;">${doc.date}</div>
            </div>
            <div style="display: flex; margin-bottom: 3px;">
              <div style="flex: 1; display: flex;">
                <div style="width: 80px; font-weight: bold;">Nombre:</div>
                <div style="flex: 1; text-transform: uppercase;">${doc.client}</div>
              </div>
              <div style="flex: 1; display: flex;">
                <div style="width: 80px; font-weight: bold; margin-left: 10px;">Teléfono:</div>
                <div style="text-transform: uppercase;">${doc.telefono || '-'}</div>
              </div>
            </div>
            <div style="display: flex; margin-bottom: 3px;">
              <div style="flex: 1; display: flex;">
                <div style="width: 80px; font-weight: bold;">NIT / C.C.:</div>
                <div style="text-transform: uppercase;">${doc.nit || '-'}</div>
              </div>
              <div style="flex: 1; display: flex;">
                <div style="width: 80px; font-weight: bold; margin-left: 10px;">Ciudad:</div>
                <div style="text-transform: uppercase;">${doc.ciudad ? (doc.ciudad + ' - ' + (doc.departamento || '')).toUpperCase() : '-'}</div>
              </div>
            </div>
            <div style="display: flex; margin-bottom: 3px;">
              <div style="width: 80px; font-weight: bold;">Dirección:</div>
              <div style="flex: 1; text-transform: uppercase;">${doc.direccion || '-'}</div>
            </div>
            <div style="display: flex;">
              <div style="width: 80px; font-weight: bold;">Correo:</div>
              <div style="flex: 1; text-transform: uppercase;">${doc.correo || '-'}</div>
            </div>
          </div>
          
          <!-- Tabla de Items -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; table-layout: fixed;">
            <thead>
              <tr style="background-color: #0f4c5c; color: white;">
                <th style="padding: 6px; border: 1px solid #7393a7; text-align: center; width: 10%;">Cant</th>
                <th style="padding: 6px; border: 1px solid #7393a7; text-align: left; width: 45%;">Descripción</th>
                <th style="padding: 6px; border: 1px solid #7393a7; text-align: right; width: 15%;">Val Unit</th>
                <th style="padding: 6px; border: 1px solid #7393a7; text-align: right; width: 15%;">Val Dcto</th>
                <th style="padding: 6px; border: 1px solid #7393a7; text-align: right; width: 15%;">Val Total</th>
              </tr>
            </thead>
            <tbody>
              ${doc.items ? doc.items.map(item => {
                const sub = item.qty * item.unitPrice;
                const dct = item.qty * item.discount;
                const tot = sub - dct;
                return `
                  <tr>
                    <td style="padding: 6px; border: 1px solid #7393a7; text-align: center;">${item.qty}</td>
                    <td style="padding: 6px; border: 1px solid #7393a7; text-transform: uppercase;">${item.desc}</td>
                    <td style="padding: 6px; border: 1px solid #7393a7; text-align: right;">${formatCurrency(item.unitPrice)}</td>
                    <td style="padding: 6px; border: 1px solid #7393a7; text-align: right;">${formatCurrency(item.discount)}</td>
                    <td style="padding: 6px; border: 1px solid #7393a7; text-align: right; font-weight: bold;">${formatCurrency(tot)}</td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="5" style="text-align: center; padding: 10px; color: #999;">Detalles de ítems no disponibles para este registro antiguo.</td></tr>`}
            </tbody>
          </table>
          
          <!-- Totales y Observaciones -->
          <div style="display: flex; font-size: 11px; margin-bottom: 20px;">
            <div style="flex: 1; padding-right: 15px;">
              <div style="font-weight: bold; color: #0f766e; margin-bottom: 3px;">Observaciones</div>
              <div style="white-space: pre-wrap; text-transform: uppercase; color: #555; font-size: 10px;">${doc.observaciones || doc.notes || 'NINGUNA'}</div>
            </div>
            <div style="width: 200px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 3px; text-align: right; font-weight: bold;">TOTAL</td>
                  <td style="padding: 3px; text-align: right; border: 1px solid #7393a7; background-color: #0f4c5c; color: white; width: 100px;">${formatCurrency(subtotalCalc)}</td>
                </tr>
                <tr>
                  <td style="padding: 3px; text-align: right; font-weight: bold;">Descuento</td>
                  <td style="padding: 3px; text-align: right; border: 1px solid #7393a7;">${formatCurrency(totalDctoCalc)}</td>
                </tr>
                <tr>
                  <td style="padding: 3px; text-align: right; font-weight: bold;">TOTAL A PAGAR</td>
                  <td style="padding: 3px; text-align: right; border: 1px solid #7393a7; background-color: #0f4c5c; color: white;">${formatCurrency(doc.total)}</td>
                </tr>
              </table>
            </div>
          </div>
          

        </div>
      </div>
    `;
    
    modalTitle.textContent = `Detalles del Documento: ${doc.id}`;
    modalContent.innerHTML = modalContent.innerHTML; // ensures DOM structure is set
    modal.classList.remove("hidden");
    lucide.createIcons();
    
    document.getElementById("btn-re-export-pdf").onclick = async function() {
      const btn = this;
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader" class="spin"></i> Generando PDF...`;
      lucide.createIcons();
      
      const printElement = document.getElementById("modal-invoice-print-area");
      
      // Crear un contenedor temporal fuera de pantalla con las dimensiones exactas de una hoja Carta
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "fixed";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "-9999px";
      tempContainer.style.width = "816px";
      tempContainer.style.height = "1056px";
      tempContainer.style.background = "white";
      tempContainer.style.boxSizing = "border-box";
      tempContainer.style.position = "relative";
      
      const clone = printElement.cloneNode(true);
      clone.style.width = "100%";
      clone.style.height = "100%";
      clone.style.transform = "none";
      clone.style.margin = "0";
      clone.style.padding = "48px"; // Añadir el margen del documento como padding de la hoja
      clone.style.boxSizing = "border-box";
      

      
      tempContainer.appendChild(clone);
      document.body.appendChild(tempContainer);
      
      const opt = {
        margin:       0, // Margen cero porque ya está incluido como padding: 48px (0.5 in) en el diseño de la hoja
        filename:     `${doc.subType || doc.docType || 'Factura'}_${doc.id}_${doc.client}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2.5, useCORS: true, logging: false },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      
      try {
        await html2pdf().set(opt).from(tempContainer).save();
      } catch (err) {
        console.error(err);
        alert("Error al generar el PDF.");
      } finally {
        document.body.removeChild(tempContainer);
      }
      
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="download"></i> Exportar PDF`;
      lucide.createIcons();
    };
    return;
  }

  // Generar cabecera detallada
  let headerHTML = "";
  if (type === "Ingreso") {
    headerHTML = `
      <div class="modal-detail-grid">
        <div class="modal-detail-item"><span class="label">Fecha</span><span class="value">${doc.date}</span></div>
        <div class="modal-detail-item"><span class="label">Bodega Destino</span><span class="value">${doc.warehouse}</span></div>
        <div class="modal-detail-item"><span class="label">Condición</span><span class="value">${doc.condition}</span></div>
        <div class="modal-detail-item"><span class="label">Observaciones</span><span class="value">${doc.notes || 'Ninguna'}</span></div>
      </div>
    `;
  } else if (type === "Salida") {
    headerHTML = `
      <div class="modal-detail-grid">
        <div class="modal-detail-item"><span class="label">Fecha</span><span class="value">${doc.date}</span></div>
        <div class="modal-detail-item"><span class="label">Bodega Origen</span><span class="value">${doc.warehouse}</span></div>
        <div class="modal-detail-item"><span class="label">Punto de Venta</span><span class="value">${doc.pve}</span></div>
        <div class="modal-detail-item"><span class="label">Cliente</span><span class="value">${doc.client || 'Consumidor Final'}</span></div>
        <div class="modal-detail-item"><span class="label">Vendedor</span><span class="value">${doc.seller || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Canal</span><span class="value">${doc.channel || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Transportadora</span><span class="value">${doc.carrier || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Envío ($)</span><span class="value">${formatCurrency(doc.shippingCost)}</span></div>
        <div class="modal-detail-item"><span class="label">MasterShop</span><span class="value">${doc.mastershop || 'No'}</span></div>
        <div class="modal-detail-item"><span class="label">Factura Electrónica</span><span class="value">${doc.facturaElectronica || 'No'}</span></div>
        <div class="modal-detail-item" style="grid-column: span 2;"><span class="label">Observaciones</span><span class="value">${doc.notes || 'Ninguna'}</span></div>
      </div>
    `;
  } else if (type === "Reserva") {
    headerHTML = `
      <div class="modal-detail-grid">
        <div class="modal-detail-item"><span class="label">Fecha Reserva</span><span class="value">${doc.date || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Fecha Envío</span><span class="value">${doc.shipDate || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Cliente</span><span class="value">${doc.name || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Cédula</span><span class="value">${doc.idCard || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Teléfono</span><span class="value">${doc.phone || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">EAN (Envío)</span><span class="value">${doc.shipEan || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Factura</span><span class="value">${doc.shipInvoice || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Valor Abonado</span><span class="value">${formatCurrency(doc.amount)}</span></div>
        <div class="modal-detail-item"><span class="label">Medio de Pago</span><span class="value">${doc.paymentMethod || '-'}</span></div>
      </div>
    `;
  } else if (type === "Rótulo" || type === "Rotulo") {
    headerHTML = `
      <div class="modal-detail-grid">
        <div class="modal-detail-item"><span class="label">Folio</span><span class="value">${doc.id}</span></div>
        <div class="modal-detail-item"><span class="label">Fecha Generación</span><span class="value">${doc.date}</span></div>
        <div class="modal-detail-item"><span class="label">Tipo de Rótulo</span><span class="value">Rótulo ${doc.labelType}</span></div>
        <div class="modal-detail-item"><span class="label">Nombre Destinatario</span><span class="value">${doc.name}</span></div>
        <div class="modal-detail-item"><span class="label">Cédula (C.C.)</span><span class="value">${doc.cc}</span></div>
        <div class="modal-detail-item"><span class="label">Celular</span><span class="value">${doc.phone}</span></div>
        <div class="modal-detail-item"><span class="label">Ciudad</span><span class="value">${doc.city}</span></div>
        <div class="modal-detail-item" style="grid-column: span 2;"><span class="label">Dirección</span><span class="value">${doc.address}</span></div>
      </div>
    `;
    
    if (doc.labelType === "ME") {
      headerHTML += `
      <div class="modal-detail-grid" style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 12px;">
        <div class="modal-detail-item"><span class="label">Producto</span><span class="value">${doc.sku} - ${doc.prodName}</span></div>
        <div class="modal-detail-item"><span class="label">Serial</span><span class="value">${doc.serial}</span></div>
        <div class="modal-detail-item"><span class="label">Transportadora</span><span class="value">${doc.carrier}</span></div>
      </div>
      `;
    }
    
    modalContent.innerHTML = headerHTML;
    modal.classList.remove("hidden");
    lucide.createIcons();
    return;
  } else if (type === "Facturación" || type === "Facturacion") {
    headerHTML = `
      <div class="modal-detail-grid">
        <div class="modal-detail-item"><span class="label">Fecha</span><span class="value">${doc.date}</span></div>
        <div class="modal-detail-item"><span class="label">Tipo Documento</span><span class="value">${doc.subType || doc.docType || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Consecutivo</span><span class="value">${doc.id}</span></div>
        <div class="modal-detail-item"><span class="label">Cliente</span><span class="value">${doc.client}</span></div>
        <div class="modal-detail-item"><span class="label">NIT / C.C.</span><span class="value">${doc.nit || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Dirección</span><span class="value">${doc.direccion || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Departamento</span><span class="value">${doc.departamento || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Ciudad</span><span class="value">${doc.ciudad || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Teléfono</span><span class="value">${doc.telefono || '-'}</span></div>
        <div class="modal-detail-item"><span class="label">Correo</span><span class="value">${doc.correo || '-'}</span></div>
        <div class="modal-detail-item" style="grid-column: span 2;"><span class="label">Observaciones</span><span class="value">${doc.observaciones || doc.notes || 'Ninguna'}</span></div>
      </div>
    `;
  } else {
    headerHTML = `
      <div class="modal-detail-grid">
        <div class="modal-detail-item"><span class="label">Fecha</span><span class="value">${doc.date}</span></div>
        <div class="modal-detail-item"><span class="label">Bodega Origen</span><span class="value">${doc.originWarehouse}</span></div>
        <div class="modal-detail-item"><span class="label">Bodega Destino</span><span class="value">${doc.destWarehouse}</span></div>
      </div>
    `;
  }

  // Generar tabla de items
  let tableRows = "";
  let totalAmount = 0;

  if (type === "Reserva") {
    const p = State.products.find(prod => prod.sku === doc.sku);
    const prodName = p ? p.name : "Producto no encontrado";
    tableRows = `
      <tr>
        <td>1</td>
        <td><span class="text-bold">${doc.sku}</span></td>
        <td>${prodName}</td>
        <td>1 uds</td>
        <td>${formatCurrency(doc.amount)}</td>
      </tr>
    `;
  } else if (type === "Facturación" || type === "Facturacion") {
    if (doc.items) {
      doc.items.forEach((item, index) => {
        const subtotal = item.qty * (item.unitPrice || 0);
        const discountTotal = item.qty * (item.discount || 0);
        const total = subtotal - discountTotal;
        tableRows += `
          <tr>
            <td>${index + 1}</td>
            <td>-</td>
            <td>${item.desc}</td>
            <td>${item.qty} uds</td>
            <td>
              Unitario: ${formatCurrency(item.unitPrice)}<br>
              Dcto: ${formatCurrency(item.discount)}<br>
              Subtotal: ${formatCurrency(subtotal)}<br>
              Total: ${formatCurrency(total)}
            </td>
          </tr>
        `;
      });
    }
  } else {
    doc.items.forEach((item, index) => {
      let rowVal = "-";
      if (type === "Salida") {
        const subtotal = item.qty * (item.price || 0);
        totalAmount += subtotal;
        rowVal = `${formatCurrency(item.price)} (Subtotal: ${formatCurrency(subtotal)})`;
      }
      let serialsHTML = "";
      if (item.serials && item.serials.length > 0) {
        serialsHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;"><strong>Seriales:</strong> ${item.serials.join(", ")}</div>`;
      }
      tableRows += `
        <tr>
          <td>${index + 1}</td>
          <td><span class="text-bold">${item.sku}</span></td>
          <td>${item.name}${serialsHTML}</td>
          <td>${item.qty} uds</td>
          <td>${rowVal}</td>
        </tr>
      `;
    });
  }

  let totalHTML = "";
  if (type === "Salida") {
    totalHTML = `
      <div class="text-right border-top pt-2 mt-2 text-bold">
        Total Despachado: ${formatCurrency(totalAmount)}
      </div>
    `;
  } else if (type === "Reserva") {
    totalHTML = `
      <div class="text-right border-top pt-2 mt-2 text-bold">
        Total Abonado: ${formatCurrency(doc.amount)}
      </div>
    `;
  } else if (type === "Facturación" || type === "Facturacion") {
    const subtotal = doc.items ? doc.items.reduce((sum, i) => sum + (i.qty * (i.unitPrice || 0)), 0) : 0;
    const totalDcto = doc.items ? doc.items.reduce((sum, i) => sum + (i.qty * (i.discount || 0)), 0) : 0;
    totalHTML = `
      <div class="text-right border-top pt-2 mt-2">
        <div>Subtotal: ${formatCurrency(subtotal)}</div>
        <div class="text-danger">Descuento: ${formatCurrency(totalDcto)}</div>
        <div class="text-bold" style="font-size: 1.1rem; margin-top: 4px;">Total a Pagar: ${formatCurrency(doc.total)}</div>
      </div>
    `;
  }

  let receiptHTML = "";
  if (type === "Reserva" && doc.receipt) {
    receiptHTML = `
      <div class="mt-3 text-center border-top pt-2">
        <div style="font-weight: bold; margin-bottom: 8px; text-align: left;" class="label">Soporte de Abono:</div>
        <img src="${doc.receipt}" alt="Soporte de abono" style="max-width: 100%; max-height: 250px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); object-fit: contain;">
      </div>
    `;
  } else if (type === "Salida" && doc.carrierGuide) {
    receiptHTML = `
      <div class="mt-3 text-center border-top pt-2">
        <div style="font-weight: bold; margin-bottom: 8px; text-align: left;" class="label">Guía Transportadora:</div>
        <a href="${doc.carrierGuide}" target="_blank" title="Ver imagen en tamaño completo">
          <img src="${doc.carrierGuide}" alt="Guía Transportadora" style="max-width: 100%; max-height: 250px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); object-fit: contain; cursor: pointer; transition: transform 0.2s ease;">
        </a>
      </div>
    `;
  }

  modalContent.innerHTML = `
    ${headerHTML}
    <div class="table-responsive mt-3">
      <table class="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>SKU</th>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Valor Venta</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
    ${totalHTML}
    ${receiptHTML}
  `;

  modal.classList.remove("hidden");
  lucide.createIcons();
}


// ==========================================================================
// MÓDULO PRODUCTOS RESERVADOS
// ==========================================================================
function initReservasModule() {
  const prodSelect = document.getElementById("reserva-product-select");
  const sortedProds = [...State.products].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  prodSelect.innerHTML = `<option value="">Seleccione un producto...</option>` +
    sortedProds.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");

  const amountInput = document.getElementById("reserva-amount");
  amountInput.value = "";
  // Remover y volver a adjuntar formato al input de abono
  const freshAmount = amountInput.cloneNode(true);
  amountInput.parentNode.replaceChild(freshAmount, amountInput);
  attachPriceInputFormat(freshAmount);

  const idInput = document.getElementById("reserva-id");
  idInput.value = "";
  const freshId = idInput.cloneNode(true);
  idInput.parentNode.replaceChild(freshId, idInput);
  attachIdCardInputFormat(freshId);

  const phoneInput = document.getElementById("reserva-phone");
  phoneInput.value = "";
  const freshPhone = phoneInput.cloneNode(true);
  phoneInput.parentNode.replaceChild(freshPhone, phoneInput);
  attachPhoneInputFormat(freshPhone);

  // Resetear y ocultar campos condicionales
  const condGroup = document.getElementById("group-reserva-conditional");
  const bankGroup = document.getElementById("group-reserva-bank");
  const otherGroup = document.getElementById("group-reserva-other-method");
  
  if (condGroup) condGroup.classList.add("hidden");
  if (bankGroup) bankGroup.classList.add("hidden");
  if (otherGroup) otherGroup.classList.add("hidden");

  const bankInput = document.getElementById("reserva-bank");
  if (bankInput) {
    bankInput.value = "";
    bankInput.required = false;
  }
  const otherInput = document.getElementById("reserva-other-method");
  if (otherInput) {
    otherInput.value = "";
    otherInput.required = false;
  }

  const methodInput = document.getElementById("reserva-payment-method");
  if (methodInput) {
    methodInput.value = "";
    const freshMethod = methodInput.cloneNode(true);
    methodInput.parentNode.replaceChild(freshMethod, methodInput);
    
    // Escuchar cambios para mostrar campos condicionales
    freshMethod.addEventListener("change", function() {
      const val = this.value;
      const cGroup = document.getElementById("group-reserva-conditional");
      const bGroup = document.getElementById("group-reserva-bank");
      const oGroup = document.getElementById("group-reserva-other-method");
      
      const bInput = document.getElementById("reserva-bank");
      const oInput = document.getElementById("reserva-other-method");
      
      if (val === "Transferencia") {
        if (cGroup) cGroup.classList.remove("hidden");
        if (bGroup) bGroup.classList.remove("hidden");
        if (oGroup) oGroup.classList.add("hidden");
        
        if (bInput) bInput.required = true;
        if (oInput) {
          oInput.required = false;
          oInput.value = "";
        }
      } else if (val === "Otro") {
        if (cGroup) cGroup.classList.remove("hidden");
        if (bGroup) bGroup.classList.add("hidden");
        if (oGroup) oGroup.classList.remove("hidden");
        
        if (bInput) {
          bInput.required = false;
          bInput.value = "";
        }
        if (oInput) oInput.required = true;
      } else {
        if (cGroup) cGroup.classList.add("hidden");
        if (bGroup) bGroup.classList.add("hidden");
        if (oGroup) oGroup.classList.add("hidden");
        
        if (bInput) {
          bInput.required = false;
          bInput.value = "";
        }
        if (oInput) {
          oInput.required = false;
          oInput.value = "";
        }
      }
    });
  }

  const fileInput = document.getElementById("reserva-receipt");
  if (fileInput) fileInput.value = "";

  renderReservasTable();
}

function renderReservasTable() {
  const tbody = document.querySelector("#table-reservas-active tbody");
  tbody.innerHTML = "";

  const activeReservas = State.reservas.filter(r => !r.archived);

  activeReservas.forEach((res, index) => {
    const tr = document.createElement("tr");
    
    // Obtener detalles del producto
    const p = State.products.find(prod => prod.sku === res.sku);
    const prodName = p ? `${p.sku} - ${p.name}` : res.sku;

    tr.innerHTML = `
      <td>${res.name}</td>
      <td>${res.idCard}</td>
      <td>${res.phone}</td>
      <td>${prodName}</td>
      <td class="text-bold">${formatCurrency(res.amount)}</td>
      <td>${res.paymentMethod || '-'}</td>
      <td>
        ${res.receipt ? `<button class="btn btn-secondary btn-sm btn-view-receipt" data-idx="${State.reservas.indexOf(res)}"><i data-lucide="image"></i> Ver Soporte</button>` : '-'}
      </td>
      <td>
        <div class="btn-group-row" style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm btn-ship-reserva" data-idx="${State.reservas.indexOf(res)}">
            <i data-lucide="check"></i> Pagada
          </button>
          <button class="btn btn-danger btn-sm btn-cancel-reserva" data-idx="${State.reservas.indexOf(res)}">
            <i data-lucide="x"></i> Cancelar
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Listener para el botón "Pagada"
  document.querySelectorAll(".btn-ship-reserva").forEach(btn => {
    btn.onclick = function() {
      const idx = this.getAttribute("data-idx");
      openReservaShipModal(idx);
    };
  });

  // Listener para el botón "Ver Soporte"
  document.querySelectorAll(".btn-view-receipt").forEach(btn => {
    btn.onclick = function() {
      const idx = parseInt(this.getAttribute("data-idx"));
      viewReservaReceipt(idx);
    };
  });

  // Listener para el botón "Cancelar"
  document.querySelectorAll(".btn-cancel-reserva").forEach(btn => {
    btn.onclick = function() {
      const idx = parseInt(this.getAttribute("data-idx"));
      openReservaCancelModal(idx);
    };
  });

  lucide.createIcons();
}

function viewReservaReceipt(index) {
  const res = State.reservas[index];
  if (!res || !res.receipt) return;
  
  const modal = document.getElementById("modal-container");
  const title = document.getElementById("modal-title");
  const content = document.getElementById("modal-content");
  
  title.innerText = `Soporte de Pago - ${res.name}`;
  content.innerHTML = `
    <div class="text-center" style="padding: 10px;">
      <img src="${res.receipt}" alt="Soporte de reserva" style="max-width: 100%; max-height: 60vh; border-radius: var(--radius-sm); border: 1px solid var(--border-color); object-fit: contain;">
    </div>
  `;
  
  modal.classList.remove("hidden");
  
  // Close handler
  document.getElementById("btn-close-modal").onclick = function() {
    modal.classList.add("hidden");
  };
}

function openReservaCancelModal(index) {
  const modal = document.getElementById("modal-reserva-cancel");
  document.getElementById("reserva-cancel-idx").value = index;
  
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("reserva-cancel-date").value = today;
  document.getElementById("reserva-cancel-reason").value = "";
  document.getElementById("reserva-cancel-refund").value = "";

  modal.classList.remove("hidden");
  lucide.createIcons();
}

function openReservaShipModal(index) {
  const modal = document.getElementById("modal-reserva-ship");
  document.getElementById("reserva-ship-idx").value = index;
  
  // Set default date to today
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("reserva-ship-date").value = today;
  document.getElementById("reserva-ship-invoice").value = "";
  document.getElementById("reserva-ship-pay-method").value = "";
  document.getElementById("reserva-ship-pay-amount").value = "";

  const res = State.reservas[index];
  const p = State.products.find(prod => prod.sku === res?.sku);
  const isMe = p && p.category === "ME";

  const labelEl = document.querySelector("label[for='reserva-ship-ean']");
  if (labelEl) {
    labelEl.textContent = isMe ? "Serial Único" : "Bodega de Origen (Deducir Stock)";
  }

  const serialSelect = document.getElementById("reserva-ship-ean");
  serialSelect.innerHTML = isMe ? '<option value="">Seleccione el serial...</option>' : '<option value="">Seleccione bodega...</option>';
  
  if (res && res.sku) {
    if (isMe) {
      let allSerials = [];
      State.warehouses.forEach(w => {
        allSerials = allSerials.concat(getAvailableSerials(res.sku, w));
      });
      allSerials = [...new Set(allSerials)];
      allSerials.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        serialSelect.appendChild(opt);
      });
    } else {
      const stockData = getInventoryStock();
      State.warehouses.forEach(w => {
        const qty = stockData[res.sku]?.[w] || 0;
        if (qty > 0) {
          const opt = document.createElement("option");
          opt.value = w;
          opt.textContent = `${w} (Stock: ${qty} uds)`;
          serialSelect.appendChild(opt);
        }
      });
    }
  }

  modal.classList.remove("hidden");
  lucide.createIcons();
}

// Inicializar una vez los eventos del formulario y del modal de Reservas
(function registerReservasEvents() {
  attachPriceInputFormat(document.getElementById("reserva-amount"));
  attachPriceInputFormat(document.getElementById("reserva-ship-pay-amount"));

  // Submit crear reserva
  document.getElementById("form-create-reserva").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("reserva-name").value.trim();
    const idCard = document.getElementById("reserva-id").value.trim();
    const phone = document.getElementById("reserva-phone").value.trim();
    const sku = document.getElementById("reserva-product-select").value;
    const amountVal = document.getElementById("reserva-amount").value;
    const amount = parsePriceInput(amountVal);
    const paymentMethod = document.getElementById("reserva-payment-method").value;
    const bankVal = document.getElementById("reserva-bank").value.trim();
    const otherVal = document.getElementById("reserva-other-method").value.trim();
    const receiptFileEl = document.getElementById("reserva-receipt");

    if (!sku) {
      alert("Por favor seleccione un producto.");
      return;
    }
    if (amount <= 0) {
      alert("Por favor ingrese un abono mayor a 0.");
      return;
    }
    if (phone.length !== 10) {
      alert("El teléfono debe tener exactamente 10 dígitos.");
      return;
    }
    if (!paymentMethod) {
      alert("Por favor seleccione un medio de pago.");
      return;
    }
    if (paymentMethod === "Transferencia" && !bankVal) {
      alert("Por favor indique el banco para la transferencia.");
      return;
    }
    if (paymentMethod === "Otro" && !otherVal) {
      alert("Por favor especifique el medio de pago.");
      return;
    }

    let receiptBase64 = "";
    if (receiptFileEl.files.length > 0) {
      const file = receiptFileEl.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert("El soporte excede el tamaño máximo permitido de 10MB.");
        return;
      }
      if (!file.type.startsWith("image/")) {
        alert("El archivo soporte debe ser una imagen.");
        return;
      }
      try {
        receiptBase64 = await compressImageToBase64(file);
      } catch (err) {
        console.error("Error al procesar la imagen:", err);
        alert("Ocurrió un error al procesar la imagen de soporte.");
        return;
      }
    }

    let finalPaymentMethod = paymentMethod;
    if (paymentMethod === "Transferencia") {
      finalPaymentMethod = `Transferencia (${bankVal})`;
    } else if (paymentMethod === "Otro") {
      finalPaymentMethod = `Otro (${otherVal})`;
    }

    const id = `RES-${String(State.reservas.length + 1).padStart(4, "0")}`;
    const date = new Date().toISOString().split("T")[0];
    State.reservas.push({ 
      id, 
      date, 
      name, 
      idCard, 
      phone, 
      sku, 
      amount, 
      paymentMethod: finalPaymentMethod, 
      receipt: receiptBase64, 
      archived: false 
    });
    State.save();
    
    // Resetear formulario
    document.getElementById("form-create-reserva").reset();
    initReservasModule();
    alert("✅ Reserva registrada con éxito.");
  });

  // Cerrar modal
  document.getElementById("btn-close-reserva-modal").onclick = function() {
    document.getElementById("modal-reserva-ship").classList.add("hidden");
  };

  // Submit procesar envío y archivar
  document.getElementById("form-reserva-ship").addEventListener("submit", (e) => {
    e.preventDefault();
    const idx = parseInt(document.getElementById("reserva-ship-idx").value);
    const date = document.getElementById("reserva-ship-date").value;
    const ean = document.getElementById("reserva-ship-ean").value.trim();
    const invoice = document.getElementById("reserva-ship-invoice").value.trim();
    const payMethod = document.getElementById("reserva-ship-pay-method").value;
    const payAmountVal = document.getElementById("reserva-ship-pay-amount").value;
    const payAmount = parsePriceInput(payAmountVal);

    if (idx >= 0 && idx < State.reservas.length) {
      const res = State.reservas[idx];
      const p = State.products.find(prod => prod.sku === res.sku);
      const isMe = p && p.category === "ME";

      let sourceWarehouse = "";
      let serialsList = [];

      if (isMe) {
        serialsList = [ean];
        // Encontrar en qué bodega está el serial asignado
        for (const w of State.warehouses) {
          if (getAvailableSerials(res.sku, w).includes(ean)) {
            sourceWarehouse = w;
            break;
          }
        }
      } else {
        sourceWarehouse = ean; // En este caso, el valor es el nombre de la bodega elegida
      }

      if (!sourceWarehouse) {
        alert("❌ No se pudo determinar la bodega de origen para descontar el inventario.");
        return;
      }

      res.archived = true;
      res.shipDate = date;
      res.shipEan = isMe ? ean : (p ? p.barcode : "");
      res.shipInvoice = invoice;
      res.shipPayMethod = payMethod;
      res.shipPayAmount = payAmount;

      // Crear transacción de salida (SAL) para descontar stock
      const folioNum = String(State.salidas.length + 1).padStart(4, "0");
      const salidaId = `SAL-${folioNum}`;
      
      const clientStr = `Nombre: ${res.name.toUpperCase()} | Cédula: ${res.idCard} | Contacto: ${res.phone}`;
      
      State.salidas.push({
        id: salidaId,
        date: date,
        warehouse: sourceWarehouse,
        pve: "Reserva",
        items: [{
          sku: res.sku,
          name: p ? p.name : res.sku,
          category: p ? p.category : "",
          qty: 1,
          price: res.amount + payAmount,
          warehouse: sourceWarehouse,
          serials: serialsList
        }],
        client: clientStr,
        carrier: "Envío Reserva",
        carrierGuide: "",
        shippingCost: 0,
        seller: "Sistema Reservas",
        channel: "Reservas",
        mastershop: "No",
        facturaElectronica: "No",
        ean: isMe ? ean : (p ? p.barcode : ""),
        notes: `Despacho de Reserva ${res.id}. Factura: ${invoice}`
      });

      State.save();
      document.getElementById("modal-reserva-ship").classList.add("hidden");
      renderReservasTable();
      updateSummaryWidget();
      alert(`✅ Reserva archivada y Salida ${salidaId} generada con éxito.`);
    }
  });

  // Close handlers
  document.getElementById("btn-close-reserva-modal").addEventListener("click", () => {
    document.getElementById("modal-reserva-ship").classList.add("hidden");
  });
  document.getElementById("btn-close-reserva-cancel-modal").addEventListener("click", () => {
    document.getElementById("modal-reserva-cancel").classList.add("hidden");
  });

  // Submit cancelar reserva
  document.getElementById("form-reserva-cancel").addEventListener("submit", (e) => {
    e.preventDefault();
    const idx = parseInt(document.getElementById("reserva-cancel-idx").value);
    const date = document.getElementById("reserva-cancel-date").value;
    const reason = document.getElementById("reserva-cancel-reason").value.trim().toUpperCase();
    const refund = document.getElementById("reserva-cancel-refund").value.trim().toUpperCase();

    if (idx >= 0 && idx < State.reservas.length) {
      const res = State.reservas[idx];
      res.archived = true;
      res.status = "Cancelada";
      res.cancelDate = date;
      res.cancelReason = reason;
      res.cancelRefund = refund;

      State.save();
      document.getElementById("modal-reserva-cancel").classList.add("hidden");
      renderReservasTable();
      alert("✅ Reserva cancelada correctamente.");
    }
  });
})();


function renderBackupsTable() {
  const tbody = document.querySelector("#table-backups-log tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (State.backupsLog.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay registros de backups ejecutados.</td></tr>`;
    return;
  }

  // Ordenar por fecha descendente
  const sortedLog = [...State.backupsLog].sort((a, b) => new Date(b.date.replace(" ", "T")) - new Date(a.date.replace(" ", "T")));

  sortedLog.forEach(log => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="font-sm">${log.date}</span></td>
      <td><span class="badge badge-teal">${log.frequency}</span></td>
      <td><span class="font-sm" title="${log.emails}">${log.emails.length > 25 ? log.emails.substr(0, 25) + '...' : log.emails}</span></td>
      <td><span class="badge badge-success"><i data-lucide="check" style="width: 10px; height: 10px; vertical-align: middle; margin-right: 2px;"></i> ${log.status}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm btn-download-backup" data-filename="${log.filename}">
          <i data-lucide="download"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-download-backup").forEach(btn => {
    btn.onclick = function() {
      downloadSystemBackup(this.getAttribute("data-filename"));
    };
  });
  lucide.createIcons();
}

function downloadSystemBackup(filename) {
  const cleanState = {
    users: State.users,
    products: State.products,
    warehouses: State.warehouses,
    carriers: State.carriers,
    sellers: State.sellers,
    pve: State.pve,
    backup: State.backup,
    ingresos: State.ingresos,
    salidas: State.salidas,
    traslados: State.traslados,
    reservas: State.reservas,
    garantias: State.garantias,
    pedidosAccesorios: State.pedidosAccesorios
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href",     dataStr);
  downloadAnchor.setAttribute("download", filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// ==========================================================================
// MÓDULO DE GESTIÓN DE GARANTÍAS
// ==========================================================================

let tempGarantiaMePieces = [];

function initGarantiasModule() {
  const today = new Date().toISOString().split("T")[0];
  
  tempGarantiaMePieces = [];
  
  const tymFechaVenta = document.getElementById("garantia-tym-fecha-venta");
  const tymFechaIngreso = document.getElementById("garantia-tym-fecha-ingreso");
  const tymFechaEntrega = document.getElementById("garantia-tym-fecha-entrega");
  const meFechaVenta = document.getElementById("garantia-me-fecha-venta");
  const meFechaIngreso = document.getElementById("garantia-me-fecha-ingreso");
  const meFechaEntrega = document.getElementById("garantia-me-fecha-entrega");

  if (tymFechaVenta) tymFechaVenta.value = "";
  if (tymFechaIngreso) tymFechaIngreso.value = today;
  if (tymFechaEntrega) tymFechaEntrega.value = "";
  if (meFechaVenta) meFechaVenta.value = "";
  if (meFechaIngreso) meFechaIngreso.value = today;
  if (meFechaEntrega) meFechaEntrega.value = "";

  // Reset switches and conditional blocks
  const tymAplica = document.getElementById("garantia-tym-aplica");
  if (tymAplica) {
    tymAplica.checked = false;
    const condDiv = document.getElementById("garantia-tym-cond-proveedor");
    if (condDiv) condDiv.classList.add("hidden");
  }
  const tymProveedor = document.getElementById("garantia-tym-proveedor");
  if (tymProveedor) tymProveedor.checked = false;

  const meAplica = document.getElementById("garantia-me-aplica");
  if (meAplica) {
    meAplica.checked = false;
    const condDiv = document.getElementById("garantia-me-cond-proveedor");
    if (condDiv) condDiv.classList.add("hidden");
  }
  const meProveedor = document.getElementById("garantia-me-proveedor");
  if (meProveedor) meProveedor.checked = false;

  const meObservaciones = document.getElementById("garantia-me-observaciones");
  if (meObservaciones) meObservaciones.value = "";

  // Populate product dropdowns
  const tymProductSelect = document.getElementById("garantia-tym-producto");
  if (tymProductSelect) {
    const tymProds = State.products
      .filter(p => p.category === "T&M")
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    tymProductSelect.innerHTML = '<option value="">Seleccione un producto...</option>' +
      tymProds.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");
  }

  const meProductSelect = document.getElementById("garantia-me-producto");
  if (meProductSelect) {
    const meProds = State.products
      .filter(p => p.category === "ME")
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    meProductSelect.innerHTML = '<option value="">Seleccione un producto...</option>' +
      meProds.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");
  }

  // Populate defective pieces dropdown (Accesorios ME)
  const mePiezaSelect = document.getElementById("garantia-me-pieza-select");
  if (mePiezaSelect) {
    const accProds = State.products
      .filter(p => p.category === "Accesorios ME")
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    mePiezaSelect.innerHTML = '<option value="">Seleccione una pieza...</option>' +
      accProds.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");
  }

  // Reset file inputs
  const tymFile = document.getElementById("garantia-tym-evidencia");
  const meFile = document.getElementById("garantia-me-evidencia");
  if (tymFile) tymFile.value = "";
  if (meFile) meFile.value = "";

  // Reset tab selection to show placeholder and hide forms
  const btnTym = document.getElementById("btn-tab-tym");
  const btnMe = document.getElementById("btn-tab-me");
  if (btnTym) btnTym.classList.remove("active");
  if (btnMe) btnMe.classList.remove("active");

  const panelTym = document.getElementById("panel-garantia-tym");
  const panelMe = document.getElementById("panel-garantia-me");
  if (panelTym) panelTym.classList.remove("active");
  if (panelMe) panelMe.classList.remove("active");

  const placeholder = document.getElementById("panel-garantia-placeholder");
  if (placeholder) placeholder.classList.remove("hidden");

  renderTempGarantiaMePiecesTable();
  renderGarantiasTable();
}

function renderTempGarantiaMePiecesTable() {
  const tbody = document.querySelector("#table-temp-garantia-me-pieces tbody");
  const emptyState = document.getElementById("temp-garantia-me-pieces-empty");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (tempGarantiaMePieces.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  tempGarantiaMePieces.forEach((item, index) => {
    const tr = document.createElement("tr");

    const p = State.products.find(prod => prod.sku === item.pieceSku);
    const label = p ? `${p.sku} - ${p.name}` : item.pieceSku;

    const aplicaText = item.aplica === "Si" ? "Sí" : "No";
    const proveedorText = item.aplica === "Si" ? (item.proveedor === "Si" ? "Sí" : "No") : "-";
    const obsText = item.observaciones || "-";
    const displayObs = obsText.length > 25 ? obsText.substring(0, 25) + "..." : obsText;

    tr.innerHTML = `
      <td><span class="font-sm" title="${label}">${label.length > 30 ? label.substr(0, 30) + '...' : label}</span></td>
      <td style="text-align: center;">${aplicaText}</td>
      <td style="text-align: center;">${proveedorText}</td>
      <td><span class="font-sm" title="${obsText}">${displayObs}</span></td>
      <td style="text-align: center;">
        <button type="button" class="btn btn-danger btn-sm btn-remove-temp-me-piece" data-idx="${index}" style="padding: 2px 6px;">
          <i data-lucide="minus-circle" style="width: 12px; height: 12px;"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind removal
  document.querySelectorAll(".btn-remove-temp-me-piece").forEach(btn => {
    btn.onclick = function() {
      const idx = parseInt(this.getAttribute("data-idx"));
      tempGarantiaMePieces.splice(idx, 1);
      renderTempGarantiaMePiecesTable();
    };
  });

  lucide.createIcons();
}

async function saveGarantia(type, formData, fileInputId) {
  const fileInput = document.getElementById(fileInputId);
  
  const proceedSave = (evidenceData) => {
    let maxNum = 0;
    State.garantias.forEach(g => {
      if (g.id && g.id.startsWith("GAR-")) {
        const num = parseInt(g.id.replace("GAR-", ""));
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const id = `GAR-${String(maxNum + 1).padStart(4, "0")}`;
    
    const record = {
      id,
      type,
      ...formData,
      evidence: evidenceData
    };
    
    State.garantias.push(record);
    State.save();
    
    // Reset form
    const formId = type === 'tym' ? 'form-garantia-tym' : 'form-garantia-me';
    document.getElementById(formId).reset();
    
    // Hide conditional groups
    const condId = type === 'tym' ? 'garantia-tym-cond-proveedor' : 'garantia-me-cond-proveedor';
    document.getElementById(condId).classList.add('hidden');
    
    initGarantiasModule();
    alert(`✅ Garantía ${id} registrada con éxito.`);
  };

  if (fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    if (file.size > 10 * 1024 * 1024) {
      alert("❌ El archivo es demasiado grande. El tamaño máximo permitido es 10MB.");
      return;
    }
    
    if (file.type.startsWith("image/")) {
      try {
        const compressedBase64 = await compressImageToBase64(file);
        proceedSave({
          name: file.name,
          type: file.type,
          data: compressedBase64
        });
      } catch (error) {
        console.error("Error al procesar la imagen de evidencia:", error);
        alert("❌ Error al procesar la imagen de evidencia.");
      }
    } else {
      const reader = new FileReader();
      reader.onload = function(e) {
        proceedSave({
          name: file.name,
          type: file.type,
          data: e.target.result
        });
      };
      reader.onerror = function() {
        alert("❌ Error al leer el archivo de evidencia.");
      };
      reader.readAsDataURL(file);
    }
  } else {
    proceedSave(null);
  }
}

function downloadEvidencia(base64Data, filename) {
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", base64Data);
  downloadAnchor.setAttribute("download", filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function renderGarantiasTable() {
  const tbody = document.querySelector("#table-garantias tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (State.garantias.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay registros de garantías.</td></tr>`;
    return;
  }

  State.garantias.forEach(gar => {
    const tr = document.createElement("tr");
    
    const p = State.products.find(prod => prod.sku === gar.sku);
    const prodLabel = p ? `${p.sku} - ${p.name}` : gar.sku;

    const aplicaBadge = gar.aplica === "Si" 
      ? '<span class="badge badge-success">Sí</span>' 
      : '<span class="badge badge-danger">No</span>';

    const provLabel = gar.aplica === "Si"
      ? (gar.proveedor === "Si" ? "Sí" : "No")
      : "-";

    let evidenceBtn = "-";
    if (gar.evidence) {
      evidenceBtn = `
        <button class="btn btn-secondary btn-sm btn-download-gar-evidencia" data-id="${gar.id}" title="Descargar Evidencia">
          <i data-lucide="download" style="width: 12px; height: 12px;"></i>
        </button>
      `;
    }

    tr.innerHTML = `
      <td><span class="text-bold">${gar.id}</span></td>
      <td><span class="font-sm" title="${prodLabel}">${prodLabel.length > 30 ? prodLabel.substr(0, 30) + '...' : prodLabel}</span></td>
      <td>${gar.fechaIngreso}</td>
      <td>${aplicaBadge}</td>
      <td>${provLabel}</td>
      <td class="text-center">${evidenceBtn}</td>
      <td>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-primary btn-sm btn-view-garantia" data-id="${gar.id}">
            <i data-lucide="eye" style="width: 12px; height: 12px;"></i> Ver
          </button>
          <button class="btn btn-danger btn-sm btn-delete-garantia" data-id="${gar.id}">
            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind downloads
  document.querySelectorAll(".btn-download-gar-evidencia").forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute("data-id");
      const gar = State.garantias.find(g => g.id === id);
      if (gar && gar.evidence) {
        downloadEvidencia(gar.evidence.data, gar.evidence.name);
      }
    };
  });

  // Bind view detail
  document.querySelectorAll(".btn-view-garantia").forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute("data-id");
      openGarantiaDetailModal(id);
    };
  });

  // Bind delete
  document.querySelectorAll(".btn-delete-garantia").forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute("data-id");
      if (confirm(`¿Está seguro de eliminar el registro de garantía ${id}?`)) {
        State.garantias = State.garantias.filter(g => g.id !== id);
        State.save();
        renderGarantiasTable();
      }
    };
  });

  lucide.createIcons();
}

function openGarantiaDetailModal(id) {
  const gar = State.garantias.find(g => g.id === id);
  if (!gar) return;

  const modal = document.getElementById("modal-container");
  const modalTitle = document.getElementById("modal-title");
  const modalContent = document.getElementById("modal-content");

  modalTitle.textContent = `Detalles de Garantía: ${gar.id}`;
  
  const p = State.products.find(prod => prod.sku === gar.sku);
  const prodLabel = p ? `${p.sku} - ${p.name}` : gar.sku;

  let detailsHTML = "";
  
  if (gar.type === "me") {
    let piecesRows = `<tr><td colspan="4" class="text-center text-muted" style="padding: 10px;">Sin piezas registradas</td></tr>`;
    if (gar.pieces && gar.pieces.length > 0) {
      piecesRows = gar.pieces.map(item => {
        const prod = State.products.find(p => p.sku === (item.pieceSku || item));
        const name = prod ? `${prod.sku} - ${prod.name}` : (item.pieceSku || item);
        
        // Handle cases where item might be a legacy string SKU
        const aplicaText = (item && item.aplica) ? (item.aplica === "Si" ? "Sí" : "No") : (gar.aplica === "Si" ? "Sí" : "No");
        const proveedorText = (item && item.aplica) ? (item.aplica === "Si" ? (item.proveedor === "Si" ? "Sí" : "No") : "-") : (gar.aplica === "Si" ? (gar.proveedor === "Si" ? "Sí" : "No") : "-");
        const obs = (item && item.observaciones) ? item.observaciones : (gar.observaciones || "Ninguna");

        return `
          <tr>
            <td style="padding: 6px 8px;"><span class="font-sm" title="${name}">${name}</span></td>
            <td style="text-align: center; padding: 6px 8px;">${aplicaText}</td>
            <td style="text-align: center; padding: 6px 8px;">${proveedorText}</td>
            <td style="padding: 6px 8px;"><span class="font-sm">${obs}</span></td>
          </tr>
        `;
      }).join("");
    }

    detailsHTML = `
      <div class="modal-detail-item"><span class="label">Cliente</span><span class="value">${gar.clienteName || '-'}</span></div>
      <div class="modal-detail-item"><span class="label">Cédula</span><span class="value">${gar.clienteCedula || '-'}</span></div>
      <div class="modal-detail-item"><span class="label">Teléfono</span><span class="value">${gar.clienteTelefono || '-'}</span></div>
      <div class="modal-detail-item" style="opacity: 0;"></div> <!-- Alineación -->
      
      <div style="grid-column: span 2; margin-top: 8px;">
        <span class="label" style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Piezas con Novedad</span>
        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 180px; overflow-y: auto; margin-top: 6px;">
          <table class="table table-striped" style="font-size: 0.8rem; margin-bottom: 0;">
            <thead>
              <tr>
                <th style="padding: 6px 8px;">Pieza</th>
                <th style="width: 80px; text-align: center; padding: 6px 8px;">¿Aplica?</th>
                <th style="width: 100px; text-align: center; padding: 6px 8px;">Proveedor</th>
                <th style="padding: 6px 8px;">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${piecesRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else {
    detailsHTML = `
      <div class="modal-detail-item"><span class="label">¿Aplica Garantía?</span><span class="value">${gar.aplica === 'Si' ? 'Sí' : 'No'}</span></div>
      <div class="modal-detail-item"><span class="label">¿Solicita Pieza a Proveedor?</span><span class="value">${gar.aplica === 'Si' ? (gar.proveedor === 'Si' ? 'Sí' : 'No') : '-'}</span></div>
      <div class="modal-detail-item" style="grid-column: span 2;"><span class="label">Observaciones</span><span class="value">${gar.observaciones || 'Ninguna'}</span></div>
    `;
  }

  let evidenceHTML = `
    <div class="modal-detail-item" style="grid-column: span 2;">
      <span class="label">Evidencia Digital</span>
      <span class="value">Sin evidencia adjunta</span>
    </div>
  `;

  if (gar.evidence) {
    evidenceHTML = `
      <div class="modal-detail-item" style="grid-column: span 2;">
        <span class="label">Evidencia Digital</span>
        <span class="value">
          <button class="btn btn-secondary btn-sm" id="btn-modal-download-evidencia" style="display: inline-flex; align-items: center; gap: 6px;">
            <i data-lucide="download" style="width: 14px; height: 14px;"></i> Descargar (${gar.evidence.name})
          </button>
        </span>
      </div>
    `;
  }

  modalContent.innerHTML = `
    <div class="modal-detail-grid">
      <div class="modal-detail-item"><span class="label">Tipo Formulario</span><span class="value">${gar.type === 'tym' ? 'T&M' : 'ME'}</span></div>
      <div class="modal-detail-item"><span class="label">Producto</span><span class="value">${prodLabel}</span></div>
      <div class="modal-detail-item"><span class="label">EAN</span><span class="value">${gar.ean}</span></div>
      <div class="modal-detail-item"><span class="label">Fecha Venta</span><span class="value">${gar.fechaVenta}</span></div>
      <div class="modal-detail-item"><span class="label">Fecha Ingreso</span><span class="value">${gar.fechaIngreso}</span></div>
      <div class="modal-detail-item"><span class="label">Fecha Entrega</span><span class="value">${gar.fechaEntrega || '-'}</span></div>
      ${detailsHTML}
      ${evidenceHTML}
    </div>
  `;

  if (gar.evidence) {
    document.getElementById("btn-modal-download-evidencia").onclick = function() {
      downloadEvidencia(gar.evidence.data, gar.evidence.name);
    };
  }

  modal.classList.remove("hidden");
  lucide.createIcons();
}

// ==========================================================================
// MÓDULO SOLICITUD DE PEDIDOS (ACCESORIOS)
// ==========================================================================

let tempPedidoItems = [];

function initPedidosAccesoriosModule() {
  tempPedidoItems = [];

  const accSelect = document.getElementById("pedido-accesorio");
  if (accSelect) {
    const accProds = State.products
      .filter(p => p.category === "Accesorios ME")
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    accSelect.innerHTML = '<option value="">Seleccione un accesorio...</option>' +
      accProds.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");
  }

  const prodSelect = document.getElementById("pedido-producto-garantia");
  if (prodSelect) {
    const relProds = State.products
      .filter(p => p.category === "ME" || p.category === "Accesorios ME")
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    prodSelect.innerHTML = '<option value="">Seleccione un producto...</option>' +
      relProds.map(p => `<option value="${p.sku}">${p.name}</option>`).join("");
  }

  // Reset inputs
  const qtyInput = document.getElementById("pedido-cantidad");
  if (qtyInput) qtyInput.value = "1";

  const esGarantiaCheck = document.getElementById("pedido-es-garantia");
  if (esGarantiaCheck) esGarantiaCheck.checked = false;

  const form = document.getElementById("form-pedido-accesorios");
  if (form) form.reset();

  // Hide conditional blocks
  const condGar = document.getElementById("pedido-cond-garantia");
  const condLlego = document.getElementById("pedido-cond-llego");
  if (condGar) condGar.classList.add("hidden");
  if (condLlego) condLlego.classList.add("hidden");

  renderTempPedidoItemsTable();
  renderPedidosAccesoriosTable();
}

function renderTempPedidoItemsTable() {
  const tbody = document.querySelector("#table-temp-pedido-items tbody");
  const emptyState = document.getElementById("temp-pedido-empty-state");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (tempPedidoItems.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  tempPedidoItems.forEach((item, index) => {
    const tr = document.createElement("tr");

    const acc = State.products.find(p => p.sku === item.accesorioSku);
    const accLabel = acc ? `${acc.sku} - ${acc.name}` : item.accesorioSku;

    let garText = "No";
    if (item.esGarantia) {
      const rel = State.products.find(p => p.sku === item.garantiasSku);
      garText = `Sí (${rel ? rel.sku : item.garantiasSku})`;
    }

    tr.innerHTML = `
      <td><span class="font-sm" title="${accLabel}">${accLabel.length > 25 ? accLabel.substr(0, 25) + '...' : accLabel}</span></td>
      <td>${item.qty}</td>
      <td><span class="badge ${item.esGarantia ? 'badge-teal' : 'badge-secondary'}">${garText}</span></td>
      <td style="text-align: center;">
        <button type="button" class="btn btn-danger btn-sm btn-remove-temp-pedido-item" data-idx="${index}" style="padding: 2px 6px;">
          <i data-lucide="minus-circle" style="width: 12px; height: 12px;"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind removal
  document.querySelectorAll(".btn-remove-temp-pedido-item").forEach(btn => {
    btn.onclick = function() {
      const idx = parseInt(this.getAttribute("data-idx"));
      tempPedidoItems.splice(idx, 1);
      renderTempPedidoItemsTable();
    };
  });

  lucide.createIcons();
}

function renderPedidosAccesoriosTable() {
  const tbody = document.querySelector("#table-pedidos-accesorios tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filterPendientes = document.getElementById("filter-pedidos-pendientes").checked;
  let list = State.pedidosAccesorios;
  if (filterPendientes) {
    list = list.filter(p => p.llego === "No");
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay registros de pedidos.</td></tr>`;
    return;
  }

  list.forEach(ped => {
    const tr = document.createElement("tr");

    // Summary of accessories in the list
    const itemsText = (ped.items || []).map(item => {
      const prod = State.products.find(p => p.sku === item.accesorioSku);
      return `${item.qty}x ${prod ? prod.name : item.accesorioSku}`;
    }).join(", ");

    // Any warranty?
    const hasWarranty = (ped.items || []).some(item => item.esGarantia);
    const esGarantiaLabel = hasWarranty
      ? '<span class="badge badge-teal">Sí</span>'
      : '<span class="badge badge-secondary">No</span>';

    const llegoBadge = ped.llego === "Si"
      ? '<span class="badge badge-success">Recibido</span>'
      : '<span class="badge badge-warning">Pendiente</span>';

    const fechaLlegadaLabel = ped.llego === "Si" ? ped.fechaLlegada : "-";

    let receiveBtn = "";
    if (ped.llego === "No") {
      receiveBtn = `
        <button class="btn btn-success btn-sm btn-receive-pedido" data-id="${ped.id}" title="Marcar como Recibido">
          <i data-lucide="check" style="width: 12px; height: 12px;"></i> Recibir
        </button>
      `;
    }

    tr.innerHTML = `
      <td><span class="text-bold">${ped.id}</span></td>
      <td><span class="font-sm" title="${itemsText}">${itemsText.length > 35 ? itemsText.substr(0, 35) + '...' : itemsText}</span></td>
      <td>${esGarantiaLabel}</td>
      <td>${llegoBadge}</td>
      <td>${fechaLlegadaLabel}</td>
      <td>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-primary btn-sm btn-view-pedido" data-id="${ped.id}" title="Ver Detalle">
            <i data-lucide="eye" style="width: 12px; height: 12px;"></i> Ver
          </button>
          ${receiveBtn}
          <button class="btn btn-danger btn-sm btn-delete-pedido" data-id="${ped.id}" title="Eliminar">
            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind view detail
  document.querySelectorAll(".btn-view-pedido").forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute("data-id");
      openPedidoDetailModal(id);
    };
  });

  // Bind receive
  document.querySelectorAll(".btn-receive-pedido").forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute("data-id");
      const ped = State.pedidosAccesorios.find(p => p.id === id);
      if (ped) {
        const today = new Date().toISOString().split("T")[0];
        const dateVal = prompt("Ingrese la fecha de llegada (AAAA-MM-DD):", today);
        if (dateVal !== null) {
          ped.llego = "Si";
          ped.fechaLlegada = dateVal || today;
          State.save();
          renderPedidosAccesoriosTable();
        }
      }
    };
  });

  // Bind delete
  document.querySelectorAll(".btn-delete-pedido").forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute("data-id");
      if (confirm(`¿Está seguro de eliminar la solicitud de pedido ${id}?`)) {
        State.pedidosAccesorios = State.pedidosAccesorios.filter(p => p.id !== id);
        State.save();
        renderPedidosAccesoriosTable();
      }
    };
  });

  lucide.createIcons();
}

function openPedidoDetailModal(id) {
  const ped = State.pedidosAccesorios.find(p => p.id === id);
  if (!ped) return;

  const modal = document.getElementById("modal-container");
  const modalTitle = document.getElementById("modal-title");
  const modalContent = document.getElementById("modal-content");

  modalTitle.textContent = `Detalles de Pedido: ${ped.id}`;

  const headerHTML = `
    <div class="modal-detail-grid">
      <div class="modal-detail-item"><span class="label">Estado</span><span class="value">${ped.llego === 'Si' ? 'Recibido' : 'Pendiente'}</span></div>
      <div class="modal-detail-item"><span class="label">Fecha de Llegada</span><span class="value">${ped.llego === 'Si' ? ped.fechaLlegada : '-'}</span></div>
    </div>
  `;

  let tableRows = "";
  (ped.items || []).forEach((item, index) => {
    const acc = State.products.find(p => p.sku === item.accesorioSku);
    const accLabel = acc ? `${acc.sku} - ${acc.name}` : item.accesorioSku;

    let garHTML = "No";
    if (item.esGarantia) {
      const rel = State.products.find(p => p.sku === item.garantiasSku);
      const relLabel = rel ? `${rel.sku} - ${rel.name}` : item.garantiasSku;
      garHTML = `Sí<br><small class="text-muted">Relacionado: ${relLabel}<br>EAN: ${item.garantiasEan}</small>`;
    }

    tableRows += `
      <tr>
        <td>${index + 1}</td>
        <td><span class="text-bold">${item.accesorioSku}</span><br><small class="text-muted">${acc ? acc.name : ''}</small></td>
        <td>${item.qty} uds</td>
        <td>${garHTML}</td>
      </tr>
    `;
  });

  modalContent.innerHTML = `
    ${headerHTML}
    <div class="table-responsive mt-3">
      <table class="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Accesorio</th>
            <th>Cantidad</th>
            <th>Garantía</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;

  modal.classList.remove("hidden");
  lucide.createIcons();
}

// REGISTRO DE EVENTOS PARA LOS NUEVOS MÓDULOS
(function registerNuevosModulosEvents() {
  // Tabs en garantías
  const btnTym = document.getElementById("btn-tab-tym");
  const btnMe = document.getElementById("btn-tab-me");
  if (btnTym && btnMe) {
    btnTym.onclick = function() {
      btnTym.classList.add("active");
      btnMe.classList.remove("active");
      document.getElementById("panel-garantia-tym").classList.add("active");
      document.getElementById("panel-garantia-me").classList.remove("active");
      const placeholder = document.getElementById("panel-garantia-placeholder");
      if (placeholder) placeholder.classList.add("hidden");
    };
    btnMe.onclick = function() {
      btnMe.classList.add("active");
      btnTym.classList.remove("active");
      document.getElementById("panel-garantia-me").classList.add("active");
      document.getElementById("panel-garantia-tym").classList.remove("active");
      const placeholder = document.getElementById("panel-garantia-placeholder");
      if (placeholder) placeholder.classList.add("hidden");
    };
  }

  // Afectación de aplica garantía
  const tymAplica = document.getElementById("garantia-tym-aplica");
  if (tymAplica) {
    tymAplica.onchange = function() {
      const condDiv = document.getElementById("garantia-tym-cond-proveedor");
      const provSelect = document.getElementById("garantia-tym-proveedor");
      if (this.checked) {
        condDiv.classList.remove("hidden");
      } else {
        condDiv.classList.add("hidden");
        if (provSelect) provSelect.checked = false;
      }
    };
  }

  const meAplica = document.getElementById("garantia-me-aplica");
  if (meAplica) {
    meAplica.onchange = function() {
      const condDiv = document.getElementById("garantia-me-cond-proveedor");
      const provSelect = document.getElementById("garantia-me-proveedor");
      if (this.checked) {
        condDiv.classList.remove("hidden");
      } else {
        condDiv.classList.add("hidden");
        if (provSelect) provSelect.checked = false;
      }
    };
  }

  // Switch de es garantía en pedidos
  const pedidoEsGarantia = document.getElementById("pedido-es-garantia");
  if (pedidoEsGarantia) {
    pedidoEsGarantia.onchange = function() {
      const condDiv = document.getElementById("pedido-cond-garantia");
      const prodSelect = document.getElementById("pedido-producto-garantia");
      const eanInput = document.getElementById("pedido-ean-garantia");
      if (this.checked) {
        condDiv.classList.remove("hidden");
        prodSelect.setAttribute("required", "required");
        eanInput.setAttribute("required", "required");
      } else {
        condDiv.classList.add("hidden");
        prodSelect.removeAttribute("required");
        prodSelect.value = "";
        eanInput.removeAttribute("required");
        eanInput.value = "";
      }
    };
  }

  // Llegó pedido en pedidos
  const pedidoLlego = document.getElementById("pedido-llego");
  if (pedidoLlego) {
    pedidoLlego.onchange = function() {
      const condDiv = document.getElementById("pedido-cond-llego");
      const dateInput = document.getElementById("pedido-fecha-llegada");
      if (this.value === "Si") {
        condDiv.classList.remove("hidden");
        dateInput.setAttribute("required", "required");
        if (!dateInput.value) {
          dateInput.value = new Date().toISOString().split("T")[0];
        }
      } else {
        condDiv.classList.add("hidden");
        dateInput.removeAttribute("required");
        dateInput.value = "";
      }
    };
  }

  // Submits
  const formTym = document.getElementById("form-garantia-tym");
  if (formTym) {
    formTym.onsubmit = function(e) {
      e.preventDefault();
      const formData = {
        fechaVenta: document.getElementById("garantia-tym-fecha-venta").value,
        fechaIngreso: document.getElementById("garantia-tym-fecha-ingreso").value,
        fechaEntrega: document.getElementById("garantia-tym-fecha-entrega").value,
        ean: document.getElementById("garantia-tym-ean").value.trim(),
        sku: document.getElementById("garantia-tym-producto").value,
        aplica: document.getElementById("garantia-tym-aplica").checked ? "Si" : "No",
        proveedor: (document.getElementById("garantia-tym-aplica").checked && document.getElementById("garantia-tym-proveedor").checked) ? "Si" : "No",
        observaciones: document.getElementById("garantia-tym-observaciones").value.trim()
      };
      saveGarantia("tym", formData, "garantia-tym-evidencia");
    };
  }

  // Botón agregar pieza defectuosa temporal
  const btnAddMePiece = document.getElementById("btn-add-garantia-me-piece");
  if (btnAddMePiece) {
    btnAddMePiece.onclick = function() {
      const select = document.getElementById("garantia-me-pieza-select");
      const sku = select.value;

      if (!sku) {
        alert("Por favor seleccione una pieza.");
        return;
      }

      if (tempGarantiaMePieces.some(item => item.pieceSku === sku)) {
        alert("Esta pieza ya ha sido añadida a la lista.");
        return;
      }

      const aplica = document.getElementById("garantia-me-aplica").checked ? "Si" : "No";
      const proveedor = (aplica === "Si" && document.getElementById("garantia-me-proveedor").checked) ? "Si" : "No";
      const observaciones = document.getElementById("garantia-me-observaciones").value.trim();

      tempGarantiaMePieces.push({
        pieceSku: sku,
        aplica: aplica,
        proveedor: proveedor,
        observaciones: observaciones
      });

      select.value = "";
      document.getElementById("garantia-me-aplica").checked = false;
      document.getElementById("garantia-me-proveedor").checked = false;
      document.getElementById("garantia-me-observaciones").value = "";
      document.getElementById("garantia-me-cond-proveedor").classList.add("hidden");

      renderTempGarantiaMePiecesTable();
    };
  }

  const formMe = document.getElementById("form-garantia-me");
  if (formMe) {
    formMe.onsubmit = function(e) {
      e.preventDefault();
      
      if (tempGarantiaMePieces.length === 0) {
        alert("Por favor añada al menos una pieza con novedad a la garantía.");
        return;
      }

      const hasAplica = tempGarantiaMePieces.some(p => p.aplica === "Si");
      const hasProveedor = tempGarantiaMePieces.some(p => p.proveedor === "Si");
      const combinedObs = tempGarantiaMePieces.map(p => {
        const prod = State.products.find(pr => pr.sku === p.pieceSku);
        const name = prod ? prod.name : p.pieceSku;
        return `[${p.pieceSku} - ${name}] ${p.observaciones || "Sin observaciones"}`;
      }).join("\n");

      const formData = {
        fechaVenta: document.getElementById("garantia-me-fecha-venta").value,
        fechaIngreso: document.getElementById("garantia-me-fecha-ingreso").value,
        fechaEntrega: document.getElementById("garantia-me-fecha-entrega").value,
        ean: document.getElementById("garantia-me-ean").value.trim(),
        sku: document.getElementById("garantia-me-producto").value,
        clienteName: document.getElementById("garantia-me-cliente").value.trim(),
        clienteCedula: document.getElementById("garantia-me-cedula").value.trim(),
        clienteTelefono: document.getElementById("garantia-me-telefono").value.trim(),
        pieces: [...tempGarantiaMePieces],
        aplica: hasAplica ? "Si" : "No",
        proveedor: hasProveedor ? "Si" : "No",
        observaciones: combinedObs
      };
      saveGarantia("me", formData, "garantia-me-evidencia");
    };
  }

  // Botón agregar accesorio temporal
  const btnAddPedidoItem = document.getElementById("btn-add-pedido-item");
  if (btnAddPedidoItem) {
    btnAddPedidoItem.onclick = function() {
      const accSelect = document.getElementById("pedido-accesorio");
      const qtyInput = document.getElementById("pedido-cantidad");
      const esGar = document.getElementById("pedido-es-garantia").checked;
      const relProdSelect = document.getElementById("pedido-producto-garantia");
      const eanInput = document.getElementById("pedido-ean-garantia");

      const sku = accSelect.value;
      const qty = parseInt(qtyInput.value);

      if (!sku) {
        alert("Por favor seleccione un accesorio.");
        return;
      }
      if (isNaN(qty) || qty <= 0) {
        alert("Por favor ingrese una cantidad válida mayor o igual a 1.");
        return;
      }

      if (esGar) {
        if (!relProdSelect.value) {
          alert("Por favor seleccione el producto relacionado a la garantía.");
          return;
        }
        if (!eanInput.value.trim()) {
          alert("Por favor ingrese el EAN de la garantía.");
          return;
        }
      }

      // Add to temp list
      tempPedidoItems.push({
        accesorioSku: sku,
        qty: qty,
        esGarantia: esGar,
        garantiasSku: esGar ? relProdSelect.value : "",
        garantiasEan: esGar ? eanInput.value.trim() : ""
      });

      // Clear accessory inputs
      accSelect.value = "";
      qtyInput.value = "1";
      document.getElementById("pedido-es-garantia").checked = false;
      document.getElementById("pedido-cond-garantia").classList.add("hidden");
      relProdSelect.value = "";
      eanInput.value = "";

      renderTempPedidoItemsTable();
    };
  }

  const formPedido = document.getElementById("form-pedido-accesorios");
  if (formPedido) {
    formPedido.onsubmit = function(e) {
      e.preventDefault();
      
      if (tempPedidoItems.length === 0) {
        alert("Por favor añada al menos un accesorio a la solicitud.");
        return;
      }

      const llego = document.getElementById("pedido-llego").value;
      const fechaLlegada = llego === "Si" ? document.getElementById("pedido-fecha-llegada").value : "";

      if (llego === "Si" && !fechaLlegada) {
        alert("Por favor ingrese la fecha de llegada.");
        return;
      }
      
      let maxNum = 0;
      State.pedidosAccesorios.forEach(p => {
        if (p.id && p.id.startsWith("PAC-")) {
          const num = parseInt(p.id.replace("PAC-", ""));
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      const id = `PAC-${String(maxNum + 1).padStart(4, "0")}`;
      
      const record = {
        id,
        items: [...tempPedidoItems],
        llego,
        fechaLlegada
      };
      
      State.pedidosAccesorios.push(record);
      State.save();
      
      tempPedidoItems = [];
      formPedido.reset();
      document.getElementById("pedido-cond-llego").classList.add("hidden");
      
      initPedidosAccesoriosModule();
      alert(`✅ Pedido ${id} registrado con éxito.`);
    };
  }

  // Filtro
  const filterPendientes = document.getElementById("filter-pedidos-pendientes");
  if (filterPendientes) {
    filterPendientes.onchange = function() {
      renderPedidosAccesoriosTable();
    };
  }
})();

// ==========================================================================
// MÓDULO DE GENERACIÓN DE RÓTULO DE ENVÍO
// ==========================================================================
let selectedLabelType = "T&M";

// Coordenadas relativas en porcentajes (usadas como fallback)
const FIELD_COORDINATES = {
  "T&M": {
    nombre: { left: "18.2%", top: "29.2%", width: "35.5%" },
    cc: { left: "69.1%", top: "29.2%", width: "25.0%" },
    celular: { left: "18.2%", top: "36.2%", width: "21.3%" },
    ciudad: { left: "55.4%", top: "36.2%", width: "38.7%" },
    direccion: { left: "20.9%", top: "43.3%", width: "72.8%" }
  },
  "ME": {
    nombre: { left: "14.5%", top: "28.5%", width: "79.0%" },
    cc: { left: "10.1%", top: "35.5%", width: "30.0%" },
    celular: { left: "51.1%", top: "35.5%", width: "42.0%" },
    ciudad: { left: "13.2%", top: "42.5%", width: "80.0%" },
    direccion: { left: "17.0%", top: "49.5%", width: "76.0%" }
  }
};

function base64ToUint8Array(base64) {
  const raw = atob(base64);
  const rawLength = raw.length;
  const array = new Uint8Array(new ArrayBuffer(rawLength));
  for (let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

let currentPdfRenderTask = null;

function renderPdfTemplate(base64Data, type) {
  const pdfData = base64ToUint8Array(base64Data);
  
  pdfjsLib.getDocument({ data: pdfData }).promise.then(pdf => {
    return pdf.getPage(1);
  }).then(page => {
    const canvas = document.getElementById("rotulo-canvas-background");
    if (!canvas) return page;
    const ctx = canvas.getContext("2d");
    
    // Render at scale 2.5 for high quality
    const scale = 2.5;
    const viewport = page.getViewport({ scale: scale });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };
    
    // Cancel active render task if any to prevent overlapping
    if (currentPdfRenderTask) {
      try {
        currentPdfRenderTask.cancel();
      } catch (e) {}
    }
    
    currentPdfRenderTask = page.render(renderContext);
    return currentPdfRenderTask.promise.then(() => page);
  }).then(page => {
    currentPdfRenderTask = null;
    console.log("Template PDF renderizado correctamente.");
    // Align fields dynamically with exact coordinates from the PDF text layer
    alignFieldsWithPdf(page, type);
  }).catch(err => {
    console.error("Error al renderizar la plantilla PDF:", err);
  });
}

function applyFieldCoordinates(type) {
  const container = document.getElementById("rotulo-pdf-container");
  const wrapper = document.getElementById("rotulo-scaled-wrapper");
  if (!container || !wrapper) return;
  
  let containerWidth, containerHeight, wrapperWidth, wrapperHeight;
  
  if (type === "T&M") {
    containerWidth = 550;
    containerHeight = 550;
    wrapperWidth = 550;
    wrapperHeight = 428; // 550 / 1.285 aspect ratio
  } else {
    containerWidth = 792;
    containerHeight = 612;
    wrapperWidth = 723; // 25.5 cm (25.5 * 28.346)
    wrapperHeight = 439; // 15.5 cm (15.5 * 28.346)
  }
  
  container.style.width = containerWidth + "px";
  container.style.height = containerHeight + "px";
  wrapper.style.width = wrapperWidth + "px";
  wrapper.style.height = wrapperHeight + "px";
  
  const coords = FIELD_COORDINATES[type];
  if (!coords) return;
  
  const fontSize = (wrapperWidth * 0.02) + "px";
  const fields = ["nombre", "cc", "celular", "ciudad", "direccion"];
  
  fields.forEach(field => {
    const el = document.getElementById(`rotulo-val-${field}`);
    if (el) {
      el.style.left = coords[field].left;
      el.style.top = coords[field].top;
      el.style.width = coords[field].width;
      el.style.fontSize = fontSize;
      if (field === "direccion") {
        el.style.lineHeight = "1.35";
      } else {
        el.style.lineHeight = "normal";
      }
    }
  });
}

function alignFieldsWithPdf(page, type) {
  page.getTextContent().then(textContent => {
    const page_width = page.view[2];
    const page_height = page.view[3];
    
    const wrapper = document.getElementById("rotulo-scaled-wrapper");
    if (!wrapper) return;
    const wrapperWidth = parseFloat(wrapper.style.width) || wrapper.offsetWidth;
    const wrapperHeight = parseFloat(wrapper.style.height) || wrapper.offsetHeight;
    
    const scaleX = wrapperWidth / page_width;
    const scaleY = wrapperHeight / page_height;
    const fontSize = (wrapperWidth * 0.02) + "px";
    
    const defaults = FIELD_COORDINATES[type];
    const fieldsFound = { nombre: false, cc: false, celular: false, ciudad: false, direccion: false };
    
    textContent.items.forEach(item => {
      const str = item.str.trim().toUpperCase();
      const pdfX = item.transform[4];
      const pdfY = item.transform[5];
      const htmlX = pdfX * scaleX;
      const htmlY = (page_height - pdfY) * scaleY;
      
      const topPos = (htmlY - (wrapperWidth * 0.02 * 0.9)) + "px";
      const spacing = 8;
      
      if (str.includes("NOMBRE")) {
        const labelWidthHtml = item.width * scaleX;
        const valEl = document.getElementById("rotulo-val-nombre");
        if (valEl) {
          valEl.style.left = (htmlX + labelWidthHtml + spacing) + "px";
          valEl.style.top = topPos;
          valEl.style.width = (type === "T&M" ? (wrapperWidth * 0.38) : (wrapperWidth * 0.77)) + "px";
          valEl.style.fontSize = fontSize;
          fieldsFound.nombre = true;
        }
      }
      else if (str === "CC:" || str === "CC" || str === "C.C." || str === "C.C" || str === "C.C:") {
        const labelWidthHtml = item.width * scaleX;
        const valEl = document.getElementById("rotulo-val-cc");
        if (valEl) {
          valEl.style.left = (htmlX + labelWidthHtml + spacing) + "px";
          valEl.style.top = topPos;
          valEl.style.width = (wrapperWidth * 0.32) + "px";
          valEl.style.fontSize = fontSize;
          fieldsFound.cc = true;
        }
      }
      else if (str.includes("CELULAR") || str.includes("CEL:")) {
        const labelWidthHtml = item.width * scaleX;
        const valEl = document.getElementById("rotulo-val-celular");
        if (valEl) {
          valEl.style.left = (htmlX + labelWidthHtml + spacing) + "px";
          valEl.style.top = topPos;
          valEl.style.width = (type === "T&M" ? (wrapperWidth * 0.21) : (wrapperWidth * 0.42)) + "px";
          valEl.style.fontSize = fontSize;
          fieldsFound.celular = true;
        }
      }
      else if (str.includes("CIUDAD") || str.includes("CIU:")) {
        const labelWidthHtml = item.width * scaleX;
        const valEl = document.getElementById("rotulo-val-ciudad");
        if (valEl) {
          valEl.style.left = (htmlX + labelWidthHtml + spacing) + "px";
          valEl.style.top = topPos;
          valEl.style.width = (type === "T&M" ? (wrapperWidth * 0.39) : (wrapperWidth * 0.80)) + "px";
          valEl.style.fontSize = fontSize;
          fieldsFound.ciudad = true;
        }
      }
      else if (str.includes("DIRECC")) {
        const labelWidthHtml = item.width * scaleX;
        const valEl = document.getElementById("rotulo-val-direccion");
        if (valEl) {
          valEl.style.left = (htmlX + labelWidthHtml + spacing) + "px";
          valEl.style.top = topPos;
          valEl.style.width = (type === "T&M" ? (wrapperWidth * 0.74) : (wrapperWidth * 0.76)) + "px";
          valEl.style.fontSize = fontSize;
          fieldsFound.direccion = true;
        }
      }
    });
    
    // Fallback for fields not resolved dynamically
    const fields = ["nombre", "cc", "celular", "ciudad", "direccion"];
    fields.forEach(field => {
      if (!fieldsFound[field]) {
        const valEl = document.getElementById(`rotulo-val-${field}`);
        if (valEl) {
          valEl.style.left = (parseFloat(defaults[field].left) / 100 * wrapperWidth) + "px";
          valEl.style.top = (parseFloat(defaults[field].top) / 100 * wrapperHeight) + "px";
          valEl.style.width = (parseFloat(defaults[field].width) / 100 * wrapperWidth) + "px";
          valEl.style.fontSize = fontSize;
        }
      }
    });
  }).catch(err => {
    console.error("Error aligning fields dynamically:", err);
  });
}

function initRotulosModule() {
  selectedLabelType = "T&M";
  
  const btnTym = document.getElementById("btn-select-label-tym");
  const btnMe = document.getElementById("btn-select-label-me");
  const form = document.getElementById("form-rotulo-envio");
  const btnExportar = document.getElementById("btn-exportar-rotulo-pdf");
  
  form.reset();

  // Clonar inputs de Cédula y Celular para limpiar event listeners previos
  const ccInput = document.getElementById("rotulo-cc");
  const freshCc = ccInput.cloneNode(true);
  ccInput.parentNode.replaceChild(freshCc, ccInput);
  attachIdCardInputFormat(freshCc);

  const celularInput = document.getElementById("rotulo-celular");
  const freshCelular = celularInput.cloneNode(true);
  celularInput.parentNode.replaceChild(freshCelular, celularInput);
  attachPhoneInputFormat(freshCelular);
  
  // Render default T&M template & apply positions
  renderPdfTemplate(ROTULO_TEMPLATE_TYM_B64, "T&M");
  applyFieldCoordinates("T&M");
  
  updateRotuloPreview();
  checkRotuloFormValidity();

  const prodSelect = document.getElementById("rotulo-me-producto");
  prodSelect.innerHTML = '<option value="">Seleccione un producto ME / Accesorios ME</option>';
  State.products.filter(p => p.category === "ME" || p.category === "Accesorios ME").forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.sku;
    opt.textContent = `${p.sku} - ${p.name}`;
    prodSelect.appendChild(opt);
  });
  prodSelect.onchange = function() {
    const serialSelect = document.getElementById("rotulo-me-serial");
    serialSelect.innerHTML = '<option value="">Seleccione...</option>';
    const selectedSku = this.value;
    if (selectedSku) {
      const product = State.products.find(p => p.sku === selectedSku);
      
      if (product && product.category === "Accesorios ME") {
        serialSelect.disabled = true;
        const opt = document.createElement("option");
        opt.value = "N/A";
        opt.textContent = "NO APLICA";
        serialSelect.appendChild(opt);
        serialSelect.value = "N/A";
      } else {
        serialSelect.disabled = false;
        const allSerials = getCreatedSerialsForSku(selectedSku);
        allSerials.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s;
          opt.textContent = s;
          serialSelect.appendChild(opt);
        });
      }
    } else {
      serialSelect.disabled = true;
    }
    checkRotuloFormValidity();
  };
  const serialSelect = document.getElementById("rotulo-me-serial");
  serialSelect.onchange = checkRotuloFormValidity;
  serialSelect.addEventListener("mousedown", function(e) {
    const selectedSku = document.getElementById("rotulo-me-producto").value;
    const product = State.products.find(p => p.sku === selectedSku);
    if (product && product.category !== "Accesorios ME") {
      e.preventDefault();
      openRotuloSerialModal(selectedSku);
    }
  });
  serialSelect.addEventListener("keydown", function(e) {
    const selectedSku = document.getElementById("rotulo-me-producto").value;
    const product = State.products.find(p => p.sku === selectedSku);
    if (product && product.category !== "Accesorios ME") {
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openRotuloSerialModal(selectedSku);
      }
    }
  });
  document.getElementById("rotulo-me-transportadora").onchange = checkRotuloFormValidity;

  btnTym.classList.add("active");
  btnTym.classList.remove("btn-outline-primary");
  btnTym.classList.add("btn-primary");
  
  btnMe.classList.remove("active");
  btnMe.classList.add("btn-outline-secondary");
  btnMe.classList.remove("btn-secondary");

  btnTym.onclick = function() {
    selectedLabelType = "T&M";
    
    btnTym.classList.add("active");
    btnTym.classList.remove("btn-outline-primary");
    btnTym.classList.add("btn-primary");
    
    btnMe.classList.remove("active");
    btnMe.classList.add("btn-outline-secondary");
    btnMe.classList.remove("btn-secondary");
    
    document.getElementById("preview-badge-type").textContent = "T&M";
    document.getElementById("preview-badge-type").className = "badge badge-success";
    
    document.getElementById("rotulo-me-extra-fields").classList.add("hidden");
    renderPdfTemplate(ROTULO_TEMPLATE_TYM_B64, "T&M");
    applyFieldCoordinates("T&M");
    updateRotuloPreview();
  };

  btnMe.onclick = function() {
    selectedLabelType = "ME";
    
    btnMe.classList.add("active");
    btnMe.classList.remove("btn-outline-secondary");
    btnMe.classList.add("btn-secondary");
    
    btnTym.classList.remove("active");
    btnTym.classList.add("btn-outline-primary");
    btnTym.classList.remove("btn-primary");
    
    document.getElementById("preview-badge-type").textContent = "ME";
    document.getElementById("preview-badge-type").className = "badge badge-teal";
    
    document.getElementById("rotulo-me-extra-fields").classList.remove("hidden");
    renderPdfTemplate(ROTULO_TEMPLATE_ME_B64, "ME");
    applyFieldCoordinates("ME");
    updateRotuloPreview();
  };

  const inputs = form.querySelectorAll("input, select");
  inputs.forEach(input => {
    input.addEventListener("input", function() {
      if (this.tagName === "INPUT" && this.type !== "email") {
        this.value = this.value.toUpperCase();
      }
      updateRotuloPreview();
      checkRotuloFormValidity();
    });
  });

  const transSelect = document.getElementById("rotulo-me-transportadora");
  if (transSelect && transSelect.options.length <= 1) {
    State.carriers.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      transSelect.appendChild(opt);
    });
  }

  const deptoSelect = document.getElementById("rotulo-departamento");
  const ciudadSelect = document.getElementById("rotulo-ciudad");
  
  if (typeof COLOMBIA_DATA !== "undefined" && deptoSelect.options.length <= 1) {
    Object.keys(COLOMBIA_DATA).sort().forEach(depto => {
      const opt = document.createElement("option");
      opt.value = depto;
      opt.textContent = depto;
      deptoSelect.appendChild(opt);
    });
  }

  deptoSelect.addEventListener("change", function() {
    ciudadSelect.innerHTML = '<option value="">Seleccione ciudad...</option>';
    if (this.value && typeof COLOMBIA_DATA !== "undefined") {
      ciudadSelect.disabled = false;
      const ciudades = COLOMBIA_DATA[this.value].sort();
      ciudades.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        ciudadSelect.appendChild(opt);
      });
    } else {
      ciudadSelect.disabled = true;
    }
    updateRotuloPreview();
    checkRotuloFormValidity();
  });

  btnExportar.onclick = function() {
    exportarRotuloPDF();
  };
}

function updateRotuloPreview() {
  const nombre = document.getElementById("rotulo-nombre").value.trim().toUpperCase() || "-";
  const cc = document.getElementById("rotulo-cc").value.trim().toUpperCase() || "-";
  const celular = document.getElementById("rotulo-celular").value.trim().toUpperCase() || "-";
  const depto = document.getElementById("rotulo-departamento").value.trim().toUpperCase();
  const ciudadVal = document.getElementById("rotulo-ciudad").value.trim().toUpperCase();
  const ciudad = (ciudadVal && depto) ? `${ciudadVal} - ${depto}` : "-";
  const direccion = document.getElementById("rotulo-direccion").value.trim().toUpperCase() || "-";

  document.getElementById("rotulo-val-nombre").textContent = nombre;
  document.getElementById("rotulo-val-cc").textContent = cc;
  document.getElementById("rotulo-val-celular").textContent = celular;
  document.getElementById("rotulo-val-ciudad").textContent = ciudad;
  document.getElementById("rotulo-val-direccion").textContent = direccion;
}

function checkRotuloFormValidity() {
  const nombre = document.getElementById("rotulo-nombre").value.trim();
  const cc = document.getElementById("rotulo-cc").value.trim();
  const celular = document.getElementById("rotulo-celular").value.trim();
  const depto = document.getElementById("rotulo-departamento").value.trim();
  const ciudadVal = document.getElementById("rotulo-ciudad").value.trim();
  const direccion = document.getElementById("rotulo-direccion").value.trim();
  const btnExportar = document.getElementById("btn-exportar-rotulo-pdf");

  let isValid = nombre.length > 0 && cc.length > 0 && celular.length >= 10 && celular.length <= 12 && depto.length > 0 && ciudadVal.length > 0 && direccion.length > 0;
  
  if (selectedLabelType === "ME") {
    const prod = document.getElementById("rotulo-me-producto").value;
    const serial = document.getElementById("rotulo-me-serial").value;
    const trans = document.getElementById("rotulo-me-transportadora").value;
    if (!prod || !serial || !trans) isValid = false;
  }

  btnExportar.disabled = !isValid;
}

function exportarRotuloPDF() {
  const container = document.getElementById("rotulo-pdf-container");
  const nombre = document.getElementById("rotulo-nombre").value.trim().toUpperCase();
  const cc = document.getElementById("rotulo-cc").value.trim().toUpperCase();
  const celular = document.getElementById("rotulo-celular").value.trim().toUpperCase();
  const depto = document.getElementById("rotulo-departamento").value.trim().toUpperCase();
  const ciudadVal = document.getElementById("rotulo-ciudad").value.trim().toUpperCase();
  const ciudad = `${ciudadVal} - ${depto}`;
  const direccion = document.getElementById("rotulo-direccion").value.trim().toUpperCase();
  const tipo = selectedLabelType;

  const format = tipo === "T&M" ? [5.73, 5.73] : 'letter';
  const orientation = tipo === "T&M" ? 'portrait' : 'landscape';
  const opt = {
    margin:       0,
    filename:     `Rotulo_${tipo}_${nombre.replace(/\s+/g, '_')}_${Date.now()}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2.5, useCORS: true, logging: false },
    jsPDF:        { unit: 'in', format: format, orientation: orientation }
  };

  const nextNumber = State.rotulos.length + 1;
  const folio = `ROT-${String(nextNumber).padStart(4, '0')}`;
  const fechaStr = new Date().toISOString().split('T')[0];

  const nuevoRotulo = {
    id: folio,
    date: fechaStr,
    docType: "Rotulo",
    labelType: tipo,
    name: nombre,
    cc: cc,
    phone: celular,
    city: ciudad,
    address: direccion
  };
  
  if (tipo === "ME") {
    nuevoRotulo.sku = document.getElementById("rotulo-me-producto").value;
    const prodObj = State.products.find(p => p.sku === nuevoRotulo.sku);
    nuevoRotulo.prodName = prodObj ? prodObj.name : "";
    nuevoRotulo.serial = document.getElementById("rotulo-me-serial").value;
    nuevoRotulo.carrier = document.getElementById("rotulo-me-transportadora").value;
  }

  const btnExportar = document.getElementById("btn-exportar-rotulo-pdf");
  btnExportar.disabled = true;
  btnExportar.innerHTML = `<i data-lucide="loader"></i> Generando...`;
  lucide.createIcons();

  html2pdf().from(container).set(opt).save().then(() => {
    btnExportar.disabled = false;
    btnExportar.innerHTML = `<i data-lucide="download-cloud"></i> Exportar en PDF`;
    lucide.createIcons();

    State.rotulos.push(nuevoRotulo);
    State.save();
    
    alert(`Rótulo exportado con éxito. Folio registrado: ${folio}`);
    
    document.getElementById("form-rotulo-envio").reset();
    initRotulosModule();
    renderDocumentsHistory();
  }).catch(err => {
    console.error(err);
    alert("Hubo un error al generar el PDF.");
    btnExportar.disabled = false;
    btnExportar.innerHTML = `<i data-lucide="download-cloud"></i> Exportar en PDF`;
    lucide.createIcons();
  });
}

// --- CARGAR PANTALLA INICIAL ---
window.onload = function() {
  // Migración para pedidos de accesorios antiguos
  if (State.pedidosAccesorios && State.pedidosAccesorios.length > 0) {
    let migrated = false;
    State.pedidosAccesorios.forEach(ped => {
      if (!ped.items) {
        ped.items = [{
          accesorioSku: ped.accesorioSku || "",
          qty: 1,
          esGarantia: ped.esGarantia || false,
          garantiasSku: ped.garantiasSku || "",
          garantiasEan: ped.garantiasEan || ""
        }];
        delete ped.accesorioSku;
        delete ped.esGarantia;
        delete ped.garantiasSku;
        delete ped.garantiasEan;
        migrated = true;
      }
    });
    if (migrated) {
      State.save();
    }
  }

  // Migración para garantías antiguas con una sola pieza con novedad o piezas en formato antiguo
  if (State.garantias && State.garantias.length > 0) {
    let migrated = false;
    State.garantias.forEach(gar => {
      if (gar.type === "me") {
        // First case: gar.pieces does not exist but we have piezaNovedad
        if (!gar.pieces) {
          const legacySku = gar.piezaNovedad || "";
          gar.pieces = [
            {
              pieceSku: legacySku,
              aplica: gar.aplica || "Si",
              proveedor: gar.proveedor || "No",
              observaciones: gar.observaciones || ""
            }
          ];
          delete gar.piezaNovedad;
          migrated = true;
        } else {
          // Second case: gar.pieces is an array, check if elements are strings
          let updatedPieces = false;
          const newPieces = gar.pieces.map(item => {
            if (typeof item === "string") {
              updatedPieces = true;
              return {
                pieceSku: item,
                aplica: gar.aplica || "Si",
                proveedor: gar.proveedor || "No",
                observaciones: gar.observaciones || ""
              };
            }
            return item;
          });
          if (updatedPieces) {
            gar.pieces = newPieces;
            migrated = true;
          }
        }
        
        // Ensure global properties exist on the record
        if (gar.pieces.length > 0) {
          const hasAplica = gar.pieces.some(p => p.aplica === "Si");
          const hasProveedor = gar.pieces.some(p => p.proveedor === "Si");
          const combinedObs = gar.pieces.map(p => {
            const prod = State.products.find(pr => pr.sku === p.pieceSku);
            const name = prod ? prod.name : p.pieceSku;
            return `[${p.pieceSku} - ${name}] ${p.observaciones || "Sin observaciones"}`;
          }).join("\n");
          
          if (gar.aplica !== (hasAplica ? "Si" : "No") || 
              gar.proveedor !== (hasProveedor ? "Si" : "No") ||
              gar.observaciones !== combinedObs) {
            gar.aplica = hasAplica ? "Si" : "No";
            gar.proveedor = hasProveedor ? "Si" : "No";
            gar.observaciones = combinedObs;
            migrated = true;
          }
        }
      }
    });
    if (migrated) {
      State.save();
    }
  }

  // Eliminar RES-0001 por solicitud del usuario si existe en la base de datos local
  if (State.reservas && State.reservas.length > 0) {
    const originalLength = State.reservas.length;
    State.reservas = State.reservas.filter((d, idx) => {
      const id = d.id || `RES-${String(idx + 1).padStart(4, "0")}`;
      return id !== "RES-0001";
    });
    if (State.reservas.length !== originalLength) {
      State.save();
    }
  }

  if (State.activeUser) {
    showApp();
  } else {
    showLogin();
  }
  lucide.createIcons();
};
// Lógica inicial de PDF Exportación (sin cambios)
const btnExportar = document.getElementById("btn-exportar-doc");
if (btnExportar) {
  btnExportar.addEventListener("click", () => {
    // ... logic ...
  });
}

// --- LÓGICA DE SERIALES (ME) ---
let serialsModalCallback = null;
let serialsTargetQty = 0;
let serialsCurrentProduct = null;

function getAvailableSerials(sku, warehouse) {
  const serialsMap = {}; 
  State.ingresos.forEach(doc => {
    if (doc.warehouse === warehouse) {
      doc.items.forEach(item => {
        if (item.sku === sku && item.serials) item.serials.forEach(s => serialsMap[s] = true);
      });
    }
  });
  State.traslados.forEach(doc => {
    if (doc.destWarehouse === warehouse) {
      doc.items.forEach(item => {
        if (item.sku === sku && item.serials) item.serials.forEach(s => serialsMap[s] = true);
      });
    }
    if (doc.originWarehouse === warehouse) {
      doc.items.forEach(item => {
        if (item.sku === sku && item.serials) item.serials.forEach(s => delete serialsMap[s]);
      });
    }
  });
  State.salidas.forEach(doc => {
    if (doc.warehouse === warehouse) {
      doc.items.forEach(item => {
        if (item.sku === sku && item.serials) item.serials.forEach(s => delete serialsMap[s]);
      });
    }
  });
  
  // Restar items ya añadidos en sesión
  currentExitItems.forEach(item => {
    if (item.warehouse === warehouse && item.sku === sku && item.serials) {
      item.serials.forEach(s => delete serialsMap[s]);
    }
  });
  currentTransferItems.forEach(item => {
    if (document.getElementById("transfer-origin-wh").value === warehouse && item.sku === sku && item.serials) {
      item.serials.forEach(s => delete serialsMap[s]);
    }
  });

  return Object.keys(serialsMap);
}

function openAssignSerialsModal(p, qty, callback) {
  serialsCurrentProduct = p;
  serialsTargetQty = qty;
  serialsModalCallback = callback;
  
  document.getElementById("assign-serials-req-qty").textContent = qty;
  document.getElementById("assign-serials-sku").textContent = p.sku;
  document.getElementById("assign-serials-target").textContent = qty;
  document.getElementById("assign-serials-count").textContent = "0";
  document.getElementById("assign-serials-manual").value = "";
  document.getElementById("assign-serials-excel").value = "";
  
  document.getElementById("modal-assign-serials").classList.remove("hidden");
}

document.getElementById("btn-close-assign-serials").onclick = () => {
  document.getElementById("modal-assign-serials").classList.add("hidden");
};

function processAssignSerials() {
  const manual = document.getElementById("assign-serials-manual").value;
  let serials = [];
  if (manual.trim()) {
    serials = manual.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
  }
  
  const fileInput = document.getElementById("assign-serials-excel");
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
      rows.forEach(row => {
        if (row[0] && String(row[0]).trim()) {
          serials.push(String(row[0]).trim());
        }
      });
      finalizeAssignSerials(serials);
    };
    reader.readAsArrayBuffer(file);
  } else {
    finalizeAssignSerials(serials);
  }
}

function finalizeAssignSerials(serials) {
  const uniqueSerials = [...new Set(serials)];
  if (uniqueSerials.length !== serialsTargetQty) {
    alert(`Debe asignar exactamente ${serialsTargetQty} seriales únicos. Ha proveído ${uniqueSerials.length}.`);
    return;
  }
  document.getElementById("modal-assign-serials").classList.add("hidden");
  if (serialsModalCallback) serialsModalCallback(uniqueSerials);
}

document.getElementById("btn-confirm-assign-serials").onclick = processAssignSerials;
document.getElementById("assign-serials-manual").addEventListener("input", function() {
  const manual = this.value;
  const serials = manual.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
  const unique = [...new Set(serials)];
  document.getElementById("assign-serials-count").textContent = unique.length;
});

// SELECT SERIALS MODAL
let availableSerialsForSelection = [];
let selectedSerialsSet = new Set();

function openSelectSerialsModal(p, warehouse, qty, callback) {
  serialsCurrentProduct = p;
  serialsTargetQty = qty;
  serialsModalCallback = callback;
  availableSerialsForSelection = getAvailableSerials(p.sku, warehouse);
  selectedSerialsSet.clear();
  
  document.getElementById("select-serials-req-qty").textContent = qty;
  document.getElementById("select-serials-sku").textContent = p.sku;
  document.getElementById("select-serials-target").textContent = qty;
  document.getElementById("select-serials-count").textContent = "0";
  document.getElementById("select-serials-search").value = "";
  
  renderSelectSerialsGrid(availableSerialsForSelection);
  document.getElementById("modal-select-serials").classList.remove("hidden");
}

function renderSelectSerialsGrid(list) {
  const grid = document.getElementById("select-serials-grid");
  grid.innerHTML = "";
  if (list.length === 0) {
    grid.innerHTML = `<p class="text-muted" style="grid-column: 1/-1;">No hay seriales disponibles en esta bodega para este producto.</p>`;
    return;
  }
  list.forEach(s => {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    label.style.cursor = "pointer";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = s;
    cb.className = "serial-checkbox";
    if (selectedSerialsSet.has(s)) cb.checked = true;
    cb.onchange = updateSelectSerialsCount;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(s));
    grid.appendChild(label);
  });
}

document.getElementById("select-serials-search").addEventListener("input", function() {
  const q = this.value.toLowerCase();
  const filtered = availableSerialsForSelection.filter(s => s.toLowerCase().includes(q));
  renderSelectSerialsGrid(filtered);
});

function updateSelectSerialsCount() {
  const grid = document.getElementById("select-serials-grid");
  const checkboxes = grid.querySelectorAll(".serial-checkbox");
  checkboxes.forEach(cb => {
    if (cb.checked) selectedSerialsSet.add(cb.value);
    else selectedSerialsSet.delete(cb.value);
  });
  document.getElementById("select-serials-count").textContent = selectedSerialsSet.size;
}

document.getElementById("btn-close-select-serials").onclick = () => {
  document.getElementById("modal-select-serials").classList.add("hidden");
};

document.getElementById("btn-confirm-select-serials").onclick = () => {
  // Update in case any checks happened before confirming
  updateSelectSerialsCount();
  if (selectedSerialsSet.size !== serialsTargetQty) {
    alert(`Debe seleccionar exactamente ${serialsTargetQty} seriales. Ha seleccionado ${selectedSerialsSet.size}.`);
    return;
  }
  document.getElementById("modal-select-serials").classList.add("hidden");
  if (serialsModalCallback) serialsModalCallback(Array.from(selectedSerialsSet));
};

function getCreatedSerialsForSku(sku) {
  let allSerials = [];
  State.ingresos.forEach(doc => {
    doc.items.forEach(item => {
      if (item.sku === sku && item.serials) {
        allSerials = allSerials.concat(item.serials);
      }
    });
  });
  return [...new Set(allSerials)];
}

let rotuloAvailableSerials = [];
function openRotuloSerialModal(sku) {
  const modal = document.getElementById("modal-rotulo-serial");
  const searchInput = document.getElementById("rotulo-serial-search");
  searchInput.value = "";
  
  rotuloAvailableSerials = getCreatedSerialsForSku(sku);
  
  renderRotuloSerialsList(rotuloAvailableSerials);
  modal.classList.remove("hidden");
}

function renderRotuloSerialsList(list) {
  const container = document.getElementById("rotulo-serial-list");
  container.innerHTML = "";
  
  if (list.length === 0) {
    container.innerHTML = `<p class="text-muted" style="padding: 10px; text-align: center;">No hay seriales disponibles para este producto.</p>`;
    return;
  }
  
  list.forEach(s => {
    const item = document.createElement("div");
    item.className = "serial-list-item";
    item.style.padding = "10px 14px";
    item.style.borderBottom = "1px solid #f1f5f9";
    item.style.cursor = "pointer";
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";
    item.style.borderRadius = "4px";
    item.style.transition = "background-color 0.2s";
    
    item.onmouseenter = () => item.style.backgroundColor = "#f1f5f9";
    item.onmouseleave = () => item.style.backgroundColor = "";
    
    item.innerHTML = `
      <span style="font-weight: 500; color: #1e293b;">${s}</span>
      <i data-lucide="chevron-right" style="width: 16px; height: 16px; color: #94a3b8;"></i>
    `;
    
    item.onclick = function() {
      const serialSelect = document.getElementById("rotulo-me-serial");
      let exists = false;
      for (let i = 0; i < serialSelect.options.length; i++) {
        if (serialSelect.options[i].value === s) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        serialSelect.appendChild(opt);
      }
      serialSelect.value = s;
      
      document.getElementById("modal-rotulo-serial").classList.add("hidden");
      checkRotuloFormValidity();
    };
    
    container.appendChild(item);
  });
  
  lucide.createIcons();
}

document.getElementById("rotulo-serial-search").addEventListener("input", function() {
  const q = this.value.toLowerCase().trim();
  const filtered = rotuloAvailableSerials.filter(s => s.toLowerCase().includes(q));
  renderRotuloSerialsList(filtered);
});

document.getElementById("btn-close-rotulo-serial").onclick = () => {
  document.getElementById("modal-rotulo-serial").classList.add("hidden");
};

function attachContactInputFormat(el) {
  el.addEventListener("input", function() {
    this.value = this.value.replace(/[^0-9]/g, "").slice(0, 14);
  });
  el.addEventListener("keydown", function(e) {
    const allowed = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End"];
    if (allowed.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ["a","c","v","x"].includes(e.key.toLowerCase())) return;
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  });
}

// Adjuntar formato a datos del cliente en Ventas
attachIdCardInputFormat(document.getElementById("exit-client-cedula"));
attachContactInputFormat(document.getElementById("exit-client-contacto"));

// Adjuntar formato a Valor Envío
attachIdCardInputFormat(document.getElementById("exit-shipping-cost"));

// ==========================================================================
// MÓDULO FACTURACIÓN Y DOCUMENTOS COMERCIALES
// ==========================================================================
let currentFacturaType = "Cotización";
let facturacionItems = [];

const GARANTIA_NOTA_TEXT = `*1 AÑO DE GARANTÍA POR DEFECTOS DE FÁBRICA 

** No se cubren daños derivados del mal uso del producto, accidentes o negligencia.

*** Todo costo de transporte, fletes y envíos derivados de la prestación de servicios de garantía o mantenimiento preventivo/correctivo correrá por cuenta exclusiva del cliente. La empresa no asumirá costos de logística ni traslados bajo ninguna circunstancia.`;

const COLOMBIA_GEODATA = {
  "Antioquia": ["Medellín", "Bello", "Itagüí", "Envigado", "Rionegro", "Apartadó", "Turbo", "Caucasia", "Marinilla", "Sabaneta"],
  "Bogotá D.C.": ["Bogotá"],
  "Valle del Cauca": ["Cali", "Buenaventura", "Palmira", "Tuluá", "Yumbo", "Cartago", "Jamundí", "Buga"],
  "Atlántico": ["Barranquilla", "Soledad", "Malambo", "Sabanagrande", "Puerto Colombia"],
  "Bolívar": ["Cartagena", "Magangué", "Turbaco", "El Carmen de Bolívar", "Arjona"],
  "Cundinamarca": ["Soacha", "Chía", "Zipaquirá", "Facatativá", "Fusagasugá", "Madrid", "Mosquera"],
  "Santander": ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil"],
  "Norte de Santander": ["Cúcuta", "Ocaña", "Villa del Rosario", "Los Patios", "Pamplona"],
  "Tolima": ["Ibagué", "Espinal", "Melgar", "Chaparral", "Honda"],
  "Boyacá": ["Tunja", "Duitama", "Sogamoso", "Chiquinquirá", "Paipa"],
  "Magdalena": ["Santa Marta", "Ciénaga", "Fundación", "El Banco"],
  "Caldas": ["Manizales", "La Dorada", "Chinchiná", "Villamaría", "Riosucio"],
  "Risaralda": ["Pereira", "Dosquebradas", "Santa Rosa de Cabal", "La Virginia"],
  "Quindío": ["Armenia", "Calarcá", "Quimbaya", "Montenegro", "La Tebaida"],
  "Huila": ["Neiva", "Pitalito", "Garzón", "La Plata"],
  "Meta": ["Villavicencio", "Acacías", "Granada", "Puerto López"],
  "Cesar": ["Valledupar", "Aguachica", "Agustín Codazzi", "Bosconia"],
  "Córdoba": ["Montería", "Lorica", "Cereté", "Tierralta", "Sahagún"],
  "Sucre": ["Sincelejo", "Corozal", "San Marcos", "Tolú"],
  "Nariño": ["Pasto", "Ipiales", "Tumaco", "Túquerres"],
  "Cauca": ["Popayán", "Santander de Quilichao", "Puerto Tejada", "El Tambo"],
  "La Guajira": ["Riohacha", "Maicao", "Uribia", "San Juan del Cesar"],
  "Casanare": ["Yopal", "Aguazul", "Paz de Ariporo"],
  "Caquetá": ["Florencia", "San Vicente del Caguán", "Puerto Rico"],
  "Putumayo": ["Mocoa", "Puerto Asís", "Orito", "Valle del Guamuez"],
  "Chocó": ["Quibdó", "Istmina", "Tadó", "Condoto"],
  "Arauca": ["Arauca", "Tame", "Saravena", "Arauquita"],
  "Guaviare": ["San José del Guaviare", "El Retorno"],
  "San Andrés y Providencia": ["San Andrés", "Providencia"],
  "Amazonas": ["Leticia", "Puerto Nariño"],
  "Vichada": ["Puerto Carreño", "La Primavera", "Santa Rosalía", "Cumaribo"],
  "Vaupés": ["Mitú", "Caruru", "Taraira"],
  "Guainía": ["Inírida"]
};

function formatFacturacionNumInput(input) {
  let val = input.value.replace(/\D/g, "");
  if (val !== "") {
    input.value = parseInt(val, 10).toLocaleString("es-CO");
  } else {
    input.value = "";
  }
}

function getUnformattedFacturacionNum(val) {
  if (!val) return 0;
  return parseInt(String(val).replace(/\D/g, ""), 10) || 0;
}

function initFacturacionModule() {
  document.getElementById("facturacion-fecha").value = new Date().toISOString().split("T")[0];
  
  const deptoSelect = document.getElementById("facturacion-departamento");
  const ciudadSelect = document.getElementById("facturacion-ciudad");
  
  if (deptoSelect.options.length <= 1) {
    deptoSelect.innerHTML = '<option value="">Seleccione Depto...</option>' + 
      Object.keys(COLOMBIA_GEODATA).sort().map(d => `<option value="${d}">${d}</option>`).join("");
      
    deptoSelect.addEventListener("change", function() {
      if(this.value && COLOMBIA_GEODATA[this.value]) {
        ciudadSelect.innerHTML = '<option value="">Seleccione Ciudad...</option>' + 
          COLOMBIA_GEODATA[this.value].sort().map(c => `<option value="${c}">${c}</option>`).join("");
        ciudadSelect.disabled = false;
      } else {
        ciudadSelect.innerHTML = '<option value="">Seleccione Ciudad...</option>';
        ciudadSelect.disabled = true;
      }
      updatePrintTemplate();
    });
    
    ciudadSelect.addEventListener("change", updatePrintTemplate);
    document.getElementById("facturacion-fecha").addEventListener("change", updatePrintTemplate);
    document.getElementById("facturacion-nombre").addEventListener("input", updatePrintTemplate);
    document.getElementById("facturacion-nit").addEventListener("input", function() {
      formatFacturacionNumInput(this);
      updatePrintTemplate();
    });
    document.getElementById("facturacion-direccion").addEventListener("input", updatePrintTemplate);
    document.getElementById("facturacion-telefono").addEventListener("input", updatePrintTemplate);
    document.getElementById("facturacion-correo").addEventListener("input", updatePrintTemplate);
    document.getElementById("facturacion-observaciones").addEventListener("input", function() {
      const toggle = document.getElementById("facturacion-toggle-garantia");
      toggle.checked = this.value.includes(GARANTIA_NOTA_TEXT);
      updatePrintTemplate();
    });
    
    document.getElementById("facturacion-toggle-garantia").addEventListener("change", function() {
      const obsTextarea = document.getElementById("facturacion-observaciones");
      let currentVal = obsTextarea.value;
      
      if (this.checked) {
        if (!currentVal.includes(GARANTIA_NOTA_TEXT)) {
          if (currentVal.trim() === "") {
            obsTextarea.value = GARANTIA_NOTA_TEXT;
          } else {
            obsTextarea.value = currentVal.trim() + "\n\n" + GARANTIA_NOTA_TEXT;
          }
        }
      } else {
        if (currentVal.includes(GARANTIA_NOTA_TEXT)) {
          let newVal = currentVal.replace(GARANTIA_NOTA_TEXT, "").trim();
          obsTextarea.value = newVal;
        }
      }
      updatePrintTemplate();
    });
  }
  
  if (facturacionItems.length === 0) {
    facturacionItems.push({
      qty: 1,
      desc: "",
      unitPrice: 0,
      discount: 0
    });
  }
  
  updateFacturacionHeader();
  renderFacturacionItems();
  updatePrintTemplate();
}

document.querySelectorAll(".btn-doc-type").forEach(btn => {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".btn-doc-type").forEach(b => {
      b.classList.remove("btn-primary");
      b.classList.add("btn-secondary");
    });
    this.classList.remove("btn-secondary");
    this.classList.add("btn-primary");
    currentFacturaType = this.getAttribute("data-type");
    updateFacturacionHeader();
    updatePrintTemplate();
  });
});

function updateFacturacionHeader() {
  const filtered = State.facturacion.filter(f => f.docType === currentFacturaType);
  const nextNum = filtered.length + 1001;
  const prefix = currentFacturaType === "Cotización" ? "COT" : (currentFacturaType === "Pre-Factura" ? "PRE" : "FAC");
  const consec = `${prefix}-${String(nextNum).padStart(4, "0")}`;
  
  document.getElementById("facturacion-consecutivo").textContent = consec;
  document.getElementById("facturacion-doc-title").innerHTML = `${currentFacturaType} No. <span id="facturacion-consecutivo">${consec}</span>`;
  updatePrintTemplate();
}

document.getElementById("btn-add-factura-row").addEventListener("click", () => {
  facturacionItems.push({
    qty: 1,
    desc: "",
    unitPrice: 0,
    discount: 0
  });
  renderFacturacionItems();
  updatePrintTemplate();
});

function renderFacturacionItems() {
  const tbody = document.querySelector("#table-facturacion-items tbody");
  tbody.innerHTML = "";
  
  let subtotal = 0;
  let totalDcto = 0;

  const productOptions = State.products.map(p => `<option value="${p.sku} - ${p.name}">${p.sku} - ${p.name}</option>`).join("");

  facturacionItems.forEach((item, index) => {
    const itemTotal = item.qty * (item.unitPrice - item.discount);
    subtotal += (item.qty * item.unitPrice);
    totalDcto += (item.qty * item.discount);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="number" class="form-control item-qty" value="${item.qty}" min="1" data-index="${index}"></td>
      <td>
        <select class="form-control item-desc" data-index="${index}">
          <option value="">Seleccione producto...</option>
          ${productOptions}
        </select>
      </td>
      <td>
        <div class="input-icon-wrapper">
          <i data-lucide="dollar-sign" style="width: 14px; height: 14px;"></i>
          <input type="text" class="form-control item-price" value="${item.unitPrice ? item.unitPrice.toLocaleString('es-CO') : ''}" placeholder="0" data-index="${index}" style="padding-left: 30px;">
        </div>
      </td>
      <td>
        <div class="input-icon-wrapper">
          <i data-lucide="dollar-sign" style="width: 14px; height: 14px;"></i>
          <input type="text" class="form-control item-dcto" value="${item.discount ? item.discount.toLocaleString('es-CO') : ''}" placeholder="0" data-index="${index}" style="padding-left: 30px;">
        </div>
      </td>
      <td style="vertical-align: middle; font-weight: bold; text-align: right;">$ ${itemTotal.toLocaleString("es-CO")}</td>
      <td style="vertical-align: middle;">
        <button type="button" class="btn btn-danger btn-sm btn-del-factura-row" data-index="${index}"><i data-lucide="trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);

    if (item.desc) {
      tr.querySelector(".item-desc").value = item.desc;
    }
  });

  lucide.createIcons();

  document.querySelectorAll(".item-qty").forEach(input => {
    input.addEventListener("input", function() {
      facturacionItems[this.getAttribute("data-index")].qty = parseInt(this.value) || 1;
      updateFacturacionTotals();
      updatePrintTemplate();
    });
  });
  document.querySelectorAll(".item-desc").forEach(select => {
    select.addEventListener("change", function() {
      facturacionItems[this.getAttribute("data-index")].desc = this.value;
      updatePrintTemplate();
    });
  });
  document.querySelectorAll(".item-price").forEach(input => {
    input.addEventListener("input", function() {
      formatFacturacionNumInput(this);
      facturacionItems[this.getAttribute("data-index")].unitPrice = getUnformattedFacturacionNum(this.value);
      updateFacturacionTotals();
      updatePrintTemplate();
    });
  });
  document.querySelectorAll(".item-dcto").forEach(input => {
    input.addEventListener("input", function() {
      formatFacturacionNumInput(this);
      facturacionItems[this.getAttribute("data-index")].discount = getUnformattedFacturacionNum(this.value);
      updateFacturacionTotals();
      updatePrintTemplate();
    });
  });
  document.querySelectorAll(".btn-del-factura-row").forEach(btn => {
    btn.addEventListener("click", function() {
      const idx = this.getAttribute("data-index");
      facturacionItems.splice(idx, 1);
      renderFacturacionItems();
      updatePrintTemplate();
    });
  });

  const totalPagar = subtotal - totalDcto;
  document.getElementById("facturacion-subtotal").textContent = `$ ${subtotal.toLocaleString("es-CO")}`;
  document.getElementById("facturacion-descuento").textContent = `$ ${totalDcto.toLocaleString("es-CO")}`;
  document.getElementById("facturacion-total-pagar").textContent = `$ ${totalPagar.toLocaleString("es-CO")}`;
}

function updateFacturacionTotals() {
  let subtotal = 0;
  let totalDcto = 0;
  const tbody = document.querySelector("#table-facturacion-items tbody");

  facturacionItems.forEach((item, index) => {
    const itemTotal = item.qty * (item.unitPrice - item.discount);
    subtotal += (item.qty * item.unitPrice);
    totalDcto += (item.qty * item.discount);

    const tr = tbody.children[index];
    if (tr && tr.children[4]) {
      tr.children[4].textContent = `$ ${itemTotal.toLocaleString("es-CO")}`;
    }
  });

  const totalPagar = subtotal - totalDcto;
  document.getElementById("facturacion-subtotal").textContent = `$ ${subtotal.toLocaleString("es-CO")}`;
  document.getElementById("facturacion-descuento").textContent = `$ ${totalDcto.toLocaleString("es-CO")}`;
  document.getElementById("facturacion-total-pagar").textContent = `$ ${totalPagar.toLocaleString("es-CO")}`;
}

function updatePrintTemplate() {
  const fecha = document.getElementById("facturacion-fecha").value;
  const nombre = document.getElementById("facturacion-nombre").value.trim().toUpperCase();
  const nit = document.getElementById("facturacion-nit").value.trim().toUpperCase();
  const dir = document.getElementById("facturacion-direccion").value.trim().toUpperCase();
  const tel = document.getElementById("facturacion-telefono").value.trim().toUpperCase();
  
  const dptoEl = document.getElementById("facturacion-departamento");
  const ciudadEl = document.getElementById("facturacion-ciudad");
  const dptoText = dptoEl.options[dptoEl.selectedIndex]?.text || "";
  const ciudadText = ciudadEl.options[ciudadEl.selectedIndex]?.text || "";
  const ciudadFinal = ciudadText && ciudadText !== "Seleccione Ciudad..." ? `${ciudadText} - ${dptoText}`.toUpperCase() : "";
  
  const correo = document.getElementById("facturacion-correo").value.trim().toUpperCase();
  const obs = document.getElementById("facturacion-observaciones").value.trim().toUpperCase();
  
  const consecElement = document.getElementById("facturacion-consecutivo").textContent;
  
  document.getElementById("print-doc-title").innerHTML = `${currentFacturaType} No. <span style="font-weight: bold; color: #0f766e;">${consecElement}</span>`;
  document.getElementById("print-fecha").textContent = fecha;
  document.getElementById("print-nombre").textContent = nombre;
  document.getElementById("print-nit").textContent = nit;
  document.getElementById("print-direccion").textContent = dir;
  document.getElementById("print-telefono").textContent = tel;
  document.getElementById("print-ciudad").textContent = ciudadFinal;
  document.getElementById("print-correo").textContent = correo;
  
  const printTbody = document.getElementById("print-table-body");
  printTbody.innerHTML = "";
  
  let subtotal = 0;
  let totalDcto = 0;
  
  facturacionItems.forEach(item => {
    if (!item.desc) return; // Only show populated items in the preview
    const itemTotal = item.qty * (item.unitPrice - item.discount);
    subtotal += (item.qty * item.unitPrice);
    totalDcto += (item.qty * item.discount);
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding: 8px; border: 1px solid #7393a7; text-align: center;">${item.qty}</td>
      <td style="padding: 8px; border: 1px solid #7393a7;">${item.desc.toUpperCase()}</td>
      <td style="padding: 8px; border: 1px solid #7393a7; text-align: right;">$ ${item.unitPrice.toLocaleString("es-CO")}</td>
      <td style="padding: 8px; border: 1px solid #7393a7; text-align: right;">$ ${item.discount.toLocaleString("es-CO")}</td>
      <td style="padding: 8px; border: 1px solid #7393a7; text-align: right; font-weight: bold;">$ ${itemTotal.toLocaleString("es-CO")}</td>
    `;
    printTbody.appendChild(tr);
  });
  
  const totalPagar = subtotal - totalDcto;
  
  document.getElementById("print-total").textContent = `$ ${subtotal.toLocaleString("es-CO")}`;
  document.getElementById("print-total-dcto").textContent = `$ ${totalDcto.toLocaleString("es-CO")}`;
  document.getElementById("print-total-pagar").textContent = `$ ${totalPagar.toLocaleString("es-CO")}`;
  document.getElementById("print-observaciones").textContent = obs;
}

document.getElementById("form-facturacion").addEventListener("submit", async function(e) {
  e.preventDefault();
  
  if (facturacionItems.length === 0) {
    alert("Debe agregar al menos un ítem al documento.");
    return;
  }
  
  const invalidItems = facturacionItems.filter(i => !i.desc || i.desc === "");
  if (invalidItems.length > 0) {
    alert("Todos los ítems deben tener un producto seleccionado.");
    return;
  }

  const btnExportar = document.getElementById("btn-export-factura");
  btnExportar.disabled = true;
  btnExportar.innerHTML = `<i data-lucide="loader" class="spin"></i> Generando PDF...`;
  
  updatePrintTemplate(); // Ensure latest data is pushed
  
  const fecha = document.getElementById("facturacion-fecha").value;
  const nombre = document.getElementById("facturacion-nombre").value.trim().toUpperCase();
  const consecElement = document.getElementById("facturacion-consecutivo").textContent;
  
  const element = document.getElementById("factura-print-template");
  
  // Crear un contenedor temporal fuera de pantalla para evitar recortes de overflow del contenedor padre
  const tempContainer = document.createElement("div");
  tempContainer.style.position = "fixed";
  tempContainer.style.left = "-9999px";
  tempContainer.style.top = "-9999px";
  tempContainer.style.width = "816px";
  tempContainer.style.background = "white";
  
  const clone = element.cloneNode(true);
  clone.style.transform = "none"; // Eliminar transformaciones
  clone.style.width = "816px";
  clone.style.height = "1056px";
  clone.style.padding = "48px";
  
  tempContainer.appendChild(clone);
  document.body.appendChild(tempContainer);
  
  const opt = {
    margin:       0, // Margen cero porque ya está incluido como padding: 48px (0.5 in) en el diseño de la hoja
    filename:     `${currentFacturaType}_${consecElement}_${nombre}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2.5, useCORS: true, logging: false },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  
  // Calcular Total Final
  let totalPagar = 0;
  facturacionItems.forEach(item => {
    totalPagar += item.qty * (item.unitPrice - item.discount);
  });
  
  const nuevoDoc = {
    id: consecElement,
    date: fecha,
    docType: currentFacturaType,
    client: nombre,
    nit: document.getElementById("facturacion-nit").value.trim().toUpperCase(),
    direccion: document.getElementById("facturacion-direccion").value.trim().toUpperCase(),
    telefono: document.getElementById("facturacion-telefono").value.trim(),
    departamento: document.getElementById("facturacion-departamento").value,
    ciudad: document.getElementById("facturacion-ciudad").value,
    correo: document.getElementById("facturacion-correo").value.trim().toUpperCase(),
    observaciones: document.getElementById("facturacion-observaciones").value.trim().toUpperCase(),
    items: facturacionItems.map(item => ({
      qty: item.qty,
      desc: item.desc.trim().toUpperCase(),
      unitPrice: item.unitPrice,
      discount: item.discount
    })),
    total: totalPagar
  };

  State.facturacion.push(nuevoDoc);
  State.save();
  
  updateSummaryWidget();
  renderDocumentsHistory();

  try {
    await html2pdf().set(opt).from(clone).save();
    alert(`✅ ${currentFacturaType} registrada y exportada como PDF con éxito.`);
  } catch (err) {
    console.error(err);
    alert("⚠️ El documento se guardó en el historial, pero ocurrió un error al exportar el PDF. Puede re-exportarlo desde el Historial.");
  } finally {
    document.body.removeChild(tempContainer);
    // Resetear formulario
    facturacionItems = [{qty: 1, desc: "", unitPrice: 0, discount: 0}];
    document.getElementById("form-facturacion").reset();
    document.getElementById("facturacion-fecha").value = new Date().toISOString().split("T")[0];
    updateFacturacionHeader();
    renderFacturacionItems();
    updatePrintTemplate();
  }
  
  btnExportar.disabled = false;
  btnExportar.innerHTML = `<i data-lucide="download"></i> Generar y Exportar PDF`;
  lucide.createIcons();
});

// ==========================================================================
// LÓGICA DE RECUPERACIÓN DE CONTRASEÑA
// ==========================================================================
const recoveryModal = document.getElementById("modal-recovery");
const forgotPasswordBtn = document.getElementById("btn-forgot-password");
const closeRecoveryBtn = document.getElementById("btn-close-recovery");
const recoveryForm = document.getElementById("form-recovery");
const recoveryIdentity = document.getElementById("recovery-identity");
const recoveryResult = document.getElementById("recovery-result");
const adminResetFields = document.getElementById("admin-reset-fields");
const recoveryAdminKey = document.getElementById("recovery-admin-key");
const recoveryNewPassword = document.getElementById("recovery-new-password");
const submitRecoveryBtn = document.getElementById("btn-submit-recovery");

let recoveryTargetUser = null;

if (forgotPasswordBtn) {
  forgotPasswordBtn.onclick = function(e) {
    e.preventDefault();
    recoveryTargetUser = null;
    recoveryForm.reset();
    recoveryResult.classList.add("hidden");
    recoveryResult.className = "alert hidden";
    adminResetFields.classList.add("hidden");
    submitRecoveryBtn.textContent = "Verificar Usuario";
    submitRecoveryBtn.style.display = "block";
    recoveryModal.classList.remove("hidden");
    lucide.createIcons();
  };
}

if (closeRecoveryBtn) {
  closeRecoveryBtn.onclick = function() {
    recoveryModal.classList.add("hidden");
  };
}

if (recoveryForm) {
  recoveryForm.onsubmit = function(e) {
    e.preventDefault();
    
    // Si aún no hemos verificado el usuario
    if (!recoveryTargetUser) {
      const identity = recoveryIdentity.value.trim().toLowerCase();
      const user = State.users.find(u => 
        (u.email && u.email.toLowerCase() === identity) || 
        (u.username && u.username.toLowerCase() === identity)
      );
      
      if (!user) {
        recoveryResult.className = "alert alert-danger";
        recoveryResult.style.background = "#fef2f2";
        recoveryResult.style.color = "#991b1b";
        recoveryResult.style.border = "1px solid #fee2e2";
        recoveryResult.textContent = "⚠️ Usuario o correo no encontrado.";
        recoveryResult.classList.remove("hidden");
        return;
      }
      
      recoveryTargetUser = user;
      
      const isAdmin = user.role === "Administrador" || user.username === "admin" || user.email === "operaciones@tecnologiaymovilidad.com";
      
      if (isAdmin) {
        recoveryResult.className = "alert alert-warning";
        recoveryResult.style.background = "#fffbef";
        recoveryResult.style.color = "#854d0e";
        recoveryResult.style.border = "1px solid #fef08a";
        recoveryResult.innerHTML = "🔑 Para restablecer la contraseña de Administrador, por favor ingrese la Clave de Seguridad de Emergencia y su nueva contraseña.";
        recoveryResult.classList.remove("hidden");
        adminResetFields.classList.remove("hidden");
        submitRecoveryBtn.textContent = "Restablecer Contraseña";
      } else {
        recoveryResult.className = "alert alert-info";
        recoveryResult.style.background = "#f0f9ff";
        recoveryResult.style.color = "#0369a1";
        recoveryResult.style.border = "1px solid #e0f2fe";
        recoveryResult.innerHTML = "ℹ️ Tu contraseña debe ser restablecida por el Administrador. Por favor, contacta a <strong>operaciones@tecnologiaymovilidad.com</strong>.";
        recoveryResult.classList.remove("hidden");
        submitRecoveryBtn.style.display = "none";
      }
    } else {
      // Si ya verificamos y es Administrador, procedemos a restablecer
      const safetyKey = recoveryAdminKey.value.trim();
      const newPass = recoveryNewPassword.value;
      
      // Claves válidas: TM2026* o RECOVERY360 o Admin360*Recovery
      const validKeys = ["TM2026*", "RECOVERY360", "Admin360*Recovery"];
      if (!validKeys.includes(safetyKey)) {
        recoveryResult.className = "alert alert-danger";
        recoveryResult.style.background = "#fef2f2";
        recoveryResult.style.color = "#991b1b";
        recoveryResult.style.border = "1px solid #fee2e2";
        recoveryResult.textContent = "❌ Clave de Seguridad de Emergencia incorrecta.";
        return;
      }
      
      if (newPass.length < 6) {
        recoveryResult.className = "alert alert-danger";
        recoveryResult.style.background = "#fef2f2";
        recoveryResult.style.color = "#991b1b";
        recoveryResult.style.border = "1px solid #fee2e2";
        recoveryResult.textContent = "❌ La nueva contraseña debe tener al menos 6 caracteres.";
        return;
      }
      
      // Actualizar contraseña
      recoveryTargetUser.password = newPass;
      localStorage.setItem("inv360_admin_password_set", "true");
      State.save();
      
      recoveryResult.className = "alert alert-success";
      recoveryResult.style.background = "#f0fdf4";
      recoveryResult.style.color = "#166534";
      recoveryResult.style.border = "1px solid #dcfce7";
      recoveryResult.textContent = "✅ Contraseña de Administrador restablecida con éxito.";
      adminResetFields.classList.add("hidden");
      submitRecoveryBtn.style.display = "none";
      
      setTimeout(() => {
        recoveryModal.classList.add("hidden");
      }, 2000);
    }
  };
}