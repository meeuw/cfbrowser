from django.db import models
from django.contrib.auth.models import User

class Container(models.Model):
    user = models.ForeignKey(User)
    container = models.CharField(max_length=255)
    read = models.BooleanField()
    write = models.BooleanField()
    class Meta:
        unique_together = (("user", "container"),)
    def __unicode__(self):
        return '%s/%s'%(self.user, self.container)
