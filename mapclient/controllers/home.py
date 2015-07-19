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
        c.metadata = {
            'version' : ''
        }
        
        if 'mapclient.catalog.metadata.physical' in config:
            filename = config['mapclient.catalog.metadata.physical']
        
            if os.path.exists(filename):
                c.metadata['version'] = os.stat(filename).st_mtime

        return render('/index.jinja2')
