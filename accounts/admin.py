from django.contrib import admin
from accounts.models import Container
class ContainerAdmin(admin.ModelAdmin):
    pass
admin.site.register(Container, ContainerAdmin)
