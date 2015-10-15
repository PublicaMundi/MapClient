# -*- coding: utf-8 -*-

import logging

log = logging.getLogger(__name__)

import json
import geojson

from pylons import request, response, session
from pylons.controllers.util import abort
from pylons.decorators import rest
from pylons import config

from sqlalchemy.orm import noload, contains_eager

import shapely.wkb
import shapely.geometry
import shapely.geometry.base

from mapclient.lib.base import BaseController

from mapclient.model.meta import Session

from mapclient.model.schema import Organization, Group, Package, Resource, TreeNode

class ShapelyGeoJsonEncoder(geojson.codec.GeoJSONEncoder):
    def default(self, obj):
        if isinstance(obj, shapely.geometry.base.BaseGeometry):
            return shapely.geometry.mapping(obj)
        return json.GeoJSONEncoder.default(self, obj)

class MetadataController(BaseController):

    def _load_metadata(self):
        metadata = {
            'organizations': [],
            'groups' : [],
            'packages': [],
            'nodes' : {}
        }

        # Load tree nodes
        nodes = Session.query(TreeNode).filter(TreeNode.visible == True).order_by(TreeNode.parent.desc()).all()

        for node in nodes:
            nodeProperties = {
                'id' : node.id,
                'parent': node.parent,
                'caption': {
                    'el': node.caption_el,
                    'en': node.caption_en
                },
                'resources': [],
                'children': [],
                'index': node.index
            }

            if not node.parent is None:
                metadata['nodes'][node.parent]['children'].append(node.id)

            metadata['nodes'][node.id] = nodeProperties

        packages = Session.query(Package).filter(Package.resources.any(Resource.visible == True)).all()

        existingOrganizations = []
        existingGroups = []

        # Load all packages
        for package in packages:
            p = {
                'id': package.id,
                'name': package.name,
                'title': {
                    'el': package.title_el,
                    'en': package.title_en
                },
                'organization': package.organization,
                'groups': [g.group_id for g in package.groups],
                'resources': [r.id for r in package.resources],
                'spatial': None,
                'resources': [],
                'info': False
            }

            if(package.title_en != package.notes_en):
                p['info'] = True

            if package.the_geom:
                p['spatial'] = shapely.wkb.loads(package.the_geom.geom_wkb.decode("hex"))


            for resource in package.resources:
                if resource.format == 'wms' and not resource.tree_node_id is None:
                    r = {
                        'id': resource.id,
                        'format': resource.format,
                        'name': {
                            'el': resource.tree_node_caption_el,
                            'en': resource.tree_node_caption_en
                        },
                        'description': {
                            'el': resource.description_el,
                            'en': resource.description_en,
                        },
                        'url': resource.url,
                        'package': resource.package,
                        'queryable': None,
                        'wms_server': resource.wms_server,
                        'wms_layer': resource.wms_layer,
                        'node_id': resource.tree_node_id,
                        'node_index': resource.tree_node_index,
                        'info' : False
                    }

                    if(resource.tree_node_caption_en != resource.description_en):
                        r['info'] = True

                    if resource.queryableRef:
                        r['queryable'] = {
                            'geometry' : resource.queryableRef.geometry_column,
                            'srid' : resource.queryableRef.srid,
                            'resource' : resource.queryableRef.table,
                            'template' : resource.queryableRef.template
                        }

                    p['resources'].append(r)

                    if resource.tree_node_id and resource.tree_node_id in metadata['nodes']:
                        metadata['nodes'][resource.tree_node_id]['resources'].append(resource.id);

            # Return a package only if it contains at least on resource
            if len(p['resources']) > 0:
                # Load organization data only for records have have at least one package with at least one resource
                organization = package.organizationRef

                if not organization.id in existingOrganizations:
                    existingOrganizations.append(organization.id)

                    o = {
                        'id': organization.id,
                        'name': organization.name,
                        'caption': {
                            'en': organization.caption_en,
                            'el': organization.caption_el
                        },
                        'title': {
                            'en': organization.title_en,
                            'el': organization.title_el
                        },
                        'image': organization.image,
                        'info': False
                    }

                    if(organization.caption_en != organization.description_en):
                        o['info'] = True

                    metadata['organizations'].append(o)

                # Load group data only for records have have at least one package with at least one resource
                for groupRef in package.groups:
                    if not groupRef.groupRef.id in existingGroups:
                        existingGroups.append(groupRef.groupRef.id)

                        group = groupRef.groupRef

                        g = {
                            'id': group.id,
                            'name': group.name,
                            'caption': {
                                'en': group.caption_en,
                                'el': group.caption_el
                            },
                            'title': {
                                'en': group.title_en,
                                'el': group.title_el
                            },
                            'image': group.image,
                            'info': False
                        }

                        if(group.caption_en != group.description_en):
                            g['info'] = True

                        metadata['groups'].append(g)
                metadata['packages'].append(p)

        # Remove empty entries

        return metadata

    @rest.restrict('GET')
    def load(self):
        response.headers['Content-Type'] = 'application/json; charset=utf-8'

        try:
            metadata = self._load_metadata()

            return json.dumps(metadata, cls=ShapelyGeoJsonEncoder, encoding='utf-8')
        except Exception as ex:
            log.error(ex)

        return json.dumps({
            'organizations': [],
            'groups' : [],
            'packages': [],
            'nodes' : {}
        })

    @rest.restrict('GET')
    def organization(self, id):
        response.headers['Content-Type'] = 'application/json; charset=utf-8'

        try:
            organization = Session.query(Organization).filter(Organization.id == id).first()

            r = {
                'success': True,
                'text': {
                    'en' : organization.description_en if organization else None,
                    'el' : organization.description_el if organization else None,
                }
            }

            return json.dumps(r)
        except Exception as ex:
            log.error(ex)

        return json.dumps({
            'success': False,
            'text' : None
        })

    @rest.restrict('GET')
    def group(self, id):
        response.headers['Content-Type'] = 'application/json; charset=utf-8'

        try:
            group = Session.query(Group).filter(Group.id == id).first()

            r = {
                'success': True,
                'text': {
                    'en' : group.description_en if group else None,
                    'el' : group.description_el if group else None,
                }
            }

            return json.dumps(r)
        except Exception as ex:
            log.error(ex)

        return json.dumps({
            'success': False,
            'text' : None
        })

    @rest.restrict('GET')
    def package(self, id):
        response.headers['Content-Type'] = 'application/json; charset=utf-8'

        try:
            package = Session.query(Package).filter(Package.id == id).options(noload('*')).first()

            r = {
                'success': True,
                'text': {
                    'en' : package.notes_en if package else None,
                    'el' : package.notes_el if package else None,
                }
            }

            return json.dumps(r)
        except Exception as ex:
            log.error(ex)

        return json.dumps({
            'success': False,
            'text' : None
        })
