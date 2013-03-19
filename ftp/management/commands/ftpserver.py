from django.core.management.base import BaseCommand, CommandError
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import TLS_FTPHandler
from pyftpdlib.servers import FTPServer
from pyftpdlib.filesystems import AbstractedFS

from django.contrib.auth.models import User
from django.contrib.auth import authenticate
import time
from fakefs.fakefs import FakeFS, PathHelper
import cloudfiles
from config.models import Config
from accounts.models import Container
import stat
from threading import Thread, Semaphore
from time import mktime

class FakeCloudFS(FakeFS):
    def fileinfo(self, name, mime, size=0, dt=None):
        if dt: time = mktime(dt.timetuple())
        else: time = 0
        if mime == 'folder':
            mode = 040755
        else:
            mode = 0100644
        class fake_stat_result:
            f_name = name
            f_mime = mime
            n_fields = 16
            n_sequence_fields = 10
            n_unnamed_fields = 3
            st_atime = time
            st_blksize = 4096
            st_blocks = 8
            st_ctime = time
            st_dev = 2051L
            st_gid = 0
            st_ino = 0
            st_mode = mode
            st_mtime = time
            st_nlink = 1
            st_rdev = 0
            st_size = size
            st_uid = 0
        return fake_stat_result()
    def auth(self, user, read, write):
        self._user = user
        self._read = read
        self._write = write

    def get_container(self, container):
        containers = Container.objects.filter(user=self._user, container=container)
        if containers.count() == 1:
            c = containers[0]
            if self._write and not c.write:
                raise Exception()
            elif self._read and not c.read:
                raise Exception()
            else:
                return self.conn.create_container(container)
        else:
            raise Exception()
    def get_conn(self):
        return cloudfiles.get_connection(
            Config.objects.get(key='username').value,
            Config.objects.get(key='api_key').value,
            authurl=Config.objects.get(key='authurl').value,
        )
    def open(self, path, mode):
        if 'w' in mode: self._write = True
        return self.get_container(path.container).create_object(path.directoryfilename)

class IterableThread(Thread):
    def __init__(self, storage_object):
        Thread.__init__(self)
        self.data = ''
        self.storage_object = storage_object
        self.notstarted = True
        self.semaphore = Semaphore()
        self.closed = False

    def read(self, size):
        while len(self.data) < size and not self.closed:
            self.semaphore.acquire(True)
        ret = self.data[:size]
        self.data = self.data[size:]
        return ret

    def write(self, data):
        self.data += data
        if not self.isAlive(): self.start()
        self.semaphore.release()

    def run(self):
        self.storage_object.send(self)

    def close(self):
        self.closed = True
        self.semaphore.release()

