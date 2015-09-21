# -*- coding: utf-8 -*-

import logging

log = logging.getLogger(__name__)

from paste.deploy.converters import asbool

from pylons import request, response, session
from pylons.controllers.util import abort
from pylons.decorators import rest
from pylons import config

from mapclient.lib.base import BaseController

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
        try:
            config = self._expand(id)

            return json.dumps({
                'success' : True,
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
