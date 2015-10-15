from sqlalchemy import Table, Column

from sqlalchemy.orm import mapper, relation
from sqlalchemy.orm.properties import ColumnProperty

from sqlalchemy.types import Text, BigInteger

from sqlalchemy.schema import ForeignKey

from sqlalchemy.sql import delete

from geoalchemy import GeometryColumn, Geometry, WKTSpatialElement

from shapely.geometry import shape

from mapclient.model.meta import metadata, engine

class Organization(object):
    pass

class Group(object):
    pass

class Package(object):
    pass

class PackageGroup(object):
    pass

class Resource(object):
    pass

class Queryable(object):
    pass


class Field(object):
    pass

class TreeNode(object):
    pass

organizations = Table('organization',
                      metadata,
                      autoload=True,
                      autoload_with=engine)

mapper(Organization, organizations)

groups = Table('group',
               metadata,
               autoload=True,
               autoload_with=engine)

mapper(Group, groups)

packages = Table('package',
                 metadata,
                 Column('the_geom', Geometry(4326)),
                 Column('organization', Text, ForeignKey('organization.id')),
                 autoload=True,
                 autoload_with=engine)

package_groups = Table('package_group',
                       metadata,
                       Column('package_id', Text, ForeignKey('package.id')),
                       Column('group_id', Text, ForeignKey('group.id')),
                       autoload=True,
                       autoload_with=engine)

mapper(PackageGroup, package_groups, properties={
    # M:1 relations. No lazy loading is used.
    'packageRef':relation(Package, lazy=False),
    'groupRef':relation(Group, lazy=False)
})

mapper(Package, packages, properties = {
    # M:1 relation
    'organizationRef': relation(Organization, uselist=False, remote_side=[organizations.c.id], lazy=False),
    # M:N relation. No lazy loading is used.
    'groups': relation(PackageGroup, lazy=False),
    # 1:M relation. No lazy loading is used.
    'resources': relation(Resource, lazy=False),
})

tree_nodes = Table('resource_tree_node',
                   metadata,
                   Column('parent', BigInteger, ForeignKey('resource_tree_node.id')),
                   autoload = True,
                   autoload_with = engine)

mapper(TreeNode, tree_nodes, properties={
    # 1:M relation. No lazy loading is used. Allow cascading deletes
    'children': relation(TreeNode, lazy=False)
})

resources = Table('resource',
                   metadata,
                   Column('package', Text, ForeignKey('package.id')),
                   Column('tree_node_id', Text, ForeignKey('resource_tree_node.id')),
                   autoload=True,
                   autoload_with=engine)

mapper(Resource, resources, properties = {
    # M:1 relation
    'packageRef': relation(Package, uselist=False, remote_side=[packages.c.id], lazy=False),
    # M:1 relation
    'treeNodeRef': relation(TreeNode, uselist=False, remote_side=[tree_nodes.c.id], lazy=True),
    # 1:1 relation. No lazy loading is used. Allow cascading deletes
    'queryableRef': relation(Queryable, uselist=False, lazy=False, backref='resourceRef', cascade="all, delete, delete-orphan")
})

queryables = Table('resource_queryable',
                   metadata,
                   Column('resource', Text, ForeignKey('resource.id')),
                   autoload=True,
                   autoload_with=engine)

fields = Table('resource_field',
               metadata,
               Column('queryable', Text, ForeignKey('resource_queryable.id')),
               autoload=True,
               autoload_with=engine)

mapper(Field, fields)


mapper(Queryable, queryables, properties = {
    # 1:M relation. No lazy loading is used. Allow cascading deletes
    'fields': relation(Field, lazy=True, backref='queryableRef', cascade="all, delete, delete-orphan")
})
