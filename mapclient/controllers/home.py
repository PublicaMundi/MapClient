import logging

from pylons import request, response, session, url, tmpl_context as c
from pylons.controllers.util import abort, redirect_to
from pylons.decorators import jsonify

import mapclient.lib.helpers as h

from mapclient.lib.base import BaseController, render

log = logging.getLogger(__name__)


class HomeController(BaseController):

    def index(self, resource):
        c.resource = '' if resource is None else resource

        return render('/index.jinja2')
