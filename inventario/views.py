import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.views.decorators.cache import never_cache
from functools import wraps

# Imports de Django REST Framework
from rest_framework import generics
from .serializers import ProductSerializer

from .models import (
    AppUser, Product, Warehouse, Pve, Carrier, Seller,
    Ingreso, Salida, Traslado, Reserva, Factura, Garantia
)

MODEL_MAPPING = {
    'users': AppUser,
    'products': Product,
    'warehouses': Warehouse,
    'pve': Pve,
    'carriers': Carrier,
    'sellers': Seller,
    'ingresos': Ingreso,
    'salidas': Salida,
    'traslados': Traslado,
    'reservas': Reserva,
    'facturacion': Factura,
    'garantias': Garantia,
}

ID_FIELDS = {
    'users': 'email',
    'products': 'sku',
    'warehouses': None,
    'pve': None,
    'carriers': None,
    'sellers': 'name',
    'ingresos': 'id',
    'salidas': 'id',
    'traslados': 'id',
    'reservas': 'id',
    'facturacion': 'id',
    'garantias': 'id',
}

def require_auth(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.session.get('active_user_email'):
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        return view_func(request, *args, **kwargs)
    return _wrapped_view

@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return JsonResponse({'error': 'Faltan credenciales'}, status=400)

        # Check default admin backdoor for testing/recovery
        if (email == 'admin' or email == 'admin@inventario.com') and password == '123456':
            user_obj = AppUser.objects.filter(id='admin@inventario.com').first()
            if not user_obj:
                # Create default admin if it doesn't exist
                default_admin = {
                    "email": "admin@inventario.com",
                    "username": "ADMIN",
                    "password": "123456",
                    "name": "Administrador",
                    "role": "Administrador",
                    "perms": []
                }
                user_obj = AppUser.objects.create(id='admin@inventario.com', data=default_admin)
            request.session['active_user_email'] = 'admin@inventario.com'
            return JsonResponse({'success': True, 'user': user_obj.data})

        # Normal login
        user_record = AppUser.objects.filter(id=email).first()
        if not user_record:
            users = AppUser.objects.exclude(id='SYSTEM_METADATA')
            for u in users:
                d = u.data
                if isinstance(d, dict):
                    if (d.get('email', '').lower() == email or d.get('username', '').lower() == email):
                        if d.get('password') == password:
                            request.session['active_user_email'] = u.id
                            return JsonResponse({'success': True, 'user': d})
            return JsonResponse({'error': 'Credenciales inválidas'}, status=401)

        if isinstance(user_record.data, dict) and user_record.data.get('password') == password:
            request.session['active_user_email'] = user_record.id
            return JsonResponse({'success': True, 'user': user_record.data})
            
        return JsonResponse({'error': 'Credenciales inválidas'}, status=401)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request):
    request.session.flush()
    return JsonResponse({'success': True})

@require_http_methods(["GET"])
def me_view(request):
    email = request.session.get('active_user_email')
    if not email:
        return JsonResponse({'error': 'No session'}, status=401)
    user = AppUser.objects.filter(id=email).first()
    if user:
        return JsonResponse({'user': user.data})
    return JsonResponse({'error': 'User not found'}, status=404)

@require_http_methods(["GET"])
@never_cache
@require_auth
def init_state(request):
    try:
        state = {}
        for state_key, model_class in MODEL_MAPPING.items():
            if model_class == AppUser:
                records = model_class.objects.exclude(id='SYSTEM_METADATA').values_list('data', flat=True)
            else:
                records = model_class.objects.all().values_list('data', flat=True)
            state[state_key] = list(records)
        
        meta_record = AppUser.objects.filter(id='SYSTEM_METADATA').first()
        if meta_record and isinstance(meta_record.data, dict):
            for extra_key, extra_value in meta_record.data.items():
                state[extra_key] = extra_value
        else:
            state['activeUser'] = None
            state['backup'] = {"frequency": "Mensual", "time": "02:00", "emails": ""}
            state['backupsLog'] = []
            state['pedidosAccesorios'] = []
            state['rotulos'] = []
            state['simulations'] = []
            
        return JsonResponse(state)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET", "POST", "PUT", "DELETE"])
@require_auth
def api_resource(request, resource_name, resource_id=None):
    if resource_name not in MODEL_MAPPING:
        return JsonResponse({'error': 'Resource not found'}, status=404)
        
    model_class = MODEL_MAPPING[resource_name]
    
    if request.method == "GET":
        if resource_id:
            obj = model_class.objects.filter(id=resource_id).first()
            if obj:
                return JsonResponse(obj.data, safe=False)
            return JsonResponse({'error': 'Not found'}, status=404)
        else:
            records = model_class.objects.all().values_list('data', flat=True)
            return JsonResponse(list(records), safe=False)
            
    elif request.method in ["POST", "PUT"]:
        try:
            data = json.loads(request.body)
            if resource_id is None:
                id_field = ID_FIELDS.get(resource_name)
                if id_field and isinstance(data, dict):
                    resource_id = data.get(id_field)
                elif isinstance(data, str):
                    resource_id = data
                else:
                    return JsonResponse({'error': 'Missing ID in payload'}, status=400)
                    
            if not resource_id:
                return JsonResponse({'error': 'Missing ID'}, status=400)
                
            model_class.objects.update_or_create(
                id=resource_id,
                defaults={'data': data}
            )
            return JsonResponse({'success': True, 'id': resource_id})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
            
    elif request.method == "DELETE":
        if not resource_id:
            return JsonResponse({'error': 'Missing ID for deletion'}, status=400)
        model_class.objects.filter(id=resource_id).delete()
        return JsonResponse({'success': True})
        
@csrf_exempt
@require_http_methods(["POST"])
@require_auth
def sync_metadata(request):
    try:
        new_state = json.loads(request.body)
        extra_keys = ['activeUser', 'backup', 'backupsLog', 'pedidosAccesorios', 'rotulos', 'simulations']
        meta_data = {}
        for key in extra_keys:
            if key in new_state:
                meta_data[key] = new_state[key]
                
        existing_meta = AppUser.objects.filter(id='SYSTEM_METADATA').first()
        if existing_meta and isinstance(existing_meta.data, dict):
            for key in extra_keys:
                if key in existing_meta.data and (key not in meta_data or meta_data[key] is None or meta_data[key] == []):
                    meta_data[key] = existing_meta.data[key]
        
        AppUser.objects.update_or_create(
            id='SYSTEM_METADATA',
            defaults={'data': meta_data}
        )
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
@require_auth
def sync_state(request):
    return JsonResponse({'success': True, 'message': 'Endpoint deprecado. Use APIs granulares.'})

# Vista basada en DRF para el modelo Product
class ProductListCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer