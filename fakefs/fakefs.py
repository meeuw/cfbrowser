from django.core.cache import cache
import datetime
from os.path import basename

class FakeFS:
    def fileinfo(self, name, mime, size=0, dt=None):
        return [name, mime, size, dt]

    def __init__(self):
        self.conn = self.get_conn()

    def get_conn(self):
        return None

    def get_container(self, container):
        return self.conn.create_container(container)

    def get_fakefolders(self, path):
        fakefolders = cache.get('fakefolders_'+path.container)
        if not fakefolders: fakefolders = []
        return fakefolders
    def set_fakefolders(self, fakefolders, path):
        cache.set('fakefolders_'+path.container, fakefolders, 60*60*24)

    def fileList(self, folder):
        path = PathHelper(fulldirectory=folder, filename='dummy')
        container = self.get_container(path.container)
        filelist = {}
        fakefolders = self.get_fakefolders(path)
        for obj in container.list_objects_info():
            obj_path = PathHelper(
                fullpath='%s/%s'%(path.container, obj['name']))
            filelist[obj_path.directoryfilename] = self.fileinfo(
                obj_path.filename,
                obj['content_type'],
                obj['bytes'],
                datetime.datetime.strptime(obj['last_modified'][:19],
                    "%Y-%m-%dT%H:%M:%S")
            )
            ds = ''
            for d in obj_path.directoryfilename.split('/')[:-1]:
                ds += d
                if not ds in fakefolders: fakefolders.append(ds)
                ds += '/'
        for fakefoldername in fakefolders:
            if not fakefoldername in filelist:
                filelist[fakefoldername] = \
                    self.fileinfo(basename(fakefoldername), 'folder')
        ret = []
        for filename, fileinfo in filelist.iteritems():
            filename_path = PathHelper(
                fulldirectory=path.container + '/' + filename)
            if filename_path.directory == path.directory:
                ret.append(fileinfo)
        return ret
    def addFolder(self, path):
        fakefolders = self.get_fakefolders(path)
        if path.directoryfilename in fakefolders:
            pass # FIXME: raise exists
        else:
            fakefolders.append(path.directoryfilename)
            self.set_fakefolders(fakefolders, path)
            return self.fileinfo(path.filename, 'folder')
    def rename(self, path, npath):
        # u'a': [u'rename'], u'nfile': [u'newname'], u'folder': [u'test/'],
        # u'file': [u'New folder']
        fakefolders = self.get_fakefolders(path)
        if path.directoryfilename in fakefolders:
            # FIXME:recurse!
            fakefolders.remove(path.directoryfilename)
            fakefolders.append(npath.directoryfilename)
            self.set_fakefolders(fakefolders, path)
        else:
            container = self.get_container(path.container)
            storage_object = container.create_object(path.directoryfilename)

            storage_object.copy_to(npath.container, npath.directoryfilename)
            container.delete_object(path.directoryfilename)
    def delete(self, path):
        # u'a': [u'delete'], u'folder': [u'test/'], u'file': [u'4321']
        fakefolders = self.get_fakefolders(path)
        if path.directoryfilename in fakefolders:
            fakefolders.remove(path.directoryfilename)
            self.set_fakefolders(fakefolders, path)
        else:
            container = self.get_container(path.container)
            container.delete_object(path.directoryfilename)

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
            d['fullpath'] = '/'.join(filter(None, s))
