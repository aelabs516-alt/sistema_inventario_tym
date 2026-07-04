from django.urls import path
from . import views

urlpatterns = [
    # Ruta específica para Django REST Framework (debe ir arriba para tener prioridad)
    path('products/drf/', views.ProductListCreateView.as_view(), name='product-list-drf'),

    # Rutas de autenticación y sincronización
    path('auth/login', views.login_view, name='login'),
    path('auth/logout', views.logout_view, name='logout'),
    path('auth/me', views.me_view, name='me'),
    path('init-state', views.init_state, name='init_state'),
    path('sync-state', views.sync_state, name='sync_state'),
    path('sync-metadata', views.sync_metadata, name='sync_metadata'),

    # Rutas dinámicas (Deben ir al final para no interferir con las rutas específicas)
    path('<str:resource_name>', views.api_resource, name='api_resource_list'),
    path('<str:resource_name>/<path:resource_id>', views.api_resource, name='api_resource_detail'),
]