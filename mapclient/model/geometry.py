__all__ = ['GeometryEntityMixIn']

import logging

import shapely.wkb
from geojson import Feature

from geoalchemy import Geometry as GeometryBase
from geoalchemy.functions import BaseFunction, parse_clause
from geoalchemy.geometry import GeometryExtensionColumn
from geoalchemy.spatialite import SQLiteSpatialDialect

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import and_, text, table, column 
from sqlalchemy import select, func
from sqlalchemy.schema import Column

from sqlalchemy.dialects.postgresql.base import PGDialect
from sqlalchemy.dialects.sqlite.base import SQLiteDialect
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.dialects.oracle.base import OracleDialect

log = logging.getLogger(__name__)

class GeometryEntityMixIn(object):

    exported_keys = None
    __column_cache__ = None

    def _getfid(self):
        return getattr(self, self.primary_key_column().name)

    def _setfid(self, val):
        setattr(self, self.primary_key_column().name, val)

    fid = property(_getfid, _setfid)
    """ The value of the primary key."""

    def _getgeom(self):
        return getattr(self, self.geometry_column().name)

    def _setgeom(self, val):
        setattr(self, self.geometry_column().name, val)

    geometry = property(_getgeom, _setgeom)
    """ The Shapely geometry object associated to the geometry value."""

    def __getitem__(self, key):
        return getattr(self, key)

    def __setitem__(self, key, val):
        if key in self.__table__.c.keys():
            setattr(self, key, val)

    def __contains__(self, key):
        return hasattr(self, key)

    @classmethod
    def geometry_column(cls):
        """ Returns the table's geometry column or None if the table has no geometry column. """
        if cls.__column_cache__ is None or "geometry" not in cls.__column_cache__:
            columns = [c for c in cls.__table__.columns if isinstance(c.type, GeometryBase)]
            if not columns:
                return None
            elif len(columns) > 1:
                raise Exception("There is more than one geometry column")
            else:
                column = columns.pop()
                cls.__column_cache__ = dict(geometry=column)
        return cls.__column_cache__["geometry"] 

    @classmethod
    def primary_key_column(cls):
        """ Returns the table's primary key column """
        if cls.__column_cache__ is None or "primary_key" not in cls.__column_cache__:
            keys = [k for k in cls.__table__.primary_key]
            if not keys:
                raise Exception("No primary key found !")
            elif len(keys) > 1:
                raise Exception("There is more than one primary key column")
            else:
                cls.__column_cache__ = dict(primary_key=keys.pop())
        return cls.__column_cache__["primary_key"]

    def toFeature(self):
        """Create and return a ``geojson.Feature`` object from this mapped object."""
        if not self.exported_keys:
            exported = self.__table__.c.keys()
        else:
            exported = self.exported_keys

        fid_column = self.primary_key_column().name
        geom_column = self.geometry_column().name

        attributes = {}
        for k in exported:
            k = str(k)
            if k != fid_column and k != geom_column and hasattr(self, k):
                attributes[k] = getattr(self, k)
        
        if hasattr(self, '_mf_shape') and self._mf_shape is not None:
            # we already have the geometry as Shapely geometry (when updating/inserting)
            geometry = self._mf_shape
        elif hasattr(self.geometry, 'geom_wkb') and self.geometry.geom_wkb is not None:
            # create a Shapely geometry from the WKB geometry returned from the database
            geometry = shapely.wkb.loads(self.geometry.geom_wkb.decode("hex"))
        else:
            geometry = None

        return Feature(id=self.fid, 
                       geometry=geometry,
                       properties=attributes,
                       bbox=None if geometry is None else geometry.bounds)
