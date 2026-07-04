from django.db import models

class AppUser(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'app_users'

    def __str__(self):
        return str(self.id)

class Product(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'products'

    def __str__(self):
        return str(self.id)

class Warehouse(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'warehouses'

    def __str__(self):
        return str(self.id)

class Pve(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'pves'

    def __str__(self):
        return str(self.id)

class Carrier(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'carriers'

    def __str__(self):
        return str(self.id)

class Seller(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'sellers'

    def __str__(self):
        return str(self.id)

class Ingreso(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'ingresos'

    def __str__(self):
        return str(self.id)

class Salida(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'salidas'

    def __str__(self):
        return str(self.id)

class Traslado(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'traslados'

    def __str__(self):
        return str(self.id)

class Reserva(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'reservas'

    def __str__(self):
        return str(self.id)

class Factura(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'facturas'

    def __str__(self):
        return str(self.id)

class Garantia(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    data = models.JSONField()

    class Meta:
        db_table = 'garantias'

    def __str__(self):
        return str(self.id)