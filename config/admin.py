from django.contrib import admin
from config.models import Config
class ConfigAdmin(admin.ModelAdmin):
    pass
admin.site.register(Config, ConfigAdmin)
