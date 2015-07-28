#!/usr/bin/python

import sys
import os
import json
import argparse
import urlparse
import requests

# ./resource_gen.py -output ~/ -catalog http://web.dev.publicamundi.eu/ -timeout 30

def get_orginizations(catalog, timeout, metadata, verbose):
    # Example : http://labs.geodata.gov.gr/api/3/action/organization_list?all_fields=true

    metadata['organizations'] = []

    resource = urlparse.urljoin(catalog, 'api/3/action/organization_list?all_fields=true')
    request_organizations = requests.get(resource, timeout = timeout)
   
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

                query = query + '&terms=' + o['display_name'] + '&terms=' +  o['description'] + '&terms=' + o['title']
                
                resource = urlparse.urljoin(catalog, 'api/3/action/term_translation_show' + query)
                translation_request = requests.get(resource, timeout = timeout)
                
                if translation_request.status_code == 200:
                    translation = translation_request.json()
                    if translation['success'] == True:
                        for t in translation['result']:
                            if organization['caption']['en'] == t['term']:
                                organization['caption']['el'] = t['term_translation']
                            if organization['title']['en'] == t['term']:
                                organization['title']['el'] = t['term_translation']
                            if organization['description']['en'] == t['term']:
                                organization['description']['el'] = t['term_translation']
                    
                metadata['organizations'].append(organization)

def get_groups(catalog, timeout, metadata, verbose):
    # Example : http://labs.geodata.gov.gr/api/3/action/group_list?all_fields=true
    
    metadata['groups'] = []
    
    resource = urlparse.urljoin(catalog, 'api/3/action/group_list?all_fields=true')
    request_groups = requests.get(resource, timeout = timeout)
   
    if request_groups.status_code == 200:           
        groups = request_groups.json()
        if groups['success'] == True:
            for g in groups['result']:
                query = '?lang_codes=el'
                
                group = {
                    'id': g['id'],
                    'name': g['name'],
                    'caption': {
                        'en': g['display_name'],
                        'el': g['display_name']
                    },
                    'title': {
                        'en': g['title'],
                        'el': g['title']
                    },
                     'description': {
                         'en': g['description'],
                         'el': g['description']
                     },
                    'image': g['image_display_url']
                }

                query = query + '&terms=' + g['display_name'] + '&terms=' +  g['description'] + '&terms=' + g['title']
                
                resource = urlparse.urljoin(catalog, 'api/3/action/term_translation_show' + query)
                translation_request = requests.get(resource, timeout = timeout)
                
                if translation_request.status_code == 200:
                    translation = translation_request.json()
                    if translation['success'] == True:
                        for t in translation['result']:
                            if group['caption']['en'] == t['term']:
                                group['caption']['el'] = t['term_translation']
                            if group['title']['en'] == t['term']:
                                group['title']['el'] = t['term_translation']
                            if group['description']['en'] == t['term']:
                                group['description']['el'] = t['term_translation']
                    
                metadata['groups'].append(group)

def get_packages(catalog, timeout, metadata, verbose):
    metadata['packages'] = []

    organizations = [ p['id'] for p in metadata['organizations'] ]
    groups = [ p['id'] for p in metadata['groups'] ]

    # Example : http://web.dev.publicamundi.eu/api/3/action/organization_show?id=b710fb7c-8f69-470e-9f35-f64364aab3ce&include_datasets=true
    if len(organizations) > 0:
        counter = 0
        total = len(organizations)
    
        if verbose:
            print 'Loading packages for organizations ...'
       
        for oId in organizations:
            counter += 1
            
            resource = urlparse.urljoin(catalog, 'api/3/action/organization_show?id=' + oId + '&include_datasets=true')
            request_packages = requests.get(resource, timeout = timeout)

            if request_packages.status_code == 200:           
                packages = request_packages.json()
                if packages['success'] == True:
                    for p in packages['result']['packages']:
                        load_package(catalog, timeout, metadata, p)
                        
            if verbose:
                progress = 100 * counter / total
                
                # http://stackoverflow.com/questions/3173320/text-progress-bar-in-the-console
                sys.stdout.write('\r[{0}] {1}%'.format(('#'*(progress/5)).ljust(20), progress))
                sys.stdout.flush()
                
        if verbose: print ''

    # Example : http://web.dev.publicamundi.eu/api/3/action/group_show?id=ddf6fadb-d87a-40ca-b930-5ac68e421732
    if len(groups) > 0:
        counter = 0
        total = len(groups)
    
        if verbose:
            print 'Loading packages for groups ...'
            
        for oId in groups:
            counter += 1

            resource = urlparse.urljoin(catalog, 'api/3/action/group_show?id=' + oId)
            request_packages = requests.get(resource, timeout = timeout)

            if request_packages.status_code == 200:           
                packages = request_packages.json()
                if packages['success'] == True:
                    for p in packages['result']['packages']:
                        load_package(catalog, timeout, metadata, p)

            if verbose:
                progress = 100 * counter / total
                
                sys.stdout.write('\r[{0}] {1}%'.format(('#'*(progress/5)).ljust(20), progress))
                sys.stdout.flush()

        if verbose: print ''
        
