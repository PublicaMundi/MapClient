define(['module', 'jquery', 'ol', 'URIjs/URI', 'shared'], function (module, $, ol, URI, PublicaMundi) {
    "use strict";

    var sortByProperty = function(prop, locale) {
        if(locale) {
            return function(a, b) {
                if(a[prop][locale] < b[prop][locale]) {
                    return -1;
                }
                if(a[prop][locale] > b[prop][locale]) {
                    return 1;
                }
                return 0;
            }
        }
        return function(a, b) {
            if(a[prop] < b[prop]) {
                return -1;
            }
            if(a[prop] > b[prop]) {
                return 1;
            }
            return 0;
        }
    };

    PublicaMundi.Maps.Component = PublicaMundi.Class(PublicaMundi.Maps.Observable, {
        initialize: function (options) {
			this.values.element = null;
			this.values.visible = true;

            if (typeof PublicaMundi.Maps.Observable.prototype.initialize === 'function') {
                PublicaMundi.Maps.Observable.prototype.initialize.apply(this, arguments);
            }

            this.event('render');
            this.event('hide');
            this.event('show');

            if(this.values.visible) {
				this.show();
			} else {
				this.hide();
			}
        },
        render: function() {
			this.trigger('render');
		},
		refresh: function() {
			this.render();
		},
		show: function() {
			$('#' + this.values.element).show();
			this.trigger('show');
		},
		hide: function() {
			$('#' + this.values.element).hide();
			this.trigger('hide');
		},
        localizeUI: function(locale) {
        }
    });

    PublicaMundi.Maps.LayerTreeViewMode = {
		ByGroup: 1,
		ByOrganization: 2,
        ByFilter: 3
	};

    PublicaMundi.Maps.LayerTree = PublicaMundi.Class(PublicaMundi.Maps.Component, {
        initialize: function (options) {
			var self = this;

			PublicaMundi.extend(this.values, {
				map: null,
				ckan : null,
				resources: null,
				mode: PublicaMundi.Maps.LayerTreeViewMode.ByGroup
			});

            if (typeof PublicaMundi.Maps.Component.prototype.initialize === 'function') {
                PublicaMundi.Maps.Component.prototype.initialize.apply(this, arguments);
            }

            var preload = this.values.ckan.isPreloadingEnabled();

            this.values.contentElement = this.values.element + '-result';

            this.values.filter = {
                term: null
            };

            this.values.bbox = {
                overlay: null,
                interaction: null,
                feature: null
            };

            if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                // Feature overlays
                this.values.bbox.overlay = new ol.FeatureOverlay({
                    style: [
                        new ol.style.Style({
                            fill: new ol.style.Fill({
                                color: [255, 255, 255, 0.4]
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#27AE60',
                                width: 2
                            })
                        })
                    ]
                });
                this.values.bbox.overlay.setMap(this.values.map);


                // BBOX draw
                this.values.bbox.interaction = new ol.interaction.DragBox({
                    style: new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [255, 255, 255, 0.4]
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#27AE60',
                            width: 2
                        })
                    })
                });

                this.values.bbox.interaction.on('boxstart', function (e) {
                    self.values.bbox.overlay.getFeatures().clear();
                });

                this.values.bbox.interaction.on('boxend', function (e) {
                    var geom = self.values.bbox.interaction.getGeometry();
                    var feature = new ol.Feature({ name: self.values.element + '-bbox', geometry: geom });

                    self.values.bbox.overlay.getFeatures().clear();
                    self.values.bbox.overlay.addFeature(feature);
                });

                this.values.map.addInteraction(this.values.bbox.interaction);
                this.values.bbox.interaction.setActive(false);
            }

			this.event('layer:added');
			this.event('layer:removed');

			this.event('bbox:draw');
            this.event('bbox:remove');
            this.event('bbox:apply');
            this.event('bbox:cancel');

            this.event('catalog:search');
            this.event('catalog:info-loading');
            this.event('catalog:info-loaded');

            this.values.rootTreeNode = {
                id: null,
                children: []
            };

            this.values.getTreeNodeById = function(id, parent) {
                if(id == null) {
                    return null;
                }
                parent = parent || self.values.rootTreeNode;

                var node = null;
                for(var i=0; i < parent.children.length; i++) {
                    if(parent.children[i].id == id) {
                        return parent.children[i];
                    } else {
                        node = self.values.getTreeNodeById(id, parent.children[i]);
                        if(node) {
                            return node;
                        }
                    }
                }
                return null;
            };

            this.values.createTreeNodeElement = function(parentTreeNode, options, properties) {
                var content = [];

                if(options.isLeaf) {
                    content.push('<li id="node-' + this.values.element + '-' + options.id +'" class="tree-node tree-node-checkbox">');
                } else {
                    content.push('<li id="node-' + this.values.element + '-' + options.id +'" class="tree-node">');
                }
                content.push('<div class="clearfix node-container">');
                if(options.isLeaf) {
                    content.push('<div class="node-left"><img src="' + options.image + '" class="node-select img-30"/></div>');
                } else {
                    content.push('<div class="node-left"><img src="' + options.image + '" class="tree-toggle img-25"/></div>');
                }

                if(options.hasInformation) {
                    content.push('<div class="node-right tree-info"><img src="content/images/info.svg" class="img-16" /></div>');
                }

                if(options.i18n) {
                    content.push('<div class="tree-text" data-i18n-id="' + options.i18n + '">' + options.caption + '</div>');
                } else {
                    content.push('<div class="tree-text">' + options.caption + '</div>');
                }

                content.push('</div></li>');

                var elem = $(content.join(''));
                elem.data(properties);

                parentTreeNode.children.push({
                    id : options.id,
                    element :elem,
                    children: [],
                    caption : options.caption
                });

                return elem;
            };

            this.values.renderTreeNodeElements = function(parentTreeNodeId) {
                var parentTreeNode = this.values.getTreeNodeById(parentTreeNodeId) || this.values.rootTreeNode;
                var parentTreeNodeElement = parentTreeNode.element || $('#' + this.values.contentElement);

                var node = this.values.ckan.getNodeById(parentTreeNodeId);

                if(!node) {
                    $(parentTreeNodeElement).html('');
                } else {
                    var children = $('<ul class="tree-node" style="display: none;"></ul>');
                    $(parentTreeNodeElement).append(children);

                    parentTreeNodeElement = children;
                }

				var nodes = this.values.ckan.getNodeChidlren(parentTreeNodeId);
				nodes.sort(sortByProperty('index'));

				for(var i = 0; i < nodes.length; i++) {
                    if(!this.values.ckan.isNodeEmpty(nodes[i].id)) {
                        var properties = {
                            id: nodes[i].id,
                            expanded: false,
                            loaded: false,
                            type: 'node',
                            parent: nodes[i].parent
                        };

                        var options = {
                            id: nodes[i].id,
                            image: 'content/images/show.svg',
                            isLeaf: false,
                            caption: PublicaMundi.i18n.getResource('node.' + nodes[i].id, nodes[i].caption[PublicaMundi.i18n.getLocale()]),
                            hasInformation: false,
                            i18n: 'node.' + nodes[i].id
                        };

                        var elem = this.values.createTreeNodeElement.call(this, parentTreeNode, options, properties);
                        $(parentTreeNodeElement).append(elem);
                    }
				}

                if((node) && (node.resources.length > 0)) {
                    var resources = [];
                    for(var i = 0; i < node.resources.length; i++) {
                        resources.push(this.values.ckan.getResourceById(node.resources[i]));
                    }
                    resources.sort(sortByProperty('node_index'));

                    for(var i = 0; i < resources.length; i++) {
                        var resource = resources[i];
                        var _package = this.values.ckan.getPackageById(resource.package);

                        this.values.resources.setCatalogResourceMetadataOptions(resource);

                        if(!!resource.metadata.extras.layer) {
                            var layerId = resource.id + '_' + resource.metadata.extras.layer;
                            var selected = this.values.resources.isLayerSelected(layerId);

                            var properties = {
                                id: layerId.replace(/[^\w\s]/gi, ''),
                                expanded: false,
                                loaded: false,
                                type: 'layer',
                                layer: layerId,
                                selected: selected,
                                info: {
                                    type: 'package',
                                    id: _package.id
                                }
                            };

                            var options = {
                                id: layerId.replace(/[^\w\s]/gi, ''),
                                image: (selected ? 'content/images/checkbox-checked.svg' : 'content/images/checkbox-empty.svg'),
                                isLeaf: true,
                                caption: resource.name[PublicaMundi.i18n.getLocale()],
                                hasInformation: (_package.resources.length === 1),
                                i18n: 'node.resource.' + resource.id
                            };
                        } else {
                            var properties = {
                                id: resource.id,
                                expanded: false,
                                loaded: false,
                                type: 'resource',
                                info: {
                                    type: 'package',
                                    id: _package.id
                                }
                            };

                            var options = {
                                id: resource.id,
                                image: 'content/images/show.svg',
                                isLeaf: false,
                                caption: resource.name[PublicaMundi.i18n.getLocale()],
                                hasInformation: (_package.resources.length === 1),
                                i18n: 'node.resource.' + resource.id
                            };
                        }

                        var elem = this.values.createTreeNodeElement.call(this, parentTreeNode, options, properties);
                        $(parentTreeNodeElement).append(elem);
                    }
                }
            };

			this.values.renderGroups = function() {
				$('#' + this.values.contentElement).html('');

				var all_groups = this.values.ckan.getGroups();
                var groups = [];

                if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    var packages = this.values.ckan.getFilteredPackages();

                    for(var i=0; i < all_groups.length; i++) {
                        for(var j=0; j < packages.length; j++) {
                            if($.inArray(all_groups[i].id, packages[j].groups) !== -1) {
                                groups.push(all_groups[i]);
                                break;
                            }
                        }
                    }
                } else {
                    groups = all_groups;
                }

				groups.sort(sortByProperty('caption', PublicaMundi.i18n.getLocale()));

                if((this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) && (groups.length === 0)) {
                    $('#' + this.values.element + '-result').hide();
                } else {
                    $('#' + this.values.element + '-result').show();
                }

				for(var i = 0; i < groups.length; i++) {
                    if((!preload) || (!this.values.ckan.isGroupEmpty(groups[i].id))) {
                        var properties = {
                            id: groups[i].id,
                            expanded: false,
                            loaded: false,
                            type: 'group',
                            info: {
                                type: 'group',
                                id: groups[i].id
                            }
                        };

                        var options = {
                            id: groups[i].id,
                            image: 'content/images/show.svg',
                            isLeaf: false,
                            caption: PublicaMundi.i18n.getResource('group.' + groups[i].id, groups[i].caption[PublicaMundi.i18n.getLocale()]),
                            hasInformation: (groups[i].info) ||
                                            ((groups[i].description) && (groups[i].caption[PublicaMundi.i18n.getLocale()] != groups[i].description[PublicaMundi.i18n.getLocale()])),
                            i18n: 'group.' + groups[i].id
                        };


                        var elem = this.values.createTreeNodeElement.call(this, this.values.rootTreeNode, options, properties);
                        $('#' + this.values.contentElement).append(elem);
                    }
				}
			};

			this.values.renderOrganizations = function() {
				$('#' + this.values.contentElement).html('');

				var all_organizations = this.values.ckan.getOrganizations();
                var organizations = [];

                if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    var packages = this.values.ckan.getFilteredPackages();

                    for(var i=0; i < all_organizations.length; i++) {
                        for(var j=0; j < packages.length; j++) {
                            if(all_organizations[i].id === packages[j].organization) {
                                organizations.push(all_organizations[i]);
                                break;
                            }
                        }
                    }
                } else {
                    organizations = all_organizations;
                }

				organizations.sort(sortByProperty('caption', PublicaMundi.i18n.getLocale()));

				for(var i = 0; i < organizations.length; i++) {
                    if((!preload) || (!this.values.ckan.isOrganizationEmpty(organizations[i].id))) {
                        var properties = {
                            id: organizations[i].id,
                            expanded: false,
                            loaded: false,
                            type: 'organization',
                            info: {
                                type: 'organization',
                                id: organizations[i].id
                            }
                        };

                        var options = {
                            id: organizations[i].id,
                            image: 'content/images/show.svg',
                            isLeaf: false,
                            caption: PublicaMundi.i18n.getResource('organization.' + organizations[i].id, organizations[i].caption[PublicaMundi.i18n.getLocale()]),
                            hasInformation: (organizations[i].info) ||
                                            ((organizations[i].description) && (organizations[i].caption[PublicaMundi.i18n.getLocale()] != organizations[i].description[PublicaMundi.i18n.getLocale()])),
                            i18n: 'organization.' + organizations[i].id
                        };


                        var elem = this.values.createTreeNodeElement.call(this, this.values.rootTreeNode, options, properties);
                        $('#' + this.values.contentElement).append(elem);
                   }
				}
			};

			var renderGroupOrganizations = function(element, group_id) {
                var parentNode = this.values.getTreeNodeById(group_id);

                var parent = $('#node-' + this.values.element + '-' + group_id);

				var organizations = this.values.ckan.getOrganizations(), group_organizations = [], group_packages = [], packages = [];
                if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    packages = this.values.ckan.getFilteredPackages();
                } else {
                    packages = this.values.ckan.getPackages();
                }

				for(var p = 0; p < packages.length; p++) {
					if ($.inArray(group_id, packages[p].groups) !== -1) {
						group_packages.push(packages[p]);

						if (packages[p].organization) {
							var index = this.values.ckan.getIndexOfOrganization(packages[p].organization);

							var exists = false;
							if(index !== -1) {
								for(var o = 0; o < group_organizations.length; o++) {
									if(group_organizations[o].id === packages[p].organization) {
										exists = true;
										break;
									}
								}
								if(!exists) {
									group_organizations.push(organizations[index]);
								}
							}
						}
					}
				}

				group_organizations.sort(sortByProperty('caption', PublicaMundi.i18n.getLocale()));

				if(group_packages.length === 0) {
                    var handler = $(parent).find('img.tree-toggle').first();
					$(handler).addClass('disabled');
					$(handler).attr('src', 'content/images/empty.svg');
					$(parent).find('.tree-text').first().addClass('tree-text-disabled');
				} else {
					var children = $('<ul class="tree-node" style="display: none;"></ul>');
                    $(parent).append(children);

					for(var i = 0; i < group_organizations.length; i++) {
                        var properties = {
                            id: group_organizations[i].id,
                            expanded: false,
                            loaded: false,
                            type: 'organization',
                            info: {
                                type: 'organization',
                                id: group_organizations[i].id
                            }
                        };

                        var options = {
                            id: group_organizations[i].id,
                            image: 'content/images/show.svg',
                            isLeaf: false,
                            caption: PublicaMundi.i18n.getResource('organization.' + group_organizations[i].id, group_organizations[i].caption[PublicaMundi.i18n.getLocale()]),
                            hasInformation: (group_organizations[i].info) ||
                                            ((group_organizations[i].description) && (group_organizations[i].caption[PublicaMundi.i18n.getLocale()] != group_organizations[i].description[PublicaMundi.i18n.getLocale()])),
                            i18n: 'organization.' + group_organizations[i].id
                        };

                        var elem = this.values.createTreeNodeElement.call(this, parentNode, options, properties);
                        $(children).append(elem);
					}
				}
			}

			var renderOrganizationPackages = function(element, organization_id) {
                var parent = $('#node-' + this.values.element + '-' + organization_id);
                var parentNode = this.values.getTreeNodeById(organization_id);

				var packages = [], organization_packages = [];
                if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    packages = this.values.ckan.getFilteredPackages();
                } else {
                    packages = this.values.ckan.getPackages();
                }

				for(var p = 0; p < packages.length; p++) {
					if (packages[p].organization === organization_id) {
						organization_packages.push(packages[p]);
					}
				}

				organization_packages.sort(sortByProperty('title', PublicaMundi.i18n.getLocale()));

				if(organization_packages.length === 0) {
					var handler = $(parent).find('img.tree-toggle').first();
					$(handler).addClass('disabled');
					$(handler).attr('src', 'content/images/empty.svg');
					$(parent).find('.tree-text').first().addClass('tree-text-disabled');
				} else {
					var children = $('<ul class="tree-node" style="display: none;"></ul>');
                    $(parent).append(children);

					for(var j = 0; j < organization_packages.length; j++) {
                        if(organization_packages[j].resources.length > 0) {
                            for(var r=0; r < organization_packages[j].resources.length; r++) {
                                this.values.resources.setCatalogResourceMetadataOptions(organization_packages[j].resources[r]);
                            }

                            if((organization_packages[j].resources.length === 1) &&
                               (organization_packages[j].resources[0].metadata) &&
                               (!!organization_packages[j].resources[0].metadata.extras.layer)) {

                                var resourceId = organization_packages[j].resources[0].id ;
                                var layerId = resourceId + '_' + organization_packages[j].resources[0].metadata.extras.layer;
                                var selected = this.values.resources.isLayerSelected(layerId);

                                var properties = {
                                    id: layerId.replace(/[^\w\s]/gi, ''),
                                    expanded: false,
                                    loaded: false,
                                    type: 'layer',
                                    layer: layerId,
                                    selected: selected,
                                    info: {
                                        type: 'package',
                                        id: organization_packages[j].id
                                    }
                                };

                                var options = {
                                    id: layerId.replace(/[^\w\s]/gi, ''),
                                    image: (selected ? 'content/images/checkbox-checked.svg' : 'content/images/checkbox-empty.svg'),
                                    isLeaf: true,
                                    caption: organization_packages[j].resources[0].name[PublicaMundi.i18n.getLocale()],
                                    hasInformation: (organization_packages[j].info) || (!!(organization_packages[j].notes)),
                                    i18n: 'node.resource.' + resourceId
                                };

                                var elem = this.values.createTreeNodeElement.call(this, parentNode, options, properties);
                                $(children).append(elem);
                            } else if(organization_packages[j].resources.length === 1) {
                                var resourceId = organization_packages[j].resources[0].id ;

                                var properties = {
                                    id: resourceId,
                                    expanded: false,
                                    loaded: false,
                                    type: 'resource',
                                    info: {
                                        type: 'package',
                                        id: organization_packages[j].id
                                    }
                                };

                                var options = {
                                    id: resourceId,
                                    image: 'content/images/show.svg',
                                    isLeaf: false,
                                    caption: organization_packages[j].resources[0].name[PublicaMundi.i18n.getLocale()],
                                    hasInformation: (organization_packages[j].info) || (!!(organization_packages[j].notes)),
                                    i18n: 'node.resource.' + resourceId
                                };

                                var elem = this.values.createTreeNodeElement.call(this, parentNode, options, properties);
                                $(children).append(elem);
                            } else {
                                var properties = {
                                    id: organization_packages[j].id,
                                    expanded: false,
                                    loaded: false,
                                    type: 'package',
                                    info: {
                                        type: 'package',
                                        id: organization_packages[j].id
                                    }
                                };

                                var options = {
                                    id: organization_packages[j].id,
                                    image: 'content/images/show.svg',
                                    isLeaf: false,
                                    caption: organization_packages[j].title[PublicaMundi.i18n.getLocale()],
                                    hasInformation: (organization_packages[j].info) || (!!(organization_packages[j].notes))
                                };

                                var elem = this.values.createTreeNodeElement.call(this, parentNode, options, properties);
                                $(children).append(elem);
                            }
                        }
                    }
				}

                self.setFilter(self.getFilter(), 0);
            }

            var renderOrganizationResources = function(element, organization_id) {
                var parent = $('#node-' + this.values.element + '-' + organization_id);
                var parentNode = this.values.getTreeNodeById(organization_id);

				var packages = [];

                if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    packages = this.values.ckan.getFilteredPackages();
                } else {
                    packages = this.values.ckan.getPackages();
                }

                var total_resources = 0;

				var children = $('<ul class="tree-node" style="display: none;"></ul>');
                $(parent).append(children);

				for(var p = 0; p < packages.length; p++) {
					if (packages[p].organization === organization_id) {
                        var resources = packages[p].resources;

                        resources.sort(sortByProperty('node_index'));

                        for(var r = 0; r < resources.length; r++) {
                            total_resources++;

                            this.values.resources.setCatalogResourceMetadataOptions(resources[r]);

                            if((resources[r].metadata) &&
                               (!!resources[r].metadata.extras.layer)) {

                                var resourceId = resources[r].id ;
                                var layerId = resourceId + '_' + resources[r].metadata.extras.layer;
                                var selected = this.values.resources.isLayerSelected(layerId);

                                var properties = {
                                    id: layerId.replace(/[^\w\s]/gi, ''),
                                    expanded: false,
                                    loaded: false,
                                    type: 'layer',
                                    layer: layerId,
                                    selected: selected,
                                    info: {
                                        type: 'package',
                                        id: packages[p].id
                                    }
                                };

                                var options = {
                                    id: layerId.replace(/[^\w\s]/gi, ''),
                                    image: (selected ? 'content/images/checkbox-checked.svg' : 'content/images/checkbox-empty.svg'),
                                    isLeaf: true,
                                    caption: resources[r].name[PublicaMundi.i18n.getLocale()],
                                    hasInformation: ((!!(packages[p].info)) && (packages[p].resources.length == 1)),
                                    i18n: 'node.resource.' + resourceId
                                };

                                var elem = this.values.createTreeNodeElement.call(this, parentNode, options, properties);
                                $(children).append(elem);
                            } else {
                                var resourceId = resources[r].id ;

                                var properties = {
                                    id: resourceId,
                                    expanded: false,
                                    loaded: false,
                                    type: 'resource',
                                    info: {
                                        type: 'package',
                                        id: packages[p].id
                                    }
                                };

                                var options = {
                                    id: resourceId,
                                    image: 'content/images/show.svg',
                                    isLeaf: false,
                                    caption: resources[r].name[PublicaMundi.i18n.getLocale()],
                                    hasInformation: ((!!(packages[p].info)) && (packages[p].resources.length == 1)),
                                    i18n: 'node.resource.' + resourceId
                                };

                                var elem = this.values.createTreeNodeElement.call(this, parentNode, options, properties);
                                $(children).append(elem);
                            }
                        }
					}
				}

                if(total_resources === 0) {
					var handler = $(parent).find('img.tree-toggle').first();
					$(handler).addClass('disabled');
					$(handler).attr('src', 'content/images/empty.svg');
					$(parent).find('.tree-text').first().addClass('tree-text-disabled');
				}

                self.setFilter(self.getFilter(), 0);
            }

			var renderPackageResources = function(element, package_id) {
                var parent = $('#node-' + this.values.element + '-' + package_id);
                var parentNode = this.values.getTreeNodeById(package_id);

				var _package = this.values.ckan.getPackageById(package_id);

				_package.resources.sort(sortByProperty('name', PublicaMundi.i18n.getLocale()));

                var children = $('<ul class="tree-node" style="display: none;"></ul>');
                $(parent).append(children);

				for(var i = 0; i < _package.resources.length; i++) {
					var resource = _package.resources[i];

					if(!!resource.metadata.extras.layer) {
                        var layerId = resource.id + '_' + resource.metadata.extras.layer;
						var selected = this.values.resources.isLayerSelected(layerId);

                        var properties = {
                            id: layerId.replace(/[^\w\s]/gi, ''),
                            expanded: false,
                            loaded: false,
                            type: 'layer',
                            layer: layerId,
                            selected: selected
                        };

                        var options = {
                            id: layerId.replace(/[^\w\s]/gi, ''),
                            image: (selected ? 'content/images/checkbox-checked.svg' : 'content/images/checkbox-empty.svg'),
                            isLeaf: true,
                            caption: resource.name[PublicaMundi.i18n.getLocale()],
                            hasInformation: false,
                            i18n: 'node.resource.' + resource.id
                        };
					} else {
                        var properties = {
                            id: resource.id,
                            expanded: false,
                            loaded: false,
                            type: 'resource'
                        };

                        var options = {
                            id: resource.id,
                            image: 'content/images/show.svg',
                            isLeaf: false,
                            caption: resource.name[PublicaMundi.i18n.getLocale()],
                            hasInformation: false,
                            i18n: 'node.resource.' + resource.id
                        };
					}
                    var elem = this.values.createTreeNodeElement.call(this, parentNode, options, properties);
                    $(children).append(elem);
				}
			}

			var renderResourceLayers = function(element, resource_id, layers) {
                var parent = $('#node-' + this.values.element + '-' + resource_id);
                var parentNode = this.values.getTreeNodeById(resource_id);

				var resource = this.values.ckan.getResourceById(resource_id);

                var children = $('<ul class="tree-node" style="display: none;"></ul>');
                $(parent).append(children);

                layers.sort(sortByProperty('title'));

				for(var i = 0; i < layers.length; i++) {
                    // Layer Id should be unique
					var layerId = resource_id + '_' + layers[i].name;
                    var selected = this.values.resources.isLayerSelected(layerId);

                    var properties = {
                        id: layerId.replace(/[^\w\s]/gi, ''),
                        expanded: false,
                        loaded: false,
                        type: 'layer',
                        layer: layerId,
                        selected: selected
                    };

                    var options = {
                        id: layerId.replace(/[^\w\s]/gi, ''),
                        image: (selected ? 'content/images/checkbox-checked.svg' : 'content/images/checkbox-empty.svg'),
                        isLeaf: true,
                        caption: layers[i].title,
                        hasInformation: false
                    };

                    var elem = this.values.createTreeNodeElement.call(this, parentNode, options, properties);
                    $(children).append(elem);
				}

                self.setFilter(self.getFilter(), 0);
			}

            $('#' + this.values.element).on('click.' + this.values.contentElement, '.tree-text', function() {
                var handler = $(this).parent().find('.tree-toggle');
                if(handler.size() > 0) {
                    handler.click();
                } else {
                    handler = $(this).parent().find('.node-select');
                    if(handler.size() > 0) {
                        handler.click();
                    }
                }
            });

			$('#' + this.values.element).on('click.' + this.values.contentElement, '.tree-toggle', function() {
				var element = this;
                var parent = $(this).closest('li');

                var properties = $(parent).data();

				var id = properties.id;
				var type = properties.type;

				if($(parent).hasClass('disabled')) {
					return;
				}

				if(properties.expanded) {
					properties.expanded = false;
					$(this).removeClass('tree-node-collapse');
					$(parent).find('ul').first().fadeOut(250);
				} else if(!properties.loading) {
					if(properties.loaded) {
						properties.expanded = true;
						$(this).removeClass('tree-node-collapse');
						$(parent).find('ul').first().fadeIn(250);
					} else {
                        if(type === 'node') {
                            self.values.renderTreeNodeElements.call(self, id);
                            properties.loaded = true;
                            properties.expanded = true;
                            $(element).addClass('tree-node-collapse');
                            $(parent).find('ul').first().fadeIn(250);
                        } else if(type === 'group') {
							self.values.ckan.loadGroupById(id).then(function(group) {
								renderGroupOrganizations.call(self, parent, id);
								properties.loaded = true;
								properties.expanded = true;
								$(element).addClass('tree-node-collapse');
								$(parent).find('ul').first().fadeIn(250);
							});
						} else if (type === 'organization') {
							self.values.ckan.loadOrganizationById(id).then(function(organization) {
                                if(self.values.ckan.getNodeCount() > 0) {
                                    renderOrganizationResources.call(self, parent, id);
                                } else {
                                    renderOrganizationPackages.call(self, parent, id);
                                }
								properties.loaded = true;
								properties.expanded = true;
								$(element).addClass('tree-node-collapse');
								$(parent).find('ul').first().fadeIn(250);
							});
						} else if (type === 'package') {
								renderPackageResources.call(self, parent, id);
								properties.loaded = true;
								properties.expanded = true;
								$(element).addClass('tree-node-collapse');
								$(parent).find('ul').first().fadeIn(250);
						} else if (type === 'resource') {
                            var resource = self.values.ckan.getResourceById(properties.id);

                            $(this).attr('src', 'content/images/ajax-loader.gif');
                            $(this).addClass('tree-node-ajax-loader');
                            properties.loading = true;

                            self.values.resources.setCatalogResourceMetadataOptions(resource);

                            self.values.resources.getResourceMetadata(resource.metadata.type, resource.metadata.parameters).then(function(metadata) {
                                $(element).attr('src', 'content/images/show.svg');
                                $(element).removeClass('tree-node-ajax-loader');

                                renderResourceLayers.call(self, parent, id, metadata.layers);

                                properties.loaded = true;
                                properties.expanded = true;
                                properties.loading = false;
                                $(element).addClass('tree-node-collapse');
                                $(parent).find('ul').first().fadeIn(250);
                            });
						}
					}
				}

                self.setFilter(self.getFilter(), 0);
            });

			$('#' + this.values.element).on('click.' + this.values.contentElement, '.node-select', function() {
                var parent = $(this).closest('li');
				var properties = $(parent).data();

				if(properties.selected) {
					self.remove(properties.layer);
				} else {
					self.add(properties.layer);
				}
			});

            $('#' + this.values.element).on('click.' + this.values.contentElement, '.tree-info', function() {
                var parent = $(this).closest('li');
                var properties = $(parent).data();

                if(properties.info) {
                    self.trigger(
                        'catalog:info-loading',
                        {
                            sender: self,
                            type : properties.info.type,
                            id: properties.info.id,
                            title: self.values.ckan.getObjectTitle(properties.info.type, properties.info.id)
                        }
                    );

                    self.values.ckan.getObjectDescription(properties.info.type, properties.info.id).then(function(data) {
                        self.trigger('catalog:info-loaded', { sender: self, type : properties.info.type, id: properties.info.id, data : data });
                    });
                }
            });

            if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                $('#' + this.values.element).on('click.' + this.values.element, '#' + this.values.element + '-box-draw-btn', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    self.values.bbox.interaction.setActive(true);

                    $('#' + self.values.element  +'-search').hide();
                    $('#' + self.values.element  +'-box-draw').hide();
                    $('#' + self.values.element  +'-box-remove').hide();
                    $('#' + self.values.element  +'-box-apply').show();
                    $('#' + self.values.element  +'-box-cancel').show();

                    self.trigger('bbox:draw', {});

                    return false;
                });

                $('#' + this.values.element).on('click.' + this.values.element, '#' + this.values.element + '-box-remove-btn', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    self.values.bbox.overlay.getFeatures().clear();
                    self.values.bbox.feature = null;

                    $('#' + self.values.element  +'-box-remove').hide();
                    $('#' + self.values.element  +'-box-draw').show();
                    $('#' + self.values.element  +'-search').show();

                    self.setQueryBoundingBox(null);

                    self.trigger('bbox:remove', {});

                    return false;
                });

                $('#' + this.values.element).on('click.' + this.values.element, '#' + this.values.element + '-box-apply-btn', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    self.setQueryBoundingBox(self.values.bbox.overlay.getFeatures().item(0));

                    self.values.bbox.interaction.setActive(false);

                    $('#' + self.values.element  +'-box-apply').hide();
                    $('#' + self.values.element  +'-box-cancel').hide();
                    $('#' + self.values.element  +'-box-draw').show();
                    $('#' + self.values.element  +'-box-remove').show();
                    $('#' + self.values.element  +'-search').show();

                    self.trigger('bbox:apply', {});

                    return false;
                });

                $('#' + this.values.element).on('click.' + this.values.element, '#' + this.values.element + '-box-cancel-btn', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    self.values.bbox.overlay.getFeatures().clear();

                    self.values.bbox.interaction.setActive(false);

                    var feature = self.getQueryBoundingBox();

                    if(feature) {
                        self.values.bbox.overlay.addFeature(feature);
                        self.values.bbox.feature = feature;
                    } else {
                        self.values.bbox.feature = null;
                    }

                    $('#' + self.values.element  +'-box-apply').hide();
                    $('#' + self.values.element  +'-box-cancel').hide();
                    $('#' + self.values.element  +'-box-draw').show();
                    if(self.values.bbox.feature) {
                        $('#' + self.values.element  +'-box-remove').show();
                    } else {
                        $('#' + self.values.element  +'-box-remove').hide();
                    }
                    $('#' + self.values.element  +'-search').show();

                    self.trigger('bbox:cancel', {});

                    return false;
                });

                $('#' + this.values.element).on('click.' + this.values.element, '#' + this.values.element + '-search-btn', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    var bbox = null;
                    if(self.values.bbox.feature) {
                        var geom = self.values.bbox.feature.getGeometry().clone();

                        geom.transform('EPSG:3857', 'EPSG:4326');

                        bbox = geom.getExtent();
                    }
                    var text = $('#' + self.values.element + '-text').val();

                    if((!bbox) && (!text)) {
                        var content = [];
                        content.push('<div class="clearfix message-warning" data-i18n-id="control.tree.search.no-criteria">');
                        content.push(PublicaMundi.i18n.getResource('control.tree.search.no-criteria'));
                        content.push('</div>');
                        $('#' + self.values.element + '-result').html(content.join(''));
                    } else {
                        $('#' + self.values.element + '-result').html('');

                        self.values.ckan.search(text, bbox).then(function(packages){
                            self.refresh();
                            self.trigger('catalog:search', { packages : packages });
                        });
                    }

                    return false;
                });

                $('#' + this.values.element).on('keydown.' + this.values.element, '#' + this.values.element + '-text', function(e) {
                    if(e.keyCode == 13) {
                        e.preventDefault();
                        e.stopPropagation();

                        $('#' + self.values.element + '-search-btn').trigger('click');
                    }
                });
            }

			this.refresh();
        },
        setQueryBoundingBox: function(bbox) {
            if(bbox) {
                this.values.bbox.feature = bbox;
            } else {
                this.values.bbox.feature = null;
                $('#' + this.values.element  +'-box-remove').hide();
            }
        },
        getQueryBoundingBox: function() {
            return this.values.bbox.feature;
        },
        add: function(id, fireEvents) {
			var self = this;
			var parts = id.split('_');

            var normalizedSelector = '#node-' + this.values.element + '-' + id.replace(/[^\w\s]/gi, '');
            var parent = $(normalizedSelector);
            if($(parent).size() === 0){
                return;
            }
            var properties = $(parent).data();
            var handler = $(parent).find('img.node-select').first();

			if((parts.length > 1) && (!properties.loading)) {
                var resource = self.values.ckan.getResourceById(parts[0]);

				if((this.values.resources.isLayerSelected(id)) || (this.values.resources.getLayerCount() < this.values.resources.getMaxLayerCount())) {
					properties.loading = true;
					$(handler).attr('src', 'content/images/ajax-loader.gif').addClass('tree-node-ajax-loader');

					this.values.resources.setCatalogResourceMetadataOptions(resource);

					this.values.resources.getResourceMetadata(resource.metadata.type, resource.metadata.parameters).then(function(metadata) {
						properties.loading = false;
                        properties.selected = true;

						$(handler).removeClass('tree-node-ajax-loader').attr('src', 'content/images/checkbox-checked.svg');

                        if(!self.values.resources.isLayerSelected(id)) {
                            var title = $(parent).find('div.tree-text').html() || '';
                            self.values.resources.createLayer(self.values.map, metadata, id, title);
                        }

                        if(fireEvents!==false) {
                            self.trigger('layer:added', {sender: self, id: id});
                        }
					});
				}
			}
		},
		remove: function(id, fireEvents) {
			var parts = id.split('_'), properties, handler;

            var normalizedSelector = '#node-' + this.values.element + '-' + id.replace(/[^\w\s]/gi, '');
            var parent = $(normalizedSelector);
            var nodeInTree = ($(parent).size() > 0);

            if(nodeInTree) {
                properties = $(parent).data();
                handler = $(parent).find('img.node-select').first();
            }

			if(parts.length > 1) {
				if(properties) {
					if((properties.loading) || (!properties.selected)) {
						return;
					}

					properties.selected = false;
					$(handler).attr('src', 'content/images/checkbox-empty.svg');
				}
				if(this.values.resources.destroyLayer(this.values.map, id)) {
                    if(fireEvents!==false) {
                        this.trigger('layer:removed', {sender: this, id: id});
                    }
				}
			}
		},
        render: function() {
            var self = this;

            this.values.rootTreeNode = {
                id: null,
                children: []
            };

            var content = [];

            if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                if($('#' + this.values.element + '-result').size() === 1) {
                    $('#' + this.values.element + '-result').html('');
                } else {
                    $('#' + this.values.element).html('');

                    content.push('<div id="' + this.values.element + '-form" class="clearfix layer-tree-search-form">');
                    content.push('<form class="form-horizontal">');

                    content.push('<div class="form-group">');
                    content.push('<div style="float: left; padding-left: 15px; width: 19em;">');
                    content.push('<input id="' + this.values.element + '-text" placeholder="' + PublicaMundi.i18n.getResource('control.tree.search.prompt') +
                                 '" data-i18n-id="control.tree.search.prompt" data-i18n-type="attribute" data-i18n-name="placeholder" class="form-control input-md" type="text">');
                    content.push('</div>');
                    content.push('</div>');


                    content.push('<div class="clearfix">');
                    content.push('<div style="float: left; padding-right: 10px;"  id="' + this.values.element + '-box-draw">');
                    content.push('<a id="' + this.values.element + '-box-draw-btn" class="btn btn-primary" data-placement="bottom" data-i18n-id="control.tree.search.button.draw" ' +
                                 'data-i18n-type="title" title="' + PublicaMundi.i18n.getResource('control.tree.search.button.draw') + '"><img src="content/images/draw-square-w.svg" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div style="float: left; padding-right: 10px; display: none;" id="' + this.values.element + '-box-remove">');
                    content.push('<a id="' + this.values.element + '-box-remove-btn" class="btn btn-danger" data-placement="bottom" data-i18n-id="control.tree.search.button.remove" data-i18n-type="title" title="' + PublicaMundi.i18n.getResource('control.tree.search.button.remove') + '"><img src="content/images/reject-w.svg" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div style="float: left; padding-right: 10px; display: none;" id="' + this.values.element + '-box-apply">');
                    content.push('<a id="' + this.values.element + '-box-apply-btn" class="btn btn-success" data-placement="bottom" data-i18n-id="control.tree.search.button.apply" data-i18n-type="title" title="' + PublicaMundi.i18n.getResource('control.tree.search.button.apply') + '"><img src="content/images/accept-w.svg" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div style="float: left; padding-right: 10px; display: none;" id="' + this.values.element + '-box-cancel">');
                    content.push('<a id="' + this.values.element + '-box-cancel-btn" class="btn btn-danger" data-placement="bottom" data-i18n-id="control.tree.search.button.discard" data-i18n-type="title" title="' + PublicaMundi.i18n.getResource('control.tree.search.button.discard') + '"><img src="content/images/reject-w.svg" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div style="float: left; padding-right: 10px;" id="' + this.values.element + '-search">');
                    content.push('<a id="' + this.values.element + '-search-btn" class="btn btn-primary" data-placement="bottom" data-i18n-id="control.tree.search.button.search" data-i18n-type="title" title="' + PublicaMundi.i18n.getResource('control.tree.search.button.search') + '"><img src="content/images/search-w.svg" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('</div>');

                    content.push('</form>');
                    content.push('</div>');

                    content.push('<div id="' + this.values.element + '-result-container" class="clearfix layer-tree-search-result-container">');
                    content.push('<div id="' + this.values.element + '-result" class="clearfix layer-tree-search-result">');
                    content.push('</div>');
                    content.push('</div>');

                    $('#' + this.values.element).html(content.join(''));
                    $('#' + this.values.element).find('a').tooltip();
                }
            } else {
                $('#' + this.values.element).html('');

                content.push('<div style="overflow-y: auto;" id="' + this.values.element + '-result-container"><div class="clearfix" id="' + this.values.element + '-result" style="padding: 0px 2px 0px 0px;">');
                content.push('</div></div>');

                $('#' + this.values.element).html(content.join(''));
            }

			if (this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByGroup) {
                if(this.values.ckan.getNodeCount() > 0) {
                    this.values.renderTreeNodeElements.call(this);
                } else {
                    this.values.renderGroups.call(this);
                }
			} else if (this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByOrganization) {
				this.values.renderOrganizations.call(this);
			} else {
                this.values.renderOrganizations.call(this);
            }
        },
        show: function() {
            PublicaMundi.Maps.Component.prototype.show.apply(this);
            if (this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                $('#' + this.values.element + '-text').focus();
            }
        },
        getFilter: function() {
            return this.values.filter.term;
        },
        clearFilter: function() {
            $('li.tree-node').removeClass('node-filtered');
            this.values.filter = {
                term: null
            };
        },
        setFilter: function(term, timeout) {
            var self =  this;

            if(this.values.timeout) {
                clearTimeout(this.values.timeout);
                this.values.timeout = null;
            }

            if(timeout !== 0) {
                timeout = timeout || 500;
            }

            var locale = PublicaMundi.i18n.getLocale();
            var doFiltering = function() {
                if(term) {
                    self.values.filter.term = term;

                    var filterTreeNodes = function(treeNode, term, locale) {
                        var properties = $(treeNode.element).data();
                        var isFiltered = true;

                        for(var i=0; i < treeNode.children.length; i++) {
                            isFiltered = filterTreeNodes(treeNode.children[i], term, locale) && isFiltered;
                        }

                        switch(properties.type) {
                            case 'organization':
                                if((treeNode.children.length > 0 && !isFiltered) ||
                                   ((treeNode.children.length == 0) && !self.values.ckan.filterOrganization(treeNode.id, term, locale))) {
                                    $(treeNode.element).removeClass('node-filtered');
                                    return false;
                                } else {
                                    $(treeNode.element).addClass('node-filtered');
                                    return true;
                                }
                                break;
                            case 'node':
                                if((treeNode.children.length > 0 && !isFiltered) ||
                                   ((treeNode.children.length == 0) && !self.values.ckan.filterNode(treeNode.id, term, locale))) {
                                    $(treeNode.element).removeClass('node-filtered');
                                    return false;
                                } else {
                                    $(treeNode.element).addClass('node-filtered');
                                    return true;
                                }
                                break;
                            default:
                                if(((treeNode.children.length >= 0) && !isFiltered) ||
                                   ((treeNode.children.length == 0) && (treeNode.caption.indexOf(term) > -1))) {
                                    $(treeNode.element).removeClass('node-filtered');
                                    return false;
                                } else {
                                    $(treeNode.element).addClass('node-filtered');
                                    return true;
                                }
                                break;
                        }
                    };

                    for(var i=0; i < self.values.rootTreeNode.children.length; i++) {
                        filterTreeNodes(self.values.rootTreeNode.children[i], term, locale);
                    }
                } else {
                    self.clearFilter();
                }
            };

            if(timeout > 0) {
                this.values.timeout = setTimeout(doFiltering, timeout);
            } else {
                doFiltering();
            }
        },
        localizeUI: function(locale) {
            switch(this.values.mode) {
                case PublicaMundi.Maps.LayerTreeViewMode.ByGroup:
                    break;
                case PublicaMundi.Maps.LayerTreeViewMode.ByOrganization:
                    break;
                case PublicaMundi.Maps.LayerTreeViewMode.ByFilter:
                    break;
            }
        }
    });

    var _LayerSelectionAddItem = function(id, title, legend) {
		var self = this;
        var layer = this.values.resources.getLayerById(id);

        if(!layer){
            return;
        }

        if(title.hasOwnProperty([PublicaMundi.i18n.getLocale()])) {
            title = title[PublicaMundi.i18n.getLocale()];
        } else if(title.hasOwnProperty('el')) {
            title = title['el'];
        }

		var content = [];
		var safeId = id.replace(/[^\w\s]/gi, '');

		content.push('<div data-id="' + id + '" class="clearfix selected-layer">');

		content.push('<div class="legend-container">');
		if(legend) {
			content.push('<img id="' + safeId + '-legend-img" src="' + legend + '" alt=" " class="legend" />');
		} else {
			content.push('&nbsp;');
		}
		content.push('</div>');

		content.push('<div style="margin-left: 25px;">');

		content.push('<div class="clearfix" style="padding-bottom: 3px;">');
		content.push('<div class="selected-layer-close"><img src="content/images/close.svg" class="action img-16" data-action="remove"  /></div>');
		content.push('<div class="selected-layer-up"><img src="content/images/move-up.svg" class="action img-16 action-disabled" data-action="up"  /></div>');
		content.push('<div class="selected-layer-text">' + title + '</div>');
		content.push('</div>');

		content.push('<div class="clearfix">');
		content.push('<div class="selected-layer-opacity-label" data-i18n-id="index.title.layer-opacity" data-i18n-type="title" title="' + PublicaMundi.i18n.getResource('index.title.layer-opacity') + '" ><img src="content/images/opacity.svg" class="img-16" /></div>');
		content.push('<div class="selected-layer-opacity-slider"><input type="range" min="0" max="100" value="' + (layer.getOpacity()*100).toFixed(0) + '"></div>');
		content.push('<div class="selected-layer-down"><img src="content/images/move-down.svg" class="action img-16 action-disabled" data-action="down"  /></div>');
		content.push('</div>');

		content.push('</div>');

		content.push('</div>');

		$('#' + this.values.element).prepend(content.join(''));

		$('#' + safeId + '-legend-img').load(function() {
            var nWidth = $(this).prop('naturalWidth');
            var sWidth = $(this).width();
            var nHeight = $(this).prop('naturalHeight');
            var sHeight = $(this).height();
            var pHeight = $(this).parent().height();

            if ((nWidth > sWidth) || (nHeight > sHeight) || (nHeight > pHeight)) {
                $(this).css('cursor' , 'pointer');
                $(this).on('click', function (e) {
					$('#' +  self.values.element + '-dialog-legend-img').attr('src', $(this).attr('src'));

					self.values.dialog.setTitle(title);
					self.values.dialog.show();
				});
            }
        });

		$('.selected-layer-opacity-label').tooltip();

		this.values.updateActions();

		this.trigger('layer:added', {id: id});
	};

    var resolveLayerTitleFromMetadata = function(_package, _resource, value) {
        if((_package.resources.length === 1) &&
           (_package.resources[0].metadata) &&
           (!!_package.resources[0].metadata.extras.layer)) {
            return _package.title
        } else if(!!_resource.metadata.extras.layer) {
            return _resource.name;
        }

        return value;
    };

    PublicaMundi.Maps.LayerSelection = PublicaMundi.Class(PublicaMundi.Maps.Component, {
        initialize: function (options) {
			var self = this;

			PublicaMundi.extend(this.values, {
				map: null,
				ckan : null,
				resources: null
			});

            if (typeof PublicaMundi.Maps.Component.prototype.initialize === 'function') {
                PublicaMundi.Maps.Component.prototype.initialize.apply(this, arguments);
            }

            this.event('layer:added');
            this.event('layer:removed');
            this.event('layer:up');
            this.event('layer:down');

            this.event('layer:opacity:changed');

            this.values.updateActions = function() {
				var elements = $('#' + self.values.element).find('.selected-layer');

				var total = elements.size();

				elements.each(function(index, element) {
					if(index == 0) {
						$(element).find('[data-action="up"]').addClass('action-disabled');
						if(total == 1) {
							$(element).find('[data-action="down"]').addClass('action-disabled');
						} else {
							$(element).find('[data-action="down"]').removeClass('action-disabled');
						}
					} else if(index == (total-1)) {
						if(total == 1) {
							$(element).find('[data-action="up"]').addClass('action-disabled');
						} else {
							$(element).find('[data-action="up"]').removeClass('action-disabled');
						}
						$(element).find('[data-action="down"]').addClass('action-disabled');
					} else {
						$(element).find('[data-action="up"]').removeClass('action-disabled');
						$(element).find('[data-action="down"]').removeClass('action-disabled');
					}
				});
			}

			$('#' + this.values.element).on('click.' + this.values.element, '.action', function() {
				var parent = $(this).closest('.selected-layer');

				var id = parent.data('id');
				var action =  $(this).data('action');

				switch(action){
					case 'remove':
						self.remove(id);
						break;
					case 'up':
						if(self.values.resources.moveLayerUp(self.values.map, id)) {
							parent.prevAll().first().insertAfter(parent);
							self.values.updateActions();

							self.trigger('layer:up');
						}
						break;
					case 'down':
						if(self.values.resources.moveLayerDown(self.values.map, id)) {
							parent.nextAll().first().insertBefore(parent);
							self.values.updateActions();

							self.trigger('layer:down');
						}
						break;
				}

			});

			$('#' + this.values.element).on('change.' + this.values.element, '[type="range"]', function() {
				var id = $(this).closest('.selected-layer').data('id');

				self.values.resources.setLayerOpacity(id, $(this).val());

				self.trigger('layer:opacity:changed', { id: id, opacity : $(this).val()});
			});

			this.values.dialog = new PublicaMundi.Maps.Dialog({
                title: '',
                element: this.values.element + '-dialog-legend',
                visible: false,
                width: 430,
                height: 400,
                autofit: true,
                buttons: {
                    close : {
                        text: 'button.close',
                        style: 'primary'
                    }
                },
                renderContent: function() {
                    var content = [];

                    content.push('<div class="clearfix" style="max-height: 350px; overflow: auto;">');
					content.push('<img id="' + self.values.element + '-dialog-legend-img" src="" alt="" />');
                    content.push('</div>');
                    return content;
                }
            });

            this.values.dialog.on('dialog:action', function(args){
                    switch(args.action){
                        case 'close':
                            this.hide();
                            break;
                    }
            });
		},
        render: function() {
            $('#' + this.values.element).html('');
		},
		add: function(id, metadata) {
			if(this.values.resources.getLayerCount() > this.values.resources.getMaxLayerCount()) {
				return false;
			}

			var self = this, _resource, _package;

			var parts = id.split('_');
			var layer = parts.splice(1).join('_');

			var _resource = this.values.ckan.getResourceById(parts[0]);

			if(_resource) {
				_package = this.values.ckan.getPackageById(_resource.package);
				this.values.resources.setCatalogResourceMetadataOptions(_resource);

				this.values.resources.getResourceMetadata(_resource.metadata.type, _resource.metadata.parameters).then(function(metadata) {
					var title, legend;

					for(var i=0; i<metadata.layers.length;i++) {
						if(metadata.layers[i].key == layer) {
							title = metadata.layers[i].title;
							legend = metadata.layers[i].legend;
							break;
						}
					}

					_LayerSelectionAddItem.call(self, id, resolveLayerTitleFromMetadata(_package, _resource, title), legend);

                    return true;
				});

				return true;
			} else if(metadata) {
				for(var i=0, count=metadata.layers.length; i<count; i++) {
					if(metadata.layers[i].key == layer) {
						_LayerSelectionAddItem.call(self, id, metadata.layers[i].title, metadata.layers[i].legend);

						return true;
					}
				}
			}

			return false;
		},
		remove: function(id) {
			$('#' + this.values.element).find('[data-id="' + id  +'"]').remove();

			this.values.updateActions();

            if(this.values.resources.getLayerById(id)) {
                this.trigger('layer:removed', { id: id });
            }
		}
	});

    PublicaMundi.Maps.Tool = PublicaMundi.Class(PublicaMundi.Maps.Component, {
        initialize: function (options) {
			var self = this;

			PublicaMundi.extend(this.values, {
                name: null,
				active: false,
                enabled: true,
                images: {
                    enabled: '',
                    diabled: ''
                },
                title: null
			});

            if (typeof PublicaMundi.Maps.Component.prototype.initialize === 'function') {
                PublicaMundi.Maps.Component.prototype.initialize.apply(this, arguments);
            }

            this.values.actions = [];

            this.event('tool:toggle');

            this.render();
        },
        getName: function() {
            return this.values.name
        },
        getActive: function() {
            return (this.values.active && this.values.enabled);
        },
        hasActions: function() {
            return (this.values.actions.length > 0);
        },
        setActive: function(active) {
            this.values.active = active && this.values.enabled;
            if(this.values.element) {
                if(this.values.active) {
                    $('#' + this.values.element).
                        find('a').addClass('tool-toggle-selected').removeClass('btn-default').addClass('btn-primary').
                        find('img').attr('src', this.values.images.enabled);

                    for(var i=0; i< this.values.actions.length; i++) {
                        this.values.actions[i].show();
                    }
                } else {
                    $('#' + this.values.element).
                        find('a').removeClass('tool-toggle-selected').removeClass('btn-primary').addClass('btn-default').
                        find('img').attr('src', this.values.images.disabled);

                    for(var i=0; i< this.values.actions.length; i++) {
                        this.values.actions[i].hide();
                    }
                }
            }
        },
        getEnabled: function() {
            return this.values.enabled;
        },
        setEnabled: function(enabled) {
            this.values.enabled = enabled;
            if(!this.values.enabled) {
                this.setActive(false);
            }
        },
        render: function() {
            var self = this;

            if(this.values.element) {
                var content = [];
                content.push('<a data-action="' + this.values.name + '" class="tool-toggle btn btn-default" data-i18n-id="' + this.values.title + '" data-i18n-type="title" title="' + ( PublicaMundi.i18n.getResource(this.values.title) || '') + '">');
                content.push('<img class="img-20" src="' + (this.values.active ? this.values.images.enabled : this.values.images.disabled ) + '">');
                content.push('</a>');

                $('#' + this.values.element).html(content.join(''));

                $('#' + this.values.element).find('a').tooltip();

                $('#' + this.values.element).find('a').click(function() {
                    self.setActive(!self.values.active);
                    self.trigger('tool:toggle', { sender : self, active : self.getActive() });
                });

                if(!this.values.visible) {
                    $('#' + this.values.element).hide();
                }
            }
        }
    });

    PublicaMundi.Maps.MeasureToolType = {
        Length: 1,
        Area: 2
    };

    PublicaMundi.Maps.MeasureTool = PublicaMundi.Class(PublicaMundi.Maps.Tool, {
        initialize: function (options) {
			var self = this;

            this.values.map = null;
            this.values.overlay = null;
            this.values.interaction = null;

            this.values.type = PublicaMundi.Maps.MeasureToolType.Length

            if (typeof PublicaMundi.Maps.Tool.prototype.initialize === 'function') {
                PublicaMundi.Maps.Tool.prototype.initialize.apply(this, arguments);
            }
            this.values.feature = null;

            this.event('measure:end');

            // Tooltip
            var tooltip;
            var tooltipElement;

            var formatMeasurement = function() {
                if(!self.values.feature) {
                    return null;
                }

                // http://openlayers.org/en/v3.5.0/examples/measure.html
                var wgs84Sphere = new ol.Sphere(6378137);

                var geom = self.values.feature.getGeometry().clone().transform('EPSG:3857', 'EPSG:4326');

                if(self.values.type === PublicaMundi.Maps.MeasureToolType.Length) {
                    var coordinates = geom.getCoordinates();

                    var length = 0;
                    for (var i = 0, ii = coordinates.length - 1; i < ii; ++i) {
                      var c1 = coordinates[i];
                      var c2 = coordinates[i + 1];
                      length += wgs84Sphere.haversineDistance(c1, c2);
                    }

                    var length = Math.round(length * 100) / 100;
                    var output;
                    if (length > 100) {
                        output = (Math.round(length / 1000 * 100) / 100) + ' ' + 'km';
                    } else {
                        output = (Math.round(length * 100) / 100) + ' ' + 'm';
                    }
                    return output;
                } else {
                    var coordinates = geom.getLinearRing(0).getCoordinates();
                    var area = Math.abs(wgs84Sphere.geodesicArea(coordinates));

                    var output;
                    if (area > 10000) {
                        output = (Math.round(area / 1000000 * 100) / 100) + ' ' + 'km<sup>2</sup>';
                    } else {
                        output = (Math.round(area * 100) / 100) + ' ' + 'm<sup>2</sup>';
                    }
                    return output;
                }
            };

            this.values.reset = function() {
                self.values.overlay.getFeatures().clear();

                if (tooltipElement) {
                    tooltipElement.parentNode.removeChild(tooltipElement);
                }
                if(tooltip) {
                    self.values.map.removeOverlay(tooltip);
                }
            }

            var createTooltip = function() {
                self.values.reset();

                tooltipElement = document.createElement('div');
                tooltipElement.className = 'mt-tooltip mt-tooltip-measure';

                tooltip = new ol.Overlay({
                    element: tooltipElement,
                    offset: [0, -15],
                    positioning: 'bottom-center'
                });

                self.values.map.addOverlay(tooltip);
            };

            this.values.handler = function(e) {
                if (e.dragging) {
                    return;
                }
                var tooltipCoord = e.coordinate;

                if (self.values.feature) {
                    var geom = (self.values.feature.getGeometry());
                    var output = formatMeasurement(geom);

                    if(self.values.type === PublicaMundi.Maps.MeasureToolType.Area) {
                        tooltipCoord = geom.getInteriorPoint().getCoordinates();
                    } else {
                        tooltipCoord = geom.getLastCoordinate();
                    }
                    tooltipElement.innerHTML = output;
                    tooltip.setPosition(tooltipCoord);
                }
            };

            // Feature overlay
            this.values.overlay = new ol.FeatureOverlay({
                style: [
                    new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [255, 255, 255, 0.4]
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#7f8c8d',
                            width: 2
                        })
                    })
                ]
            });
            this.values.overlay.setMap(this.values.map);

            // Draw polygon
            var type = (this.values.type === PublicaMundi.Maps.MeasureToolType.Length ? 'LineString' : 'Polygon');

            this.values.interaction = new ol.interaction.Draw({
                features: this.values.overlay.getFeatures(),
                type: type,
                style: [
                    new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [255, 255, 255, 0.4]
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#7f8c8d',
                            lineDash: [10, 10],
                            width: 2
                        })
                    }),
                    new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 6,
                            fill: new ol.style.Fill({
                                color: [255, 255, 255, 0.4]
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#7f8c8d',
                                width: 2
                            })
                        }),
                        zIndex: Infinity
                    })
                ]
            });

            this.values.interaction.on('change:active', function (e) {
                if(this.getActive()) {
                    self.values.overlay.setMap(self.values.map);
                } else {
                    self.values.overlay.setMap(null);
                }
            });

            this.values.interaction.on('drawstart', function (e) {
                createTooltip();
                self.values.feature = e.feature;

                self.values.overlay.getFeatures().clear();
            });

            this.values.interaction.on('drawend', function (e) {
                if(e.feature) {
                    self.values.feature = e.feature;
                } else {
                    self.values.feature = null;
                }

                tooltipElement.className = 'mt-tooltip mt-tooltip-static';
                self.values.feature = null;
                tooltipElement = null;

                self.trigger('measure:end', { feature: e.feature });
            });

            this.values.map.addInteraction(this.values.interaction);
            this.values.interaction.setActive(false);

            this.render();
        },
        setActive: function(active) {
            PublicaMundi.Maps.Tool.prototype.setActive.apply(this, [active]);

            if(this.values.active) {
                if(this.values.interaction) {
                    this.values.interaction.setActive(true);
                    this.values.map.on('pointermove', this.values.handler);
                }
            } else {
                if(this.values.interaction) {
                    this.values.interaction.setActive(false);
                    this.values.map.un('pointermove', this.values.handler);

                    this.values.reset();
                }
            }
        },
        getType: function() {
            return this.values.type;
        },
        getFeature: function() {
            return this.values.feature;
        },
        getMeasurement: function() {
            return this.values.measurement;
        }
    });

    var _ExportActionHandler = function(e) {
        if(this.values.action.isBusy()) {
            return;
        };
        this.values.dialog.show();
        this.values.dialog.moveToCenter();
    };

    var _ExportDialogActionExportHandler = function(e) {
        this.values.dialog.hide();

        if(this.values.action.isBusy()) {
            return;
        };

        var feature = this.getFeature();

        if(feature) {
            var format = new ol.format.GeoJSON();
            var polygon = JSON.parse(format.writeGeometry(feature.getGeometry()));

            var layers = this.values.resources.getSelectedLayers();
            var resources = this.values.resources.getQueryableResources();

            var quyarable = [];
            for(var i=0; i<layers.length; i++) {
                for(var j=0; j<resources.length; j++) {
                    if(layers[i].resource_id == resources[j].wms) {
                        quyarable.push({
                            table: resources[j].table,
                            title: layers[i].title
                        });
                        break;
                    }
                }
            }

            if(quyarable.length > 0) {
                this.values.action.suspendUI();

                var query = this.values.query;
                query.
                    reset().
                    crs($('#' + this.values.element + '-crs').val()).
                    format($('#' + this.values.element + '-format').val());

                var files= [];
                for(var i=0; i<quyarable.length; i++) {
                    files.push(quyarable[i].title);

                    query.resource(quyarable[i].table).
                          contains(
                            polygon, {
                                resource: quyarable[i].table,
                                name : 'the_geom'
                            });
                    if(i < (quyarable.length-1)) {
                        query.queue();
                    }
                }
                query.export({
                    context: this,
                    success: _DownloadExportFile,
                    files: files
                });
            }
        }
    };

    var _DownloadExportFile = function(data, execution) {
        this.values.action.resumeUI();

        if(data.success) {
            jQuery('#export-download-frame').remove();
            jQuery('body').append('<div id="export-download-frame" style="display: none"><iframe src="' + this.values.endpoint + 'api/download/' + data.code + '"></iframe></div>');
        }
    }

    PublicaMundi.Maps.ExportTool = PublicaMundi.Class(PublicaMundi.Maps.Tool, {
        initialize: function (options) {
			var self = this;

            this.values.map = null;
            this.values.disabledFormats = [];

            if (typeof PublicaMundi.Maps.Tool.prototype.initialize === 'function') {
                PublicaMundi.Maps.Tool.prototype.initialize.apply(this, arguments);
            }

            this.event('feature:change');

            this.values.overlay = null;
            this.values.interaction = null;
            this.values.feature = null;

            this.values.crs = PublicaMundi.Maps.CRS.Mercator;

            this.values.query = new PublicaMundi.Data.Query(this.values.endpoint);

            this.values.formats = [{
                value: 'ESRI Shapefile',
                text: 'ESRI Shapefile',
                selected: true
            },{
                value: 'GML',
                text: 'GML'
            },{
                value: 'KML',
                text: 'KML'
            },{
                value: 'GPKG',
                text: 'Geo Package'
            },{
                value: 'DXF',
                text: 'AutoCAD DXF'
            },{
                value: 'CSV',
                text: 'Comma Separated Value'
            },{
                value: 'GeoJSON',
                text: 'GeoJSON'
            },{
                value: 'PDF',
                text: 'Geospatial PDF'
            }];

            // Actions
            if(this.values.action) {
                this.values.actions.push(this.values.action);

                this.values.action.on('action:execute', _ExportActionHandler, this);
            }

            // Dialogs
            this.values.dialog = new PublicaMundi.Maps.Dialog({
                title: 'control.export.dialog.title',
                element: this.values.element + 'dialog',
                visible: false,
                width: 430,
                height: 200,
                autofit: true,
                buttons: {
                    export: {
                        text: 'control.export.dialog.button.export',
                        style: 'primary'
                    },
                    close : {
                        text: 'control.export.dialog.button.cancel',
                        style: 'default'
                    }
                },
                renderContent: function() {
                    var content = [];

                    content.push('<div class="clearfix" style="padding-bottom: 10px;">');
                    content.push('<label for="' + self.values.element + '-crs" style="padding-right: 10px; width: 145px;" data-i18n-id="control.export.dialog.label.crs">' +
                                 PublicaMundi.i18n.getResource('control.export.dialog.label.crs')  + '</label>');
                    content.push('<select name="' + self.values.element + '-crs" id="' + self.values.element + '-crs" class="selectpicker" data-width="160px">');
                    content.push('<option value="EPSG:3857">Web Mercator</option>');
                    content.push('<option value="EPSG:4326">WGS84</option>');
                    content.push('<option value="EPSG:2100" selected="selected">ΕΓΣΑ87</option>');
                    content.push('<option value="EPSG:4258">ETRS89</option>');
                    content.push('</select>');
                    content.push('</div>');

                    content.push('<div class="clearfix">');
                    content.push('<label for="' + self.values.element + '-format" style="padding-right: 10px; width: 145px;" data-i18n-id="control.export.dialog.label.format">' +
                                 PublicaMundi.i18n.getResource('control.export.dialog.label.format') + '</label>');
                    content.push('<select name="' + self.values.element + '-format" id="' + self.values.element + '-format" class="selectpicker" data-width="250px">');

                    for(var i=0, countFormat = self.values.formats.length; i<countFormat; i++) {
                        var format =  self.values.formats[i];

                        if(self.values.disabledFormats.indexOf(format.value) < 0) {
                            if(!!format.selected) {
                                content.push('<option value="' + format.value + '" selected="selected">' + format.text + '</option>');
                            } else {
                                content.push('<option value="' + format.value + '">' + format.text + '</option>');
                            }
                        }
                    }
                    content.push('</select>');
                    content.push('</div>');
                    return content;
                }
            });

            $('#' + this.values.element + '-crs').selectpicker().change(function () {
                $('[data-id="' + self.values.element + '-crs"]').blur();
            });

            $('#' + this.values.element + '-format').selectpicker().change(function () {
                $('[data-id="' + self.values.element + '-format"]').blur();
            });

            this.values.dialog.on('dialog:action', function(args){
                    switch(args.action){
                        case 'close':
                            this.hide();
                            break;
                        case 'export':
                            this.hide()
                            _ExportDialogActionExportHandler.apply(self);
                            break;
                    }
            });

            // Feature overlay
            this.values.overlay = new ol.FeatureOverlay({
                style: [
                    new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [255, 255, 255, 0.4]
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#3399CC',
                            width: 2
                        })
                    })
                ]
            });
            this.values.overlay.setMap(this.values.map);

            // Draw polygon
            this.values.interaction = new ol.interaction.Draw({
                features: this.values.overlay.getFeatures(),
                type: 'Polygon',
                style: [
                    new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [255, 255, 255, 0.4]
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#3399CC',
                            width: 1
                        })
                    }),
                    new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 6,
                            fill: new ol.style.Fill({
                                color: [255, 255, 255, 0.4]
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#3399CC',
                                width: 1
                            })
                        }),
                        zIndex: Infinity
                    })
                ]
            });

            this.values.interaction.on('change:active', function (e) {
                if(this.getActive()) {
                    self.values.overlay.setMap(self.values.map);
                } else {
                    self.values.overlay.setMap(null);
                }
            });

            this.values.interaction.on('drawstart', function (e) {
                self.values.overlay.getFeatures().clear();
                self.values.feature = null;
            });

            this.values.interaction.on('drawend', function (e) {
                if(e.feature) {
                    self.values.feature = e.feature;
                } else {
                    self.values.feature = null;
                }

                self.trigger('feature:change', { feature: e.feature });
            });

            this.values.map.addInteraction(this.values.interaction);
            this.values.interaction.setActive(false);

            this.render();
        },
        setActive: function(active) {
            PublicaMundi.Maps.Tool.prototype.setActive.apply(this, [active]);

            if(this.values.active) {
                if(this.values.interaction) {
                    this.values.interaction.setActive(true);
                }
            } else {
                if(this.values.interaction) {
                    this.values.interaction.setActive(false);
                }
            }
        },
        getFeature: function() {
            return this.values.feature;
        }
    });

    var _SelectToolClickHandler = function(e) {
        if((this.isBusy()) || (!this.getActive())) {
            return;
        }

        var id = 1;

        // Clear selection
        this.clearSelection();

        // Get external features
        var externalFeatures = [];

        this.values.map.forEachFeatureAtPixel(e.pixel,
            function(feature, layer) {
                if((layer) && (layer instanceof ol.layer.Vector)) {
                    feature = feature.clone();
                    feature.id = id;
                    externalFeatures.push(feature);
                    i++;
                }
            },
            this
        );

        // Get queryable resources
        var layers = this.values.resources.getSelectedLayers();
        var resources = this.values.resources.getQueryableResources();
        var templates = [];

        var quyarable = [];
        for(var i=0; i<layers.length; i++) {
            for(var j=0; j<resources.length; j++) {
                if(layers[i].resource_id == resources[j].wms) {
                    quyarable.push({
                        table: resources[j].table,
                        title: layers[i].title
                    });
                    templates.push(resources[j].template);
                    break;
                }
            }
        }

        // Search remote resources
        var point = {
            type: 'Point',
            coordinates: e.coordinate
        };

        if(quyarable.length > 0) {
            this.suspendUI();

            var query = this.values.query;
            query.reset().format(PublicaMundi.Data.Format.GeoJSON)

            for(var i=0; i<quyarable.length; i++) {
                query.resource(quyarable[i].table).
                      distanceLessOrEqual(
                        point,
                        {
                            resource: quyarable[i].table,
                            name : 'the_geom'
                        },
                        this.values.map.getView().getResolution() * this.values.buffer);
                if(i < (quyarable.length-1)) {
                    query.queue();
                }
            }

            query.execute({
                success: function(response) {
                    if(response.success) {
                        var format = new ol.format.GeoJSON();

                        for(var i=0; i< response.data.length; i++) {
                            if(response.data[i].features.length > 0) {
                                // Post process features
                                for(var j=0; j < response.data[i].features.length; j++) {
                                    // Create unique feature Id
                                    response.data[i].features[j].id = id;
                                    id++;
                                    // Set feature template
                                    response.data[i].features[j].properties.__template__ = templates[i];
                                }

                                var features = format.readFeatures(response.data[i], {
                                    dataProjection: PublicaMundi.Maps.CRS.Mercator,
                                    featureProjection: PublicaMundi.Maps.CRS.Mercator
                                });
                                this.values.features.extend(features);
                            }
                        }

                        // Append external features
                        if(externalFeatures.length > 0) {
                            this.values.features.extend(externalFeatures);
                        }

                        this.values.overlay.setFeatures(this.values.features);

                        this.setFeatureFocus(0);

                        this.trigger('selection:changed', { sender : this, features : this.getFeatures() });
                    }
                    this.resumeUI();
                },
                context : this
            });
        } else if(externalFeatures.length > 0) {
            this.values.features.extend(externalFeatures);
            this.values.overlay.setFeatures(this.values.features);

            this.setFeatureFocus(0);

            this.trigger('selection:changed', { sender : this, features : this.getFeatures() });
        }
    };

    PublicaMundi.Maps.SelectTool = PublicaMundi.Class(PublicaMundi.Maps.Tool, {
        initialize: function (options) {
			var self = this;

			PublicaMundi.extend(this.values, {
                map: null,
                resources: null,
                endpoint: null,
                buffer: 3,
                centerOnSelection: false
			});

            if (typeof PublicaMundi.Maps.Tool.prototype.initialize === 'function') {
                PublicaMundi.Maps.Tool.prototype.initialize.apply(this, arguments);
            }
            this.values.element = this.values.name;

            this.event('selection:changed');

            this.values.query = new PublicaMundi.Data.Query(this.values.endpoint);
            this.values.features = new ol.Collection;
            this.values.focus = null;

            if(this.values.buffer < 0) {
                this.values.buffer = 2;
            }
            this.values.tooltip = null;

            // Styles
            this.values.styles = {
                select : [
                    new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [255, 255, 255, 0.4]
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#F39C12',
                            width: 3
                        })
                    }),
                    new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 6,
                            fill: new ol.style.Fill({
                                color: [255, 255, 255, 0.7]
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#F39C12',
                                width: 2
                            })
                        }),
                        zIndex: Infinity
                    })
                ],
                focus : [
                    new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [255, 255, 255, 0.4]
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#C0392B',
                            width: 3
                        })
                    }),
                    new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 6,
                            fill: new ol.style.Fill({
                                color: [255, 255, 255, 0.7]
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#C0392B',
                                width: 2
                            })
                        }),
                        zIndex: Infinity
                    })
                ]
            };

            // Feature overlay
            this.values.overlay = new ol.FeatureOverlay({
                style: this.values.styles.select
            });

            this.render();
        },
        setActive: function(active) {
            PublicaMundi.Maps.Tool.prototype.setActive.apply(this, [active]);

            if(this.values.active) {
                this.values.map.on('click', _SelectToolClickHandler, this);
                this.values.overlay.setMap(this.values.map);
            } else {
                this.values.map.un('click', _SelectToolClickHandler, this);
                this.values.overlay.setMap(null);
                if(this.values.tooltip) {
                    this.values.map.removeOverlay(this.values.tooltip);
                }
                this.values.overlay.getFeatures().clear();
            }
        },
        getFeatures: function() {
            return this.values.features.getArray();
        },
        isBusy: function() {
            return $('#' + this.values.element).hasClass('busy');
        },
        suspendUI: function() {
            if(!$('#' + this.values.element).hasClass('busy')) {
                $('#' + this.values.element).addClass('tool-wapper-action busy').append('<div class="action-executing"><img style="" src="content/images/ajax-loader.gif"></div>');
            }
        },
        resumeUI: function() {
            $('#' + this.values.element).find('.action-executing').remove();
            $('#' + this.values.element).removeClass('tool-wapper-action busy');
        },
        clearFeatureFocus: function() {
            if(this.values.focus) {
                this.values.focus.feature.setStyle(this.values.styles.select);
                this.values.focus = null;
                if(this.values.tooltip) {
                    this.values.map.removeOverlay(this.values.tooltip);
                }
            }
        },
        setFeatureFocus: function(index) {
            var self = this;

            if(this.values.focus) {
                if(this.values.focus.index == index) {
                    return true;
                } else {
                    this.clearFeatureFocus();
                }
            }

            var features = this.getFeatures();
            if(features.length == 0) {
                return false;
            }

            if(index < 0 ) {
                index = 0;
            }
            if(index >= features.length) {
                index = features.length - 1;
            }

            var feature = features[index];
            var geom = feature.getGeometry();

            this.values.focus = {
                feature : feature,
                index : index
            };

            feature.setStyle(this.values.styles.focus);

            var content = [];

            content.push('<div id="' + this.values.element + '-popup" class="popover top feature-popup" tabIndex="1">');

            content.push('<div class="arrow"></div>');

            content.push('<div class="clearfix popover-title" id="popover-top">');
            content.push('<div  id="' + this.values.element + '-popup-close" style="width: 18px; 1px 4px 0px 0px; float: left;">');
            content.push('<span class="glyphicon glyphicon-remove icon-alert" style="cursor: pointer;"></span>');
            content.push('</div>');
            content.push('<div style="float: left;" data-i18n-id="tool.select.dialog.title">' + PublicaMundi.i18n.getResource('tool.select.dialog.title') + '</div>');
            if(features.length > 1) {
                content.push('<div style="float: right;"><img id="' + this.values.element + '-next" class="img-20" src="content/images/next.svg"></div>');
                content.push('<div style="float: right; font-size: 0.9em; padding-top: 2px;">' + (index + 1 ) + '</div>');
                content.push('<div style="float: right;"><img id="' + this.values.element + '-prev" class="img-20" src="content/images/previous.svg"></div>');
            }
            content.push('</div>');

            content.push('<div class="popover-content">');
            content.push('<div style="max-height: 190px; overflow: auto;">');
            var keys = feature.getKeys();
            if(($.inArray('__template__', keys) !== -1) && (feature.get('__template__'))) {
                var text = feature.get('__template__');
                for (var i = 0; i < keys.length; i++) {
                    var re = new RegExp('%\\(' + keys[i] + '\\)s', 'g');
                    text = text.replace(re, (feature.get(keys[i]) ? feature.get(keys[i]) : ''));
                }

                content.push(text);
            } else {
                content.push('<div class="feature-table"><table style="width: 100%;">');
                for (var i = 0; i < keys.length; i++) {
                    if ((keys[i] != feature.getGeometryName()) && (keys[i] != '__template__')) {
                        content.push('<tr class="feature-row"><td class="feature-prop-key">' + keys[i] + '</td><td class="feature-prop-value">' +
                        (feature.get(keys[i]) ? feature.get(keys[i]) : '') + '</td></tr>');
                    }
                }
                content.push('</table></div>')
            }
            content.push('</div>')
            content.push('</div>');

            content.push('</div>');

            $('body').append(content.join(''));

            if(features.length > 1) {
                $('#' + this.values.element + '-prev').click(function() {
                    return self.setFeatureFocusPrevious();
                });

                $('#' + this.values.element + '-next').click(function() {
                    return self.setFeatureFocusNext();
                });
            }

            $('#' + this.values.element + '-popup-close').click(function() {
                self.clearSelection();
            });

            var element = $('#' + this.values.element + '-popup');
            this.values.tooltip = new ol.Overlay({
                element: element[0],
                offset: [-element.outerWidth() / 2, -element.outerHeight()],
                positioning: 'bottom-center'
            });

            this.values.map.addOverlay(this.values.tooltip);

            var center = getGeometryCenter(geom);
            if(center) {
                this.values.tooltip.setPosition(center);

                if(this.values.centerOnSelection) {
                    this.values.map.getView().setCenter(center);
                }
            }


            $('#' +  this.values.element + '-popup').on('keydown', function(e){
                if(e.keyCode == 27) {
                    self.clearSelection();
                }
            });

            $('#' + this.values.element + '-popup').focus();

            return true;
        },
        setFeatureFocusPrevious: function() {
            if((this.values.focus) && (this.values.focus.index > 0)) {
                this.setFeatureFocus(this.values.focus.index - 1);
            } else {
                this.setFeatureFocus(0);
            }
        },
        setFeatureFocusNext: function() {
            var features = this.getFeatures();
            if(features.length == 0) {
                return false;
            }

            if((this.values.focus) && (this.values.focus.index < (features.length -2))) {
                return this.setFeatureFocus(this.values.focus.index + 1);
            } else {
                return this.setFeatureFocus(features.length -1);
            }
        },
        clearSelection: function() {
            this.clearFeatureFocus();
            this.values.overlay.getFeatures().clear();
            this.values.features = new ol.Collection();
        }
    });

    var getGeometryCenter = function(geom) {
        var c1, c2, center;
        if (geom instanceof ol.geom.Polygon) {
            center = geom.getInteriorPoint().getCoordinates();
        } else if (geom instanceof ol.geom.MultiPolygon) {
            var polygons = geom.getPolygons();
            var largest = polygons[0];
            for(var p=1;p<polygons.length;p++) {
                if(largest.getArea() < polygons[p].getArea()) {
                    largest = polygons[p];
                }
            }

            center = largest.getInteriorPoint().getCoordinates();
        } else if (geom instanceof ol.geom.Point) {
            center = geom.getCoordinates();
        } else {
            var singleGeom = geom;
            if(geom instanceof ol.geom.MultiLineString) {
                var middle= Math.floor(geom.getLineStrings().length / 2);
                singleGeom = geom.getLineString(middle);

                extent = geom.getExtent();
            }

            var coords = singleGeom.getCoordinates();
            var middle = Math.floor(coords.length / 2);

            center = [0, 0];
            c1 = coords[middle-1];
            c2 = coords[middle];

            center[0] = (c2[0] + c1[0]) / 2.0;
            center[1] = (c2[1] + c1[1]) / 2.0;
        }

        return center;
    };

    PublicaMundi.Maps.TextSearch = PublicaMundi.Class(PublicaMundi.Maps.Component, {
        initialize: function (options) {
			var self = this;

			PublicaMundi.extend(this.values, {
                map: null,
                endpoint: null
			});

			if (typeof PublicaMundi.Maps.Component.prototype.initialize === 'function') {
				PublicaMundi.Maps.Component.prototype.initialize.apply(this, arguments);
			}

            this.event('selection:changed');

            this.values.selection = null;
            this.values.feature = null;
            this.values.tooltip = null;

            this.values.overlay = new ol.FeatureOverlay({
                style: [
                    new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [255, 255, 255, 0.4]
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#3399CC',
                            width: 2
                        })
                    }),
                    new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 6,
                            fill: new ol.style.Fill({
                                color: [255, 255, 255, 0.4]
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#3399CC',
                                width: 1
                            })
                        }),
                        zIndex: Infinity
                    })
                ]
            });
            this.values.overlay.setMap(this.values.map);

			var searcher = new Bloodhound({
				datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
				queryTokenizer: Bloodhound.tokenizers.whitespace,
				remote: {
					url: this.values.endpoint + 'search/query?term=%QUERY&limit=10',
                    replace: function () {
                        var url = self.values.endpoint + 'search/query?term=' + $('#' + self.values.element).val() + '&limit=10';

                        var selection = self.values.resources.getSelectedLayers();
                        var queryables = self.values.resources.getQueryableResources();

                        var resources = [];

                        for(var i=0; i<selection.length; i++) {
                            for(var j=0; j<queryables.length; j++) {
                                if(selection[i].resource_id == queryables[j].wms) {
                                    resources.push(selection[i].resource_id);
                                    break;
                                }
                            }
                        }
                        url = url + '&resources=' + resources.join(',');

                        return url;
                    },
                    transform : function (data) {
                        return $.map(data, function (item) {
                            return {
                                name: item.properties.dd_default_field,
                                object: item
                            };
                        });
                    }
				}
			});

			var addTooltip = function(selection) {
				self.removeTooltip();

                if((selection) && (selection.geometry)) {
					self.values.selection = selection;

					var format = new ol.format.GeoJSON();
					var geom = format.readGeometry(selection.geometry, {
						dataProjection: PublicaMundi.Maps.CRS.Mercator,
						featureProjection: PublicaMundi.Maps.CRS.Mercator
					});
					self.values.feature = new ol.Feature({ name: 'selection', geometry: geom });

                    var center = getGeometryCenter(geom);
				    var drawFeature = false;
				    var extent = null;

					if (!(geom instanceof ol.geom.Point)) {
						drawFeature = true;
						extent = geom.getExtent();
					}

					if(drawFeature) {
						self.values.overlay.addFeature(self.values.feature);
					}

					var content = [];

					content.push('<div id="' + self.values.element + '-popup" class="popover top text-search ' + (drawFeature ? 'tooltip-popup-inactive' : 'tooltip-popup') +
								 '" tabIndex="1">');

					content.push('<div class="arrow"></div>');

					content.push('<div class="popover-content">');

					content.push('<div style="max-height: 190px; overflow: auto;"><div class="feature-table">');
					content.push('<table style="width: 100%;"><tr class=""><td class="text-search tooltip-prop-value">' + selection.properties.dd_default_suggest + '</td>');
                    content.push('<td id="' + self.values.element + '-popup-close" style="width: 18px; vertical-align: top; padding-left: 6px;">');
                    content.push('<span class="glyphicon glyphicon-remove icon-alert" style="cursor: pointer;"></span></td>');
                    content.push('</tr></table>');
					content.push('</div></div>');

					content.push('</div>');

					content.push('</div>');

					$('body').append(content.join(''));
                    $('#' + self.values.element + '-popup-close').click(function() {
                        self.removeTooltip();
                    });

                    $('#' +  self.values.element + '-popup').on('keydown', function(e){
                        if(e.keyCode == 27) {
                            self.removeTooltip();
                        }
                    });

					var element = $('#' + self.values.element + '-popup');
					self.values.tooltip = new ol.Overlay({
						element: element[0],
						offset: [-element.outerWidth() / 2, -element.outerHeight()],
						positioning: 'bottom-center'
					});

					self.values.map.addOverlay(self.values.tooltip);

					self.values.tooltip.setPosition(center);

					if(extent) {
						var view = self.values.map.getView();
						var size = self.values.map.getSize();
						view.fitExtent(extent, size);
					} else {
						self.values.map.getView().setCenter(center);
						self.values.map.getView().setZoom(17);
					}


					$('#' + self.values.element + '-popup').focus();
				}
			};

			var selectLocationSearchResult = function(e, selection) {
				self.removeTooltip();
                $('#' + self.values.element).val('');
				if(selection) {
					addTooltip(selection.object);

					self.trigger('selection:changed', { selection : selection.object });
				}

                $('#' + self.values.element).typeahead('val', '');
			};

			$('#' + this.values.element).typeahead({
				hint: true,
				highlight: true,
				minLength: 3
			}, {
				name: 'location-search',
				source: searcher,
                display: function(obj) {
                    return obj.object.properties.dd_default_text;
                },
                templates: {
                    suggestion: function(obj) {
                        return '<div>' + obj.object.properties.dd_default_suggest + '</div>';
                    }
                }
			}).bind('typeahead:select', selectLocationSearchResult);

            this.render();
        },
        getFeature: function() {
            return this.values.feature;
        },
        removeTooltip: function() {
			if(this.values.overlay) {
				this.values.overlay.getFeatures().clear();
			}

			if(this.values.tooltip) {
				this.values.map.removeOverlay(this.values.tooltip);
			}

			this.values.selection = null;
			this.values.feature = null;
			this.values.tooltip = null;
        }
    });

    PublicaMundi.Maps.Action = PublicaMundi.Class(PublicaMundi.Maps.Component, {
        initialize: function (options) {
			var self = this;

			PublicaMundi.extend(this.values, {
                name: null,
                image: '',
                title: null,
                visible: false
			});

            if (typeof PublicaMundi.Maps.Component.prototype.initialize === 'function') {
                PublicaMundi.Maps.Component.prototype.initialize.apply(this, arguments);
            }

            this.event('action:execute');

            this.render();
        },
        render: function() {
            var self = this;

            var content = [];
            content.push('<a data-action="' + this.values.name + '" class="tool-action btn btn-primary" data-i18n-id="' + this.values.title +
					     '" data-i18n-type="title" title="' + ( PublicaMundi.i18n.getResource(this.values.title) || '') + '">');
            content.push('<img class="img-20" src="' + this.values.image + '">');
            content.push('</a>');

            $('#' + this.values.element).addClass('tool-wapper-action').html(content.join(''));

            $('#' + this.values.element).find('a').tooltip();

            $('#' + this.values.element).find('a').click(function() {
                if(typeof self.execute === 'function') {
                    self.execute();
                }
                self.trigger('action:execute', { name : self.values.name });
            });

            if(!this.values.visible) {
                $('#' + this.values.element).hide();
            }
        },
        isBusy: function() {
            return $('#' + this.values.element).hasClass('busy');
        },
        suspendUI: function() {
            if(!$('#' + this.values.element).hasClass('busy')) {
                $('#' + this.values.element).addClass('busy').append('<div class="action-executing"><img style="" src="content/images/ajax-loader.gif"></div>');
            }
        },
        resumeUI: function() {
            $('#' + this.values.element).removeClass('busy');
            $('#' + this.values.element).find('.action-executing').remove();
        }
    });

	var _zIndex = 2100;

    PublicaMundi.Maps.Dialog = PublicaMundi.Class(PublicaMundi.Maps.Component, {
        initialize: function (options) {
			var self = this;

			PublicaMundi.extend(this.values, {
                image: '',
                title: null,
                visible: false,
                width: 600,
                height: 400,
                buttons: {
                },
                closeOnEscape: true,
                autofit: false
			});

            if (typeof PublicaMundi.Maps.Component.prototype.initialize === 'function') {
                PublicaMundi.Maps.Component.prototype.initialize.apply(this, arguments);
            }

            this.values.positionInitialized = false;

            this.event('dialog:close');
            this.event('dialog:action');
            this.event('dialog:show');

            this.render();
        },
        render: function() {
            var self = this;

            $('#' + this.values.element).remove();

            var content = [];
            _zIndex++;

            content.push('<div id="' + this.values.element + '" class="modal-dialog" style="z-index: ' + _zIndex+ '; width: ' + (this.values.width || 600 ) + 'px; outline: none; position: absolute;" tabIndex="1">');
            content.push('<div class="modal-content">');

            content.push('<div class="modal-header">');
            content.push('<button id="' + this.values.element + '-close" type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>');
            content.push('<h4 class="modal-title" data-i18n-id="' + this.values.title + '">' + PublicaMundi.i18n.getResource(this.values.title) + '</h4>');
            content.push('</div>');

            content.push('<div class="modal-body" style="text-align: justify; max-height: ' + (this.values.height || 400) +
                         'px; overflow: ' + (this.values.autofit ? 'unset': 'auto') + '" >');
            if(typeof this.values.renderContent === 'function'){
                content = content.concat(this.values.renderContent());
            }
            content.push('</div>');

            content.push('<div class="modal-footer">');

            if(typeof this.values.renderFooter === 'function'){
                content = content.concat(this.values.renderFooter());
            }
            if(this.values.buttons) {
                for(var action in this.values.buttons) {
                    this.values.buttons[action].style = this.values.buttons[action].style || 'default';

                    content.push('<button type="button" class="btn btn-' + this.values.buttons[action].style + '" data-i18n-id="' + this.values.buttons[action].text +
                                 '" data-action="' + action +
                                 '">' + PublicaMundi.i18n.getResource(this.values.buttons[action].text) + '</button>');
                }
            }
            content.push('</div>');

            content.push('</div>');
            content.push('</div>');
            content.push('</div>');

            var target = $('.dialog-container').first();
            if(target.length === 0) {
                throw 'Dialog container does not exist.';
            } else {
                target.append(content.join(''));
            }

            $('#' + this.values.element).draggable({
                handle : '.modal-header',
                containment: 'parent'
            });

            $('#' + this.values.element).on('click.' + this.values.element, 'button', function() {
                self.trigger('dialog:action', { sender : self, action : $(this).data('action') });
            });

            $('#' +  this.values.element + '-close').click(function(e) {
                self.hide();
                self.trigger('dialog:close', { sender : self });
            });

            if(this.values.visible) {
                this.show();
            } else {
                this.hide();
            }

            $('#' +  this.values.element).on('keydown', function(e){
                if((self.values.closeOnEscape) && (e.keyCode == 27)) {
                    self.hide();
                    self.trigger('dialog:close', { sender : self });
                }
            });
        },
        moveToFront: function() {
            var myElement = $('#' + this.values.element);
            var myIndex = myElement.zIndex();

            var topModal = null;
            var topModalIndex = myIndex;

            $('.modal-dialog').each(function(index, element) {
                var zIndex = $(element).zIndex();
                if(zIndex > topModalIndex) {
                    topModalIndex = zIndex;
                    topModal = element;
                }
            });
            if(topModal) {
                $(topModal).zIndex(myIndex);
                $(myElement).zIndex(topModalIndex)
            }
        },
        show: function() {
            PublicaMundi.Maps.Component.prototype.show.apply(this, arguments);

            if(!this.values.positionInitialized) {
                this.values.positionInitialized = true;
                this.moveToCenter();
            }
            this.moveToFront();
            this.trigger('dialog:show', {sender : this });

            $('#' +  this.values.element).focus();
        },
        moveTo: function(left, top) {
            $('#' + this.values.element).offset({ top : top, left : left });
        },
        moveToCenter: function() {
            $('#' + this.values.element).offset({
                top : ($(window).height() - $('#' + this.values.element).height()) / 2,
                left : ($(window).width() - $('#' + this.values.element).width()) / 2
            });
        },
        setTitle: function(text) {
            $('#' + this.values.element).find('.modal-title').html(text);
        },
        setContent: function(text) {
            $('#' + this.values.element).find('.modal-body').html(text);
        }
    });

    var _DialogTableBrowserRenderTable = function(response) {
        if(response.success) {
            this.values.page.data = response.data[0].records;

            var records = this.values.page.data, content = [];

            content.push('<div class="clearfix" style="overflow: scroll; max-height: ' + (this.values.height - 100) + 'px;"><table class="table table-striped data-table">');

            if(records.length > 0) {
                content.push('<thead>');
                content.push('<tr>');
                for(var field in records[0]) {
                    if( field !== this.values.geometryName) {
                        content.push('<th>' + field + '</th>');
                    }
                }
                content.push('</tr>');
                content.push('</thead>');

                content.push('<tbody>');

                var maxPageSize = this.values.page.size;
                if (maxPageSize > records.length) {
                    maxPageSize = records.length;
                }
                for(var i=0; i < maxPageSize; i++) {
                    content.push('<tr>');
                    for(var field in records[i]) {
                        if( field !== this.values.geometryName) {
                            content.push('<td>' + (records[i][field] ? records[i][field] : '' ) + '</td>');
                        }
                    }
                    content.push('</tr>');
                }
                content.push('</tbody>');
            }
            content.push('</table><div>');

            this.setContent(content.join(''));
            this.show();
        }
    };

    var _DialogTableBrowserBuildQuery = function() {
        var query = this.values.query;

        query.reset();
        query.resource(this.values.table).
            format(PublicaMundi.Data.Format.JSON).
            skip(this.values.page.index * this.values.page.size).
            take(this.values.page.size + 1).
            execute(_DialogTableBrowserRenderTable, this);

    };

    PublicaMundi.Maps.DialogTableBrowser = PublicaMundi.Class(PublicaMundi.Maps.Dialog, {
        initialize: function (options) {
			var self = this;

			PublicaMundi.extend(this.values, {
                table: null,
                endpoint: null
			});

            if (typeof PublicaMundi.Maps.Dialog.prototype.initialize === 'function') {
                PublicaMundi.Maps.Dialog.prototype.initialize.apply(this, arguments);
            }

            this.values.query = new PublicaMundi.Data.Query(this.values.endpoint);
            this.values.page = {
                index : 0,
                size: 10,
                data: null,
            };
            this.values.geometryName = 'the_geom';

            this.event('page:next');
            this.event('page:previous');
            this.event('page:refresh');
            this.event('row:changed');

            this.render();
        },
        render: function() {
            var self = this;

            PublicaMundi.Maps.Dialog.prototype.render.apply(this);
        },
        getNextPage: function() {
            this.values.page.index = this.values.page.index + 1;
            _DialogTableBrowserBuildQuery.apply(this);
        },
        getPrevPage: function() {
            if(this.values.page.index > 0) {
                this.values.page.index = this.values.page.index - 1;
            }
            _DialogTableBrowserBuildQuery.apply(this);
        },
        getPage: function(index) {
            if(index < 0) {
                this.values.page.index = 0;
            } else {
                this.values.page.index = index;
            }
            _DialogTableBrowserBuildQuery.apply(this);
        },
        setTable: function(table) {
            this.values.page.index = 0;
            this.values.table = table;
        },
        getGeometryName: function() {
            return this.values.geometryName;
        },
        getPageIndex: function() {
            return this.values.page.index;
        }
    });

    PublicaMundi.Maps.ImportWmsTool = PublicaMundi.Class(PublicaMundi.Maps.Action, {
        initialize: function (options) {
			var self = this;

            if (typeof PublicaMundi.Maps.Action.prototype.initialize === 'function') {
                PublicaMundi.Maps.Action.prototype.initialize.apply(this, arguments);
            }

            this.event('metadata:loaded');

            this.event('layer:added');

            this.values.dialog = new PublicaMundi.Maps.Dialog({
                title: 'action.import-wms.title',
                element: this.values.element + '-dialog',
                visible: false,
                width: 430,
                height: 280,
                autofit: false,
                buttons: {
                    close : {
                        text: 'button.close',
                        style: 'primary'
                    }
                },
                renderContent: function() {
                    var content = [];

                    content.push('<div class="clearfix" style="padding-bottom: 10px;">');

                    content.push('<div class="input-group">');
                    content.push('<span class="input-group-addon">');
                    content.push('<span class="glyphicon glyphicon-link"></span>');
                    content.push('</span>');
                    content.push('<input id="' + self.values.element + '-endpoint" value="" type="text" class="form-control" data-i18n-id="action.import-wms.url.placeholder" data-i18n-type="attribute" data-i18n-name="placeholder" placeholder="Διεύθυνση WMS ...">');
                    content.push('<span class="input-group-btn">');
                    content.push('<button id="' + self.values.element + '-btn-metadata" class="btn btn-default" type="button">');
                    content.push('<span class="glyphicon glyphicon-search"></span>');
                    content.push('</button>');
                    content.push('</span>');
                    content.push('</div>');

                    content.push('</div>');

                    content.push('<div class="clearfix" style="max-height: 200px; overflow: auto;">');
                    content.push('<div id="' + self.values.element + '-layers" class="clearfix" style="padding: 0 4px 0 0;"></div>');
                    content.push('</div>');
                    content.push('<div class="clearfix"  id="' + self.values.element + '-error"></div>');
                    return content;
                }
            });


			$('#' + this.values.element + '-layers').on('click.' + this.values.element, '.list-group-item-button', function() {
				var index = $(this).data('index');
				var id = self.values.metadata.key + '_' + self.values.metadata.layers[index].key;

				self.trigger('layer:added', { metadata : self.values.metadata, id : id});
			});

            $('#' + this.values.element + '-btn-metadata').click(function () {
				self.values.metadata = null;

				$('#' + self.values.element + '-layers').html('');
				$('#' + self.values.element + '-error').html('');

                self.values.resources.getResourceMetadata(
					PublicaMundi.Maps.Resources.Types.WMS,
					{ url : $('#' + self.values.element + '-endpoint').val() }
				).then(function(metadata) {
					self.values.metadata = metadata;

					var content = [];
					if((metadata) && (metadata.layers.length > 0)) {
						content.push('<ul class="list-group">');
						for(var i=0, count=metadata.layers.length; i<count; i++) {
							content.push('<li class="list-group-item">' + metadata.layers[i].title + '<span class="list-group-item-button" data-index="' + i + '"><span class="glyphicon glyphicon-plus"></span><span></span></span></li>');
						}
						content.push('</ul>');
					}

					$('#' + self.values.element + '-layers').html(content.join(''));

					self.trigger('metadata:loaded', { metadata : metadata});
				}, function(error) {
					$('#' + self.values.element + '-error').append('<div class="alert alert-danger" role="alert" data-i18n-id="action.import-wms.error.metadata">' + PublicaMundi.i18n.getResource('action.import-wms.error.metadata') + '</div>');
				});
            });

            this.values.dialog.on('dialog:action', function(args){
                    switch(args.action){
                        case 'close':
                            this.hide();
                            break;
                    }
            });

            this.render();
        },
        execute: function() {
			this.values.dialog.show();
		}
    });

    PublicaMundi.Maps.UploadFileTool = PublicaMundi.Class(PublicaMundi.Maps.Action, {
        initialize: function (options) {
			var self = this;

            if (typeof PublicaMundi.Maps.Action.prototype.initialize === 'function') {
                PublicaMundi.Maps.Action.prototype.initialize.apply(this, arguments);
            }

            this.event('resource:loaded');

            this.values.dialog = new PublicaMundi.Maps.Dialog({
                title: 'action.upload-resource.title',
                element: this.values.element + '-dialog',
                visible: false,
                width: 430,
                height: 280,
                autofit: true,
                buttons: {
                    close : {
                        text: 'button.close',
                        style: 'primary'
                    }
                },
                renderContent: function() {
                    var content = [];

                    content.push('<div class="clearfix form-inline" style="padding-bottom: 10px;">');
                    content.push('<label for="' + self.values.element + '-title" style="padding-right: 10px; width: 145px;" data-i18n-id="control.upload.dialog.label.title">' +
                                 PublicaMundi.i18n.getResource('control.upload.dialog.label.title') + '</label>');
                    content.push('<input id="' + self.values.element + '-title" class="form-control input-md" type="text" style="width: 250px;" value="' + PublicaMundi.i18n.getResource('control.upload.dialog.default.title') + '">');
                    content.push('</div>');

                    content.push('<div class="clearfix" style="padding-bottom: 10px;">');
                    content.push('<label for="' + self.values.element + '-format" style="padding-right: 10px; width: 145px;" data-i18n-id="control.upload.dialog.label.format">' +
                                 PublicaMundi.i18n.getResource('control.upload.dialog.label.format') + '</label>');
                    content.push('<select name="' + self.values.element + '-format" id="' + self.values.element + '-format" autocomplete="off" class="selectpicker" data-width="250px">');
                    content.push('<option value="GML">GML</option>');
                    content.push('<option value="KML" selected>KML</option>');
                    content.push('<option value="ESRI Shapefile">ESRI Shapefile (compressed file)</option>');
                    content.push('<option value="GeoJSON">GeoJSON</option>');
                    content.push('<option value="DXF">AutoCAD DXF</option>');
                    content.push('<option value="CSV">Comma Separated Values</option>');
                    content.push('</select>');
                    content.push('</div>');

                    content.push('<div id="' + self.values.element + '-info" class="clearfix alert alert-info" role="alert" ' +
                                 'style="margin: 0px 4px 11px 0px; padding: 7px !important; display: none">');
                    content.push('<span data-i18n-id="control.upload.dialog.info">' +
                                 PublicaMundi.i18n.getResource('control.upload.dialog.info')  + '</label>');
                    content.push('</div>');

                    content.push('<div class="clearfix" style="padding-bottom: 10px;">');
                    content.push('<label for="' + self.values.element + '-crs" style="padding-right: 10px; width: 145px;" data-i18n-id="control.upload.dialog.label.crs">' +
                                 PublicaMundi.i18n.getResource('control.upload.dialog.label.crs')  + '</label>');
                    content.push('<select name="' + self.values.element + '-crs" id="' + self.values.element + '-crs" class="selectpicker" data-width="160px" disabled>');
                    content.push('<option value="EPSG:3857">Web Mercator</option>');
                    content.push('<option value="EPSG:4326" selected>WGS84</option>');
                    content.push('<option value="EPSG:2100">ΕΓΣΑ87</option>');
                    content.push('<option value="EPSG:4258">ETRS89</option>');
                    content.push('</select>');
                    content.push('</div>');

                    content.push('<div class="clearfix"  id="' + self.values.element + '-error"></div>');
                    return content;
                },
                renderFooter: function() {
                    var content = [];

                    content.push('<span class="btn btn-success fileinput-button">');
                    content.push('<i class="glyphicon glyphicon-upload"></i>');
                    content.push('<span data-i18n-id="action.upload-resource.select-file" style="padding-left: 10px;">' + PublicaMundi.i18n.getResource('action.upload-resource.select-file') + '</span>');
                    content.push('<input id="' + self.values.element + '-fileupload" type="file" name="files[]" multiple>');
                    content.push('</span>');

                    return content;
                }
            });


            $('#' + this.values.element + '-format').selectpicker().change(function () {
                $('[data-id="' + self.values.element + '-format"]').blur();

                var format = $('#' + self.values.element + '-format').val();

                $('#' + self.values.element + '-info').hide();

                if(format == 'KML') {
                    $('#' + self.values.element + '-crs').val('EPSG:4326').prop('disabled',true).selectpicker('refresh');
                } else if(format == 'CSV') {
                    $('#' + self.values.element + '-info').show();
                } else {
                    $('#' + self.values.element + '-crs').prop('disabled',false).selectpicker('refresh');
                }
            });

            $('#' + this.values.element + '-crs').selectpicker().change(function () {
                $('[data-id="' + self.values.element + '-crs"]').blur();
                if(($('#' + self.values.element + '-format').val() == 'KML') &&
                   ($('#' + self.values.element + '-crs').val() != 'EPSG:4326')) {
                    $('#' + self.values.element + '-crs').val('EPSG:4326').selectpicker('refresh');
                }
            });

            $('#' + this.values.element + '-fileupload').fileupload({
                url: this.values.endpoint + 'upload/upload_resource',
                dataType: 'json',
                done: function (e, data) {
                    $.each(data.result.files, function (index, file) {
                        if(file.error) {
                            switch(file.error) {
                                case 'minFileSize': case 'maxFileSize': case 'acceptFileTypes': case 'invalidContent': case 'conversionFailed':
                                case 'crsNotSupported': case 'acceptFileFormats':
                                    $('#' + self.values.element + '-error').html('').append('<div class="alert alert-danger" role="alert" data-i18n-id="action.upload-resource.error.' + + file.error + '">' +
                                                                                            PublicaMundi.i18n.getResource('action.upload-resource.error.' + file.error) + '</div>');
                                    break;
                                default:
                                    $('#' + self.values.element + '-error').html('').append('<div class="alert alert-danger" role="alert" data-i18n-id="action.upload-resource.error.unknown">' +
                                                                                            PublicaMundi.i18n.getResource('action.upload-resource.error.unknown') + '</div>');
                                    break;
                            };
                        } else {
                            var format = $('#' + self.values.element + '-format').val();
                            if((format == 'ESRI Shapefile') || (format == 'DXF') || (format == 'CSV')) {
                                format = 'geojson';
                            }

                            self.trigger('resource:loaded', {
                                id: 'remote_' + file.url,
                                title: $('#' + self.values.element + '-title').val() || file.name,
                                format: format,
                                name: file.name,
                                type: file.type,
                                text: null,
                                url: file.url,
                                projection: $('#' + self.values.element + '-crs').val()
                            });
                        }
                    });
                },
                submit: function(e, data) {
                    data.formData = {
                        format: $('#' + self.values.element + '-format').val(),
                        crs : $('#' + self.values.element + '-crs').val()
                    };
                },
                add : function (e, data) {
                    $('#' + self.values.element + '-error').html('');

                    var allowed_extensions = /(\.|\/)(gml|kml|geojson|json|zip|dxf|csv)$/i
                    var locally_allowed_extensions = /(\.|\/)(gml|kml|geojson|json)$/i

                    var submit = true;

                    var format = $('#' + self.values.element + '-format').val();

                    $.each(data.files, function (index, file) {
                        var ext = file.name.split('.').pop();

                        if(!allowed_extensions.test(file.name)) {
                            $('#' + self.values.element + '-error').html('').append('<div class="alert alert-danger" role="alert" data-i18n-id="action.upload-resource.error.acceptFileTypes">' +
                                                                                    PublicaMundi.i18n.getResource('action.upload-resource.error.acceptFileTypes') + '</div>');

                            submit = false;
                        } else if((window.File) && (window.FileReader) && (locally_allowed_extensions.test(file.name))) {
                            var reader = new FileReader();

                            var format = $('#' + self.values.element + '-format').val();
                            if((format == 'ESRI Shapefile') || (format == 'DXF') || (format == 'CSV')) {
                                format = 'geojson';
                            }

                            reader.onload = function(e) {
                                self.trigger('resource:loaded', {
                                    id: 'local_' + file.name,
                                    title: $('#' + self.values.element + '-title').val() || file.name,
                                    format: format,
                                    name : file.name,
                                    type: file.type,
                                    text : reader.result,
                                    url : null,
                                    projection: $('#' + self.values.element + '-crs').val()
                                });
                            };

                            reader.readAsText(file);

                            submit = false;
                        }
                    });

                    if(submit) {
                        data.submit();
                    }
                },
                fail : function(e, data) {
                    $('#' + self.values.element + '-error').html('').append('<div class="alert alert-danger" role="alert" data-i18n-id="action.upload-resource.error.unknown">' +
                                                                            PublicaMundi.i18n.getResource('action.upload-resource.error.unknown') + '</div>');
                }
            });

            this.values.dialog.on('dialog:action', function(args){
                    switch(args.action){
                        case 'close':
                            this.hide();
                            break;
                    }
            });

            this.render();
        },
        execute: function() {
			this.values.dialog.show();
            $('#' + this.values.element + '-title').focus().select();
		}
    });

    PublicaMundi.Maps.PositionTool = PublicaMundi.Class(PublicaMundi.Maps.Action, {
        initialize: function (options) {
			var self = this;

            if (typeof PublicaMundi.Maps.Action.prototype.initialize === 'function') {
                PublicaMundi.Maps.Action.prototype.initialize.apply(this, arguments);
            }

            this.event('position:changed');

            this.values.dialog = new PublicaMundi.Maps.Dialog({
                title: 'action.set-position.title',
                element: this.values.element + '-dialog',
                visible: false,
                width: 220,
                height: 280,
                autofit: true,
                buttons: {
                    update: {
                        text: 'control.set-position.dialog.button.move',
                        style: 'primary'
                    },
                    close : {
                        text: 'button.close',
                        style: 'default'
                    }
                },
                renderContent: function() {
                    var content = [];

                    content.push('<div class="clearfix form-inline" style="padding-bottom: 10px;">');
                    content.push('<label for="' + self.values.element + '-title" style="padding-right: 10px; width: 25px;" data-i18n-id="control.set-position.dialog.label.x">' +
                                 PublicaMundi.i18n.getResource('control.set-position.dialog.label.x') + '</label>');
                    content.push('<input id="' + self.values.element + '-x" class="form-control input-md" type="text" style="width: 150px;">');
                    content.push('</div>');

                    content.push('<div class="clearfix form-inline" style="padding-bottom: 10px;">');
                    content.push('<label for="' + self.values.element + '-title" style="padding-right: 10px; width: 25px;" data-i18n-id="control.set-position.dialog.label.y">' +
                                 PublicaMundi.i18n.getResource('control.set-position.dialog.label.y') + '</label>');
                    content.push('<input id="' + self.values.element + '-y" class="form-control input-md" type="text" style="width: 150px;">');
                    content.push('</div>');

                    content.push('<div class="clearfix"  id="' + self.values.element + '-error"></div>');

                    return content;
                }
            });

            // http://stackoverflow.com/questions/891696/jquery-what-is-the-best-way-to-restrict-number-only-input-for-textboxes-all

            $('#' + this.values.element + '-x, #' + this.values.element + '-y').keydown(function(e) {
                var controlKeys = [8, 9, 13, 35, 36, 37, 39];
                if(controlKeys.indexOf(e.which) >= 0) {
                    return ;
                }
                var v = (this.value || '') + e.key;
                if($.isNumeric(v) === false) {
                    //chop off the last char entered
                    e.preventDefault();
                }
            });

            $('#' + this.values.element + '-x, #' + this.values.element + '-y').change(function() {
                this.value = parseFloat(this.value).toFixed(4);
            });

            this.values.dialog.on('dialog:show', function(args) {
                var center = self.values.map.getView().getCenter();

                center = ol.proj.transform(center, 'EPSG:3857' , self.values.projection);

                $('#' + self.values.element + '-x').val(center[0].toFixed(4));
                $('#' + self.values.element + '-y').val(center[1].toFixed(4));
            });

            this.values.dialog.on('dialog:action', function(args){
                    switch(args.action){
                        case 'update':
                            var center = self.getPosition();
                            if(center) {
                                center = ol.proj.transform(center, self.values.projection, 'EPSG:3857');
                                self.values.map.getView().setCenter(center);
                            }
                            break;
                        case 'close':
                            this.hide();
                            break;
                    }
            });

            this.render();
        },
        execute: function() {
			this.values.dialog.show();
		},
        getPosition: function() {
            if(this.values.projection) {
                var x = parseFloat(parseFloat($('#' + this.values.element + '-x').val()).toFixed(4));
                var y = parseFloat(parseFloat($('#' + this.values.element + '-y').val()).toFixed(4));

                if((!isNaN(x)) && (!isNaN(y))) {
                    return [x,y];
                }
            }
            return null;
        },
        setPosition: function(position) {
            if(position) {
                $('#' + this.values.element + '-x').val(position[0].toFixed(4));
                $('#' + this.values.element + '-y').val(position[1].toFixed(4));
            };
        },
        setProjection: function(projection) {
            var position = this.getPosition();

            if(position) {
                position = ol.proj.transform(position,this.values.projection , projection);
                this.values.projection = projection;

                this.setPosition(position);
            }
        }
    });

    PublicaMundi.Maps.PermalinkTool = PublicaMundi.Class(PublicaMundi.Maps.Action, {
        initialize: function (options) {
			var self = this;

            options.mode = options.mode || PublicaMundi.Maps.PermalinkTool.Mode.Link;

            if (typeof PublicaMundi.Maps.Action.prototype.initialize === 'function') {
                PublicaMundi.Maps.Action.prototype.initialize.apply(this, arguments);
            }

            this.values.dialog = new PublicaMundi.Maps.Dialog({
                title: (options.mode == PublicaMundi.Maps.PermalinkTool.Mode.Link ? 'action.create-link.title' : 'action.create-link-embed.title'),
                element: this.values.element + '-dialog',
                visible: false,
                width: 500,
                height: 280,
                autofit: true,
                buttons: {
                    close: {
                        text: 'button.close',
                        style: 'default'
                    }
                },
                renderContent: function() {
                    var content = [];

                    switch(self.values.mode) {
                        case PublicaMundi.Maps.PermalinkTool.Mode.Link:
                            content.push('<div class="clearfix" style="padding-bottom: 10px;">');

                            content.push('<div class="input-group">');
                            content.push('<input readonly id="' + self.values.element +
                                         '-link" value="" type="text" class="form-control" data-i18n-id="action.create-link.link.placeholder" data-i18n-type="attribute" data-i18n-name="placeholder" placeholder="" style="background: white;">');
                            content.push('<span class="input-group-btn">');
                            content.push('<button id="' + self.values.element + '-btn-copy" class="btn btn-default" type="button">');
                            content.push('<span class="glyphicon glyphicon-copy"></span>');
                            content.push('</button>');
                            content.push('</span>');
                            content.push('</div>');

                            content.push('</div>');

                            content.push('<div class="clearfix" style="max-height: 200px; overflow: auto;">');
                            content.push('<div id="' + self.values.element + '-layers" class="clearfix" style="padding: 0 4px 0 0;"></div>');
                            content.push('</div>');
                            content.push('<div class="clearfix" style="background: #fff5c1; border-radius: 4px; padding: 4px;" id="' + self.values.element + '-error"></div>');
                            break;
                        case PublicaMundi.Maps.PermalinkTool.Mode.Embed:
                            content.push('<div class="clearfix" style="padding-bottom: 10px;">');
                            content.push('<label for="' + self.values.element + '-lib" style="padding-right: 10px; width: 115px;" data-i18n-id="action.create-link-embed.label.lib">' +
                                         PublicaMundi.i18n.getResource('action.create-link-embed.label.lib')  + '</label>');
                            content.push('<select name="' + self.values.element + '-lib" id="' + self.values.element + '-lib" class="selectpicker" data-width="160px">');
                            content.push('<option value="leaflet" selected>LeafLet</option>');
                            content.push('<option value="ol">OpenLayers 3</option>');
                            content.push('</select>');
                            content.push('</div>');

                            content.push('<div class="clearfix" style="padding-bottom: 10px;">');
                            content.push('<label for="' + self.values.element + '-iframe" style="padding-right: 10px; width: 115px; float: left;" data-i18n-id="action.create-link-embed.label.code">' +
                                         PublicaMundi.i18n.getResource('action.create-link-embed.label.code')  + '</label>');
                            content.push('<textarea name="' + self.values.element + '-iframe" id="' + self.values.element + '-iframe" class="form-control" rows="3" style="resize: none; width: 340px; float: left;"></textarea>');
                            content.push('</div>');

                            break;
                    }

                    return content;
                }
            });

            $('#' + this.values.element + '-lib').selectpicker().change(function () {
                $('[data-id="' + self.values.element + '-lib"]').blur();
                self.execute();
            });

            $('#' + this.values.element + '-btn-copy').click(function() {
                 $(this).blur();
            });

            this.values.dialog.on('dialog:action', function(args){
                    switch(args.action) {
                        case 'close':
                            this.hide();
                            break;
                    }
            });

            this.render();
        },
        exportToJSON: function() {
            var base = this.values.map.getLayers().getArray()[0];
            var overlay = this.values.map.getLayers().getArray()[1];

            var config = {
                zoom: this.values.map.getView().getZoom(),
                center: this.values.map.getView().getCenter(),
                base : {
                    type : (base ? base.publicamundi.type : null),
                    set : (base ? base.publicamundi.set : null),
                    opacity : (overlay.getOpacity() * 100)
                },
                layers: [],
                lib: null
            };

            if(this.values.mode == PublicaMundi.Maps.PermalinkTool.Mode.Embed) {
                config.lib = $('#' + this.values.element + '-lib').val();
            }

            var layers = this.values.resources.getSelectedLayers();
            for(var l=0;l<layers.length; l++) {
                var layer = layers[l];

                var resource = this.values.ckan.getResourceById(layer.resource_id);
                if(resource) {
                    config.layers.push({
                        title: layer.title,
                        package : resource.package,
                        resource : resource.id,
                        layer: layer.layer_id,
                        opacity: layer.opacity,
                        endpoint: layer.endpoint,
                        key: layer.key
                    });
                }
            }
            return config;
        },
        execute: function() {
            var self = this;

            var config = this.exportToJSON();
            if(self.values.mode == PublicaMundi.Maps.PermalinkTool.Mode.Embed) {
                config.lib = $('#' + self.values.element + '-lib').val();
            }
            return new Promise(function(resolve, reject) {
                var uri = new URI();

                if(self.values.endpoint === '/') {
                    uri.segment(['config', 'save']);
                } else {
                    uri.segment([self.values.endpoint, 'config', 'save']);
                }

                var callback = null;
                switch(self.values.mode) {
                    case PublicaMundi.Maps.PermalinkTool.Mode.Link:
                        callback = function (response) {
                            $('#' + self.values.element + '-error').hide();
                            if(response.success) {
                                var link = new URI(window.location.origin);
                                if(self.values.endpoint!='/') {
                                    link.segment([self.values.endpoint]);
                                }
                                link.addQuery({ 'config': response.url });

                                $('#' + self.values.element + '-link').val(link.toString());

                                var copied = false;
                                try {
                                    copied = document.execCommand('copy');
                                } catch(err) {
                                    // suppress exception
                                }
                                if(!copied) {
                                    $('#' + self.values.element + '-btn-copy').addClass('disabled');

                                    $('#' + self.values.element + '-error').html(PublicaMundi.i18n.getResource('action.create-link.error.copy'));
                                    $('#' + self.values.element + '-error').show();
                                }
                            }

                            self.values.dialog.show();

                            $('#' + self.values.element + '-link').focus();
                            $('#' + self.values.element + '-link').select();

                            resolve(response);
                        };
                        break;
                    case PublicaMundi.Maps.PermalinkTool.Mode.Embed:
                      callback = function (response) {
                            $('#' + self.values.element + '-error').hide();
                            if(response.success) {
                                var link = new URI(window.location.origin);

                                if(window.location.pathname === '/') {
                                    link.segment(['config', 'embed', response.url]);
                                } else {
                                    link.segment([window.location.pathname, 'config', 'embed', response.url]);
                                }

                                var iframe = [];
                                iframe.push('<iframe style="border: none 0; padding: 0; margin: 0; width: 600px; height: 600px;" src="');
                                iframe.push(link.toString().replace(/\/\//g, '/').replace(/:\//g, '://'));
                                iframe.push('" frameborder="0" scrolling="hidden"></iframe>');

                                $('#' + self.values.element + '-iframe').val(iframe.join(''));
                            }

                            self.values.dialog.show();
                            $('#' + self.values.element + '-iframe').focus();
                            $('#' + self.values.element + '-iframe').select();

                            resolve(response);
                        };
                    break;
                }
				$.ajax({
                    type: "POST",
					url: uri.toString().replace(/\/\//g, '/').replace(/:\//g, '://'),
					context: self,
                    contentType: "application/json; charset=utf-8",
                    dataType: "json",
                    data: JSON.stringify(config)
				}).done(callback).fail(function (jqXHR, textStatus, errorThrown) {
					console.log('Failed to save configuration : ' + JSON.stringify(config));

					reject(errorThrown);
				});
			});
		}
    });

    PublicaMundi.Maps.PermalinkTool.Mode = {
        Link : 1,
        Embed : 2
    };

    var _ParseCoordinates = function(crs, delimiter, text) {
        var re, coordinates = [], transformed = [];

        text = text || '';

        switch(delimiter) {
            case '.':
                re = /\s|,/;
                break;
            case ',':
                re = /\s/;
                break;
        }

        var tokens = text.split(re);
        var num, numbers = [];

        for(var i=0; i<tokens.length; i++) {
            if(tokens[i]) {
                if(delimiter==',') {
                    tokens[i] = tokens[i].replace(',', '.');
                }
                num = parseFloat(tokens[i]);
                if(isFinite(num)) {
                    numbers.push(num);
                }
            }
        }

        for(var i=0; i<numbers.length; i+=2) {
            if(numbers[i+1]) {
                coordinates.push([numbers[i], numbers[i+1]]);
                transformed.push([numbers[i], numbers[i+1]]);
            }
        }

        if((coordinates.length > 1) &&
           ((coordinates[0][0] != coordinates[coordinates.length - 1][0]) ||
            (coordinates[0][1] != coordinates[coordinates.length - 1][1]))) {
            coordinates.push([numbers[0], numbers[1]]);
            transformed.push([numbers[0], numbers[1]]);
        }

        if(crs != PublicaMundi.Maps.CRS.Mercator) {
            for(var c=0; c<transformed.length; c++) {
                transformed[c] = ol.proj.transform(transformed[c], crs , PublicaMundi.Maps.CRS.Mercator);
            }
        }

        return {
            initial: coordinates,
            transformed: transformed
        };
    };

    PublicaMundi.Maps.CoordinateParser = PublicaMundi.Class(PublicaMundi.Maps.Action, {
        initialize: function (options) {
			var self = this;

            this.values.map = null;

            if (typeof PublicaMundi.Maps.Action.prototype.initialize === 'function') {
                PublicaMundi.Maps.Action.prototype.initialize.apply(this, arguments);
            }

            this.values.buffer = this.values.buffer || 3;

            this.event('parse:completed');

            // http://openlayers.org/en/v3.3.0/examples/vector-labels.js
            var featureStyleFunction = function(feature, resolution) {
                var geom = feature.getGeometry();

                return [
                    new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [40, 96, 144, 0.4]
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#286090',
                            width: 2
                        })
                    }),
                    new ol.style.Style({
                        zIndex: Infinity,
                        text: new ol.style.Text({
                            textAlign: 'center',
                            font: '10pt Tahoma,Arial Normal',
                            text: feature.get('label') || '',
                            fill: new ol.style.Fill({color: 'black'}),
                            stroke: new ol.style.Stroke({color: 'white', width: 1}),
                            offsetX: 0,
                            offsetY: 0
                        })
                    })
                ]
            };

            this.values.overlay = new ol.FeatureOverlay({
                style: featureStyleFunction
            });
            this.values.overlay.setMap(this.values.map);

            this.values.dialog = new PublicaMundi.Maps.Dialog({
                title: 'control.parse.dialog.title',
                element: this.values.element + '-dialog',
                visible: false,
                width: 520,
                height: 250,
                autofit: true,
                buttons: {
                    parse: {
                        text: 'control.parse.dialog.button.parse',
                        style: 'primary'
                    },
                    close : {
                        text: 'control.parse.dialog.button.cancel',
                        style: 'default'
                    }
                },
                renderContent: function() {
                    var content = [];

                    content.push('<div class="clearfix" style="padding-bottom: 10px;">');
                    content.push('<label for="' + self.values.element + '-crs" style="padding-right: 10px; width: 145px;" data-i18n-id="control.parse.dialog.label.crs">' +
                                 PublicaMundi.i18n.getResource('control.parse.dialog.label.crs')  + '</label>');
                    content.push('<select name="' + self.values.element + '-crs" id="' + self.values.element + '-crs" class="selectpicker" data-width="120px">');
                    content.push('<option value="EPSG:4326">WGS84</option>');
                    content.push('<option value="EPSG:2100" selected="selected">ΕΓΣΑ87</option>');
                    content.push('</select>');

                    content.push('<label for="' + self.values.element + '-delimiter" style="padding: 0px 10px;" data-i18n-id="control.parse.dialog.label.delimiter">' +
                                 PublicaMundi.i18n.getResource('control.parse.dialog.label.delimiter')  + '</label>');
                    content.push('<select name="' + self.values.element + '-delimiter" id="' + self.values.element + '-delimiter" class="selectpicker" data-width="50px">');
                    content.push('<option value="." selected="selected">.</option>');
                    content.push('<option value=",">,</option>');
                    content.push('</select>');
                    content.push('</div>');

                    content.push('<div class="clearfix" style="padding-bottom: 10px;">');
                    content.push('<label for="' + self.values.element + '-text" style="padding-right: 10px; width: 145px; float: left;" data-i18n-id="control.parse.dialog.label.text">' +
                                 PublicaMundi.i18n.getResource('control.parse.dialog.label.text')  + '</label>');
                    content.push('<textarea name="' + self.values.element + '-text" id="' + self.values.element + '-text" class="form-control" rows="3" style="resize: none; width: 330px; float: left;"></textarea>');
                    content.push('</div>');

                    content.push('<div class="clearfix alert alert-info" role="alert" style="margin: 0 !important; padding: 7px !important; width: 475px;">');
                    content.push('<span data-i18n-id="control.parse.dialog.info">' +
                                 PublicaMundi.i18n.getResource('control.parse.dialog.info')  + '</label>');
                    content.push('</div>');

                    return content;
                }
            });

            this.values.dialog.on('dialog:close', function(args) {
                self.values.overlay.getFeatures().clear();
            });

            $('#' + this.values.element + '-crs').selectpicker().change(function () {
                $('[data-id="' + self.values.element + '-crs"]').blur();
            });

            $('#' + this.values.element + '-delimiter').selectpicker().change(function () {
                $('[data-id="' + self.values.element + '-delimiter"]').blur();
            });

            $('#' + this.values.element + '-type').selectpicker().change(function () {
                $('[data-id="' + self.values.element + '-type"]').blur();
            });

            this.values.dialog.on('dialog:action', function(args){
                switch(args.action){
                    case 'close':
                        self.values.overlay.getFeatures().clear();
                        this.hide();
                        break;
                    case 'parse':
                        var coordinates = _ParseCoordinates($('#' + self.values.element + '-crs').val(),
                                                            $('#' + self.values.element + '-delimiter').val(),
                                                            $('#' + self.values.element + '-text').val());

                        var initial = coordinates.initial, transformed = coordinates.transformed;
                        if(initial.length > 0) {
                            var bbox = null;
                            if(transformed.length > 1) {
                                bbox = [transformed[0][0], transformed[0][1], transformed[0][0], transformed[0][1]];
                                for(var c=1; c<transformed.length; c++) {
                                    bbox[0] = Math.min(bbox[0], transformed[c][0]);
                                    bbox[1] = Math.min(bbox[1], transformed[c][1]);
                                    bbox[2] = Math.max(bbox[2], transformed[c][0]);
                                    bbox[3] = Math.max(bbox[3], transformed[c][1]);
                                }
                            }

                            self.values.overlay.getFeatures().clear();
                            self.values.features = new ol.Collection;

                            var ring = []
                            for(var c=0; c<transformed.length; c++) {
                                ring.push(transformed[c]);

                                var point = new ol.geom.Point(transformed[c]);
                                var label = initial[c][0].toFixed(4) + ' , ' + initial[c][1].toFixed(4)

                                var feature = new ol.Feature({
                                    name: 'point-' + (c+1),
                                    label: label,
                                    geometry: point
                                });
                                self.values.features.push(feature);
                            }
                            var geom = new ol.geom.Polygon([ring]);

                            var feature = new ol.Feature({
                                name: 'polygo-',
                                label: '',
                                geometry: geom
                            });
                            self.values.features.push(feature);

                            self.values.overlay.setFeatures(self.values.features);

                            switch(transformed.length) {
                                case 0:
                                    break;
                                case 1:
                                    self.values.map.getView().setCenter(transformed[0]);
                                    self.values.map.getView().setZoom(17);
                                    break;
                                default:
                                    var view = self.values.map.getView();
                                    var size = self.values.map.getSize();

                                    view.fitExtent(bbox, size);
                                    break;
                            }
                        }
                        self.trigger('parse:completed', { sender : self, coordinates : coordinates});
                        break;
                }
            });

            this.render();
        },
        execute: function() {
			this.values.dialog.show();
		}
    });

    return PublicaMundi;
});
