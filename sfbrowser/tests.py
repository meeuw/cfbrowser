from django.test import TestCase
from sfbrowser.views import PathHelper

class PathHelperTest(TestCase):
    r = ['def', 'abc', 'abc/def', 'ghi', 'def/ghi']
    def testFulldirectoryFilename(self):
        p = PathHelper(fulldirectory='abc/def', filename='ghi')
        self.assertEqual([p.directory, p.container, p.fulldirectory, p.filename, p.directoryfilename], self.r)

        p = PathHelper(fulldirectory='abc//def', filename='/ghi/')
        self.assertEqual([p.directory, p.container, p.fulldirectory, p.filename, p.directoryfilename], self.r)

        p = PathHelper(fulldirectory='abc//def//ghi')
        self.assertEqual(p.container, 'abc')
        self.assertEqual(p.directory, 'def')
        self.assertEqual(p.fulldirectory, 'abc/def/ghi')

        #p = PathHelper(fulldirectory='abc/def/')
    def testFullpath(self):
        p = PathHelper(fullpath='abc/def/ghi')
        self.assertEqual([p.directory, p.container, p.fulldirectory, p.filename, p.directoryfilename], self.r)

        p = PathHelper(fullpath='abc//def//ghi')
        self.assertEqual([p.directory, p.container, p.fulldirectory, p.filename, p.directoryfilename], self.r)
