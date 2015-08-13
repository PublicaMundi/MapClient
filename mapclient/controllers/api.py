import logging

from pylons import config, request, response, session, tmpl_context as c
from pylons.controllers.util import abort, redirect_to
from pylons.decorators import jsonify

from mapclient.lib.base import BaseController, render

from sqlalchemy import create_engine
from sqlalchemy.sql import text
from sqlalchemy.engine import ResultProxy
from sqlalchemy.exc import ProgrammingError, IntegrityError, DBAPIError, DataError

import json
import geojson

import numbers
import os
import tempfile
import shutil
import zipfile
import uuid
import string
import time

from mapclient.lib.ogr2ogr import main as ogr_export
from publicamundi.data.api import *

log = logging.getLogger(__name__)

SESSION_METADATA_KEY = 'DATA_API_348A4EBF-0CDE-4EFB-BC42-D16F3D8FE250'

class ApiController(BaseController):

    def resource_show(self):
        # Get configuration
        configuration = self._get_configuration()
        
        # Set response headers
        self._set_headers()
        
        try:
            query_executor = QueryExecutor();
            resources = query_executor._get_resources(configuration)
            
            result = {
                "success" : True,
                "message" : None,
                "resources" : resources
            }
        except Exception as ex:
            log.error(ex)
            result = {
                "success" : False,
                "message" : u'Failed to load metadata for resources.',
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
                fields = query_executor._resource_describe(configuration, None, id)
                
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
            log.error(ex)
            result = {
                "success" : False,
                "message" : u'Failed to load resource {resource} metadata.'.format(resource = resource),
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
            query_result = query_executor.execute(configuration, query, ACTION_QUERY, metadata)
            
            # Set metadata 
            self._set_metadata_to_session(query_result['metadata'])
            
            # Set response headers
            self._set_headers()

            # Construct response body 
            output_format = query_result['format']
           
            result = {
                'data': query_result['data'],
                'success': True,
                'message': None
            }

            return self._format_response(result, callback, output_format)
        except DataException as apiEx:
            log.error(apiEx)

            return self._format_response({
                'success' : False,
                'message' : apiEx.message,
                'data' : None
            }, callback)
        except DBAPIError as dbEx:
            log.error(dbEx)

            message = 'Unhandled exception has occured.'
            if dbEx.orig.pgcode == _PG_ERR_CODE['query_canceled']:
                message = 'Execution exceeded timeout.'

            return self._format_response({
                'success': False,
                'message': message,
                'details': (dbEx.message if config['dataapi.error.details'] else ''),
                'data' : None
            }, callback)
        except Exception as ex:
            log.error(ex)

            return self._format_response({
                'success': False,
                'message': 'Unhandled exception has occured.',
                'details': (ex.message if config['dataapi.error.details'] else ''),
                'data' : None
            }, callback)

    def export(self):
        path = tempfile.mkdtemp()

        try:
            # Parse query
            query = self._parse_query()
            
            # Get configuration
            configuration = self._get_configuration()
            
            # Get metadata
            metadata = self._get_metadata_from_session()
            
            # Execute query
            query_executor = QueryExecutor();
            query_result = query_executor.execute(configuration, query, ACTION_EXPORT, metadata)
            
            # Set metadata 
            self._set_metadata_to_session(query_result['metadata'])
            
            # Set response headers
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
            
            # Export layer data to files
            data = query_result['data']
            crs = query_result['crs']
            files = query_result['files']
            output_format = query_result['format']

            token = str(uuid.uuid4())

            index = 1
            for i in range(0, len(data)):
                filename = 'export' + str(index)
                if not files is None and files[i]:
                    filename = files[i]

                if len(data[i]['features']) > 0:
                    self._export_partial_result(self._format_response(data[i], None, FORMAT_GEOJSON), path, filename, crs, output_format)
                    index+=1

            # Compress exported data
            f_output_zipped = os.path.join(path, 'exported-layers.zip')
            self._zip_folder(path, f_output_zipped)

            # Construct response body
            session[token] = f_output_zipped
            session.save()

            result = { 'success' : True, 'code' : token, 'message' : None }
                   
            return json.dumps(result, encoding='utf-8')
        except DataException as apiEx:
            log.error(apiEx)

            if path != None:
                shutil.rmtree(path)

            return self._format_response({
                'success': False,
                'message': apiEx.message,
                'token': None
            }, None)
        except DBAPIError as dbEx:
            log.error(dbEx)

            message = 'Unhandled exception has occured.'
            if dbEx.orig.pgcode == _PG_ERR_CODE['query_canceled']:
                message = 'Execution exceeded timeout.'

            if path != None:
                shutil.rmtree(path)

            return self._format_response({
                'success': False,
                'message': message,
                'details': (dbEx.message if config['dataapi.error.details'] else ''),
                'token': None
            }, None)
        except Exception as ex:
            log.error(ex)

            if path != None:
                shutil.rmtree(path)

            return self._format_response({
                'success': False,
                'message': 'Unhandled exception has occured.',
                'details': (ex.message if config['dataapi.error.details'] else ''),
                'token': None
            }, None)

    def download(self):
        method = request.environ["REQUEST_METHOD"]
        
        if method == 'GET' and 'code' in request.params and request.params['code'] in session:
            response.headers['Content-Type'] = 'application/octet-stream; charset=utf-8'
            response.headers['Content-Disposition'] = 'attachment; filename="export-' + time.strftime('%Y%m%d') + '.zip"'
            
            filename = session[request.params['code']]

            with open(filename, 'r') as f:
                shutil.copyfileobj(f, response)

            shutil.rmtree(os.path.dirname(filename))

            del session[request.params['code']]
            session.save()

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
            CONFIG_SQL_TIMEOUT : int(config['dataapi.timeout']) if 'dataapi.timeout' in config else 10000
        }

    def _export_partial_result(self, text, path, filename, crs, output_format):
        # ogr2ogr -t_srs EPSG:4326 -s_srs EPSG:3857 -f "ESRI Shapefile" query.shp query.geojson

        ext = None

        for i in range(0, len(FORMAT_SUPPORT_EXPORT)):
            if FORMAT_SUPPORT_EXPORT[i] == output_format:
                ext = '.' + EXTENSION_EXPORT[i]
                break;

        f_input = os.path.join(path, filename + '.geojson')

        with open(f_input, "w") as text_file:
            text_file.write(text)

        if output_format != FORMAT_GEOJSON:
            f_output = os.path.join(path, filename + ext)

            if not ogr_export(['', '-lco', 'ENCODING=UTF-8', '-t_srs', 'EPSG:' + str(crs), '-s_srs', 'EPSG:' + str(crs), '-f', output_format, f_output, f_input]):
                raise DataException('Export operation for CRS [{crs}] and format [{output_format}] has failed'.format(crs = crs, output_format = output_format))

            os.remove(f_input)

    def _zip_folder(self, path, filename):       
        exportedFiles = [ f for f in os.listdir(path) ]

        with zipfile.ZipFile(filename, "w", zipfile.ZIP_DEFLATED) as compressedFile:
            for f in exportedFiles:
                 compressedFile.write(os.path.join(path,f), f)

    def _format_response(self, response, callback=None, output_format=FORMAT_JSON):
        if not callback is None:
            if output_format == FORMAT_GEOJSON:
                return '{callback}({response});'.format(
                        callback = callback,
                        response = geojson.dumps(response, cls=ShapelyGeoJsonEncoder, encoding='utf-8')
                )
            elif output_format == FORMAT_JSON:
                return '{callback}({response});'.format(
                        callback = callback,
                        response = json.dumps(response, cls=ShapelyJsonEncoder, encoding='utf-8')
                )
            else:
                raise DataException(u'Failed to format response using output format {output_format}.'.format(output_format = output_format))

        if output_format == FORMAT_GEOJSON:
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
