from rest_framework.routers import DefaultRouter

from .views import MeasurementSetViewSet

router = DefaultRouter()
router.register('measurements', MeasurementSetViewSet, basename='measurements')

urlpatterns = router.urls
