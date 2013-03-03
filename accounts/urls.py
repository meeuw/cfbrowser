from django.conf.urls import patterns, url
#urlpatterns = patterns('sfbrowser.views',
#)
urlpatterns = patterns('',
    url(r'login/$', 'django.contrib.auth.views.login', {'template_name': 'accounts/login.html'}),
)
