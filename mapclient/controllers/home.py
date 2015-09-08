import logging

import os, time

from pylons import config, request, response, session, url, tmpl_context as c
from pylons.controllers.util import abort, redirect_to
from pylons.decorators import jsonify

import mapclient.lib.helpers as h

from mapclient.lib.base import BaseController, render

log = logging.getLogger(__name__)


class HomeController(BaseController):

    def index(self):
        # Get metadata version
        c.metadata = {
            'version' : ''
        }
        
        if 'mapclient.catalog.metadata.physical' in config:
            filename = config['mapclient.catalog.metadata.physical']
        
            if os.path.exists(filename):
                c.metadata['version'] = os.stat(filename).st_mtime
        
        # Export disabled format
        c.exportDisabledFormats = []
        if 'dataapi.export.formats.disabled' in config:
           c.exportDisabledFormats =  filter(None, config['dataapi.export.formats.disabled'].split(','))

        return render('/index.jinja2')
