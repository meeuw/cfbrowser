from django.db import models

class Config(models.Model):
    key = models.CharField(max_length=30)
    value = models.CharField(max_length=1024)
    def __unicode__(self):
        return u'%s=%s' % (self.key, self.value)
