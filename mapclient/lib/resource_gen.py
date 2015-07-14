#!/usr/bin/python

import sys
import os
import json
import argparse
import urlparse
import requests

# ./resource_gen.py -output ~/ -catalog http://web.dev.publicamundi.eu/ -timeout 30

def get_orginizations(catalog, timeout):
    # Example : http://labs.geodata.gov.gr/api/3/action/organization_list?all_fields=true

    metadata = []
    
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
                    # 'description': {
                    #     'en': o['description'],
                    #     'el': o['description']
                    # },
                    'image': o['image_display_url']
                }

                query = query + '&terms=' + o['display_name'] + '&terms' +  o['description'] + '&terms=' + o['title']
                
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
                            #if organization['description']['en'] == t['term']:
                            #    organization['description']['el'] = t['term_translation']
                    
                metadata.append(organization)
    return metadata

def get_groups(catalog, timeout):
    # Example : http://labs.geodata.gov.gr/api/3/action/group_list?all_fields=true
    
    metadata = []
    
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
                    # 'description': {
                    #     'en': g['description'],
                    #     'el': g['description']
                    # },
                    'image': g['image_display_url']
                }

                query = query + '&terms=' + g['display_name'] + '&terms' +  g['description'] + '&terms=' + g['title']
                
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
                            #if group['description']['en'] == t['term']:
                            #    group['description']['el'] = t['term_translation']
                    
                metadata.append(group)
    return metadata

def get_packages(catalog, timeout, metadata):
    packages = []

    organizations = [ p['id'] for p in metadata['organizations'] ]
    groups = [ p['id'] for p in metadata['groups'] ]
    
    # Example : http://web.dev.publicamundi.eu/api/3/action/organization_show?id=b710fb7c-8f69-470e-9f35-f64364aab3ce&include_datasets=true
    for oId in organizations:
        resource = urlparse.urljoin(catalog, 'api/3/action/group_show?id=' + oId + '&include_datasets=true')
        request_packages = requests.get(resource, timeout = timeout)

        if request_packages.status_code == 200:           
            packages = request_packages.json()
            if packages['success'] == True:
                for p in packages['result']['packages']:
                    query = '?lang_codes=el'
                    
                    package = {
                        'id': ['id'],
                        'name': g['name'],
                        'caption': {
                            'en': g['display_name'],
                            'el': g['display_name']
                        },
                        'title': {
                            'en': g['title'],
                            'el': g['title']
                        },
                        # 'description': {
                        #     'en': g['description'],
                        #     'el': g['description']
                        # },
                        'image': g['image_display_url']
                    }

                    query = query + '&terms=' + g['display_name'] + '&terms' +  g['description'] + '&terms=' + g['title']
                    
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
                                #if group['description']['en'] == t['term']:
                                #    group['description']['el'] = t['term_translation']
                        
                    metadata.append(group)
    return metadata

def get_metadata(output, catalog, timeout, pretty):
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

        metadata['organizations'] = get_orginizations(catalog, timeout)
        metadata['groups'] = get_groups(catalog, timeout)
        metadata['packages'] = get_packages(catalog, timeout, metadata)

        filename = os.path.join(output, 'metadata.json')        
        
        if os.path.exists(filename):
            os.remove(filename)
        
        with open(filename, 'w') as outfile:
            if pretty:
                json.dump(metadata, outfile, indent=4, separators=(',', ': '))
            else:
                json.dump(metadata, outfile)
    except requests.exceptions.HTTPError as ex:
        details = 'Could not load resource. Server responded with %s %s' % (
            ex.response.status_code, error.response.reason)
        abort(409, detail=details)
    except requests.exceptions.ConnectionError as ex:
        details = 'Could not load resource because a connection error occurred. %s' % ex
        abort(502, detail=details)
    except requests.exceptions.Timeout as ex:
        details = 'Could not load resource because the connection timed out.'
        abort(504, detail=details)

try:
    parser = argparse.ArgumentParser(description='Downloads organization, group and package metadata from the catalog and extracts information for the Map Client application')
    parser.add_argument('-output', '-o', metavar='path', type=str, help='folder where the produced files are created', required=True)
    parser.add_argument('-catalog', '-c', metavar='url', type=str, help='CKAN catalog endpoint', required=True)
    parser.add_argument('-timeout', '-t', metavar='N', type=int, help='HTTP requests will timeout after N seconds', required=False, default=30)
    parser.add_argument('-pretty', '-p', action='store_true', help='JSON elements and object members will be pretty-printed')
    
    args = parser.parse_args()

    get_metadata(args.output, args.catalog, args.timeout, args.pretty)
except Exception as ex:
    print 'Export has failed: ' + str(ex)
