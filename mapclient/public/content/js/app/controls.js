define(['module', 'jquery', 'ol', 'URIjs/URI', 'shared'], function (module, $, ol, URI, PublicaMundi) {
    "use strict";

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
				mode: PublicaMundi.Maps.LayerTreeViewMode.ByGroup,
				maxLayerCount: 5,
                bbox: null
			});
			
            if (typeof PublicaMundi.Maps.Component.prototype.initialize === 'function') {
                PublicaMundi.Maps.Component.prototype.initialize.apply(this, arguments);
            }

            this.values.contentElement = this.values.element + '-result';
            
			this.event('layer:added');
			this.event('layer:removed');
            
			this.event('bbox:draw');
            this.event('bbox:remove');
            this.event('bbox:apply');
            this.event('bbox:cancel');
            
            this.event('catalog:search');
            this.event('catalog:info');
            
			var sortByTitle = function(a, b) {
				if(a.title < b.title) {
					return -1;
				}
				if(a.title > b.title) {
					return 1;
				}
				return 0;
			};
			
			var sortByCaption = function(a, b) {
				if(a.caption < b.caption) {
					return -1;
				}
				if(a.caption > b.caption) {
					return 1;
				}
				return 0;
			};
			
			var sortByName = function(a, b) {
				if(a.name < b.name) {
					return -1;
				}
				if(a.name > b.name) {
					return 1;
				}
				return 0;
			};
			
			this.values.renderGroups = function() {
				$('#' + this.values.contentElement).html('');
				
				var content = [];
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

				groups.sort(sortByTitle);
				
                if((this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) && (groups.length === 0)) {
                    $('#' + this.values.element + '-result').hide();
                } else {
                    $('#' + this.values.element + '-result').show();
                }
                
				for(var i = 0; i < groups.length; i++) {
                    var caption = PublicaMundi.getResource('group.' + groups[i].title, groups[i].title);
                    
					content.push('<li class="tree-node"><div class="clearfix">');
					content.push('<div style="float: left;"><img id="' + groups[i].id + '_' + this.values.element + '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="group"/></div>');
					content.push('<div class="tree-text tree-text-1" data-i18n-id="group.' + groups[i].title + '">' + caption + '</div>');
                    if((groups[i].description) && (groups[i].title != groups[i].description)) {
                        content.push('<div class="tree-info" data-type="group" data-id="' + groups[i].id + '"><img src="content/images/info.png" class="img-16" /></div>');
                    }
					content.push('</div></li>');
				}
				$('#' + this.values.contentElement).append(content.join(''));
			};

			this.values.renderOrganizations = function() {
				$('#' + this.values.contentElement).html('');
				
				var content = [];
				var organizations = this.values.ckan.getOrganizations();
				
				organizations.sort(sortByCaption);
				
				for(var i = 0; i < organizations.length; i++) {
                    var caption = PublicaMundi.getResource('organization.' + organizations[i].caption, organizations[i].caption);
                    
					content.push('<li class="tree-node"><div class="clearfix">');
					content.push('<div style="float: left;"><img id="' + organizations[i].id + '_' + this.values.element +  '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="organization"/></div>');
					content.push('<div class="tree-text tree-text-1" data-i18n-id="organization.' + organizations[i].caption + '">' + caption + '</div>');
                    if((organizations[i].description) && (organizations[i].caption != organizations[i].description)) {
                        content.push('<div class="tree-info" data-type="organization" data-id="' + organizations[i].id + '"><img src="content/images/info.png" class="img-16" /></div>');
                    }
					content.push('</div></li>');
				}
				$('#' + this.values.contentElement).append(content.join(''));
			};
			
			var renderGroupOrganizations = function(element, id) {	
                var parts = id.split('_');
                var group_id = parts[0];
                
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
			
				group_organizations.sort(sortByCaption);
				
				var content = [];
				
				if(group_packages.length === 0) {
					$('#' + id).addClass('disabled');
					$('#' + id).attr('src', 'content/images/empty-node.png');
					$('#' + id).closest('li').find('.tree-text-2').first().addClass('tree-text-disabled');
				} else {						
					content.push('<ul class="tree-node" style="display: none;">');
					
					for(var i = 0; i < group_organizations.length; i++) {
                        var caption = PublicaMundi.getResource('organization.' + group_organizations[i].caption, group_organizations[i].caption);
                        
						content.push('<li class="tree-node">');
						content.push('<div class="clearfix">');
						content.push('<div style="float: left;"><img id="' + group_id + '_' + group_organizations[i].id + '_' + this.values.element +  '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="group_organization"/></div>');
						content.push('<div class="tree-text tree-text-2" data-i18n-id="organization.' + group_organizations[i].caption + '">' + caption + '</div>');
                        if((group_organizations[i].description) && (group_organizations[i].caption != group_organizations[i].description)) {
                            content.push('<div class="tree-info" data-type="organization" data-id="' + group_organizations[i].id + '"><img src="content/images/info.png" class="img-16" /></div>');
                        }
						content.push('</div>');				
						content.push('</li>');
					}
					content.push('</ul>');
					
					$(element).append(content.join(''));
				}
			}

			var renderOrganizationPackages = function(element, id) {
				var parts = id.split('_');
				var group_id = parts[0];
				var organization_id = parts[1];

				var packages = [], organization_packages = [];
                if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    packages = this.values.ckan.getFilteredPackages();
                } else {
                    packages = this.values.ckan.getPackages();
                }
				
				for(var p = 0; p < packages.length; p++) {
					if ((packages[p].organization === organization_id) && ($.inArray(group_id, packages[p].groups) !== -1)) {
						organization_packages.push(packages[p]);
					}
				}
			
				organization_packages.sort(sortByTitle);
				
				var content = [];
				
				if(organization_packages.length === 0) {
					$('#' + id).addClass('disabled');
					$('#' + id).attr('src', 'content/images/empty-node.png');
					$('#' + id).closest('li').find('.tree-text-2').first().addClass('tree-text-disabled');
				} else {						
					content.push('<ul class="tree-node" style="display: none;">');
					
					for(var j = 0; j < organization_packages.length; j++) {
						for(var r=0; r < organization_packages[j].resources.length; r++) {
							this.values.resources.setCatalogResourceMetadataOptions(organization_packages[j].resources[r]);
						}

						if((organization_packages[j].resources.length === 1) && 
						   (organization_packages[j].resources[0].metadata) && 
						   (!!organization_packages[j].resources[0].metadata.extras.layer)) {

							var resourceId = organization_packages[j].resources[0].id ;
							var layerId = resourceId + '_' + organization_packages[j].resources[0].metadata.extras.layer;
							var selected = this.values.resources.isLayerSelected(layerId);
                            
							content.push('<li class="tree-node tree-node-checkbox">');
							content.push('<div class="clearfix">');
							content.push('<div style="float: left;"><img id="' + group_id + '_' + 
                                                                                 organization_id + '_' + 
                                                                                 organization_packages[j].id + '_' + 
                                                                                 resourceId + '_' + 
                                                                                 this.values.element + '" src="' + (selected ? 'content/images/checked.png' : 'content/images/unchecked.png') + '" class="node-select img-16" data-selected="' + (selected ? 'true' : 'false') + '" data-type="layer" data-layer="' + layerId +'" /></div>');
							content.push('<div class="tree-text tree-text-3">' + organization_packages[j].title + '</div>');
                            if(organization_packages[j].notes) {
                                content.push('<div class="tree-info" data-type="package" data-id="' + organization_packages[j].id + '"><img src="content/images/info.png" class="img-16" /></div>');
                            }
							content.push('</div>');
							content.push('</li>');
						} else if(organization_packages[j].resources.length === 1) {
							var resourceId = organization_packages[j].resources[0].id ;
							
							content.push('<li class="tree-node">');
							content.push('<div class="clearfix">');
							content.push('<div style="float: left;"><img id="' + group_id + '_' +
                                                                                 organization_id + '_' +  
                                                                                 organization_packages[j].id + '_' + 
                                                                                 resourceId + '_' + 
                                                                                 this.values.element + '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="resource"/></div>');
							content.push('<div class="tree-text tree-text-3">' + organization_packages[j].title + '</div>');
                            if(organization_packages[j].notes) {
                                content.push('<div class="tree-info" data-type="package" data-id="' + organization_packages[j].id + '"><img src="content/images/info.png" class="img-16" /></div>');
                            }
							content.push('</div>');
							content.push('</li>');
					    } else {
							content.push('<li class="tree-node">');
							content.push('<div class="clearfix">');
							content.push('<div style="float: left;"><img id="' + group_id + '_' + 
                                                                                 organization_id + '_' +  
                                                                                 organization_packages[j].id + '_' +
                                                                                 this.values.element + '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="package"/></div>');
							content.push('<div class="tree-text tree-text-3">' + organization_packages[j].title + '</div>');
                            if(organization_packages[j].notes) {
                                content.push('<div class="tree-info" data-type="package" data-id="' + organization_packages[j].id + '"><img src="content/images/info.png" class="img-16" /></div>');
                            }
							content.push('</div>');
							content.push('</li>');
						}
					}
					content.push('</ul>');
					
					$(element).append(content.join(''));
				}
			}
			
			var renderOrganizationGroups = function(element, id) {
                var parts = id.split('_');
                var organization_id = parts[0];
                
				var groups = this.values.ckan.getGroups(), packages = [], organization_groups = [], organization_packages = [];
                if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    packages = this.values.ckan.getFilteredPackages();
                } else {
                    packages = this.values.ckan.getPackages();
                }
				
				for(var p = 0; p < packages.length; p++) {
					if (organization_id === packages[p].organization) {					
						organization_packages.push(packages[p]);
					
						for(var g = 0; g < packages[p].groups.length; g++) {
							var index = this.values.ckan.getIndexOfGroup(packages[p].groups[g]);

							var exists = false;
							if(index !== -1) {
								for(var o = 0; o < organization_groups.length; o++) {
									if(organization_groups[o].id === packages[p].groups[g]) {
										exists = true;
										break;
									}
								}
								if(!exists) {
									organization_groups.push(groups[index]);
								}
							}
						}
					}
				}
			
				organization_groups.sort(sortByTitle);
				
				var content = [];
				
				if(organization_packages.length === 0) {
					$('#' + id).addClass('disabled');
					$('#' + id).attr('src', 'content/images/empty-node.png');
					$('#' + id).closest('li').find('.tree-text-2').first().addClass('tree-text-disabled');
				} else {
					content.push('<ul class="tree-node" style="display: none;">');
					
					for(var i = 0; i < organization_groups.length; i++) {
                        var caption = PublicaMundi.getResource('group.' + organization_groups[i].title, organization_groups[i].title);
                        
						content.push('<li class="tree-node">');
						content.push('<div class="clearfix">');
						content.push('<div style="float: left;"><img id="' + organization_groups[i].id + '_' + organization_id + '_' + this.values.element + '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="organization_group"/></div>');
						content.push('<div class="tree-text tree-text-2" data-i18n-id="group.' + organization_groups[i].title + '">' + caption + '</div>');
                        if((organization_groups[i].description) & (organization_groups[i].title != organization_groups[i].description)) {
                            content.push('<div class="tree-info" data-type="group" data-id="' + organization_groups[i].id + '"><img src="content/images/info.png" class="img-16" /></div>');
                        }
						content.push('</div>');
						content.push('</li>');
					}
					content.push('</ul>');
					
					$(element).append(content.join(''));
				}
			}
					
			var renderGroupPackages = function(element, id) {
				var parts = id.split('_');
				var group_id = parts[0];
				var organization_id = parts[1];
                
				var packages = [], group_packages = [];
                if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    packages = this.values.ckan.getFilteredPackages();
                } else {
                    packages = this.values.ckan.getPackages();
                }
                
				for(var p = 0; p < packages.length; p++) {
					if ((packages[p].organization === organization_id) && ($.inArray(group_id, packages[p].groups) !== -1)) {
						group_packages.push(packages[p]);
					}
				}
			
				group_packages.sort(sortByTitle);
				
				var content = [];
				
				if(group_packages.length === 0) {
					$('#' + id).addClass('disabled');
					$('#' + id).attr('src', 'content/images/empty-node.png');
					$('#' + id).closest('li').find('.tree-text-2').first().addClass('tree-text-disabled');
				} else {						
					content.push('<ul class="tree-node" style="display: none;">');
					
					for(var j = 0; j < group_packages.length; j++) {
						for(var r=0; r < group_packages[j].resources.length; r++) {
							this.values.resources.setCatalogResourceMetadataOptions(group_packages[j].resources[r]);
						}

						if((group_packages[j].resources.length === 1) && 
						   (group_packages[j].resources[0].metadata) && 
						   (!!group_packages[j].resources[0].metadata.extras.layer)) {
							   
							var resourceId = group_packages[j].resources[0].id ;
							var layerId = resourceId + '_' + group_packages[j].resources[0].metadata.extras.layer;
                            var selected = this.values.resources.isLayerSelected(layerId);
							
							content.push('<li class="tree-node tree-node-checkbox">');
							content.push('<div class="clearfix">');
							content.push('<div style="float: left;"><img id="' + group_id + '_' + 
                                                                                 organization_id + '_' +
                                                                                 group_packages[j].id + '_' + 
                                                                                 resourceId + '_' + 
                                                                                 this.values.element + '" src="' + (selected ? 'content/images/checked.png' : 'content/images/unchecked.png') + '" class="node-select img-16" data-selected="' + (selected ? 'true' : 'false') + '" data-type="layer" data-layer="' + layerId +'" /></div>');
							content.push('<div class="tree-text tree-text-3">' + group_packages[j].title + '</div>');
                            if(group_packages[j].notes) {
                                content.push('<div class="tree-info" data-type="package" data-id="' + group_packages[j].id + '"><img src="content/images/info.png" class="img-16" /></div>');
                            }
							content.push('</div>');
							content.push('</li>');
						} else if(group_packages[j].resources.length === 1) {
							var resourceId = group_packages[j].resources[0].id ;
							
							content.push('<li class="tree-node">');
							content.push('<div class="clearfix">');
							content.push('<div style="float: left;"><img id="' + group_id + '_' + 
                                                                                 organization_id + '_' +
                                                                                 group_packages[j].id + '_' + 
                                                                                 resourceId + '_' + 
                                                                                 this.values.element + '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="resource"/></div>');
							content.push('<div class="tree-text tree-text-3">' + group_packages[j].title + '</div>');
                            if(group_packages[j].notes) {
                                content.push('<div class="tree-info" data-type="package" data-id="' + group_packages[j].id + '"><img src="content/images/info.png" class="img-16" /></div>');
                            }
							content.push('</div>');
							content.push('</li>');
					    } else {
							content.push('<li class="tree-node">');
							content.push('<div class="clearfix">');
							content.push('<div style="float: left;"><img id="' + group_id + '_' + 
                                                                                 organization_id + '_' +
                                                                                 group_packages[j].id + '_' +
                                                                                 this.values.element + '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="package"/></div>');
							content.push('<div class="tree-text tree-text-3">' + group_packages[j].title + '</div>');
                            if(group_packages[j].notes) {
                                content.push('<div class="tree-info" data-type="package" data-id="' + group_packages[j].id + '"><img src="content/images/info.png" class="img-16" /></div>');
                            }
							content.push('</div>');
							content.push('</li>');
						}
					}
					content.push('</ul>');
					
					$(element).append(content.join(''));
				}
			}
			
			var renderPackageResources = function(element, id) {
				var parts = id.split('_');
                var group_id = parts[0];
                var organization_id = parts[1];
				var package_id = parts[2];

				var _package = this.values.ckan.getPackageById(package_id);

				_package.resources.sort(sortByName);
				
				var content = [];

				content.push('<ul class="tree-node" style="display: none;">');
				
				for(var i = 0; i < _package.resources.length; i++) {
					var resource = _package.resources[i];

					if(!!resource.metadata.extras.layer) {
						   
						var layerId = resource.id + '_' + resource.metadata.extras.layer;
						var selected = this.values.resources.isLayerSelected(layerId);
                        
						content.push('<li class="tree-node tree-node-checkbox">');
						content.push('<div class="clearfix">');
						content.push('<div style="float: left;"><img id="' + group_id + '_' +
                                                                             organization_id + '_' +
                                                                             package_id + '_' +
                                                                             resource.id + '_' + 
                                                                             this.values.element + '" src="' + (selected ? 'content/images/checked.png' : 'content/images/unchecked.png') + '" class="node-select img-16" data-selected="' + (selected ? 'true' : 'false') + '" data-type="layer" data-layer="' + layerId +'" /></div>');
						content.push('<div class="tree-text tree-text-4">' + resource.name + '</div>');
						content.push('</div>');
						content.push('</li>');
					} else {
						content.push('<li class="tree-node">');
						content.push('<div class="clearfix">');
						content.push('<div style="float: left;"><img id="' + group_id + '_' +
                                                                             organization_id + '_' +
                                                                             package_id + '_' +
                                                                             resource.id + '_' + 
                                                                             this.values.element + '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="resource"/></div>');
						content.push('<div class="tree-text tree-text-4">' + resource.name + '</div>');
						content.push('</div>');
						content.push('</li>');
					}
				}
				content.push('</ul>');
				
				$(element).append(content.join(''));
			}
			
			var renderResourceLayers = function(element, id, layers) {
				var parts = id.split('_');
                var group_id = parts[0];
                var organization_id = parts[1];
				var package_id = parts[2];
				var resource_id = parts[3];
								
				var resource = this.values.ckan.getResourceById(resource_id);

				var content = [];

				content.push('<ul class="tree-node" style="display: none;">');
				
				for(var i = 0; i < layers.length; i++) {
					var layerId = resource_id + '_' + layers[i].name;
                    var selected = this.values.resources.isLayerSelected(layerId);
						
					content.push('<li class="tree-node tree-node-checkbox">');
					content.push('<div class="clearfix">');
					content.push('<div style="float: left;"><img id="' + group_id + '_' +
                                                                         organization_id + '_' +
                                                                         package_id + '_' +
                                                                         resource_id + '_' + 
                                                                         layers[i].key + '_' + 
                                                                         this.values.element + '" src="' + (selected ? 'content/images/checked.png' : 'content/images/unchecked.png') + '" class="node-select img-16" data-selected="' + (selected ? 'true' : 'false') + '" data-type="layer" data-layer="' + layerId +'" /></div>');
					content.push('<div class="tree-text tree-text-4">' + layers[i].title + '</div>');
					content.push('</div>');
					content.push('</li>');

				}
				content.push('</ul>');
				
				$(element).append(content.join(''));
			}
            
			$('#' + this.values.element).on('click.' + this.values.contentElement, '.tree-toggle', function() {
				var element = this;
							
				var id = $(this).attr('id');
				var type = $(this).data('type');

                var parts = id.split('_');
                
				if($(this).hasClass('disabled')) {
					return;
				}
				if($(this).data('expanded')) {
					$(this).data('expanded', false);
					$(this).addClass('tree-node-collapse');
					$('#' + id).closest('li').find('ul').first().fadeOut(250);
				} else if(!$(this).data('loading')) {
					if($(this).data('loaded')) {
						$(this).data('expanded', true);
						$(this).removeClass('tree-node-collapse');
						$('#' + id).closest('li').find('ul').first().fadeIn(250);
					} else {
						if(type === 'group') {
							self.values.ckan.loadGroupById(parts[0]).then(function(group) {
								renderGroupOrganizations.call(self, $('#' + id).closest('li'), id);
								$(element).data('loaded', true);
								$(element).data('expanded', true);
								$(element).removeClass('tree-node-collapse');
								$('#' + id).closest('li').find('ul').first().fadeIn(250);
							});							
						} else if (type === 'organization') {
							self.values.ckan.loadOrganizationById(parts[0]).then(function(organization) {
								renderOrganizationGroups.call(self, $('#' + id).closest('li'), id);
								$(element).data('loaded', true);
								$(element).data('expanded', true);
								$(element).removeClass('tree-node-collapse');
								$('#' + id).closest('li').find('ul').first().fadeIn(250);
							});
						} else if (type === 'group_organization') {
								renderOrganizationPackages.call(self, $('#' + id).closest('li'), id);
								$(element).data('loaded', true);
								$(element).data('expanded', true);
								$(element).removeClass('tree-node-collapse');
								$('#' + id).closest('li').find('ul').first().fadeIn(250);							
						} else if (type === 'organization_group') {
								renderGroupPackages.call(self, $('#' + id).closest('li'), id);
								$(element).data('loaded', true);
								$(element).data('expanded', true);
								$(element).removeClass('tree-node-collapse');
								$('#' + id).closest('li').find('ul').first().fadeIn(250);							
						} else if (type === 'package') {
								renderPackageResources.call(self, $('#' + id).closest('li'), id);
								$(element).data('loaded', true);
								$(element).data('expanded', true);
								$(element).removeClass('tree-node-collapse');
								$('#' + id).closest('li').find('ul').first().fadeIn(250);							
						} else if (type === 'resource') {
								var parts = id.split('_');
								var resource_id = parts[3];

								var resource = self.values.ckan.getResourceById(resource_id);

								$(this).attr('src', 'content/images/ajax-loader.gif');
								$(this).addClass('tree-node-ajax-loader');
								$(this).data('loading', true)
                                
                                self.values.resources.setCatalogResourceMetadataOptions(resource);
                                
								self.values.resources.getResourceMetadata(resource.metadata.type, resource.metadata.parameters).then(function(metadata) {
									$(element).attr('src', 'content/images/expand-arrow.png');
									$(element).removeClass('tree-node-ajax-loader');
									
									renderResourceLayers.call(self, $('#' + id).closest('li'), id, metadata.layers);
									
									$(element).data('loaded', true);
									$(element).data('expanded', true);
									$(element).data('loading', false);
									$(element).removeClass('tree-node-collapse');
									$('#' + id).closest('li').find('ul').first().fadeIn(250);
								});
						}
					}
				}
			});
			
			$('#' + this.values.element).on('click.' + this.values.contentElement, '.node-select', function() {
				var id = $(this).data('layer');

				if($(this).data('selected')) {
					self.remove(id);
				} else {
					self.add(id);											
				}
			});
		
            $('#' + this.values.element).on('click.' + this.values.contentElement, '.tree-info', function() {
                var id = $(this).data('id');
                var type = $(this).data('type');
                
                var data = null;
                
                switch(type) {
                    case 'group':
                        data = self.values.ckan.getGroupById(id);
                        break;
                    case 'organization':
                        data = self.values.ckan.getOrganizationById(id);
                        break;
                    case 'package':
						data = self.values.ckan.getPackageById(id);   
                        break;
                        
                }
                if(data) {
                    self.trigger('catalog:info', { sender: self, type : type, data : data });
                }
            });
            
            if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                $('#' + this.values.element).on('click.' + this.values.element, '#' + this.values.element + '-box-draw-btn', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

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

                    $('#' + self.values.element  +'-box-apply').hide();
                    $('#' + self.values.element  +'-box-cancel').hide();
                    $('#' + self.values.element  +'-box-draw').show();
                    if(self.values.bbox) {
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
                    if(self.values.bbox) {
                        var geom = self.values.bbox.getGeometry().clone();

                        geom.transform('EPSG:3857', 'EPSG:4326');

                        bbox = geom.getExtent();
                    }
                    self.values.ckan.search($('#' + self.values.element + '-text').val(), bbox).then(function(packages){
                        self.refresh();
                        self.trigger('catalog:search', { packages : packages });
                    });
                    
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
                this.values.bbox = bbox;
            } else {                
                this.values.bbox = null;
                $('#' + this.values.element  +'-box-remove').hide();
            }
        },
        getQueryBoundingBox: function() {
            return this.values.bbox;
        },
        add: function(id) {
			var self = this;
			var parts = id.split('_');
							
			if((parts.length > 1) && (!$('[data-layer="' + id +'"]').first().data('loading'))) {
                var resource = self.values.ckan.getResourceById(parts[0]);

				var layer = parts.splice(1).join('_');
						
				if(this.values.resources.getLayerCount() < this.values.maxLayerCount) {
					$('[data-layer="' + id +'"]').data('loading', true)
					$('[data-layer="' + id +'"]').attr('src', 'content/images/ajax-loader.gif');
					$('[data-layer="' + id +'"]').addClass('tree-node-ajax-loader');
							
					this.values.resources.setCatalogResourceMetadataOptions(resource);

					this.values.resources.getResourceMetadata(resource.metadata.type, resource.metadata.parameters).then(function(metadata) {
						$('[data-layer="' + id +'"]').data('loading', false)
						$('[data-layer="' + id +'"]').removeClass('tree-node-ajax-loader');
						$('[data-layer="' + id +'"]').data('selected', true);
						$('[data-layer="' + id +'"]').attr('src', 'content/images/checked.png');

						self.values.resources.createLayer(self.values.map, metadata, id);
					
						self.trigger('layer:added', {id: id});
					});	
				}
			}
		},
		remove: function(id) {
			var parts = id.split('_');
				
			if(parts.length > 1) {
				if($('[data-layer="' + id +'"]').size() > 0) {
					if(($('[data-layer="' + id +'"]').first().data('loading')) || (!$('[data-layer="' + id +'"]').data('selected'))) {
						return;
					}

					$('[data-layer="' + id +'"]').data('selected', false);
					$('[data-layer="' + id +'"]').attr('src', 'content/images/unchecked.png');
				}
				if(this.values.resources.destroyLayer(this.values.map, id)) {
					this.trigger('layer:removed', { id: id});
				}
			}
		},
        render: function() {
            var content = [];
            
            if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                if($('#' + this.values.element + '-result').size() === 1) {
                    $('#' + this.values.element + '-result').html('');
                } else {
                    $('#' + this.values.element).html('');

                    content.push('<div class="clearfix" id="' + this.values.element + '-form" style="padding: 8px 0px 0px 5px; position: absolute;">');
                    
                    content.push('<form class="form-horizontal">');
                    
                    content.push('<div class="form-group">');
                    content.push('<div style="float: left; padding-left: 15px; width: 19em;">');
                    content.push('<input id="' + this.values.element + '-text" placeholder="' + PublicaMundi.getResource('control.tree.search.prompt') + 
                                 '" data-i18n-id="control.tree.search.prompt" data-i18n-type="attribute" data-i18n-name="placeholder" class="form-control input-md" type="text">');
                    content.push('</div>');
                    content.push('</div>');

                    
                    content.push('<div class="clearfix">');
                    content.push('<div style="float: left; padding-right: 10px;"  id="' + this.values.element + '-box-draw">');
                    content.push('<a id="' + this.values.element + '-box-draw-btn" class="btn btn-primary" data-placement="bottom" data-i18n-id="control.tree.search.button.draw" ' + 
                                 'data-i18n-type="title" title="' + PublicaMundi.getResource('control.tree.search.button.draw') + '"><img src="content/images/edit-w.png" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div style="float: left; padding-right: 10px; display: none;" id="' + this.values.element + '-box-remove">');
                    content.push('<a id="' + this.values.element + '-box-remove-btn" class="btn btn-danger" data-placement="bottom" data-i18n-id="control.tree.search.button.remove" data-i18n-type="title" title="' + PublicaMundi.getResource('control.tree.search.button.remove') + '"><img src="content/images/trash-w.png" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div style="float: left; padding-right: 10px; display: none;" id="' + this.values.element + '-box-apply">');
                    content.push('<a id="' + this.values.element + '-box-apply-btn" class="btn btn-success" data-placement="bottom" data-i18n-id="control.tree.search.button.apply" data-i18n-type="title" title="' + PublicaMundi.getResource('control.tree.search.button.apply') + '"><img src="content/images/apply-w.png" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div style="float: left; padding-right: 10px; display: none;" id="' + this.values.element + '-box-cancel">');
                    content.push('<a id="' + this.values.element + '-box-cancel-btn" class="btn btn-danger" data-placement="bottom" data-i18n-id="control.tree.search.button.discard" data-i18n-type="title" title="' + PublicaMundi.getResource('control.tree.search.button.discard') + '"><img src="content/images/trash-w.png" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div style="float: left; padding-right: 10px;" id="' + this.values.element + '-search">');
                    content.push('<a id="' + this.values.element + '-search-btn" class="btn btn-primary" data-placement="bottom" data-i18n-id="control.tree.search.button.search" data-i18n-type="title" title="' + PublicaMundi.getResource('control.tree.search.button.search') + '"><img src="content/images/search-w.png" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('</div>');

                    content.push('</form>');
                    
                    content.push('</div>');
                    
                    content.push('<div id="' + this.values.element + '-result" class="clearfix layer-tree-search-result">');
                    content.push('</div>');
                    
                    $('#' + this.values.element).html(content.join(''));
                    $('#' + this.values.element).find('a').tooltip();
                }
            } else {
                $('#' + this.values.element).html('');
                
                content.push('<div class="clearfix" id="' + this.values.element + '-result">');
                content.push('</div>');
                
                $('#' + this.values.element).html(content.join(''));
            }
                            
			if (this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByGroup) {
				this.values.renderGroups.call(this);
			} else if (this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByOrganization) {
				this.values.renderOrganizations.call(this);
			} else {
                this.values.renderGroups.call(this);
            }
        },
        show: function() {
            PublicaMundi.Maps.Component.prototype.show.apply(this);
            if (this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                $('#' + this.values.element + '-text').focus();
            }
        }
    });
    
    var _LayerSelectionAddItem = function(id, title, legend) {
		var self = this;
		
		var content = [];
		var safeId = id.replace(/[^\w\s]/gi, '');
		
		content.push('<div data-id="' + id + '" class="clearfix selected-layer">');
		
		content.push('<div style="float: left; width: 24px;">');
		if(legend) {
			content.push('<img id="' + safeId + '-legend-img" src="' + legend + '" alt="" class="legend" />');
		} else {
			content.push('&nbsp;');
		}
		content.push('</div>');
		
		content.push('<div style="float: left;">');
		
		content.push('<div class="clearfix" style="padding-bottom: 3px;">');
		content.push('<div class="selected-layer-close"><img src="content/images/close.png" class="action img-16" data-action="remove"  /></div>');
		content.push('<div class="selected-layer-text">' + title + '</div>');
		content.push('<div class="selected-layer-up"><img src="content/images/up.png" class="action img-16 action-disabled" data-action="up"  /></div>');
		content.push('</div>');
		
		content.push('<div class="clearfix">');
		content.push('<div class="selected-layer-opacity-label" data-i18n-id="index.title.layer-opacity" data-i18n-type="title" title="' + PublicaMundi.getResource('index.title.layer-opacity') + '" ><img src="content/images/opacity.png" class="img-16" /></div>');
		content.push('<div class="selected-layer-opacity-slider"><input type="range" name="points" min="0" max="100" value="100"></div>');
		content.push('<div class="selected-layer-down"><img src="content/images/down.png" class="action img-16 action-disabled" data-action="down"  /></div>');
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
	
    PublicaMundi.Maps.LayerSelection = PublicaMundi.Class(PublicaMundi.Maps.Component, {
        initialize: function (options) {
			var self = this;
			
			PublicaMundi.extend(this.values, {
				map: null,
				ckan : null,
				resources: null,
				maxLayerCount: 5
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
			if(this.values.resources.getLayerCount() >= this.values.maxLayerCount) {
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
					// Override title with package / resource
					if((_package.resources.length === 1) && 
					   (_package.resources[0].metadata) && 
					   (!!_package.resources[0].metadata.extras.layer)) {
						title = _package.title
					} else if(!!_resource.metadata.extras.layer) {
						title = _resource.name;
					}
							   
					_LayerSelectionAddItem.call(self, id, title, legend);				
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
			
			this.trigger('layer:removed', { id: id });
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
        setActive: function(active) {
            this.values.active = active && this.values.enabled;
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
            
            var content = [];
            content.push('<a data-action="' + this.values.name + '" class="tool-toggle btn btn-default" data-i18n-id="' + this.values.title + '" data-i18n-type="title" title="' + ( PublicaMundi.getResource(this.values.title) || '') + '">');
            content.push('<img class="img-20" src="' + (this.values.active ? this.values.images.enabled : this.values.images.disabled ) + '">');
            content.push('</a>');
            
            $('#' + this.values.element).html(content.join(''));
            
            $('#' + this.values.element).find('a').tooltip();
            
            $('#' + this.values.element).find('a').click(function() {
                self.setActive(!self.values.active);
                self.trigger('tool:toggle', { name : self.values.name, active : self.getActive() });
            });
            
            if(!this.values.visible) {
                $('#' + this.values.element).hide();
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
                query.export(_DownloadExportFile, files, this);
            }
        }
    };
    
    var _DownloadExportFile = function(data, execution) {
        this.values.action.resumeUI();

        if(data.success) {
            jQuery('#export-download-frame').remove();
            jQuery('body').append('<div id="export-download-frame" style="display: none"><iframe src="' + this.values.endpoint + 'api/download?code=' + data.code + '"></iframe></div>');
        }
    }
    
    PublicaMundi.Maps.ExportTool = PublicaMundi.Class(PublicaMundi.Maps.Tool, {
        initialize: function (options) {
			var self = this;

            this.values.map = null;

            if (typeof PublicaMundi.Maps.Tool.prototype.initialize === 'function') {
                PublicaMundi.Maps.Tool.prototype.initialize.apply(this, arguments);
            }

            this.event('feature:change');

            this.values.overlay = null;
            this.values.interaction = null;            
            this.values.feature = null;
            
            this.values.crs = PublicaMundi.Maps.CRS.Mercator;
            
            this.values.query = new PublicaMundi.Data.Query(this.values.endpoint);
            
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
                                 PublicaMundi.getResource('control.export.dialog.label.crs')  + '</label>');
                    content.push('<select name="' + self.values.element + '-crs" id="' + self.values.element + '-crs" class="selectpicker" data-width="160px">');
                    content.push('<option value="EPSG:3857">Web Mercator</option>');
                    content.push('<option value="EPSG:4326">WGS84</option>');
                    content.push('<option value="EPSG:2100" selected="selected">ΕΓΣΑ87</option>');
                    content.push('<option value="EPSG:4258">ETRS89</option>');
                    content.push('</select>');
                    content.push('</div>');

                    content.push('<div class="clearfix">');
                    content.push('<label for="' + self.values.element + '-format" style="padding-right: 10px; width: 145px;" data-i18n-id="control.export.dialog.label.format">' + 
                                 PublicaMundi.getResource('control.export.dialog.label.format') + '</label>');
                    content.push('<select name="' + self.values.element + '-format" id="' + self.values.element + '-format" class="selectpicker" data-width="250px">');
                    content.push('<option value="ESRI Shapefile" selected="selected">ESRI Shapefile</option>');
                    content.push('<option value="GML">GML</option>');
                    content.push('<option value="KML">KML</option>');
                    content.push('<option value="GPKG">Geo Package</option>');
                    content.push('<option value="DXF">AutoCAD DXF</option>');
                    content.push('<option value="CSV">Comma Separated Value</option>');
                    content.push('<option value="GeoJSON">GeoJSON</option>');
                    content.push('<option value="PDF">Geospatial PDF</option>');
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
        this.clearFeatureFocus();
        this.values.overlay.getFeatures().clear();
        this.values.features = new ol.Collection();
                
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
            
            query.execute(function(response) {
                if(response.success) {
                    var format = new ol.format.GeoJSON();
                    
                    for(var i=0; i< response.data.length; i++) {
                        if(response.data[i].features.length > 0) {
                            // Make feature id unique
                            for(var j=0; j < response.data[i].features.length; j++) {
                                response.data[i].features[j].id = id;
                                id++;
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
            }, this);
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
                buffer: 3
			});
            
            if (typeof PublicaMundi.Maps.Tool.prototype.initialize === 'function') {
                PublicaMundi.Maps.Tool.prototype.initialize.apply(this, arguments);
            }

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
            content.push('<div style="float: left;" data-i18n-id="tool.select.dialog.title">' + PublicaMundi.getResource('tool.select.dialog.title') + '</div>');
            if(features.length > 1) {
                content.push('<div style="float: right;"><img id="' + this.values.element + '-next" class="img-12" src="content/images/right.png"></div>');
                content.push('<div style="float: right; font-size: 0.9em; padding-top: 2px;">' + (index + 1 ) + '</div>');
                content.push('<div style="float: right;"><img id="' + this.values.element + '-prev" class="img-12" src="content/images/left.png"></div>');
            }
            content.push('</div>');
            content.push('<div class="popover-content">');
            
            content.push('<div style="max-height: 190px; overflow: auto;"><div class="feature-table"><table style="width: 100%;">');
            var keys = feature.getKeys();
            for (var i = 0; i < keys.length; i++) {
                if (keys[i] != feature.getGeometryName()) {
                    content.push('<tr class="feature-row"><td class="feature-prop-key">' + keys[i] + '</td><td class="feature-prop-value">' + 
                    (feature.get(keys[i]) ? feature.get(keys[i]) : '') + '</td></tr>');
                }
            }
            content.push('</div></table></div>')
            
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
            
            var element = $('#' + this.values.element + '-popup');
            this.values.tooltip = new ol.Overlay({
                element: element[0],
                offset: [-element.outerWidth() / 2, -element.outerHeight()],
                positioning: 'bottom-center'
            });
            
            this.values.map.addOverlay(this.values.tooltip);
            
            var c1, c2, center;
            if (geom instanceof ol.geom.Polygon) {
                center = geom.getInteriorPoint().getCoordinates();
            } else if (geom instanceof ol.geom.Point) {
                center = geom.getCoordinates();
            } else {
                var coords = geom.getCoordinates();
                var middle= Math.floor(coords.length / 2);

                center = [0, 0];                    
                c1 = coords[middle-1];
                c2 = coords[middle];

                center[0] = (c2[0] + c1[0]) / 2.0;
                center[1] = (c2[1] + c1[1]) / 2.0;
            }

            this.values.tooltip.setPosition(center);
            this.values.map.getView().setCenter(center);

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
        }
    });

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
            
			var nominatim = new Bloodhound({
				datumTokenizer: Bloodhound.tokenizers.obj.whitespace('display_name'),
				queryTokenizer: Bloodhound.tokenizers.whitespace,
				remote: {
					url: this.values.endpoint + '?q=%QUERY&format=jsonv2&polygon_geojson=1&addressdetails=1&accept-language=' + members.i18n.locale + '&countrycodes=gr&limit=10',
					wildcard: '%QUERY'
				}
			});

			var addTooltip = function(selection) {
				self.removeTooltip();
			   
			   if((selection) && (selection.geojson)) {
					self.values.selection = selection;
					
				    var drawFeature = false;
				    var extent = null;

					var format = new ol.format.GeoJSON();
					var geom = format.readGeometry(selection.geojson, {
						dataProjection: PublicaMundi.Maps.CRS.WGS84,
						featureProjection: PublicaMundi.Maps.CRS.Mercator
					});
					self.values.feature = new ol.Feature({ name: 'selection', geometry: geom });
					
					var c1, c2, center, zoom;
					if (geom instanceof ol.geom.Polygon) {
						drawFeature = true;

						center = geom.getInteriorPoint().getCoordinates();
						extent = geom.getExtent();
					} else if (geom instanceof ol.geom.MultiPolygon) {
						drawFeature = true;
												
						center = geom.getInteriorPoints().getFirstCoordinate();
						extent = geom.getExtent();
					} else if (geom instanceof ol.geom.Point) {
						center = geom.getCoordinates();
					} else {
						var singleGeom = geom;
						if(geom instanceof ol.geom.MultiLineString) {
							drawFeature = true;
							
							var middle= Math.floor(geom.getLineStrings().length / 2);
							singleGeom = geom.getLineString(middle);
							
							extent = geom.getExtent();
						}
						
						drawFeature = true;
						
						var coords = singleGeom.getCoordinates();
						var middle= Math.floor(coords.length / 2);

						center = [0, 0];                    
						c1 = coords[middle-1];
						c2 = coords[middle];

						center[0] = (c2[0] + c1[0]) / 2.0;
						center[1] = (c2[1] + c1[1]) / 2.0;
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
					content.push('<table style="width: 100%;"><tr class=""><td class="text-search tooltip-prop-value">' + selection.display_name + '</td></tr></table>');
					content.push('</div></div>');

					content.push('</div>');
					
					content.push('</div>');
					
					$('body').append(content.join(''));
								
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

				if(selection) {
					addTooltip(selection);

					self.trigger('selection:changed', { selection : selection });
				}
			};
			
			$('#' + this.values.element).typeahead({
				hint: true,
				highlight: true,
				minLength: 3
			}, {
				name: 'nominatim-search',
				display: 'display_name',
				source: nominatim
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
					     '" data-i18n-type="title" title="' + ( PublicaMundi.getResource(this.values.title) || '') + '">');
            content.push('<img class="img-20" src="' + this.values.image + '">');
            content.push('</a>');
            
            $('#' + this.values.element).addClass('tool-wapper-action').html(content.join(''));
            
            $('#' + this.values.element).find('a').tooltip();
            
            $('#' + this.values.element).find('a').click(function() {
                if(typeof self.execute === 'function') {
                    self.execute();
                } else {
                    self.trigger('action:execute', { name : self.values.name });
                }
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

	var _zIndex = 2000;
	
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
            content.push('<h4 class="modal-title" data-i18n-id="' + this.values.title + '">' + PublicaMundi.getResource(this.values.title) + '</h4>');
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
                                 '">' + PublicaMundi.getResource(this.values.buttons[action].text) + '</button>');
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
        show: function() {
            PublicaMundi.Maps.Component.prototype.show.apply(this, arguments);
            
            if(!this.values.positionInitialized) {
                this.values.positionInitialized = true;
                this.moveToCenter();
            }
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
					$('#' + self.values.element + '-error').append('<div class="alert alert-danger" role="alert" data-i18n-id="action.import-wms.error.metadata">' + PublicaMundi.getResource('action.import-wms.error.metadata') + '</div>');
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
                                 PublicaMundi.getResource('control.upload.dialog.label.title') + '</label>');
                    content.push('<input id="' + self.values.element + '-title" class="form-control input-md" type="text" style="width: 250px;">');
                    content.push('</div>');
                    
                    content.push('<div class="clearfix" style="padding-bottom: 10px;">');
                    content.push('<label for="' + self.values.element + '-format" style="padding-right: 10px; width: 145px;" data-i18n-id="control.upload.dialog.label.format">' + 
                                 PublicaMundi.getResource('control.upload.dialog.label.format') + '</label>');
                    content.push('<select name="' + self.values.element + '-format" id="' + self.values.element + '-format" autocomplete="off" class="selectpicker" data-width="250px">');
                    content.push('<option value="gml">GML</option>');
                    content.push('<option value="kml" selected>KML</option>');
                    content.push('<option value="zip">ESRI Shapefile (compressed file)</option>');
                    content.push('<option value="geojson">GeoJSON</option>');
                    content.push('</select>');
                    content.push('</div>');

                    content.push('<div class="clearfix" style="padding-bottom: 10px;">');
                    content.push('<label for="' + self.values.element + '-crs" style="padding-right: 10px; width: 145px;" data-i18n-id="control.upload.dialog.label.crs">' + 
                                 PublicaMundi.getResource('control.upload.dialog.label.crs')  + '</label>');
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
                    content.push('<span data-i18n-id="action.upload-resource.select-file" style="padding-left: 10px;">' + PublicaMundi.getResource('action.upload-resource.select-file') + '</span>');
                    content.push('<input id="' + self.values.element + '-fileupload" type="file" name="files[]" multiple>');
                    content.push('</span>');

                    return content;
                }
            });


            $('#' + this.values.element + '-format').selectpicker().change(function () {
                $('[data-id="' + self.values.element + '-format"]').blur();
                
                if($('#' + self.values.element + '-format').val() == 'kml') {
                    $('#' + self.values.element + '-crs').val('EPSG:4326').prop('disabled',true).selectpicker('refresh');
                } else {
                    $('#' + self.values.element + '-crs').prop('disabled',false).selectpicker('refresh');
                }
            });

            $('#' + this.values.element + '-crs').selectpicker().change(function () {
                $('[data-id="' + self.values.element + '-crs"]').blur();
                if(($('#' + self.values.element + '-format').val() == 'kml') &&
                   ($('#' + self.values.element + '-crs').val() != 'EPSG:4326')) {
                    $('#' + self.values.element + '-crs').val('EPSG:4326').selectpicker('refresh');
                }
            });
            
            $('#' + this.values.element + '-fileupload').fileupload({
                url: this.values.endpoint + '/upload/upload_resource',
                dataType: 'json',
                done: function (e, data) {
                    $.each(data.result.files, function (index, file) {
                        if(file.error) {
                            switch(file.error) {
                                case 'minFileSize': case 'maxFileSize': case 'acceptFileTypes': case 'invalidContent': case 'conversionFailed':
                                case 'crsNotSupported':
                                    $('#' + self.values.element + '-error').html('').append('<div class="alert alert-danger" role="alert" data-i18n-id="action.upload-resource.error.' + + file.error + '">' + 
                                                                                            PublicaMundi.getResource('action.upload-resource.error.' + file.error) + '</div>');
                                    break;
                                default:
                                    $('#' + self.values.element + '-error').html('').append('<div class="alert alert-danger" role="alert" data-i18n-id="action.upload-resource.error.unknown">' + 
                                                                                            PublicaMundi.getResource('action.upload-resource.error.unknown') + '</div>');
                                    break;
                            };
                        } else {
                            var format = $('#' + self.values.element + '-format').val();
                            if(format == 'zip') {
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
                    data.formData = { crs : $('#' + self.values.element + '-crs').val() };
                },
                add : function (e, data) {
                    $('#' + self.values.element + '-error').html('');

                    var allowed = /(\.|\/)(gml|kml|geojson|zip)$/i
                    var supportedLocally = /(\.|\/)(gml|kml|geojson)$/i
                    
                    var submit = true;

                    var format = $('#' + self.values.element + '-format').val();
                    if(format == 'zip') {
                        format = 'geojson';
                    }
                    
                    $.each(data.files, function (index, file) {
                        var ext = file.name.split('.').pop();
                                               
                        if((!allowed.test(file.name)) || ($('#' + self.values.element + '-format').val().toLowerCase() != ext.toLowerCase())) {
                            $('#' + self.values.element + '-error').html('').append('<div class="alert alert-danger" role="alert" data-i18n-id="action.upload-resource.error.acceptFileTypes">' + 
                                                                                    PublicaMundi.getResource('action.upload-resource.error.acceptFileTypes') + '</div>');
                                                                                    
                            submit = false;
                        } else if((window.File) && (window.FileReader) && (supportedLocally.test(file.name))) {
                            var reader = new FileReader();

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
                                                                            PublicaMundi.getResource('action.upload-resource.error.unknown') + '</div>');
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
		}
    });

    return PublicaMundi;
});
