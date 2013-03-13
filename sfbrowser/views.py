# Create your views here.
from django.shortcuts import render
from django.http import HttpResponse
from django.contrib.auth.decorators import login_required
from config.models import Config
from accounts.models import Container
from django.core.cache import cache
from base64 import b64decode
from django.core.exceptions import SuspiciousOperation
import json
import re
import cloudfiles
import time
def mknewfolder(name):
    return {
        'file':name,
        'mime':"folder",
        'rsize':0,
        'size':"-",
        'time':0,
        'date':"01-01-2013 0:00",
    }
def auth_create_container(conn, user, container, read, write):
    containers = Container.objects.filter(user=user, container=container)
    if containers.count() == 1:
        c = containers[0]
        if write and not c.write:
            raise SuspiciousOperation
        elif read and not c.read:
            raise SuspiciousOperation
        else:
            return conn.create_container(container)
    else:
        raise SuspiciousOperation

@login_required
def index(request):
    browser = ''
    with open('sfbrowser/static/sfbrowser/browser.html') as f:
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

@login_required
def sfbrowser(request):
    conn = cloudfiles.get_connection(
        Config.objects.get(key='username').value,
        Config.objects.get(key='api_key').value,
        authurl=Config.objects.get(key='authurl').value,
    )
    ret = {'data':'', 'error':'', 'msg':''}
    if ('a' in request.POST):
        if (request.POST['a'] == 'fileList'):
            path = PathHelper(fulldirectory=request.POST['folder'],
                filename='dummy')
            container = auth_create_container(
                    conn, request.user, path.container, True, False)
            filelist = {}
            fakefolders = cache.get('fakefolders_'+path.container)
            if not fakefolders: fakefolders = {}
            for obj in container.list_objects_info():
                obj_path = PathHelper(
                    fullpath='%s/%s'%(path.container, obj['name']))
                filelist[obj_path.directoryfilename] = {
                    'file':obj_path.filename,
                    'mime':obj['content_type'],
                    'rsize':obj['bytes'],
                    'size':int(obj['bytes']),
                    'time':time.mktime(time.strptime(
                        obj['last_modified'][:19], '%Y-%m-%dT%H:%M:%S')),
                    'date':obj['last_modified'],
                    'width':0,
                    'height':0,
                }
                ds = ''
                for d in obj_path.directoryfilename.split('/')[:-1]:
                    ds += d
                    if not ds in fakefolders: fakefolders[ds] = mknewfolder(d)
                    ds += '/'
            for fakefoldername, fakefolder in fakefolders.iteritems():
                if not fakefoldername in filelist:
                    filelist[fakefoldername] = fakefolder
            ret['data'] = []
            for filename, fileinfo in filelist.iteritems():
                filename_path = PathHelper(
                    fulldirectory=path.container+'/'+filename)
                if filename_path.directory == path.directory:
                    ret['data'].append(fileinfo)
        elif (request.POST['a'] == 'addFolder'):
            # u'a': u'addFolder'], u'folder': [u'test/'],
            # u'foldername': [u'New folder']
            path = PathHelper(fulldirectory=request.POST['folder'],
                filename=request.POST['foldername'])
            fakefolders = cache.get('fakefolders_'+path.container)
            if not fakefolders: fakefolders = {}
            if path.directoryfilename in fakefolders:
                ret['msg'] = 'folderFailed'
                ret['data'] = None
            else:
                newfolder = mknewfolder(path.filename)
                fakefolders[path.directoryfilename] = newfolder
                cache.set('fakefolders_'+path.container, fakefolders, 60*60*24)
                ret['msg'] = 'folderCreated'
                ret['data'] = newfolder
        elif (request.POST['a'] == 'rename'):
            # u'a': [u'rename'], u'nfile': [u'newname'], u'folder': [u'test/'],
            # u'file': [u'New folder']
            path = PathHelper(fulldirectory=request.POST['folder'],
                filename=request.POST['file'])
            npath = PathHelper(fulldirectory=request.POST['folder'],
                filename=request.POST['nfile'])
            fakefolders = cache.get('fakefolders_'+path.container)
            if not fakefolders: fakefolders = {}
            if path.directoryfilename in fakefolders:
                # FIXME:recurse!
                fakefolders[npath.directoryfilename] = \
                    fakefolders[path.directoryfilename]
                fakefolders[npath.directoryfilename]['file'] = npath.filename
                del fakefolders[path.directoryfilename]
                cache.set('fakefolders_'+path.container, fakefolders, 60*60*24)
            else:
                container = auth_create_container(
                        conn, request.user, path.container, True, True)
                storage_object = container.create_object(path.directoryfilename)

                storage_object.copy_to(npath.container, npath.directoryfilename)
                container.delete_object(path.directoryfilename)
        elif (request.POST['a'] == 'delete'):
            # u'a': [u'delete'], u'folder': [u'test/'], u'file': [u'4321']
            path = PathHelper(fulldirectory=request.POST['folder'],
                    filename=request.POST['file'])
            container = auth_create_container(
                    conn, request.user, path.container, True, True)
            container.delete_object(path.directoryfilename)
        else: print request
    elif ('a' in request.GET):
        if (request.GET['a'] == 'uploading'):
            conn = cloudfiles.get_connection(
                Config.objects.get(key='username').value,
                Config.objects.get(key='api_key').value,
                authurl=Config.objects.get(key='authurl').value,
            )
            path = PathHelper(fulldirectory=request.GET['folder'],
                filename=request.META['HTTP_UP_FILENAME'])
            container = auth_create_container(
                conn, request.user, path.container, True, True)
            storage_object = container.create_object(path.directoryfilename)
            storage_object.send(B64stream(request))
            
            ret['data'] = {
                'file':path.filename,
                'mime':"plain/text",
                'rsize':0,
                'size':"0",
                'time':0,
                'date':"01-01-2013 0:00",
            }
        elif (request.GET['a'] == 'download'):
            conn = cloudfiles.get_connection(
                Config.objects.get(key='username').value,
                Config.objects.get(key='api_key').value,
                authurl=Config.objects.get(key='authurl').value,
            )
            path = PathHelper(fullpath=request.GET['file'])
            container = auth_create_container(
                conn, request.user, path.container, True, False)
            storage_object = container.get_object(path.directoryfilename)
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

