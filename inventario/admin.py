from django.contrib import admin
from .models import (
    AppUser, Product, Warehouse, Pve, Carrier, Seller,
    Ingreso, Salida, Traslado, Reserva, Factura, Garantia
)

# 1. Creamos una clase base ya que todos tus modelos comparten la misma estructura (id y data)
class JsonModelBaseAdmin(admin.ModelAdmin):
    # Mostramos el ID y el resumen del JSON en la lista principal
    list_display = ('id', 'resumen_datos')
    
    # Habilitamos una barra de búsqueda para buscar por el ID exacto
    search_fields = ('id',)
    
    # Paginación para mantener el panel rápido
    list_per_page = 50

    # Esta función convierte el JSON a texto y lo recorta a 75 caracteres 
    # para que la tabla principal se vea ordenada y no colapse visualmente.
    def resumen_datos(self, obj):
        datos_str = str(obj.data)
        if len(datos_str) > 75:
            return datos_str[:75] + '...'
        return datos_str
    
    # Le damos un nombre bonito a la columna
    resumen_datos.short_description = 'Contenido de Datos (JSON)'

# 2. Registramos todos tus modelos aplicando la configuración base
@admin.register(AppUser)
class AppUserAdmin(JsonModelBaseAdmin):
    pass

@admin.register(Product)
class ProductAdmin(JsonModelBaseAdmin):
    pass

@admin.register(Warehouse)
class WarehouseAdmin(JsonModelBaseAdmin):
    pass

@admin.register(Pve)
class PveAdmin(JsonModelBaseAdmin):
    pass

@admin.register(Carrier)
class CarrierAdmin(JsonModelBaseAdmin):
    pass

@admin.register(Seller)
class SellerAdmin(JsonModelBaseAdmin):
    pass

@admin.register(Ingreso)
class IngresoAdmin(JsonModelBaseAdmin):
    pass

@admin.register(Salida)
class SalidaAdmin(JsonModelBaseAdmin):
    pass

@admin.register(Traslado)
class TrasladoAdmin(JsonModelBaseAdmin):
    pass

@admin.register(Reserva)
class ReservaAdmin(JsonModelBaseAdmin):
    pass

@admin.register(Factura)
class FacturaAdmin(JsonModelBaseAdmin):
    pass

@admin.register(Garantia)
class GarantiaAdmin(JsonModelBaseAdmin):
    pass