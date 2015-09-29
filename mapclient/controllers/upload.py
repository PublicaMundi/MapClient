import logging

from pylons import config, request, response, session
from pylons.decorators import jsonify, rest
from pylons.controllers.util import abort, redirect_to

from routes import url_for

from mapclient.lib.base import BaseController
from mapclient.lib.ogr2ogr import main as ogr_export

import re, os, shutil, uuid

import zipfile

from osgeo import ogr

log = logging.getLogger(__name__)

IMPORT_GEOJSON = 'GeoJSON'
IMPORT_ESRI = 'ESRI Shapefile'
IMPORT_GML = 'GML'
IMPORT_KML = 'KML'
IMPORT_DXF = 'DXF'
IMPORT_CSV = 'CSV'

MIN_FILE_SIZE = 1 # bytes
MAX_FILE_SIZE = 5242880 # bytes

ACCEPT_FORMAT = [IMPORT_GML, IMPORT_KML, IMPORT_GEOJSON, IMPORT_CSV, IMPORT_ESRI, IMPORT_DXF]

ACCEPT_FORMAT_TYPES = {
    IMPORT_GML: ['application/gml+xml'],
    IMPORT_KML: ['application/vnd.google-earth.kml+xml'],
    IMPORT_ESRI: ['application/zip', 'application/octet-stream'],
    IMPORT_GEOJSON: ['application/vnd.geo+json', 'application/json', 'text/plain'],
    IMPORT_DXF: ['application/dxf', 'application/octet-stream'],
    IMPORT_CSV: ['application/vnd.ms-excel', 'text/csv', 'text/plain']
}

ACCEPT_FORMAT_CONVERT = [IMPORT_ESRI, IMPORT_DXF, IMPORT_CSV]

CRS_SUPPORTED = ['EPSG:900913', 'EPSG:3857', 'EPSG:4326', 'EPSG:2100', 'EPSG:4258']