def load_package(catalog, timeout, metadata, p):
    if not p['id'] in [ existing['id'] for existing in metadata['packages'] ]:
        query = '?lang_codes=el'
        
        package = {
            'id': p['id'],
            'name': p['name'],
            'title': p['title'],
            'notes': p['notes'],
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
                        'resource_group_id': r['resource_group_id'],
                        'format': r['format'],
                        'name': r['name'],
                        'description': r['description'],
                        'url': r['url'],
                        'package': p['id']
                    }
                    if 'wms_server' in r:
                        resource['wms_server'] = r['wms_server']
                    if 'wms_layer' in r:
                        resource['wms_layer'] = r['wms_layer']
                    if 'parent_resource_id' in r:
                        resource['parent_resource_id'] = r['parent_resource_id']
                    
                    package['resources'].append(resource)
               
        if len(package['resources']) > 0:               
            metadata['packages'].append(package)

def get_metadata(output, catalog, timeout, pretty, verbose):
    parts = urlparse.urlsplit(catalog)
    if not parts.scheme or not parts.netloc:
        raise Exception('Invalid URL.')

    if not os.path.isdir(output):
        raise Exception('Folder [{output}] does not exist.'.format(output = output))

    try:
        metadata = {
            'organizations': [],
            'groups': [],
            'packages': []
        }

        if verbose:
            print 'Loading organizations ...'
        get_orginizations(catalog, timeout, metadata, verbose)

        if verbose:
            print 'Loading groups ...'
        get_groups(catalog, timeout, metadata, verbose)

        get_packages(catalog, timeout, metadata, verbose)

        filename = os.path.join(output, 'metadata.json')        
        
        if os.path.exists(filename):
            os.remove(filename)
        
        with open(filename, 'w') as outfile:
            if pretty:
                json.dump(metadata, outfile, indent=4, separators=(',', ': '))
            else:
                json.dump(metadata, outfile)
                
        if verbose:
            print 'Export completed. Metadata is writen at [{filename}].'.format(filename = filename)
    except requests.exceptions.HTTPError as ex:
        print 'Export has failed (HTTPError): ' + str(ex)
    except requests.exceptions.ConnectionError as ex:
        print 'Export has failed (ConnectionError): ' + str(ex)
    except requests.exceptions.Timeout as ex:
        print 'Export has failed (Timeout): ' + str(ex)
        

try:
    parser = argparse.ArgumentParser(description='Downloads organization, group and package metadata from the catalog and extracts information for the Map Client application')
    parser.add_argument('-output', '-o', metavar='path', type=str, help='folder where the produced files are created', required=True)
    parser.add_argument('-catalog', '-c', metavar='url', type=str, help='CKAN catalog endpoint', required=True)
    parser.add_argument('-timeout', '-t', metavar='N', type=int, help='HTTP requests will timeout after N seconds', required=False, default=30)
    parser.add_argument('-pretty', '-p', action='store_true', help='JSON elements and object members will be pretty-printed')
    parser.add_argument('-verbose', '-v', action='store_true', help='Print detailed information for export execution')
    
    args = parser.parse_args()

    get_metadata(args.output, args.catalog, args.timeout, args.pretty, args.verbose)
except Exception as ex:
    print 'Export has failed: ' + str(ex)
