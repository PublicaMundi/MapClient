# -*- coding: utf-8 -*-

import logging

log = logging.getLogger(__name__)

from pylons import config, request, response, session, url, tmpl_context as c
from pylons.controllers.util import abort, redirect_to
from pylons.decorators import rest
from pylons import config

import mapclient.lib.helpers as h

from mapclient.lib.base import BaseController, render

from mapclient.model.meta import Session
from mapclient.model.link import Link

import simplejson as json

class ConfigController(BaseController):

    _valid = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

    def _getIP(self):
        try:
            if 'mapclient.proxy' in config and config['mapclient.proxy']:
                ip = request.environ.get("HTTP_X_FORWARDED_FOR", request.environ["REMOTE_ADDR"])
            else:
                ip = request.environ["REMOTE_ADDR"]

            ipArray = ip.split(',')

            if not ipArray is None and len(ipArray)>0:
                return ipArray[0].strip()
        except Exception as ex:
            log.error("Failed to get IP address.")
            log.error(ex)

        return None

    def _compress(self, config, ip):
        url = ''

        try:
            link = Session.query(Link).filter(Link.configuration==config).first()
            if not link:
                link = Link()
                link.configuration = config
                link.ip = ip

                Session.add(link)
                Session.flush()

                index = link.index

                while index != 0:
                    index, remainder = divmod(index - 1, len(self._valid))
                    url += self._valid[remainder]

                link.url = url
            else:
                url = link.url

            Session.commit()
        except Exception as ex:
            log.error('Failed to create shortcut for configuration %(configuration)s' % { 'configuration' : config})
            log.error(ex)

        return url

    def _expand(self, url):
        if url:
            link = Session.query(Link).filter(Link.url==url).first()

            if link:
                return json.loads(link.configuration)

        return {}

    @rest.restrict('GET')
    def load(self, id):
        response.headers['Content-Type'] = 'application/json; charset=utf-8'

        try:
            config = self._expand(id)

            return json.dumps({
                'success' : True if config else False,
                'config' : config
            })
        except Exception as ex:
            log.error(ex)

        return json.dumps({
            'success' : False,
            'config' : None
        })

    def save(self):
        ip = None

        response.headers['Content-Type'] = 'application/json; charset=utf-8'

        # Get requested url
        try:
            ip = self._getIP()
            config = json.loads(request.body, encoding=request.charset)

            url = self._compress(json.dumps(config), ip)

            return json.dumps({
                'success' : True,
                'url' : url
            })
        except Exception as ex:
            log.error(ex)

        return json.dumps({
            'success' : False,
            'url' : None
        })

    def embed(self, id):
        try:
            configuration = self._expand(id)

            if 'mapclient.google.analytics' in config and config['mapclient.google.analytics']:
                c.google = config['mapclient.google.analytics']

            c.lib = config['lib'] if 'lib' in config else 'leaflet'
            c.config = json.dumps(configuration)
        except Exception as ex:
            log.error(ex)

            abort(404, 'Map configuration was not found')

        return render('/embed.jinja2')
