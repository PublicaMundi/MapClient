import logging

from pylons import config, request, response, session
from pylons.decorators import jsonify, rest
from pylons.controllers.util import abort, redirect_to

from routes import url_for

from mapclient.lib.base import BaseController

import re, os, shutil, uuid

log = logging.getLogger(__name__)

MIN_FILE_SIZE = 1 # bytes
MAX_FILE_SIZE = 5242880 # bytes
ACCEPT_FILE_TYPES = ['application/gml+xml', 'application/vnd.google-earth.kml+xml']

class UploadController(BaseController):
    
    @rest.dispatch_on(HEAD='upload_HEAD', GET='upload_GET', POST='upload_POST', OPTIONS='upload_POST', DELETE='upload_DELETE')
    def upload_resource(self):
        return ''

    def upload_GET(self):
        return ''

    @jsonify
    def upload_POST(self):
        files = []

        for name, fieldStorage in request.POST.items():
            if isinstance(fieldStorage, unicode):
                continue

            file = {}

            token = str(uuid.uuid4())
            
            initialFilename = fieldStorage.filename
            storageFilename = os.path.join(config['upload.path'], token + os.path.splitext(initialFilename)[1])

            file['name'] = os.path.basename(initialFilename)
            file['type'] = fieldStorage.type
            file['size'] = self._get_file_size(fieldStorage.file)
            
            if self._validate(file):
                with open(storageFilename, 'w') as f:
                    shutil.copyfileobj( fieldStorage.file , f)

                file['url'] = url_for(controller='upload', action='download', id=token)

            session[token] = {
                'name' : file['name'],
                'type' : file['type'],
                'storage' : storageFilename
            }
            session.save()
            
            files.append(file)
        return {
            'files' : files
        }

    @rest.restrict('GET')
    def download(self, id):
        if id != None and id in session:
            file = session[id]
            
            response.headers['Content-Type'] = file['type'] + '; charset=utf-8'
            response.headers['Content-Disposition'] = 'attachment; filename="' + file['name'] + '"'
        
            filename = file['storage']

            del session[id]
            session.save()
            
            if not os.path.isfile(filename):
                abort(404, detail = 'File not found.')
            else:
                with open(filename, 'r') as f:
                    shutil.copyfileobj(f, response)

                os.remove(filename)
        else:
            abort(404, detail = 'File not found.')

    def upload_OPTIONS(self):
        return ''
        
    def upload_HEAD(self):
        return ''

    def upload_DELETE(self):
        return ''
        
    def _validate(self, file):
        if file['size'] < MIN_FILE_SIZE:
            file['error'] = 'minFileSize'
        elif file['size'] > MAX_FILE_SIZE:
            file['error'] = 'maxFileSize'
        elif not file['type'] in ACCEPT_FILE_TYPES:
            file['error'] = 'acceptFileTypes'
        else:
            return True
        return False

    def _get_file_size(self, file):
        file.seek(0, 2) # Seek to the end of the file
        size = file.tell() # Get the position of EOF
        file.seek(0) # Reset the file position to the beginning
        return size
