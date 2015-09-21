#!/usr/bin/python

import sys
import os
import json
import geojson
import csv
import argparse
import urlparse
import requests

from sqlalchemy import create_engine, MetaData, Table, Column
from sqlalchemy.types import Text, BigInteger
from sqlalchemy.schema import ForeignKey
from sqlalchemy.sql import delete
from sqlalchemy.orm import sessionmaker, mapper, relation
from sqlalchemy.orm.properties import ColumnProperty

from geoalchemy import GeometryColumn, Geometry, WKTSpatialElement

from shapely.geometry import shape

# Declare data model
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

class ResourceGenerator(object):

    def __init__(self):
        self.engine = None
        self.metadata = None
        self.session = None

    def _initialize_session(self, args):
        if args.database:
            self.engine = create_engine(args.database)
            session_factory = sessionmaker(bind=self.engine)

            self.session = session_factory()
            self.metadata = MetaData()

    def _initialize_model(self):
        if self.session:
            self.organizations = Table('organization',
                                  self.metadata,  
                                  autoload=True,
                                  autoload_with=self.engine)

            mapper(Organization, self.organizations)
            
            self.groups = Table('group',
                           self.metadata,  
                           autoload=True,
                           autoload_with=self.engine)

            mapper(Group, self.groups)
            
            self.packages = Table('package',
                             self.metadata,
                             Column('the_geom', Geometry(4326)),
                             Column('organization', Text, ForeignKey('organization.id')),
                             autoload=True,
                             autoload_with=self.engine)

            self.package_groups = Table('package_group',
                                   self.metadata,
                                   Column('package_id', Text, ForeignKey('package.id')),
                                   Column('group_id', Text, ForeignKey('group.id')),
                                   autoload=True, 
                                   autoload_with=self.engine)

            mapper(PackageGroup, self.package_groups, properties={
                # M:1 relations. No lazy loading is used.
                'packageRef':relation(Package, lazy=False),
                'groupRef':relation(Group, lazy=False)
            })

            mapper(Package, self.packages, properties = {
                # M:1 relation
                'organizationRef': relation(Organization, uselist=False, remote_side=[self.organizations.c.id], lazy=False),
                # M:N relation. No lazy loading is used.
                'groups': relation(PackageGroup, lazy=False),
            })

            self.tree_nodes = Table('resource_tree_node',
                               self.metadata,
                               Column('parent', BigInteger, ForeignKey('resource_tree_node.id')),
                               autoload = True,
                               autoload_with = self.engine)

            mapper(TreeNode, self.tree_nodes, properties={
                 # Add a reference to the parent group. It is important to set remote_side parameter since the relation is a many-to-one
                 # relation. Moreover, since this is a self-referencing relation, join_depth parameter must be also set in order to avoid
                 # querying the database for the parent of each group.
                'parentRef': relation(TreeNode, uselist=False, remote_side=[self.tree_nodes.c.id], lazy=False, join_depth=1)
            })

            self.resources = Table('resource',
                               self.metadata,
                               Column('package', Text, ForeignKey('package.id')),
                               Column('tree_node_id', Text, ForeignKey('resource_tree_node.id')),
                               autoload=True,
                               autoload_with=self.engine)
                             
            mapper(Resource, self.resources, properties = {
                # M:1 relation
                'packageRef': relation(Package, uselist=False, remote_side=[self.packages.c.id], lazy=False),
                # M:1 relation
                'treeNodeRef': relation(TreeNode, uselist=False, remote_side=[self.tree_nodes.c.id], lazy=False),
                # 1:1 relation. No lazy loading is used. Allow cascading deletes
                'queryableRef': relation(Queryable, lazy=False, backref='resourceRef', cascade="all, delete, delete-orphan")
            })

            self.queryables = Table('resource_queryable',
                               self.metadata,
                               Column('resource', Text, ForeignKey('resource.id')),
                               autoload=True,
                               autoload_with=self.engine)
                               
            self.fields = Table('resource_field',
                           self.metadata,
                           Column('queryable', Text, ForeignKey('resource_queryable.id')),
                           autoload=True,
                           autoload_with=self.engine)
                             
            mapper(Field, self.fields)


            mapper(Queryable, self.queryables, properties = {
                # 1:M relation. No lazy loading is used. Allow cascading deletes
                'fields': relation(Field, lazy=False, backref='queryableRef', cascade="all, delete, delete-orphan")
            })

    def _get_organizations(self, args, data):
        if args.verbose:
            print 'Loading organizations ...'
                
        # Example : http://labs.geodata.gov.gr/api/3/action/organization_list?all_fields=true

        data['organizations'] = []

        resource = urlparse.urljoin(args.catalog, 'api/3/action/organization_list?all_fields=true')
        request_organizations = requests.get(resource, timeout = args.timeout)

        if request_organizations.status_code == 200:
            organizations = request_organizations.json()
            if organizations['success'] == True:
                for o in organizations['result']:
                    query = '?lang_codes=el'

                    organization = {
                        'id': o['id'],
                        'name': o['name'],
                        'caption': {
                            'en': o['display_name'],
                            'el': o['display_name']
                        },
                        'title': {
                            'en': o['title'],
                            'el': o['title']
                        },
                         'description': {
                             'en': o['description'],
                             'el': o['description']
                         },
                        'image': o['image_display_url']
                    }

                    fields = {
                        'caption': o['display_name'],
                        'description': o['description'],
                        'title' : o['title']
                    }

                    for f in fields:
                        query = query + '&terms=' + fields[f]

                        resource = urlparse.urljoin(args.catalog, 'api/3/action/term_translation_show' + query)
                        translation_request = requests.get(resource, timeout = args.timeout)

                        if translation_request.status_code == 200:
                            translation = translation_request.json()
                            if translation['success'] == True:
                                for t in translation['result']:
                                    if organization[f]['en'] == t['term']:
                                        organization[f]['el'] = t['term_translation']

                    data['organizations'].append(organization)
                    
    def _get_groups(self, args, data):
        if args.verbose:
            print 'Loading groups ...'
                
        group_translations = None

        if args.groups:
            group_translations = {}

            with open(args.groups, mode='r') as topics_file:
                reader = csv.reader(topics_file)
                for row in reader:
                    group_translations[row[0]] = {
                        'title_el' : row[1],
                        'title_en' : row[2],
                        'description_el' : row[3],
                        'description_en' : row[4],
                        'logo_url' : row[5]
                    }

        # Example : http://labs.geodata.gov.gr/api/3/action/group_list?all_fields=true

        data['groups'] = []

        resource = urlparse.urljoin(args.catalog, 'api/3/action/group_list?all_fields=true')
        request_groups = requests.get(resource, timeout = args.timeout)

        if request_groups.status_code == 200:
            groups = request_groups.json()
            if groups['success'] == True:
                for g in groups['result']:
                    name = g['name']

                    translate = True

                    title_en = g['title']
                    title_el = g['title']

                    description_en = g['description']
                    description_el = g['description']

                    if not group_translations is None and name in group_translations:
                        translate = False

                        title_en = group_translations[name]['title_en']
                        title_el = group_translations[name]['title_el']

                        description_en = group_translations[name]['description_en']
                        description_el = group_translations[name]['description_el']

                    group = {
                        'id': g['id'],
                        'name': name,
                        'caption': {
                            'en': title_en,
                            'el': title_el
                        },
                        'title': {
                            'en': title_en,
                            'el': title_el
                        },
                         'description': {
                             'en': description_en,
                             'el': description_el
                         },
                        'image': g['image_display_url']
                    }

                    if translate:
                        query = '?lang_codes=el'

                        fields = {
                            'caption': g['title'],
                            'description': g['description'],
                            'title' : g['title']
                        }

                        for f in fields:
                            query = query + '&terms=' + fields[f]

                            resource = urlparse.urljoin(args.catalog, 'api/3/action/term_translation_show' + query)
                            translation_request = requests.get(resource, timeout = args.timeout)

                            if translation_request.status_code == 200:
                                translation = translation_request.json()
                                if translation['success'] == True:
                                    for t in group['result']:
                                        if group[f]['en'] == t['term']:
                                            group[f]['el'] = t['term_translation']

                    data['groups'].append(group)

    def _get_packages(self, args, data):
        data['packages'] = []

        organizations = [ p['id'] for p in data['organizations'] ]
        groups = [ p['id'] for p in data['groups'] ]

        # Example : http://web.dev.publicamundi.eu/api/3/action/organization_show?id=b710fb7c-8f69-470e-9f35-f64364aab3ce&include_datasets=true
        if len(organizations) > 0:
            counter = 0
            total = len(organizations)

            if args.verbose:
                print 'Loading packages for organizations ...'

            for oId in organizations:
                counter += 1

                resource = urlparse.urljoin(args.catalog, 'api/3/action/organization_show?id=' + oId + '&include_datasets=true')
                request_packages = requests.get(resource, timeout = args.timeout)

                if request_packages.status_code == 200:
                    packages = request_packages.json()
                    if packages['success'] == True:
                        for p in packages['result']['packages']:
                            self._load_package(args, data, p)

                if args.verbose:
                    progress = 100 * counter / total

                    # http://stackoverflow.com/questions/3173320/text-progress-bar-in-the-console
                    sys.stdout.write('\r[{0}] {1}%'.format(('#'*(progress/5)).ljust(20), progress))
                    sys.stdout.flush()

            if args.verbose: print ''

        # Example : http://web.dev.publicamundi.eu/api/3/action/group_show?id=ddf6fadb-d87a-40ca-b930-5ac68e421732
        if len(groups) > 0:
            counter = 0
            total = len(groups)

            if args.verbose:
                print 'Loading packages for groups ...'

            for oId in groups:
                counter += 1

                resource = urlparse.urljoin(args.catalog, 'api/3/action/group_show?id=' + oId)
                request_packages = requests.get(resource, timeout = args.timeout)

                if request_packages.status_code == 200:
                    packages = request_packages.json()
                    if packages['success'] == True:
                        for p in packages['result']['packages']:
                            self._load_package(args, data, p)

                if args.verbose:
                    progress = 100 * counter / total

                    sys.stdout.write('\r[{0}] {1}%'.format(('#'*(progress/5)).ljust(20), progress))
                    sys.stdout.flush()

            if args.verbose: print ''

    def _load_package(self, args, data, p):
        if not p['id'] in [ existing['id'] for existing in data['packages'] ]:
            query = '?lang_codes=el'

            package = {
                'id': p['id'],
                'name': p['name'],
                'title': {
                    'el': p['title'],
                    'en': p['title']
                },
                'notes': {
                    'el': p['notes'],
                    'en': p['notes']
                },
                'organization': p['organization']['id'],
                'groups': [],
                'resources': []
            }

            if 'spatial' in p:
                package['spatial'] = p['spatial']

            if 'groups' in p:
                for g in p['groups']:
                   package['groups'].append(g['id'])

            if 'resources' in p:
                for r in p['resources']:
                    if r['format'] == 'wms':
                        resource = {
                            'id': r['id'],
                            'format': r['format'],
                            'name': {
                                'el': r['name'],
                                'en': r['name']
                            },
                            'description': {
                                'el': r['description'],
                                'en': r['description']
                            },
                            'url': r['url'],
                            'package': p['id'],
                            'queryable': None,
                            'wms_server': None,
                            'wms_layer': None
                        }
                        if 'wms_server' in r:
                            resource['wms_server'] = r['wms_server']
                        if 'wms_layer' in r:
                            resource['wms_layer'] = r['wms_layer']

                        package['resources'].append(resource)

            if len(package['resources']) > 0:
                data['packages'].append(package)

    def _get_queryable_resources(self, args, data):
        # Get all queryable resources
        # Example : http://web.dev.publicamundi.eu/maps/api/resource_show
        resources_url = urlparse.urljoin(args.endpoint, 'api/resource_show')
        request_resources = requests.get(resources_url, timeout = args.timeout)

        if request_resources.status_code == 200:
            resources_response = request_resources.json()
            if resources_response['success']:
                if len(resources_response['resources']) > 0:
                    counter = 0
                    total = len(resources_response['resources'])

                    if args.verbose:
                        print 'Loading queryable resources ...'

                    for resource_id in resources_response['resources']:
                        counter += 1
                        
                        resource = resources_response['resources'][resource_id]
                        
                        for package in data['packages']:
                            for package_resource in package['resources']:
                                if package_resource['id'] == resource['wms']:
                                    package_resource['queryable'] = {
                                        'fields' : [],
                                        'geometry' : resource['geometry_type'],
                                        'srid' : None,
                                        'resource' : resource_id
                                    }
                                
                                    # Get table resource metadata
                                    # Example : http://web.dev.publicamundi.eu/maps/api/resource_describe/3e2d4224-65f5-408e-b6b9-340066dc3fa0
                                    metadata_url = urlparse.urljoin(args.endpoint, 'api/resource_describe/' + resource_id)
                                    request_metadata = requests.get(metadata_url, timeout = args.timeout)

                                    if request_metadata.status_code == 200:
                                        metadata_response = request_metadata.json()
                                        if metadata_response['success']:
                                            resource_metadata = metadata_response['resource']
                                            
                                            package_resource['queryable']['srid'] = resource_metadata['srid']
                                            package_resource['queryable']['fields'] = [f for f in resource_metadata['fields'] if resource_metadata['fields'][f]['type'] == 'varchar']

                        if args.verbose:
                            progress = 100 * counter / total

                            sys.stdout.write('\r[{0}] {1}%'.format(('#'*(progress/5)).ljust(20), progress))
                            sys.stdout.flush()

                    if args.verbose: print ''
             
    def _save_metadata(self, args, data):
        # Delete data that is always re-created
        self.session.query(PackageGroup).delete()
        
        catalogOrganizations = [o['id'] for o in data['organizations']]
        deletedOranizations = []

        catalogGroups = [o['id'] for o in data['groups']]
        deletedGroups = []
        
        catalogPackages = [o['id'] for o in data['packages']]
        deletedPackages = []

        catalogResources = [r['id'] for p in data['packages'] for r in p['resources']]
        deletedResources = []

        try:
            if args.database:
                # Find deleted organizations
                storedOrganizations = self.session.query(Organization).all()
                for o in storedOrganizations:
                    if not o.id in catalogOrganizations:
                        deletedOranizations.append(o)

                # Insert new or update existing organizations
                for o in data['organizations']:
                    id = o['id']
                    
                    dbOrganization = self.session.query(Organization).filter(Organization.id == id).first()
                    
                    if not dbOrganization:
                        dbOrganization = Organization()
                        dbOrganization.id = id
                        
                        self.session.add(dbOrganization)
                        
                    dbOrganization.name = o['name']
                    dbOrganization.image = o['image']
                    dbOrganization.caption_en = o['caption']['en']
                    dbOrganization.caption_el = o['caption']['el']
                    dbOrganization.title_en = o['title']['en']
                    dbOrganization.title_el = o['title']['el']
                    dbOrganization.description_en = o['description']['en']
                    dbOrganization.description_el = o['description']['el']

                # Delete organizations that have been removed from the catalog
                for o in deletedOranizations:
                    self.session.delete(o)

                if args.verbose:
                    print 'Updated organizations ...'

                # Find deleted groups
                storedGroups = self.session.query(Group).all()
                for g in storedGroups:
                    if not g.id in catalogGroups:
                        deletedGroups.append(g)

                # Insert new or update existing groups
                for g in data['groups']:
                    id = g['id']
                    dbGroup = self.session.query(Group).filter(Group.id == id).first()

                    if not dbGroup:
                        dbGroup = Group()
                        dbGroup.id = id
                        
                        self.session.add(dbGroup)
                        
                    dbGroup.name = g['name']
                    dbGroup.image = g['image']
                    dbGroup.caption_en = g['caption']['en']
                    dbGroup.caption_el = g['caption']['el']
                    dbGroup.title_en = g['title']['en']
                    dbGroup.title_el = g['title']['el']
                    dbGroup.description_en = g['description']['en']
                    dbGroup.description_el = g['description']['el']

                # Delete groups that have been removed from the catalog
                for g in deletedGroups:
                    self.session.delete(g)

                self.session.flush()

                if args.verbose:
                    print 'Updated groups ...'

                # Find deleted packages
                storedPackages = self.session.query(Package).all()
                for p in storedPackages:
                    if not p.id in catalogPackages:
                        deletedPackages.append(p)

                # Insert new or update existing packages
                for p in data['packages']:
                    id = p['id']
                    
                    dbPackage = self.session.query(Package).filter(Package.id == id).first()
                    
                    if not dbPackage:
                        dbPackage = Package()
                        dbPackage.id = id
                        
                        self.session.add(dbPackage)
                        
                    dbPackage.name = p['name']
                    dbPackage.title_en = p['title']['en']
                    dbPackage.title_el = p['title']['el']
                    dbPackage.notes_en = p['notes']['en']
                    dbPackage.notes_el = p['notes']['el']

                    dbPackage.organization = p['organization']
                    
                    if 'spatial' in p and p['spatial']:
                        s = shape(geojson.loads(p['spatial']))
                        
                        dbPackage.the_geom = WKTSpatialElement(s.wkt)

                    if p['groups']:
                        for groupId in p['groups']:
                            packageGroup = PackageGroup()
                            packageGroup.package_id = id
                            packageGroup.group_id = groupId
                            
                            self.session.add(packageGroup)


                # Delete packages that have been removed from the catalog
                for p in deletedPackages:
                    self.session.delete(p)

                if args.verbose:
                    print 'Updated packages ...'

                # Find deleted resources
                storedResouces = self.session.query(Resource).all()
                for r in storedResouces:
                    if not r.id in catalogResources:
                        deletedResources.append(r)

                # Insert new or update existing resources
                for r in [r for p in data['packages'] for r in p['resources']]:
                    createQueryable = False
                    
                    id = r['id']
                    
                    dbResource = self.session.query(Resource).filter(Resource.id == id).first()
                    dbQueryable = None

                    # If resource exists, check if queryable is also present
                    if dbResource:
                        dbQueryable = self.session.query(Queryable).filter(Queryable.resource == id).first()
                    else:
                        dbResource = Resource()
                        
                        dbResource.id = id
                        dbResource.package = r['package']
                        
                        self.session.add(dbResource)
                        
                    dbResource.name_en = r['name']['en']
                    dbResource.name_el = r['name']['el']
                    dbResource.description_en = r['description']['en']
                    dbResource.description_el = r['description']['el']
                    dbResource.format = r['format']
                    dbResource.url = r['url']
                    dbResource.wms_server = r['wms_server']
                    dbResource.wms_layer = r['wms_layer']

                    if r['queryable']:
                        createFields = False
                        if not dbQueryable:
                            dbQueryable = Queryable()
                            dbQueryable.resource = id
                            
                            self.session.add(dbQueryable)
                            createFields = True

                        dbQueryable.geometry = r['queryable']['geometry']
                        dbQueryable.srid = r['queryable']['srid']
                        dbQueryable.table = r['queryable']['resource']
                        
                        if createFields:
                            # Fetch new key for queryable
                            self.session.flush()
                            
                            for f in r['queryable']['fields']:
                                dbField = Field()
                                dbField.queryable = dbQueryable.id
                                dbField.name = f
                                dbField.caption_en = f
                                dbField.caption_el = f
                                dbField.active = False
                                
                                dbQueryable.fields.append(dbField)
                    elif dbQueryable:
                        #self.session.execute(delete(self.fields, whereclause = (self.fields.c.queryable == dbQueryable.id)))
                        self.session.delete(dbQueryable)

                # Delete resources that have been removed from the catalog
                for r in deletedResources:
                    self.session.delete(r)

                if args.verbose:
                    print 'Updated resources ...'

                self.session.commit()
        except:
            self.session.rollback()
            
            raise

    def _export_metadata(self, args, data):
        filename = os.path.join(args.output, 'metadata.json')

        if os.path.exists(filename):
            os.remove(filename)

        with open(filename, 'w') as outfile:
            if args.pretty:
                json.dump(data, outfile, indent=4, separators=(',', ': '))
            else:
                json.dump(data, outfile)

        if args.verbose:
            print ''
            print 'Export completed. Metadata is writen at [{filename}].'.format(filename = filename)
                
    def get_metadata(self, args):
        try:        
            self._initialize_session(args)

            self._initialize_model()

            parts = urlparse.urlsplit(args.catalog)

            if not parts.scheme or not parts.netloc:
                raise Exception('Invalid URL.')

            if not os.path.isdir(args.output):
                raise Exception('Folder [{output}] does not exist.'.format(output = args.output))

            if not args.groups is None and not os.path.isfile(args.groups):
                raise Exception('File [{groups}] does not exist.'.format(groups = args.groups))

            data = {
                'organizations': [],
                'groups': [],
                'packages': []
            }

            self._get_organizations(args, data)

            self._get_groups(args, data)

            self._get_packages(args, data)

            self._get_queryable_resources(args, data)
            
            self._save_metadata(args, data)
            
            self._export_metadata(args, data)
        except requests.exceptions.HTTPError as ex:
            print 'Export has failed (HTTPError): ' + str(ex)
        except requests.exceptions.ConnectionError as ex:
            print 'Export has failed (ConnectionError): ' + str(ex)
        except requests.exceptions.Timeout as ex:
            print 'Export has failed (Timeout): ' + str(ex)
        except Exception as ex:
            print 'Unexpected exception has occured: ' + str(ex)
        finally:
            self._cleanup()
        
    def _cleanup(self):
        try:
            if self.session:
                self.session.close()
        except:
            pass

generator = None

try:
    parser = argparse.ArgumentParser(description='Downloads organization, group and package metadata from the catalog and extracts information for the Map Client application')
    parser.add_argument('-output', '-o', metavar='path', type=str, help='Folder where the produced files are created', required=True)
    parser.add_argument('-catalog', '-c', metavar='url', type=str, help='CKAN catalog endpoint', required=True)
    parser.add_argument('-endpoint', '-e', metavar='url', type=str, help='Map Client Data API endpoint', required=True)
    parser.add_argument('-database', '-d', metavar='connection string', type=str, help='Database connection string to the Map Client database', required=False)
    parser.add_argument('-groups', '-g', metavar='groups', type=str, help='CSV with CKAN topics used for initialization', required=False)
    parser.add_argument('-timeout', '-t', metavar='N', type=int, help='HTTP requests will timeout after N seconds', required=False, default=30)
    parser.add_argument('-pretty', '-p', action='store_true', help='JSON elements and object members will be pretty-printed')
    parser.add_argument('-verbose', '-v', action='store_true', help='Print detailed information for export execution')

    args = parser.parse_args()

    generator = ResourceGenerator()

    generator.get_metadata(args)
except Exception as ex:
    print 'Export has failed: ' + str(ex)
