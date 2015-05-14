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
					content.push('<li class="tree-node"><div class="clearfix">');
					content.push('<div style="float: left;"><img id="' + groups[i].id + '_' + this.values.element + '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="group"/></div>');
					content.push('<div class="tree-text tree-text-1">' + groups[i].title + '</div>');
                    if(groups[i].description) {
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
					content.push('<li class="tree-node"><div class="clearfix">');
					content.push('<div style="float: left;"><img id="' + organizations[i].id + '_' + this.values.element +  '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="organization"/></div>');
					content.push('<div class="tree-text tree-text-1">' + organizations[i].caption + '</div>');
                    if(organizations[i].description) {
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
						content.push('<li class="tree-node">');
						content.push('<div class="clearfix">');
						content.push('<div style="float: left;"><img id="' + group_id + '_' + group_organizations[i].id + '_' + this.values.element +  '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="group_organization"/></div>');
						content.push('<div class="tree-text tree-text-2">' + group_organizations[i].caption + '</div>');
                        if(group_organizations[i].description) {
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

							var selected = false;
							var resourceId = organization_packages[j].resources[0].id ;
							var layerId = resourceId + '_' + organization_packages[j].resources[0].metadata.extras.layer;
							if( $('[data-layer="' + layerId  +'"]').size() > 0) {
								selected = $('[data-layer="' + layerId +'"]').data('selected');
							}
							
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
						content.push('<li class="tree-node">');
						content.push('<div class="clearfix">');
						content.push('<div style="float: left;"><img id="' + organization_groups[i].id + '_' + organization_id + '_' + this.values.element + '" src="content/images/expand-arrow.png" class="tree-toggle tree-node-collapse img-16" data-expanded="false" data-loaded="false" data-type="organization_group"/></div>');
						content.push('<div class="tree-text tree-text-2">' + organization_groups[i].title + '</div>');
                        if(organization_groups[i].description) {
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
							   
							var selected = false;
							var resourceId = group_packages[j].resources[0].id ;
							var layerId = resourceId + '_' + group_packages[j].resources[0].metadata.extras.layer;
							if( $('[data-layer="' + layerId  +'"]').size() > 0) {
								selected = $('[data-layer="' + layerId +'"]').data('selected');
							}
							
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

				var _package = null;
                if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    this.values.ckan.getFilteredPackageById(package_id);
                } else {
                    this.values.ckan.getPackageById(package_id);
                }

				_package.resources.sort(sortByName);
				
				var content = [];

				content.push('<ul class="tree-node" style="display: none;">');
				
				for(var i = 0; i < _package.resources.length; i++) {
					var resource = _package.resources[i];

					if(!!resource.metadata.extras.layer) {
						   
						var selected = false;
						var layerId = resource.id + '_' + resource.metadata.extras.layer;
						if( $('[data-layer="' + layerId  +'"]').size() > 0) {
							selected = $('[data-layer="' + layerId +'"]').data('selected');
						}
						
						content.push('<li class="tree-node tree-node-checkbox">');
						content.push('<div class="clearfix">');
						content.push('<div style="float: left;"><img id="' + group_id + '_' +
                                                                             organization_id + '_' +
                                                                             package_id + '_' +
                                                                             resource.id + '_' + 
                                                                             this.values.elemeng + '" src="' + (selected ? 'content/images/checked.png' : 'content/images/unchecked.png') + '" class="node-select img-16" data-selected="' + (selected ? 'true' : 'false') + '" data-type="layer" data-layer="' + layerId +'" /></div>');
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
								
				var resource = null;

                if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    this.values.ckan.getFilteredResourceById(resource_id);
                } else {
                    this.values.ckan.getResourceById(resource_id);
                }
                
				var content = [];

				content.push('<ul class="tree-node" style="display: none;">');
				
				for(var i = 0; i < layers.length; i++) {
					var selected = false;
					var layerId = resource_id + '_' + layers[i].name;
					if( $('[data-layer="' + layerId  +'"]').size() > 0) {
						selected = $('[data-layer="' + layerId +'"]').data('selected');
					}
						
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

								var resource;
                                if(self.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                                    resource = self.values.ckan.getFilteredResourceById(resource_id);
                                } else {
                                    resource = self.values.ckan.getResourceById(resource_id);
                                }

								$(this).attr('src', 'content/images/ajax-loader.gif');
								$(this).addClass('tree-node-ajax-loader');
								$(this).data('loading', true)
                                
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
                        if(self.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                            data = self.values.ckan.getFilteredPackageById(id);
                        } else {
                            data = self.values.ckan.getPackageById(id);   
                        }
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
                var resource;
                if(self.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    resource = self.values.ckan.getFilteredResourceById(parts[0]);
                } else {
                    resource = self.values.ckan.getResourceById(parts[0]);
                }
                
				var layer = parts.splice(1).join('_');
						
				if(this.values.resources.getLayerCount() < this.values.maxLayerCount) {
					$('[data-layer="' + id +'"]').data('loading', true)
					$('[data-layer="' + id +'"]').attr('src', 'content/images/ajax-loader.gif');
					$('[data-layer="' + id +'"]').addClass('tree-node-ajax-loader');
							
					this.values.resources.getResourceMetadata(resource.metadata.type, resource.metadata.parameters).then(function(metadata) {
						$('[data-layer="' + id +'"]').data('loading', false)
						$('[data-layer="' + id +'"]').removeClass('tree-node-ajax-loader');
						$('[data-layer="' + id +'"]').data('selected', true);
						$('[data-layer="' + id +'"]').attr('src', 'content/images/checked.png');

                        var title, legend;
                        for(var i=0; i<metadata.layers.length;i++) {
                            if(metadata.layers[i].key == layer) {
                                title = metadata.layers[i].title;
                                legend = metadata.layers[i].legend;
                                break;
                            }
                        }

						self.values.resources.createLayer(self.values.map.control, metadata, layer, id, title);
						
						var title = $('[data-layer="' + id +'"]').first().closest('li').find('.tree-text').html();
						
						self.trigger('layer:added', {id: id, title : title, legend : legend});
					});	
				}
			}
		},
		remove: function(id) {
			var parts = id.split('_');
				
			if((parts.length > 1) && 
			   (!$('[data-layer="' + id +'"]').first().data('loading')) &&
			   ($('[data-layer="' + id +'"]').data('selected'))) {
                var resource;
                if(this.values.mode === PublicaMundi.Maps.LayerTreeViewMode.ByFilter) {
                    resource = this.values.ckan.getFilteredResourceById(parts[0]);
                } else {
                    resource = this.values.ckan.getResourceById(parts[0]);
                }

				$('[data-layer="' + id +'"]').data('selected', false);
				$('[data-layer="' + id +'"]').attr('src', 'content/images/unchecked.png');
			
				this.values.resources.destroyLayer(this.values.map.control, id);
										
				this.trigger('layer:removed', { id: id});
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
                    content.push('<input id="' + this.values.element + '-text" placeholder="Search resources ..." class="form-control input-md" type="text">');
                    content.push('</div>');
                    content.push('</div>');

                    
                    content.push('<div class="form-group">');
                    content.push('<div class="col-md-3"  id="' + this.values.element + '-box-draw">');
                    content.push('<a id="' + this.values.element + '-box-draw-btn" class="btn btn-primary"><img src="content/images/edit-w.png" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div class="col-md-3" id="' + this.values.element + '-box-remove" style="display: none;">');
                    content.push('<a id="' + this.values.element + '-box-remove-btn" class="btn btn-danger"><img src="content/images/trash-w.png" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div class="col-md-3" id="' + this.values.element + '-box-apply" style="display: none;">');
                    content.push('<a id="' + this.values.element + '-box-apply-btn" class="btn btn-success"><img src="content/images/apply-w.png" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div class="col-md-3" id="' + this.values.element + '-box-cancel" style="display: none;">');
                    content.push('<a id="' + this.values.element + '-box-cancel-btn" class="btn btn-danger"><img src="content/images/trash-w.png" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('<div class="col-md-3" id="' + this.values.element + '-search">');
                    content.push('<a id="' + this.values.element + '-search-btn" class="btn btn-primary"><img src="content/images/search-w.png" class="img-20" /></a>');
                    content.push('</div>');
                    content.push('</div>');

                    content.push('</form>');
                    
                    content.push('</div>');
                    
                    content.push('<div id="' + this.values.element + '-result" class="clearfix layer-tree-search-result">');
                    content.push('</div>');
                    
                    $('#' + this.values.element).html(content.join(''));
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
						if(self.values.resources.moveLayerUp(self.values.map.control, id)) {						
							parent.prevAll().first().insertAfter(parent);
							self.values.updateActions();
							
							self.trigger('layer:up');
						}
						break;
					case 'down':
						if(self.values.resources.moveLayerDown(self.values.map.control, id)) {						
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
			
		},
        render: function() {
            $('#' + this.values.element).html('');
		},
		add: function(id, title, legend) {
			var content = [];
			
			content.push('<div data-id="' + id + '" class="clearfix selected-layer">');
            
            content.push('<div style="float: left; width: 24px;">');
            if(legend) {
                content.push('<img src="' + legend + '" alt="" />');
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
			content.push('<div class="selected-layer-opacity-label" title="Διαφάνεια υποβάθρου" ><img src="content/images/opacity.png" class="img-16" /></div>');
			content.push('<div class="selected-layer-opacity-slider"><input type="range" name="points" min="0" max="100" value="100"></div>');
			content.push('<div class="selected-layer-down"><img src="content/images/down.png" class="action img-16 action-disabled" data-action="down"  /></div>');
            content.push('</div>');
            
			content.push('</div>');

			content.push('</div>');
			
			$('#' + this.values.element).prepend(content.join(''));
			
			this.values.updateActions();
						
			this.trigger('layer:added', { id : id });
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
                title: null,
                actions: []
			});
			
            if (typeof PublicaMundi.Maps.Component.prototype.initialize === 'function') {
                PublicaMundi.Maps.Component.prototype.initialize.apply(this, arguments);
            }
            
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
            content.push('<a data-action="' + this.values.name + '" class="tool-toggle btn btn-default" title="' + ( this.values.title || '') + '">');
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
                
                if(self.values.type === PublicaMundi.Maps.MeasureToolType.Length) {
                    var length = Math.round(self.values.feature.getGeometry().getLength() * 100) / 100;
                    var output;
                    if (length > 100) {
                        output = (Math.round(length / 1000 * 100) / 100) + ' ' + 'km';
                    } else {
                        output = (Math.round(length * 100) / 100) + ' ' + 'm';
                    }
                    return output;
                } else {
                    var area = self.values.feature.getGeometry().getArea();
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
                    self.values.overlay.setMap(members.map.control);
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
                //tooltip.setOffset([0, -7]);
                // unset self.values.feature
                self.values.feature = null;
                // unset tooltip so that a new one can be created
                tooltipElement = null;
       
                //createTooltip();
        
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

    PublicaMundi.Maps.ExportTool = PublicaMundi.Class(PublicaMundi.Maps.Tool, {
        initialize: function (options) {
			var self = this;

            this.values.map = null;
            this.values.overlay = null;
            this.values.interaction = null;

            if (typeof PublicaMundi.Maps.Tool.prototype.initialize === 'function') {
                PublicaMundi.Maps.Tool.prototype.initialize.apply(this, arguments);
            }

            this.event('feature:change');
            
            this.values.feature = null;
            
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
                    self.values.overlay.setMap(members.map.control);
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
            content.push('<a data-action="' + this.values.name + '" class="tool-action btn btn-primary" title="' + ( this.values.title || '') + '">');
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
                closeOnEscape: true
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
            
            content.push('<div id="' + this.values.element + '" class="modal-dialog" style="z-index: 1; width: ' + (this.values.width || 600 ) + 'px; outline: none;" tabIndex="1">');
            content.push('<div class="modal-content">');
            
            content.push('<div class="modal-header">');
            content.push('<button id="' + this.values.element + '-close" type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>');
            content.push('<h4 class="modal-title">' + this.values.title + '</h4>');
            content.push('</div>');
            
            content.push('<div class="modal-body" style="text-align: justify; max-height: ' + (this.values.height || 400) + 'px; overflow: auto;" >');
            if(typeof this.values.renderContent === 'function'){
                content = content.concat(this.values.renderContent());
            }
            content.push('</div>');
            
            content.push('<div class="modal-footer">');
            if(this.values.buttons) {
                for(var action in this.values.buttons) {
                    this.values.buttons[action].style = this.values.buttons[action].style || 'default';
                    
                    content.push('<button type="button" class="btn btn-' + this.values.buttons[action].style + '" data-action="' + action + 
                                 '">' + this.values.buttons[action].text + '</button>');
                }
            }
            content.push('</div>');
            
            content.push('</div>');
            content.push('</div>');
            content.push('</div>');
            
            $('#' + this.values.target).append(content.join(''));
            
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

    return PublicaMundi;
});
