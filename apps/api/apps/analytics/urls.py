from django.urls import path

from .views import AnalyticsOrdersExportView, AnalyticsSummaryView

urlpatterns = [
    path('analytics/summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
    path(
        'analytics/orders.xlsx/',
        AnalyticsOrdersExportView.as_view(),
        name='analytics-orders-xlsx',
    ),
]
