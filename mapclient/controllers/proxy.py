import logging

from pylons import config, request, response, session, tmpl_context as c
from pylons.controllers.util import abort, redirect_to
from pylons.decorators import jsonify

from mapclient.lib.base import BaseController, render

import urlparse
import requests

log = logging.getLogger(__name__)


MAX_FILE_SIZE = 1024 * 1024  # 1MB
CHUNK_SIZE = 512

class ProxyController(BaseController):

    def _validateUrl(self, parts):
        if not parts.scheme or not parts.netloc:
            abort(409, detail = 'Invalid URL.')

        if parts.port and not parts.port in [80, 8080]:
            log.warn('Port {port} in url {url} is not allowed.'.format(port = parts.port, url = urlparse.urlunparse(parts)))
            abort(409, detail = 'Invalid URL.')

        if not parts.query:
            log.warn('Missing query string in url {url}.'.format(url = urlparse.urlunparse(parts)))
            abort(409, detail = 'Invalid URL.')

        invalidQuery = False
        query = urlparse.parse_qs(parts.query)

        for prop in query:
            if not prop in ['service', 'request', 'map']:
                invalidQuery = True
                log.warn('Query string parameter [{parameter}] is not supported.'.format(parameter = prop))

            if prop == 'service' and len(query[prop]) != 1:
                invalidQuery = True
                log.warn('Query string parameter [{parameter}] should have a single value.'.format(parameter = prop))

            if prop == 'service' and query[prop][0].lower() != 'wms':
                invalidQuery = True
                log.warn('Value {value} for query string parameter [{parameter}] is not supported.'.format(parameter = prop, value = query[prop]))

            if prop == 'request' and len(query[prop]) != 1:
                invalidQuery = True
                log.warn('Query string parameter [{parameter}] should have a single value.'.format(parameter = prop))

            if prop == 'request' and query[prop][0].lower() != 'getcapabilities':
                invalidQuery = True
                log.warn('Value {value} for query string parameter [{parameter}] is not supported.'.format(parameter = prop, value = query[prop]))

        if invalidQuery:
            abort(409, detail = 'Invalid URL.')

    def _isUrlInWhiteList(self, parts):
        prefix = urlparse.urlunparse((parts[0], parts[1], parts[2], None, None, None, ))

        if 'mapclient.proxy.white-list' in config and prefix in config['mapclient.proxy.white-list'].split(','):
            return True

        return False

    def proxy_resource(self):
        size_limit = MAX_FILE_SIZE
        if 'mapclient.proxy.limit.default' in config:
            size_limit = config['mapclient.proxy.limit.default']

        timeout = 3

        if not 'url' in request.params:
            abort(404, detail = 'Parameter url is required.')

        url = request.params['url']
        url = url.split('#')[0] # remove potential fragment

        ''' Chunked proxy for resources. To make sure that the file is not too
        large, first, we try to get the content length from the headers.
        If the headers to not contain a content length (if it is a chinked
        response), we only transfer as long as the transferred data is less
        than the maximum file size. '''
        parts = urlparse.urlsplit(url)

        allowed = self._isUrlInWhiteList(parts)

        if not allowed:
            self._validateUrl(parts)
            log.warn('Proxy resource - {url}'.format(url = url))

        if allowed and 'mapclient.proxy.limit.white-list' in config:
            size_limit = config['mapclient.proxy.limit.white-list']

        try:
            method = request.environ["REQUEST_METHOD"]

            if method == "POST":
                length = int(request.environ["CONTENT_LENGTH"])
                headers = {"Content-Type": request.environ["CONTENT_TYPE"]}
                body = request.body
                r = requests.post(url, data=body, headers=headers, stream=True, timeout = timeout)
            else:
                r = requests.get(url, stream=True, timeout = timeout)

            cl = r.headers['content-length']
            if cl and int(cl) > size_limit:
                abort(409, '''Content is too large to be proxied. Allowed
                    file size: {allowed}, Content-Length: {actual}.'''.format(
                    allowed=size_limit, actual=cl))

            response.content_type = r.headers['content-type']
            response.charset = r.encoding

            length = 0
            for chunk in r.iter_content(chunk_size=CHUNK_SIZE):
                response.body_file.write(chunk)
                length += len(chunk)

                if length >= size_limit:
                    abort(409, headers={'content-encoding': ''},
                               detail='Content is too large to be proxied.')

        except requests.exceptions.HTTPError, error:
            details = 'Could not proxy resource. Server responded with %s %s' % (
                error.response.status_code, error.response.reason)
            abort(409, detail=details)
        except requests.exceptions.ConnectionError, error:
            details = '''Could not proxy resource because a connection error occurred. %s''' % error
            abort(502, detail=details)
        except requests.exceptions.Timeout, error:
            details = 'Could not proxy resource because the connection timed out.'
            abort(504, detail=details)

