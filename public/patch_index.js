const fs = require('fs');
const file = "C:/Users/Falcon/Documents/inventario/sistema_inventario_tym/public/index.html";
let content = fs.readFileSync(file, 'utf8');

const htmlToAdd = `
  <!-- MODAL EDIT INGRESO SERIALS LIST -->
  <div id="modal-edit-ingreso-list" class="modal-wrapper hidden">
    <div class="modal-card">
      <div class="modal-header">
        <h4>Editar Seriales de Ingreso</h4>
        <button class="modal-close-btn" id="btn-close-edit-ingreso-list"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">
        <p class="text-muted text-sm mb-3">Seleccione el producto al cual desea editarle los seriales.</p>
        <table class="table" style="width: 100%;">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Cant.</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody id="edit-ingreso-list-tbody">
          </tbody>
        </table>
      </div>
    </div>
  </div>
`;

content = content.replace('<!-- MODAL SELECCIONAR SERIALES (ME) -->', htmlToAdd + '\n  <!-- MODAL SELECCIONAR SERIALES (ME) -->');
fs.writeFileSync(file, content);
