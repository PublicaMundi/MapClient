import logging

from pylons import request, response, session, tmpl_context as c
from pylons.controllers.util import abort, redirect_to
from pylons.decorators import jsonify

from mapclient.lib.base import BaseController, render

import urlparse
import requests

log = logging.getLogger(__name__)


MAX_FILE_SIZE = 1024 * 1024  # 1MB
CHUNK_SIZE = 512

class ProxyController(BaseController):

    def proxy_resource(self):
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

        if not parts.scheme or not parts.netloc:
            abort(409, detail = 'Invalid URL.')

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
            if cl and int(cl) > MAX_FILE_SIZE:
                base.abort(409, '''Content is too large to be proxied. Allowed
                    file size: {allowed}, Content-Length: {actual}.'''.format(
                    allowed=MAX_FILE_SIZE, actual=cl))

            response.content_type = r.headers['content-type']
            response.charset = r.encoding

            length = 0
            for chunk in r.iter_content(chunk_size=CHUNK_SIZE):
                response.body_file.write(chunk)
                length += len(chunk)

                if length >= MAX_FILE_SIZE:
                    base.abort(409, headers={'content-encoding': ''},
                               detail='Content is too large to be proxied.')

        except requests.exceptions.HTTPError, error:
            details = 'Could not proxy resource. Server responded with %s %s' % (
                error.response.status_code, error.response.reason)
            abort(409, detail=details)
        except requests.exceptions.ConnectionError, error:
            details = '''Could not proxy resource because a
                                connection error occurred. %s''' % error
            abort(502, detail=details)
        except requests.exceptions.Timeout, error:
            details = 'Could not proxy resource because the connection timed out.'
            abort(504, detail=details)
           
