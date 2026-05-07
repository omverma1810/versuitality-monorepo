from rest_framework.routers import DefaultRouter

from .views import FabricUsageViewSet, FabricViewSet

router = DefaultRouter()
router.register('fabrics', FabricViewSet, basename='fabrics')
router.register('fabric-usage', FabricUsageViewSet, basename='fabric-usage')

urlpatterns = router.urls
