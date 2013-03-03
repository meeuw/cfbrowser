# Create your views here.
from django.shortcuts import render
from django.http import HttpResponse
from django.contrib.auth.decorators import login_required
from config.models import Config
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

    return render(request, 'sfbrowser/index.html', {'browser':browser})

def sfbrowser(request):
    conn = cloudfiles.get_connection(
        Config.objects.get(key='username').value,
        Config.objects.get(key='api_key').value,
        authurl=Config.objects.get(key='authurl').value,
    )
    container = conn.create_container('cloudservers')
    ret = {}
    if ('a' in request.POST):
        if (request.POST['a'] == 'fileList'):
            ret['error'] = ''
            ret['msg'] = ''
            ret['data'] = []
            for obj in container.list_objects_info():
                ret['data'].append({
                    'file':obj['name'],
                    'mime':obj['content_type'],
                    'rsize':obj['bytes'],
                    'size':'%i'%obj['bytes'],
                    'time':time.mktime(time.strptime(obj['last_modified'][:19], '%Y-%m-%dT%H:%M:%S')),
                    'date':obj['last_modified'],
                    'width':0,
                    'height':0,
                })
        else: print request.POST['a']
    else: print request

    return HttpResponse(json.dumps(ret), content_type="application/json")