class CloudFS(AbstractedFS):
    def __init__(self, root, cmd_channel):
        AbstractedFS.__init__(self, root, cmd_channel)
        self.fakecloudfs = FakeCloudFS()
        self.user = cmd_channel.authorizer.user
        self.filelist = (None, None)

    def open(self, filename, mode):
        """Open a file returning its handler."""
        assert isinstance(filename, unicode), filename
        self.fakecloudfs.auth(self.user, True, False)
        class FakeFile:
            def __init__(self, storage_object):
                self.storage_object = storage_object
                self.closed = False
                self.offset = 0
                self.name = storage_object.name
                self.iterablethread = IterableThread(storage_object)
            def read(self, size=-1):
                if self.offset == self.storage_object.size: return ''
                buf = self.storage_object.read(size=size, offset=self.offset)
                self.offset += len(buf)
                return buf
            def write(self, data):
                self.iterablethread.write(data)
            def close(self):
                self.closed = True
                self.iterablethread.close()
        return FakeFile(self.fakecloudfs.open(
            PathHelper(fullpath=filename), mode))

    def mkstemp(self, suffix='', prefix='', dir=None, mode='wb'):
        raise NotImplementedError

    def chdir(self, path):
        """Change the current directory."""
        # note: process cwd will be reset by the caller
        assert isinstance(path, unicode), path
        self._cwd = self.fs2ftp(path)

    def mkdir(self, path):
        """Create the specified directory."""
        assert isinstance(path, unicode), path
        self.fakecloudfs.addFolder(PathHelper(fullpath=path))

    def listdir(self, path):
        """List the content of a directory."""
        assert isinstance(path, unicode) or path == '', path
        path = "/".join(filter(None, path.split('/')))
        if path == '':
            path = ''
            ret = []
            access = []
            self.fakecloudfs.auth(self.user, True, False)
            for container in Container.objects.filter(user=self.user,
                read=True):
                access.append(container.container)
            fileinfos = []
            for container in self.fakecloudfs.conn.list_containers():
                if container in access:
                    fileinfos.append(self.fakecloudfs.fileinfo(container, 'folder'))
                    ret.append(unicode(container))
            self.filelist = (path, fileinfos)
        else:
            self.fakecloudfs.auth(self.user, True, False)
            self.filelist = (path, self.fakecloudfs.fileList(path))
            ret = []
            for f in self.filelist[1]:
                ret.append(f.f_name)
        return ret

    def rmdir(self, path):
        """Remove the specified directory."""
        assert isinstance(path, unicode), path
        raise NotImplementedError
        # FIXME remove folder

    def remove(self, path):
        """Remove the specified file."""
        assert isinstance(path, unicode), path
        self.fakecloudfs.delete(PathHelper(fullpath=path))

    def rename(self, src, dst):
        """Rename the specified src file to the dst filename."""
        assert isinstance(src, unicode), src
        assert isinstance(dst, unicode), dst
        self.fakecloudfs.rename(PathHelper(fullpath=src),
                PathHelper(fullpath=dst))

    def chmod(self, path, mode):
        """Change file/directory mode."""
        assert isinstance(path, unicode), path
        raise NotImplementedError

    def stat(self, path):
        """Perform a stat() system call on the given path."""
        # on python 2 we might also get bytes from os.lisdir()
        #assert isinstance(path, unicode), path
        raise NotImplementedError

    def lstat(self, path):
        """Like stat but does not follow symbolic links."""
        # on python 2 we might also get bytes from os.lisdir()
        #assert isinstance(path, unicode), path
        if path == '/': return self.fakecloudfs.fileinfo('/', 'folder')
        path = PathHelper(fullpath=path)
        if path.fulldirectory == '': return self.fakecloudfs.fileinfo('', 'folder')
        if self.filelist[0] != path.fulldirectory: self.listdir(path.fulldirectory)
        for f in self.filelist[1]:
            if '%s/%s'%(self.filelist[0],f.f_name) == path.fullpath or \
                f.f_name == path.fullpath: # FIXME: f_name mag geen / bevatten
                return f
        #traceback.print_stack()
        print 'lstat', path.fullpath, '- <',
        for f in self.filelist[1]: print '%s/%s'%(self.filelist[0],f.f_name),
        print '>'

    def isfile(self, path):
        """Return True if path is a file."""
        assert isinstance(path, unicode), path
        s = self.lstat(path)
        if s: return stat.S_ISREG(s.st_mode)
        else: return False

    def islink(self, path):
        """Return True if path is a symbolic link."""
        assert isinstance(path, unicode), path
        return False

    def isdir(self, path):
        """Return True if path is a directory."""
        assert isinstance(path, unicode), path
        s = self.lstat(path)
        if s: return stat.S_ISDIR(s.st_mode)
        else: return False

    def getsize(self, path):
        """Return the size of the specified file in bytes."""
        assert isinstance(path, unicode), path
        return self.lstat(path).st_size

    def getmtime(self, path):
        """Return the last modified time as a number of seconds since
        the epoch."""
        assert isinstance(path, unicode), path
        return self.lstat(path).st_mtime

    def realpath(self, path):
        assert isinstance(path, unicode), path
        return path

    def lexists(self, path):
        """Return True if path refers to an existing path, including
        a broken or circular symbolic link.
        """
        assert isinstance(path, unicode), path
        return self.lstat(path) != None

    def get_user_by_uid(self, uid):
        return uid

    def get_group_by_gid(self, gid):
        return gid

read_perms = "elr"
write_perms = "adfmw"

"""
Authorizer class: upon login users will be authenticated against the user
database created and maintained in django.
"""
class DjangoFtpAuthorizer:

    def has_user(self, username):
        try:
            u = User.objects.get(username = username)
            return True
        except:
            return False

    def get_home_dir(self, username):
        return u'/'

    def get_msg_login(self, username):
        return "Welcome"

    def get_msg_quit(self, username):
        return 'Please come again'

    def r_perm(self, username, obj=None):
        try:
            return read_perms
        except:
            return False

    def w_perm(self, username, obj=None):
        try:
            return write_perms
        except:
            return False

    def has_perm(self, username, perm, path=None):
        u = User.objects.get(username = username)
        if u.is_superuser:
            return write_perms+read_perms
        else:
            return perm in read_perms
    
    def impersonate_user(self, username, password):
        """Impersonate another user (noop).

        It is always called before accessing the filesystem.
        By default it does nothing.  The subclass overriding this
        method is expected to provide a mechanism to change the
        current user.
        """
        pass

    def terminate_impersonation(self, dummy):
        """Terminate impersonation (noop).

        It is always called after having accessed the filesystem.
        By default it does nothing.  The subclass overriding this
        method is expected to provide a mechanism to switch back
        to the original user.
        """
        pass

    def get_user(self, username):
        try:
            return User.objects.get(username=username)
        except:
            raise

    def validate_authentication(self, username, password, handler):
        self.user = authenticate(username=username, password=password)
        if self.user is not None:
            if not self.user.is_active: raise AuthenticationFailed('inactive')
        else: raise Exception('no user')

class Command(BaseCommand):
    args = ''
    help = 'ftpserver'
    def handle(self, *args, **options):
        handler = TLS_FTPHandler
        handler.certfile = Config.objects.get(key='certfile').value
        handler.authorizer = DjangoFtpAuthorizer()
        handler.abstracted_fs = CloudFS
        server = FTPServer(("0.0.0.0", 21), handler)
        server.serve_forever()