class PathHelper:
    def __init__(self, **kwargs):
        d = self.__dict__
        d['fullpath'] = None          # test/abc/def
        d['container'] = None         # test
        d['fulldirectory'] = None     # test/abc
        d['directory'] = None         # abc
        d['directoryfilename'] = None # abc/def
        d['filename'] = None          # def
        if 'fullpath' in kwargs: self.fullpath = kwargs['fullpath']
        if 'fulldirectory' in kwargs:
            self.fulldirectory = kwargs['fulldirectory']
        if 'filename' in kwargs: self.filename = kwargs['filename']
    def __getattr__(self, name):
        d = self.__dict__         # abc/def/ghi
    def __setattr__(self, name, value):
        d = self.__dict__
        if name == 'fulldirectory':
            d['fulldirectory'] = '/'.join(filter(None, value.split('/')))
        elif name == 'filename': 
            d['filename'] = value.replace('/','')
        elif name == 'fullpath': d['fullpath'] = value
        if d['fulldirectory']:
            if d['filename']:
                d['directoryfilename'] = None
                d['fullpath'] = d['fulldirectory']+'/'+d['filename']
                d['directory'] = None
            else:
                d['fullpath'] = d['fulldirectory']
        if d['fullpath']:
            s = d['fullpath'].split('/')
            s = filter(None, s)
            if not d['container']: d['container'] = s[0]
            if not d['fulldirectory']: d['fulldirectory'] = '/'.join(s[:-1])
            if not d['directory']: d['directory'] = '/'.join(s[1:-1])
            if not d['filename']: d['filename'] = s[-1]
            if not d['directoryfilename']:
                d['directoryfilename'] = '/'.join(s[1:])

