import os
import glob
from distutils.dir_util import copy_tree
import shutil

srcfiles = glob.glob('./src/minecraft/*.ts')
cmd = 'tsc --allowJs -m ES6 -t ES6 --outDir dist --sourceMap --alwaysStrict ' + " ".join(srcfiles) + ' ./src/lib/vue/vue.js '
print('Building TypeScript: ' + cmd)
os.system(cmd)
copy_tree('./src/minecraft/static', './dist')
