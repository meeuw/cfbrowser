# Create your views here.
from django.shortcuts import render
from django.http import HttpResponse
from django.contrib.auth.decorators import login_required
from config.models import Config
from django.core.cache import cache
from base64 import b64decode
import json
import re
import cloudfiles
import time
@login_required
def index(request):
    browser = ''
    with open('sfbrowser/static/sfbrowser/browser.html') as f:
        browser = re.match(r'.*<body[^>]*>(.*)</body>.*', f.read(), re.DOTALL).group(1)
        browser = re.sub('[\n\r\t]', '', browser)
        browser = browser.replace('"', '\\"')
    conn = cloudfiles.get_connection(
        Config.objects.get(key='username').value,
        Config.objects.get(key='api_key').value,
        authurl=Config.objects.get(key='authurl').value,
    )
    containers = conn.list_containers()

    return render(request, 'sfbrowser/index.html', {'browser':browser, 'containers':containers})

def sfbrowser(request):
    conn = cloudfiles.get_connection(
        Config.objects.get(key='username').value,
        Config.objects.get(key='api_key').value,
        authurl=Config.objects.get(key='authurl').value,
    )
    ret = {'data':'','error':'', 'msg':''}
    if ('a' in request.POST):
        if (request.POST['a'] == 'fileList'):
            folder = request.POST['folder'].split('/')
            container = conn.create_container(folder[0]); #FIXME: Check permission!
            filelist = {}
            for obj in container.list_objects_info():
                filelist[obj['name']] = {
                    'file':obj['name'].split('/')[-1],
                    'mime':obj['content_type'],
                    'rsize':obj['bytes'],
                    'size':'%i'%obj['bytes'],
                    'time':time.mktime(time.strptime(obj['last_modified'][:19], '%Y-%m-%dT%H:%M:%S')),
                    'date':obj['last_modified'],
                    'width':0,
                    'height':0,
                }
            emptyfolders = cache.get('emptyfolders')
            if emptyfolders:
                for emptyfoldername, emptyfolder in emptyfolders.iteritems():
                    if emptyfoldername.split('/')[0] == folder[0]:
                        if not emptyfoldername in filelist:
                            filelist[emptyfoldername] = (emptyfolder)
            ret['data'] = []
            for filename, fileinfo in filelist.iteritems():
                if filename.startswith(request.POST['folder']):
                    ret['data'].append(fileinfo)
        elif (request.POST['a'] == 'addFolder'):
            # u'a': u'addFolder'], u'folder': [u'test/'], u'foldername': [u'New folder']
            path = request.POST['folder']+request.POST['foldername']
            path_split = path.split('/')
            newfolder = {
                'file':path_split[-1],
                'mime':"folder",
                'rsize':0,
                'size':"-",
                'time':0,
                'date':"01-01-2013 0:00",
            }
            emptyfolders = cache.get('emptyfolders')
            if not emptyfolders: emptyfolders = {}
            if path in emptyfolders:
                ret['msg'] = 'folderFailed';
                ret['data'] = None;
            else:
                emptyfolders[path] = newfolder;
                cache.set('emptyfolders', emptyfolders, 60*60*24);
                ret['msg'] = 'folderCreated';
                ret['data'] = newfolder;
        elif (request.POST['a'] == 'rename'):
            # u'a': [u'rename'], u'nfile': [u'newname'], u'folder': [u'test/'], u'file': [u'New folder']
            path = request.POST['folder']+request.POST['file']
            path_split = path.split('/')
            emptyfolders = cache.get('emptyfolders')
            if not emptyfolders: emptyfolders = {}
            if path in emptyfolders:
                emptyfolders[path]['file'] = request.POST['nfile']
                emptyfolders[request.POST['folder']+request.POST['nfile']] = emptyfolders[path]
                del emptyfolders[path]
            cache.set('emptyfolders', emptyfolders, 60*60*24)
            # FIXME: rename files / folders at cloud files
        else: print request
    elif ('a' in request.GET):
        if (request.GET['a'] == 'uploading'):
            conn = cloudfiles.get_connection(
                Config.objects.get(key='username').value,
                Config.objects.get(key='api_key').value,
                authurl=Config.objects.get(key='authurl').value,
            )
            container = conn.create_container(request.GET['folder'].split('/')[0]); #FIXME: Check permission!
            storage_object = container.create_object(request.META['HTTP_UP_FILENAME'])
            storage_object.send(b64stream(request))
            
            ret['data'] = {
                'file':request.META['HTTP_UP_FILENAME'],
                'mime':"plain/text",
                'rsize':0,
                'size':"0",
                'time':0,
                'date':"01-01-2013 0:00",
            }

    else: print request

    return HttpResponse(json.dumps(ret), content_type="application/json")

class b64stream:
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


