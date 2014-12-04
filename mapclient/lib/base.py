"""The base Controller API

Provides the BaseController class for subclassing.
"""
from pylons.controllers import WSGIController
from pylons.templating import render_jinja2 as render
from pylons import config, request, response

from paste.deploy.converters import asbool

from mapclient.model import meta

class BaseController(WSGIController):

    def __call__(self, environ, start_response):
        """Invoke the Controller"""
        # WSGIController.__call__ dispatches to the Controller method
        # the request is routed to. This routing information is
        # available in environ['pylons.routes_dict']
        try:
            return WSGIController.__call__(self, environ, start_response)
        finally:
            meta.Session.remove()

    def __after__(self, action, **params):
        # Do we have CORS settings in config?
        if config['dataapi.cors.enabled'] and request.headers.get('Origin'):
            self._set_cors()

    def _set_cors(self):
        '''
        Set up Access Control Allow headers if either origin_allow_all is
        True, or the request Origin is in the origin_whitelist.
        '''
        cors_origin_allowed = None
        if asbool(config.get('dataapi.cors.enabled')):
            cors_origin_allowed = "*"

        if cors_origin_allowed is not None:
            response.headers['Access-Control-Allow-Origin'] = \
                cors_origin_allowed
            response.headers['Access-Control-Allow-Methods'] = \
                "POST, PUT, GET, DELETE, OPTIONS"
            response.headers['Access-Control-Allow-Headers'] = \
                "Content-Type"
