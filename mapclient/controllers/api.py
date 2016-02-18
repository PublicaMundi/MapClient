# -*- coding: utf-8 -*-

import logging

log = logging.getLogger(__name__)

from paste.deploy.converters import asbool

from pylons import config, request, response, session, tmpl_context as c
from pylons.controllers.util import abort

from mapclient.lib.base import BaseController, render

import json
import geojson

import numbers
import os
import datetime
import tempfile
import shutil
import zipfile
import uuid
import string
import time
import urllib2

from mapclient.lib.ogr2ogr import main as ogr_export
from publicamundi.data.api import *

# Session metadata key
SESSION_METADATA_KEY = 'DATA_API_348A4EBF-0CDE-4EFB-BC42-D16F3D8FE250'

# Supported exported formats
EXPORT_FORMAT_GEOJSON = 'GeoJSON'
EXPORT_FORMAT_ESRI = 'ESRI Shapefile'
EXPORT_FORMAT_GML = 'GML'
EXPORT_FORMAT_KML = 'KML'
EXPORT_FORMAT_GPKG = 'GPKG'
EXPORT_FORMAT_DXF = 'DXF'
EXPORT_FORMAT_CSV = 'CSV'
EXPORT_FORMAT_PDF = 'PDF'

MAX_FILENAME_LENGTH = 40

# Supported formats for export operation
FORMAT_SUPPORT_EXPORT = {
    EXPORT_FORMAT_ESRI: {
        'ext': 'shp',
        'mimeType': 'application/octet-stream'
    },
    EXPORT_FORMAT_GML: {
        'ext': 'gml',
        'mimeType': 'text/xml'
    },
    EXPORT_FORMAT_KML: {
        'ext': 'kml',
        'mimeType': 'application/vnd.google-earth.kml+xml'
    },
    EXPORT_FORMAT_DXF: {
        'ext': 'dxf',
        'mimeType': 'application/octet-stream'
    },
    EXPORT_FORMAT_CSV: {
        'ext': 'csv',
        'mimeType': 'text/csv'
    },
    EXPORT_FORMAT_GEOJSON: {
        'ext': 'geojson',
        'mimeType': 'application/json'
    },
    EXPORT_FORMAT_PDF: {
        'ext': 'pdf',
        'mimeType': 'application/octet-stream'
    },
    EXPORT_FORMAT_GPKG: {
        'ext': 'gpkg',
        'mimeType': 'application/octet-stream'
    }
}

