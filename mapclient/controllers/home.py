import logging

import os, time

from paste.deploy.converters import asbool

from pylons import config, request, response, session, url, tmpl_context as c
from pylons.controllers.util import abort, redirect_to
from pylons.decorators import jsonify

import mapclient.lib.helpers as h

from mapclient.lib.base import BaseController, render

from user_agents import parse as parse_agent

log = logging.getLogger(__name__)


class HomeController(BaseController):

    def _isMobileOrTablet(self):
        if 'User-Agent' in request.headers:
            user_agent = parse_agent(request.headers['User-Agent'])

            if user_agent and (user_agent.is_mobile or user_agent.is_tablet) and user_agent.is_touch_capable:
                return True

        return False

    def index(self):
        # Servers
        c.servers = {
            'mapproxy' : filter(None, [s.strip() for s in config['mapclient.servers.mapproxy'].split(',')]),
            'tilecache' : filter(None, [s.strip() for s in config['mapclient.servers.tilecache'].split(',')]),
            'osm' : filter(None, [s.strip() for s in config['mapclient.servers.osm'].split(',')])
        }

        # Google Analytics
        if 'mapclient.google.analytics' in config and config['mapclient.google.analytics']:
            c.google = config['mapclient.google.analytics']

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

        # Debug mode
        debug = asbool(config['mapclient.debug'])

        # RequireJS main script
        if self._isMobileOrTablet() == False:
            if debug == True:
                c.main = 'js/client-main.js'
            else:
                c.main = 'jsmin/client-main.js'
        else:
            if debug == True:
                c.main = 'js/client-main-mobile.js'
            else:
                c.main = 'jsmin/client-main-mobile.js'

        return render('/index.jinja2')
