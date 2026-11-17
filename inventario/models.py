from django.db import models
from django.utils import timezone


class AuditedIndexedModel(models.Model):
    """
    Modelo base abstracto con columnas indexadas B-Tree para llaves foráneas lógicas
    (user_id, company_id, product_id), fechas de auditoría (created_at) y filtros
    compuestos de inventario/movimientos (sucursal_id + sku, estado + fecha).
    Totalmente retrocompatible con el almacenamiento documental en `data` (JSONB).
    """
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    # Columnas indexadas (B-Tree) para consultas rápidas y filtrado sin Full Table Scan
    user_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    company_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    product_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    sucursal_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    sku = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    estado = models.CharField(max_length=120, null=True, blank=True, db_index=True)
    fecha = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now, null=True, blank=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        abstract = True

    def sync_indexed_fields_from_data(self):
        if not isinstance(self.data, dict):
            return
        d = self.data
        # SKU / Product ID
        extracted_sku = d.get('sku')
        if not extracted_sku and isinstance(d.get('items'), list) and len(d['items']) > 0:
            first_item = d['items'][0]
            if isinstance(first_item, dict):
                extracted_sku = first_item.get('sku') or first_item.get('desc')
        if extracted_sku:
            self.sku = str(extracted_sku)[:255]
            if not self.product_id:
                self.product_id = str(extracted_sku)[:255]

        # Sucursal / Bodega / Punto de Venta
        sucursal = d.get('warehouse') or d.get('originWarehouse') or d.get('pve') or d.get('sucursal_id')
        if sucursal:
            self.sucursal_id = str(sucursal)[:255]

        # Estado / Condición / Tipo
        estado = d.get('status') or d.get('condition') or d.get('estado') or d.get('docType') or d.get('category')
        if estado:
            self.estado = str(estado)[:120]

        # Fecha de operación
        fecha = d.get('date') or d.get('fecha') or d.get('createdAt')
        if fecha:
            self.fecha = str(fecha)[:64]

        # Usuario / Vendedor
        user_ref = d.get('user_id') or d.get('email') or d.get('seller')
        if user_ref:
            self.user_id = str(user_ref)[:255]

        # Compañía / Cliente NIT
        company_ref = d.get('company_id') or d.get('nit') or d.get('idCard')
        if company_ref:
            self.company_id = str(company_ref)[:255]

    def save(self, *args, **kwargs):
        self.sync_indexed_fields_from_data()
        super().save(*args, **kwargs)

    def __str__(self):
        return str(self.id)


class AppUser(AuditedIndexedModel):
    class Meta:
        db_table = 'app_users'
        indexes = [
            models.Index(fields=['user_id', 'created_at'], name='idx_appuser_user_created'),
        ]


class Product(AuditedIndexedModel):
    class Meta:
        db_table = 'products'
        indexes = [
            models.Index(fields=['sucursal_id', 'sku'], name='idx_product_sucursal_sku'),
            models.Index(fields=['estado', 'fecha'], name='idx_product_estado_fecha'),
        ]


class Warehouse(AuditedIndexedModel):
    class Meta:
        db_table = 'warehouses'


class Pve(AuditedIndexedModel):
    class Meta:
        db_table = 'pves'


class Carrier(AuditedIndexedModel):
    class Meta:
        db_table = 'carriers'


class Seller(AuditedIndexedModel):
    class Meta:
        db_table = 'sellers'


class Ingreso(AuditedIndexedModel):
    class Meta:
        db_table = 'ingresos'
        indexes = [
            models.Index(fields=['sucursal_id', 'sku'], name='idx_ingreso_sucursal_sku'),
            models.Index(fields=['estado', 'fecha'], name='idx_ingreso_estado_fecha'),
        ]


class Salida(AuditedIndexedModel):
    class Meta:
        db_table = 'salidas'
        indexes = [
            models.Index(fields=['sucursal_id', 'sku'], name='idx_salida_sucursal_sku'),
            models.Index(fields=['estado', 'fecha'], name='idx_salida_estado_fecha'),
        ]


class Traslado(AuditedIndexedModel):
    class Meta:
        db_table = 'traslados'
        indexes = [
            models.Index(fields=['sucursal_id', 'sku'], name='idx_traslado_sucursal_sku'),
            models.Index(fields=['estado', 'fecha'], name='idx_traslado_estado_fecha'),
        ]


class Reserva(AuditedIndexedModel):
    class Meta:
        db_table = 'reservas'
        indexes = [
            models.Index(fields=['sucursal_id', 'sku'], name='idx_reserva_sucursal_sku'),
            models.Index(fields=['estado', 'fecha'], name='idx_reserva_estado_fecha'),
        ]


class Factura(AuditedIndexedModel):
    class Meta:
        db_table = 'facturas'
        indexes = [
            models.Index(fields=['company_id', 'fecha'], name='idx_factura_company_fecha'),
            models.Index(fields=['estado', 'fecha'], name='idx_factura_estado_fecha'),
        ]


class Garantia(AuditedIndexedModel):
    class Meta:
        db_table = 'garantias'
        indexes = [
            models.Index(fields=['estado', 'fecha'], name='idx_garantia_estado_fecha'),
            models.Index(fields=['product_id', 'created_at'], name='idx_garantia_prod_created'),
        ]


class ActiveSession(models.Model):
    """
    Tabla dedicada en PostgreSQL para almacenamiento y auditoría centralizada de sesiones
    entre múltiples workers de Gunicorn, con control de Idle Timeout, Absolute Timeout
    y revocación inmediata por usuario.
    """
    session_key = models.CharField(max_length=128, primary_key=True, db_index=True)
    user_id = models.CharField(max_length=255, db_index=True)
    ip_address = models.CharField(max_length=64, null=True, blank=True)
    user_agent = models.CharField(max_length=512, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_activity = models.DateTimeField(default=timezone.now, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    is_revoked = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'active_sessions'
        indexes = [
            models.Index(fields=['user_id', 'is_revoked'], name='idx_sess_user_revoked'),
            models.Index(fields=['is_revoked', 'expires_at'], name='idx_sess_revoked_expires'),
        ]

    def __str__(self):
        return f"{self.user_id} ({self.session_key[:8]}...)"