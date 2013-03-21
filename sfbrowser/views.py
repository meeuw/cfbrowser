# Create your views here.
from django.shortcuts import render
from django.http import HttpResponse
from django.contrib.auth.decorators import login_required
from config.models import Config
from accounts.models import Container
from django.core.cache import cache
from base64 import b64decode
from django.core.exceptions import SuspiciousOperation
from fakefs.fakefs import FakeFS, PathHelper
import json
import re
import cloudfiles
import time
import os.path
@login_required
def index(request):
    browser = ''
    with open(os.path.dirname(os.path.abspath(__file__))+
        '/static/sfbrowser/browser.html') as f:
        browser = re.match(r'.*<body[^>]*>(.*)</body>.*', f.read(),
            re.DOTALL).group(1)
        browser = re.sub('[\n\r\t]', '', browser)
        browser = browser.replace('"', '\\"')
    conn = cloudfiles.get_connection(
        Config.objects.get(key='username').value,
        Config.objects.get(key='api_key').value,
        authurl=Config.objects.get(key='authurl').value,
    )
    containers = []
    access = []
    for container in Container.objects.filter(user=request.user, read=True):
        access.append(container.container)
    for container in conn.list_containers():
        if container in access: containers.append(container)
    return render(request, 'sfbrowser/index.html',
        {'browser':browser, 'containers':containers})

class SFBrowserFS(FakeFS):
    def fileinfo(self, name, mime, size=0, dt=None):
        return {
            'file':name,
            'mime':mime,
            'rsize':size,
            'size':str(size),
            'time':0,
            'date':"01-01-2013 0:00", # FIXME
        }
    def auth(self, user, read, write):
        self._user = user
        self._read = read
        self._write = write
    def get_container(self, container):
        containers = Container.objects.filter(user=self._user, container=container)
        if containers.count() == 1:
            c = containers[0]
            if self._write and not c.write:
                raise SuspiciousOperation
            elif self._read and not c.read:
                raise SuspiciousOperation
            else:
                return self.conn.create_container(container)
        else:
            raise SuspiciousOperation
    def get_conn(self):
        return cloudfiles.get_connection(
            Config.objects.get(key='username').value,
            Config.objects.get(key='api_key').value,
            authurl=Config.objects.get(key='authurl').value,
        )
    def uploading(self, path):
        container = self.get_container()
        storage_object = container.create_object(path.directoryfilename)
        storage_object.send(B64stream(request))
        return fileinfo(path.filename, "application/octet-stream", 0, 0)

    def download(self, path):
        container = self.get_container(path.container)
        return container.get_object(path.directoryfilename)

@login_required
def sfbrowser(request):
    ret = {'data':'', 'error':'', 'msg':''}
    sfbrowserfs = SFBrowserFS()
    if ('a' in request.POST):
        if (request.POST['a'] == 'fileList'):
            sfbrowserfs.auth(request.user, True, False)
            ret['data'] = sfbrowserfs.fileList(request.POST['folder'])
        elif (request.POST['a'] == 'addFolder'):
            # u'a': u'addFolder'], u'folder': [u'test/'],
            # u'foldername': [u'New folder']
            sfbrowsersf.auth(request.user, True, True)
            ret['msg'] = 'folderCreated'
            ret['data'] = sfbrowserfs.addFolder()
        elif (request.POST['a'] == 'rename'):
            # u'a': [u'rename'], u'nfile': [u'newname'], u'folder': [u'test/'],
            # u'file': [u'New folder']
            sfbrowserfs.auth(request.user, True, True)
            sfbrowserfs.rename(
                PathHelper(fulldirectory=request.POST['folder'],
                    filename=request.POST['file']),
                PathHelper(fulldirectory=request.POST['folder'],
                    filename=request.POST['nfile'])
            )
        elif (request.POST['a'] == 'delete'):
            # u'a': [u'delete'], u'folder': [u'test/'], u'file': [u'4321']
            sfbrowserfs.auth(request.user, True, True)
            sfbrowserfs.delete(PathHelper(fulldirectory=request.POST['folder'],
                    filename=request.POST['file']))
        else: print request
    elif ('a' in request.GET):
        if (request.GET['a'] == 'uploading'):
            sfbrowserfs.auth(request.user, True, True)
            return sfbrowser.uploading(
                PathHelper(fulldirectory=request.GET['folder'],
                    filename=request.META['HTTP_UP_FILENAME']))
        elif (request.GET['a'] == 'download'):
            sfbrowserfs.auth(request.user, True, False)
            path = PathHelper(fullpath=request.GET['file'])
            storage_object = sfbrowserfs.download(path)
            response = HttpResponse(storage_object.stream(),
                    content_type=storage_object.content_type)
            response['Content-Disposition'] = \
                'attachment; filename="%s"' % path.filename
            return response
    else: print request

    return HttpResponse(json.dumps(ret), content_type="application/json")

class B64stream:
    #size = 123
    #content_type
    def __init__(self, request):
        self.request = request
    def __iter__(self):
        return self
    def next(self):
        while 1:
            line = self.request.read(60)
            if not line: raise StopIteration
            return b64decode(line)
