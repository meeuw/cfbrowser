from django.conf.urls import patterns, url
urlpatterns = patterns('sfbrowser.views',
    url(r'connectors/django/sfbrowser\.django$', 'sfbrowser'),
)
