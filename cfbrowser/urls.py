from django.conf.urls import patterns, include, url

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()
import sfbrowser.views
import sfbrowser.urls
import accounts.urls

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'cfbrowser.views.home', name='home'),
    # url(r'^cfbrowser/', include('cfbrowser.foo.urls')),

    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    url(r'^admin/', include(admin.site.urls)),
    url(r'^$', sfbrowser.views.index),
    url(r'^sfbrowser/', include(sfbrowser.urls)),
    url(r'^accounts/', include(accounts.urls)),
)
