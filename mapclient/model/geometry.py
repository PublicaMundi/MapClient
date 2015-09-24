__all__ = ['GeometryEntityMixIn']

import logging

import shapely.wkb
from geojson import Feature

from geoalchemy import Geometry as GeometryBase
from geoalchemy.functions import BaseFunction, parse_clause
from geoalchemy.geometry import GeometryExtensionColumn

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import and_, text, table, column, func
from sqlalchemy import select, func
from sqlalchemy.schema import Column

log = logging.getLogger(__name__)

class GeometryEntityMixIn(object):

    def toObject(self, default_field):
        exported = []
        if self.exported_fields:
            exported = self.exported_fields
        else:
            return None

        o = {
            'geometry' : None,
            'properties': {
                'dd_default_field': getattr(self, str(default_field))
            }
        }

        for field in exported:
            o['properties'][field] = getattr(self, str(field))
        
        if hasattr(self, self.geometry_column + '_simple') and getattr(self, self.geometry_column + '_simple'):
            shape = shapely.wkb.loads(getattr(self, self.geometry_column + '_simple').decode("hex"))
            if not shape.is_empty:
                o['geometry'] = shape
        
        if not o['geometry'] and hasattr(self, self.geometry_column + '_transform') and getattr(self, self.geometry_column + '_transform'):
            shape = shapely.wkb.loads(getattr(self, self.geometry_column + '_transform').decode("hex"))
            if not shape.is_empty:
                o['geometry'] = shape

        if not o['geometry']:
            shape = shapely.wkb.loads(getattr(self, self.geometry_column).decode("hex"))
            if not shape.is_empty:
                o['geometry'] = shape

        return o