class ApiController(BaseController):

    tempfile.tempdir = config['upload.path']

    def dashboard(self):
        if not 'mapclient.enable.api.dashboard' in config or not asbool(config['mapclient.enable.api.dashboard']) == True:
            abort(404, 'Data API dashboard is not enabled.')

        # Servers
        c.servers = {
            'mapproxy' : filter(None, [s.strip() for s in config['mapclient.servers.mapproxy'].split(',')]),
            'osm' : filter(None, [s.strip() for s in config['mapclient.servers.osm'].split(',')])
        }

        # Data API configuration
        c.api = {}

        # Resource alias
        resource_list = None
        alias_list = None

        if 'mapclient.enable.api.dashboard.queries.resource' in config and not config['mapclient.enable.api.dashboard.queries.resource'] is None:
            resource_list = filter(None, [s.strip() for s in config['mapclient.enable.api.dashboard.queries.resource'].split(',')])

        if 'mapclient.enable.api.dashboard.queries.alias' in config and not config['mapclient.enable.api.dashboard.queries.alias'] is None:
            alias_list = filter(None, [s.strip() for s in config['mapclient.enable.api.dashboard.queries.alias'].split(',')])

        if not resource_list is None and not alias_list is None:
            if len(resource_list) > 0 and len(resource_list) == len(alias_list):
                c.api['alias'] = dict(zip(alias_list, resource_list))

        # WPS endpoint
        c.api['wps'] = config['mapclient.enable.api.dashboard.wps.endpoint']

        # Google Analytics
        if 'mapclient.google.analytics' in config and config['mapclient.google.analytics']:
            c.google = config['mapclient.google.analytics']

        return render('/api/dashboard.jinja2')

    def demo(self):
        if not 'mapclient.enable.api.examples' in config or not asbool(config['mapclient.enable.api.examples']) == True:
            abort(404, 'Data API examples page is not enabled.')

        # Servers
        c.servers = {
            'mapproxy' : filter(None, [s.strip() for s in config['mapclient.servers.mapproxy'].split(',')]),
            'osm' : filter(None, [s.strip() for s in config['mapclient.servers.osm'].split(',')])
        }

        # Data API configuration
        c.api = {
            'alias': None
        }

        # Resource alias
        resource_list = None
        alias_list = None

        if 'mapclient.enable.api.examples.queries.resource' in config and not config['mapclient.enable.api.examples.queries.resource'] is None:
            resource_list = filter(None, [s.strip() for s in config['mapclient.enable.api.examples.queries.resource'].split(',')])

        if 'mapclient.enable.api.examples.queries.alias' in config and not config['mapclient.enable.api.examples.queries.alias'] is None:
            alias_list = filter(None, [s.strip() for s in config['mapclient.enable.api.examples.queries.alias'].split(',')])

        if not resource_list is None and not alias_list is None:
            if len(resource_list) > 0 and len(resource_list) == len(alias_list):
                c.api['alias'] = dict(zip(alias_list, resource_list))

        # Google Analytics
        if 'mapclient.google.analytics' in config and config['mapclient.google.analytics']:
            c.google = config['mapclient.google.analytics']

        return render('/api/examples.jinja2')

    def resource_show(self):
        # Get configuration
        configuration = self._get_configuration()

        # Set response headers
        self._set_headers()

        try:
            query_executor = QueryExecutor();
            resources = query_executor.get_resources(configuration)

            result = {
                "success" : True,
                "message" : None,
                "resources" : resources
            }
        except Exception as ex:
            message = u'Failed to load metadata for resources.'

            log.exception(message)

            result = {
                "success" : False,
                "message" : message,
                "resource": None
            }

        return json.dumps(result, encoding='utf-8')

    def resource_describe(self, id):
        # Get configuration
        configuration = self._get_configuration()

        # Set response headers
        self._set_headers()

        try:
            if id is None:
                result = {
                    "success" : False,
                    "message" : u'Resource id is missing.',
                    "resource": None
                }
            else:
                query_executor = QueryExecutor();
                fields = query_executor.describe_resource(configuration, id)

                result = {
                    "success" : True,
                    "message" : None,
                    "resource": {
                        "id" : id,
                        "fields" : fields['fields'],
                        "srid": fields['srid'],
                        "geometry_column" : fields['geometry_column']
                    }
                }
        except Exception as ex:
            message =  u'Failed to load resource {resource} metadata.'.format(resource = id)

            log.exception(message)

            result = {
                "success" : False,
                "message" : message,
                "resource": None
            }

        return json.dumps(result, encoding='utf-8')

    def query(self):
        callback = request.params['callback'] if 'callback' in request.params else None

        try:
            # Parse query
            query = self._parse_query()

            # Get configuration
            configuration = self._get_configuration()

            # Get metadata
            metadata = self._get_metadata_from_session()

            # Execute query
            query_executor = QueryExecutor();
            query_result = query_executor.execute(configuration, query, metadata)

            # Set metadata
            self._set_metadata_to_session(query_result['metadata'])

            # Set response headers
            self._set_headers()

            result = {
                'data': query_result['data'],
                'success': True,
                'message': None
            }

            return self._format_response(result, callback, query_result['format'])
        except DataException as apiEx:
            log.exception('Data API exception has occured.')

            details = None
            if not apiEx.innerException is None and config['dataapi.error.details']:
                details = apiEx.innerException.message

            return self._format_response({
                'success' : False,
                'message' : apiEx.message,
                'details' : details,
                'data' : None
            }, callback)
        except Exception as ex:
            message = u'Unhandled exception has occured.'

            log.exception(message)

            return self._format_response({
                'success': False,
                'message': message,
                'details': (ex.message if config['dataapi.error.details'] else ''),
                'data' : None
            }, callback)

    def export(self):
        if not 'dataapi.export.enabled' in config or config['dataapi.export.enabled'] == False:
            return self._format_response({
                'success': False,
                'message': 'Operation is not supported.',
                'token': None
            })

        path = None

        try:
            # Parse query
            query = self._parse_query()

            # Set export format
            export_format = EXPORT_FORMAT_ESRI

            if 'format' in query:
                if not query['format'] in FORMAT_SUPPORT_EXPORT:
                    raise DataException('Output format {format} is not supported for export results.'.format(format = query['format']))

                export_format = query['format']

            # Get disabled export formats and check selected value
            disabledFormats = []

            if 'dataapi.export.formats.disabled' in config:
                disabledFormats = filter(None, config['dataapi.export.formats.disabled'].split(','))

            if export_format in disabledFormats:
                message = 'Export format [{format}] is disabled.'.format(format = export_format)

                log.warn(message)

                return self._format_response({
                    'success': False,
                    'message': message,
                    'token': None
                }, None)

            # Check filenames
            files = None
            if 'files' in query and not query['files'] is None:
                if not type(query['files']) is list:
                    raise DataException('Parameter files should be a list with at least one item.')
                if len(query['queue']) <> len(query['files']):
                    raise DataException('Arrays queue and files should be of the same length.')
                for i in range(0, len(query['files'])):
                    query['files'][i] = self._format_filename(query['files'][i])
                if  len(query['files'])!=len(set(query['files'])):
                    raise DataException('Filenames must be unique.')
                files = query['files']

            # Create temporary folder for exported files
            path = tempfile.mkdtemp()

            # Get configuration
            configuration = self._get_configuration()

            # Get metadata
            metadata = self._get_metadata_from_session()

            # Override query format
            query['format'] = QUERY_FORMAT_GEOJSON

            # Execute query
            query_executor = QueryExecutor();
            query_result = query_executor.execute(configuration, query, metadata)

            # Set metadata
            self._set_metadata_to_session(query_result['metadata'])

            # Set response headers
            response.headers['Content-Type'] = 'application/json; charset=utf-8'

            # Export layer data to files
            data = query_result['data']
            crs = query_result['crs']

            token = str(uuid.uuid4())

            index = 1
            for i in range(0, len(data)):
                filename = 'export' + str(index)
                if not files is None and files[i]:
                    filename = files[i]

                if len(data[i]['features']) > 0:
                    if export_format == EXPORT_FORMAT_DXF:
                        # For DXF remove all properties
                        for f in data[i]['features']:
                            f['properties'] = {}

                    self._export_partial_result(self._format_response(data[i], None, QUERY_FORMAT_GEOJSON), path, filename, crs, export_format)
                    index+=1

            # Compress exported data
            f_output_zipped = os.path.join(path, 'exported-layers.zip')
            self._zip_folder(path, f_output_zipped)

            # Construct response body
            ext = self._getFormatExtension(export_format)

            session[token] = {
                'path' : path,
                'filename' : (os.path.join(path, filename + '.' + ext) if len(data) == 1 else None),
                'compressed' : f_output_zipped,
                'format' : export_format,
                'extension' : (ext if len(data) == 1 else None)
            }

            session.save()

            result = { 'success' : True, 'code' : token, 'message' : None }

            return json.dumps(result, encoding='utf-8')
        except DataException as apiEx:
            message = u'Data API exception has occured.'

            log.exception(message)

            if path != None:
                shutil.rmtree(path)

            details = None
            if not apiEx.innerException is None and config['dataapi.error.details']:
                details = apiEx.innerException.message

            return self._format_response({
                'success': False,
                'message': apiEx.message,
                'details': details,
                'token': None
            }, None)
        except Exception as ex:
            message = u'Unhandled exception has occured.'

            log.exception(message)

            if path != None:
                shutil.rmtree(path)

            return self._format_response({
                'success': False,
                'message': message,
                'details': (ex.message if config['dataapi.error.details'] else ''),
                'token': None
            }, None)

    def download(self, id):
        method = request.environ["REQUEST_METHOD"]

        if method == 'GET':
            if id in session:
                # Web client
                exportResult = session[id]

                response.headers['Content-Type'] = 'application/octet-stream; charset=utf-8'
                response.headers['Content-Disposition'] = 'attachment; filename="export-' + time.strftime('%Y%m%d') + '.zip"'

                with open(exportResult['compressed'], 'r') as f:
                    shutil.copyfileobj(f, response)

                shutil.rmtree(exportResult['path'])

                del session[id]
                session.save()

                return
            else:
                # External service
                filename = os.path.join(tempfile.gettempdir(), id)

                if os.path.isfile(filename):
                    response.headers['Content-Type'] = 'application/octet-stream; charset=utf-8'
                    response.headers['Content-Disposition'] = 'attachment; filename="download-' + time.strftime('%Y%m%d') + '"'

                    with open(filename, 'r') as f:
                        shutil.copyfileobj(f, response)

                    os.remove(filename)

                    return

        abort(404, 'Document not found')

    def wps(self):
        if not 'dataapi.export.enabled' in config or config['dataapi.export.enabled'] == False:
            return self._format_response({
                'success': False,
                'message': 'Operation is not supported.',
                'token': None
            })

        path = None

        try:
            # Parse query
            query = self._parse_query()

            if not 'queue' in query:
                raise DataException('Parameter queue is required.')
            if not 'queue' in query or not type(query['queue']) is list or len(query['queue']) != 1:
                return self._format_response({
                'success': False,
                'message': 'WPS operations require exactly one query.',
                'token': None
            })

            # Set export format
            export_format = EXPORT_FORMAT_GML

            # Get configuration
            configuration = self._get_configuration()

            # Get metadata
            metadata = self._get_metadata_from_session()

            # Override query format
            query['format'] = EXPORT_FORMAT_GEOJSON

            # Execute query
            query_executor = QueryExecutor();
            query_result = query_executor.execute(configuration, query, metadata)

            # Set metadata
            self._set_metadata_to_session(query_result['metadata'])
            session.save()

            # Set response headers
            response.headers['Content-Type'] = 'application/json; charset=utf-8'

            # Export layer data to files
            data = query_result['data'][0]
            crs = query_result['crs']

            if len(data['features']) == 0:
                return self._format_response({
                'success': False,
                'message': 'No features found.',
                'token': None
            })

            # Create temporary folder for exported files
            path = tempfile.mkdtemp()

            # Create temp file name
            token = str(uuid.uuid4())
            ext = self._getFormatExtension(export_format)

            self._export_partial_result(self._format_response(data, None, QUERY_FORMAT_GEOJSON), path, token, crs, export_format)
            shutil.move(os.path.join(path, token + '.' + ext), os.path.join(tempfile.gettempdir(), token))

            if path != None:
                shutil.rmtree(path)
                path = None

            # Construct response body
            result = { 'success' : True, 'code' : token, 'message' : None }

            return json.dumps(result, encoding='utf-8')
        except DataException as apiEx:
            log.exception('Data API exception has occured.')

            if path != None:
                shutil.rmtree(path)

            details = None
            if not apiEx.innerException is None and config['dataapi.error.details']:
                details = apiEx.innerException.message

            return self._format_response({
                'success': False,
                'message': apiEx.message,
                'details': details,
                'token': None
            }, None)
        except Exception as ex:
            message = u'Unhandled exception has occured.'

            log.exception(message)

            if path != None:
                shutil.rmtree(path)

            return self._format_response({
                'success': False,
                'message': message,
                'details': (ex.message if config['dataapi.error.details'] else ''),
                'token': None
            }, None)
    
    
    def describe_layergroups(self):
        """ Provides a json representation of GeoServer's Layer Group's structure
        """
        layer_groups_structure = {'layergroups':{}}
        
        try:
            layer_groups = self._get_layergroups()
        except RuntimeError as ex:
            return json.dumps(layer_groups_structure)
        
        for layer_group in layer_groups:
            layer_groups_structure['layergroups'][layer_group] = []
            
            try:
                members = self._get_layergroup_members(layer_group.split(':')[1])
            except RuntimeError as ex:
                members = []
                            
            for member in members:
                layer_groups_structure['layergroups'][layer_group].append(member)
        
        return json.dumps(layer_groups_structure)
    
    
    def _get_layergroups(self):
        workspace = config['mapclient.geoserver.workspace']        
        path = 'workspaces/' + workspace + '/layergroups.json' 
        
        result = json.loads(self._make_geoserver_rest_request(path))
        layer_groups = []
        if result['layerGroups'] and result['layerGroups']['layerGroup']:
            layer_groups = [workspace + ':' + x['name'] for x in result['layerGroups']['layerGroup']]

        return layer_groups
            
    
    
    def _get_layergroup_members(self, layergroup):
        
        workspace = config['mapclient.geoserver.workspace']
        path = 'workspaces/' + workspace + '/layergroups/' + layergroup + '.json' 
        
        result = json.loads(self._make_geoserver_rest_request(path))
        members = [workspace + ':' + x['name'] for x in result['layerGroup']['publishables']['published']]
                
        return members
    
    
    def _make_geoserver_rest_request(self, path, data=None):
        url = config['mapclient.geoserver.api_url'] + 'rest/' + path
        username = config['mapclient.geoserver.username']
        password = config['mapclient.geoserver.password']
        
        request = urllib2.Request(url = url)
        
        passw = 'Basic ' + ((username + ':' + password).encode('base64').rstrip())
        
        #TODO Check POST case
        if data:
            request.add_data(data.encode('utf-8'))
        
        request.add_header('Authorization', 
                           'Basic ' + ((username + ':' + password).encode('base64').rstrip()))
        try:
            response = urllib2.urlopen(request)
        except urllib2.HTTPError as ex:
            try:
                detail = ex.read()
            except:
                detail = 'n/a'
            raise RuntimeError('GeoServer REST Request \'%s\' failed with '
                               'exception: \'%s\'. Details: %s' % (path, ex, detail))
        return response.read()   
    

    def _parse_query(self):
        if request.environ["REQUEST_METHOD"] == 'POST':
            return json.loads(request.body, cls=ShapelyJsonDecoder, encoding=request.charset)
        else:
            if not 'query' in request.params:
                raise DataException('Parameter query is required.')

            return json.loads(request.params['query'], cls=ShapelyJsonDecoder, encoding=request.charset)

    def _get_configuration(self):
        return {
            CONFIG_SQL_CATALOG : config['dataapi.sqlalchemy.catalog'],
            CONFIG_SQL_DATA : config['dataapi.sqlalchemy.vectorstore'],
            CONFIG_SQL_TIMEOUT : int(config['dataapi.timeout']) if 'dataapi.timeout' in config else 10000,
            CONFIG_MAX_RESOURCE: int(config['dataapi.resource.max']) if 'dataapi.resource.max' in config else 4
        }

    def _export_partial_result(self, text, path, filename, crs, export_format):
        # ogr2ogr -t_srs EPSG:4326 -s_srs EPSG:3857 -f "ESRI Shapefile" query.shp query.geojson

        ext = '.' + self._getFormatExtension(export_format)

        f_input = os.path.join(path, filename + '.geojson')

        with open(f_input, "w") as text_file:
            text_file.write(text)

        if export_format != EXPORT_FORMAT_GEOJSON:
            f_output = os.path.join(path, filename + ext)

            if not ogr_export(['', '-lco', 'ENCODING=UTF-8', '-t_srs', 'EPSG:' + str(crs), '-s_srs', 'EPSG:' + str(crs), '-f', export_format, f_output, f_input]):
                raise DataException('Export operation for CRS [{crs}] and format [{export_format}] has failed'.format(crs = crs, export_format = export_format))

            os.remove(f_input)

    def _zip_folder(self, path, filename):
        exportedFiles = [ f for f in os.listdir(path) ]

        with zipfile.ZipFile(filename, "w", zipfile.ZIP_DEFLATED) as compressedFile:
            for f in exportedFiles:
                compressedFile.write(os.path.join(path,f), unicode(f, 'utf-8'))

    def _format_response(self, response, callback=None, output_format=QUERY_FORMAT_JSON):
        if not callback is None:
            if output_format == QUERY_FORMAT_GEOJSON:
                return '{callback}({response});'.format(
                        callback = callback,
                        response = geojson.dumps(response, cls=ShapelyGeoJsonEncoder, encoding='utf-8')
                )
            elif output_format == QUERY_FORMAT_JSON:
                return '{callback}({response});'.format(
                        callback = callback,
                        response = json.dumps(response, cls=ShapelyJsonEncoder, encoding='utf-8')
                )
            else:
                raise DataException(u'Failed to format response using output format {output_format}.'.format(output_format = output_format))

        if output_format == QUERY_FORMAT_GEOJSON:
            return geojson.dumps(response, cls=ShapelyGeoJsonEncoder, encoding='utf-8')
        else:
            return json.dumps(response, cls=ShapelyJsonEncoder, encoding='utf-8')

    def _get_metadata_from_session(self):
        metadata = {}
        if SESSION_METADATA_KEY in session:
            metadata = session[SESSION_METADATA_KEY]
        return metadata

    def _set_metadata_to_session(self, metadata):
        session[SESSION_METADATA_KEY] = metadata
        session.save()

    def _set_headers(self):
        if request.environ["REQUEST_METHOD"] == 'POST':
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
        else:
            if 'callback' in request.params:
                response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
            else:
                response.headers['Content-Type'] = 'application/json; charset=utf-8'

    #https://gist.github.com/seanh/93666
    def _format_filename(self, filename):
        """Take a string and return a valid filename constructed from the string.
    Uses a whitelist approach: any characters not present in valid_chars are
    removed. Also spaces are replaced with underscores.

    Note: this method may produce invalid filenames such as ``, `.` or `..`
    When I use this method I prepend a date string like '2009_01_15_19_46_32_'
    and append a file extension like '.txt', so I avoid the potential of using
    an invalid filename.

    """
        valid_chars = "-_.() %s%s" % (string.ascii_letters, string.digits)
        filename = ''.join(c for c in filename if c in valid_chars)
        filename = "{prefix:%Y%m%d_%H%M%S}_{suffix}".format(prefix = datetime.datetime.now(), suffix = filename[:MAX_FILENAME_LENGTH].replace(' ','_'))
        return filename

    def _getFormatExtension(self, format):
        if format in FORMAT_SUPPORT_EXPORT:
            return FORMAT_SUPPORT_EXPORT[format]['ext']

        raise DataException('Output format {format} is not supported by the export operation.'.format(format = format))
