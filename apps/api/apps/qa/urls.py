from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    QcChecklistDefinitionView,
    QcInspectionViewSet,
    QcQueueView,
)

router = DefaultRouter()
router.register('qa/inspections', QcInspectionViewSet, basename='qc-inspections')

urlpatterns = [
    path('qa/queue/', QcQueueView.as_view(), name='qc-queue'),
    path('qa/checklist/', QcChecklistDefinitionView.as_view(), name='qc-checklist'),
] + router.urls