class UploadController(BaseController):

    @rest.dispatch_on(POST='upload_POST')
    def upload_resource(self):
        return ''

    @jsonify
    def upload_POST(self):
        files = []

        in_crs = None
        if request.POST['crs'] and request.POST['crs'] in CRS_SUPPORTED:
            in_crs = request.POST['crs']

        in_format = None
        if request.POST['format'] and request.POST['format'] in ACCEPT_FORMAT_TYPES:
            in_format = request.POST['format']

        for name, fieldStorage in request.POST.items():
            if isinstance(fieldStorage, unicode):
                continue

            file = {}

            token = str(uuid.uuid4())

            initialFilename = fieldStorage.filename

            extension = os.path.splitext(initialFilename)[1];

            storageFilename = os.path.join(config['upload.path'], token + extension)

            file['name'] = os.path.basename(initialFilename)
            file['type'] = fieldStorage.type
            file['size'] = self._get_file_size(fieldStorage.file)
            file['url'] = None
            file['crs'] = in_crs
            file['format'] = in_format

            if self._validate(file):
                with open(storageFilename, 'w') as f:
                    shutil.copyfileobj( fieldStorage.file , f)

                if file['format'] in ACCEPT_FORMAT_CONVERT:
                    convertFilename = os.path.join(config['upload.path'], token + '.geojson')

                    if file['format'] == IMPORT_CSV:
                        file['error'] = self._parse_csv(in_crs, os.path.join(config['upload.path'], token), storageFilename, convertFilename)
                    else:
                        file['error'] = self._convert(in_crs, in_format, os.path.join(config['upload.path'], token), storageFilename, convertFilename)

                    if file['error'] is None:
                        file['name'] = os.path.splitext(os.path.basename(initialFilename))[0] + '.geojson'
                        file['type'] = 'application/json'
                        storageFilename = convertFilename

                if file['error'] is None:
                    file['url'] = url_for(controller='upload', action='download', id=token)

                    session[token] = {
                        'name' : file['name'],
                        'type' : file['type'],
                        'storage' : storageFilename
                    }
                    session.save()

            files.append(file)
        return {
            'files' : files
        }

    @rest.restrict('GET')
    def download(self, id):
        if id != None and id in session:
            file = session[id]

            response.headers['Content-Type'] = file['type'] + '; charset=utf-8'

            filename = file['storage']

            del session[id]
            session.save()

            if not os.path.isfile(filename):
                abort(404, detail = 'File not found.')
            else:
                with open(filename, 'r') as f:
                    shutil.copyfileobj(f, response)

                os.remove(filename)
        else:
            abort(404, detail = 'File not found.')

    def _parse_csv(self, in_crs, unzip_folder, f_input, f_output):
        # ogr2ogr -t_srs EPSG:4326 -s_srs EPSG:3857 -f "GeoJSON" filename.geojson filename.vrt

        '''
        <OGRVRTDataSource>
            <OGRVRTLayer name="source">
                <SrcDataSource>source.csv</SrcDataSource>
                <GeometryType>wkbPoint</GeometryType>
                <LayerSRS>WGS84</LayerSRS>
                <GeometryField encoding="PointFromColumns" x="field_1" y="field_2"/>
            </OGRVRTLayer>
        </OGRVRTDataSource>
        '''

        if not os.path.exists(unzip_folder):
            os.makedirs(unzip_folder)

        f_input_path, f_input_file = os.path.split(f_input)
        shutil.move(f_input, os.path.join(unzip_folder, f_input_file))

        error = None

        # Create VRT file
        vrtFilename = os.path.join(unzip_folder, str(uuid.uuid4()) + '.vrt')
        with open(vrtFilename, 'w') as f:
            f.write('<OGRVRTDataSource>')
            f.write('<OGRVRTLayer name="' + os.path.splitext(f_input_file)[0] + '">')
            f.write('<SrcDataSource relativeToVRT="1">' + f_input_file + '</SrcDataSource>')
            f.write('<GeometryType>wkbPoint</GeometryType>')
            f.write('<LayerSRS>WGS84</LayerSRS>')
            f.write('<GeometryField encoding="PointFromColumns" x="field_1" y="field_2"/>')
            f.write('</OGRVRTLayer>')
            f.write('</OGRVRTDataSource>')
        if error is None and not ogr_export(['', '-lco', 'ENCODING=UTF-8', '-t_srs', 'EPSG:3857', '-s_srs', in_crs, '-f', 'GeoJSON', f_output, vrtFilename]):
            error = 'conversionFailed'

        if os.path.exists(unzip_folder):
            shutil.rmtree(unzip_folder)

        return error

    def _convert(self, in_crs, in_format, unzip_folder, f_input, f_output):
        # ogr2ogr -t_srs EPSG:4326 -s_srs EPSG:3857 -f "ESRI Shapefile" query.shp query.geojson
        error = None

        if in_format == IMPORT_ESRI:
            if not os.path.exists(unzip_folder):
                os.makedirs(unzip_folder)

            with zipfile.ZipFile(f_input, "r") as z:
                z.extractall(unzip_folder)

            os.remove(f_input)

            f_counter = 0
            for filename in [ f for f in os.listdir(unzip_folder) ]:
                if os.path.splitext(filename)[1] == '.shp':
                    f_counter += 1
                    f_input = os.path.join(unzip_folder, filename)

            if f_counter != 1:
                error = 'invalidContent'

        if error is None and in_format == IMPORT_ESRI:
            driver = ogr.GetDriverByName(IMPORT_ESRI)
            if not driver is None:
                shapefile = driver.Open(f_input)
                if not shapefile is None:
                    layer = shapefile.GetLayer()
                    if not layer is None:
                        crs = layer.GetSpatialRef()
                        if not crs is None:
                            try:
                                crs.AutoIdentifyEPSG()
                            except Exception as ex:
                                pass

                            if 'GGRS87' in str(crs):
                                in_crs = 'EPSG:2100'
                            elif 'WGS_84_Pseudo_Mercator' in str(crs):
                                in_crs = 'EPSG:3857'
                            elif 'GCS_WGS_1984' in str(crs):
                                in_crs = 'EPSG:4326'
                            elif 'ETRS89' in str(crs):
                                in_crs = 'EPSG:4258'

        if error is None and not ogr_export(['', '-lco', 'ENCODING=UTF-8', '-t_srs', 'EPSG:3857', '-s_srs', in_crs, '-f', 'GeoJSON', f_output, f_input]):
            error = 'conversionFailed'

        if os.path.exists(unzip_folder):
            shutil.rmtree(unzip_folder)
        else:
            os.remove(f_input)

        return error

    def _validate(self, file):
        if file['crs'] is None:
            file['error'] = 'crsNotSupported'
        elif file['format'] is None or not file['format'] in ACCEPT_FORMAT:
            file['error'] = 'acceptFileFormats'
        elif file['size'] < MIN_FILE_SIZE:
            file['error'] = 'minFileSize'
        elif file['size'] > MAX_FILE_SIZE:
            file['error'] = 'maxFileSize'
        elif not file['type'] in ACCEPT_FORMAT_TYPES[file['format']]:
            file['error'] = 'acceptFileTypes'
        else:
            return True
        return False

    def _get_file_size(self, file):
        file.seek(0, 2) # Seek to the end of the file
        size = file.tell() # Get the position of EOF
        file.seek(0) # Reset the file position to the beginning
        return size
