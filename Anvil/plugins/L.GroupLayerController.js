L.Control.GroupLayerController = L.Control.extend({
	options:
	{
		position: 'topright',
		autoZIndex: true, // If `true`, the control will assign zIndexes in increasing order to all of its layers so that the order is preserved when switching them on/off.
		panelOptions: {title:"Layers", text:"No Content"},
	},
	initialize: function (options) 
	{
		options = this._combineOptions(options);
        L.setOptions(this, options);
		
		this._baseLayers = {};
        this._overlayLayers = {};
		this._lastZIndex = 0;
		
		this._IsPinned = false;
		this._IsOpen = false;
    },
    onAdd: function(map) 
	{
		this._map = map;
		
		const container = L.DomUtil.create('div','group-layer-container');
		this._container = container;
		
		L.DomEvent.disableClickPropagation(container);
		L.DomEvent.disableScrollPropagation(container);
		
		const buttonHeader = L.DomUtil.create('a','group-layer-button', container);
		
		const menuIcon = document.createElement("div");
		//menuIcon.className = "group-layer-button-icon";
		const iconSvg = this._createButtonIconSVG();
		menuIcon.appendChild(iconSvg);
		buttonHeader.appendChild(menuIcon);

		
		const titleText = L.DomUtil.create('h1','group-layer-button-title', buttonHeader);
		this._titleText = titleText;
		titleText.innerHTML = this.options.panelOptions.title;
		titleText.style.display = 'none';
		
		const pinIconContainer = document.createElement("div");
		pinIconContainer.className = "group-layer-button-icon";
		this._pinIconContainer = pinIconContainer;
		pinIconContainer.style.display = 'none';
		
		const pinIcon = this._createPinIconSVG();
		pinIconContainer.appendChild(pinIcon);
		
		buttonHeader.appendChild(pinIconContainer);

		container.appendChild(buttonHeader);
		
		let self = this;
		
        buttonHeader.addEventListener('mouseover', function() {
			self._OnControlOpen();
        });

        container.addEventListener('mouseleave', function() {
			if(!self._IsPinned)
				self._OnControlClose();
        });
		
		pinIconContainer.addEventListener('click', function() {
			self.setPin(!self._IsPinned);
        });

        var menuContainer = L.DomUtil.create('div', 'group-layer-menu', container);
		this._menuContainer = menuContainer;
		
        menuContainer.innerHTML = this.options.panelOptions.text;
		menuContainer.style.display = 'none';
		
		//Setup other elements and trigger a generation of the layers list
		this._setupElements();
		
        return container;
    },
	onRemove: function(map) 
	{
		//Cleanup any event listeners
		for(const groupName in this._baseLayers)
		{
			const layers = this.layers[groupName];
			for(const layerId in layers )
			{
				const layer = layers[layerId];
				const input = layer.input;
				if(input)
				{
					L.DomEvent.off(input, 'change', this._onLayerCheckChange);
				}
			}
		}
		for(const groupName in this._overlayLayers)
		{
			const layers = this.layers[groupName];
			for(const layerId in layers )
			{
				const layer = layers[layerId];
				const input = layer.input;
				if(input)
				{
					L.DomEvent.off(input, 'change', this._onLayerCheckChange);
				}
			}
		}
	},
	/*Combine input options with missing values with defaults returning an 
	options object that always has the correct properties*/
	_combineOptions: function(options)
	{
		if(!options)
		{
			options = { position:"topleft", autoZIndex:true, panelOptions: {} };
		}
		
		if(!options.panelOptions)
		{
			options.panelOptions = {};
		}
		
		//Always set the suboptions
		const panelOpt = 
		{
			title: options.panelOptions.title ?? "Layers",
			text: options.panelOptions.title ?? "No Content"
		}

		let opt = 
		{
			position: options.position ?? 'topright',
			autoZIndex: options.autoZIndex ?? true,
			panelOptions: panelOpt,
		}
		
		return opt;
	},
	/*Pin the control opening it and holding it open*/
	setPin: function(isPinned)
	{
		this._IsPinned = isPinned;
			
		console.log("Group layers pin to " + this._IsPinned );
		
		if(!this._IsOpen && isPinned)
		{
			this._OnControlOpen();
		}
	},
	_setupElements: function()
	{
		this._menuContainer = this._render(this._menuContainer,this._container);
	},
	/*Internal function to open the control*/
	_OnControlOpen: function()
	{
		if(!this._IsOpen)
		{
			this._IsOpen = true;
			
			this._menuContainer.style.display = 'block';
			this._titleText.style.display = 'block';
			this._pinIconContainer.style.display = 'block';
			
			this._container.classList.add('group-layer-menu-open');
		}
	},
	/*Internal function to close the control*/
	_OnControlClose: function()
	{
		if(this._IsOpen)
		{
			this._IsOpen = false;
			
			this._menuContainer.style.display = 'none';
			this._titleText.style.display = 'none';
			this._pinIconContainer.style.display = 'none';
			
			this._container.classList.add('group-layer-menu-open');
		}
	},
	_createButtonIconSVG: function() 
	{
		const ns = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(ns, "svg");
		svg.setAttribute("width", "22px");
		svg.setAttribute("height", "22px");
		svg.setAttribute("viewBox", "0 0 22 22");
		svg.classList.add("group-layer-svg");

		const path = document.createElementNS(ns, "path");
		path.setAttribute("d", "M19.3697 4.89109L13.5097 2.28109C12.6497 1.90109 11.3497 1.90109 10.4897 2.28109L4.62969 4.89109C3.14969 5.55109 2.92969 6.45109 2.92969 6.93109C2.92969 7.41109 3.14969 8.31109 4.62969 8.97109L10.4897 11.5811C10.9197 11.7711 11.4597 11.8711 11.9997 11.8711C12.5397 11.8711 13.0797 11.7711 13.5097 11.5811L19.3697 8.97109C20.8497 8.31109 21.0697 7.41109 21.0697 6.93109C21.0697 6.45109 20.8597 5.55109 19.3697 4.89109ZM12.0003 17.04C11.6203 17.04 11.2403 16.96 10.8903 16.81L4.15031 13.81C3.12031 13.35 2.32031 12.12 2.32031 10.99C2.32031 10.58 2.65031 10.25 3.06031 10.25C3.47031 10.25 3.80031 10.58 3.80031 10.99C3.80031 11.53 4.25031 12.23 4.75031 12.45L11.4903 15.45C11.8103 15.59 12.1803 15.59 12.5003 15.45L19.2403 12.45C19.7403 12.23 20.1903 11.54 20.1903 10.99C20.1903 10.58 20.5203 10.25 20.9303 10.25C21.3403 10.25 21.6703 10.58 21.6703 10.99C21.6703 12.11 20.8703 13.35 19.8403 13.81L13.1003 16.81C12.7603 16.96 12.3803 17.04 12.0003 17.04ZM12.0003 22.0009C11.6203 22.0009 11.2403 21.9209 10.8903 21.7709L4.15031 18.7709C3.04031 18.2809 2.32031 17.1709 2.32031 15.9509C2.32031 15.5409 2.65031 15.2109 3.06031 15.2109C3.47031 15.2109 3.80031 15.5409 3.80031 15.9509C3.80031 16.5809 4.17031 17.1509 4.75031 17.4109L11.4903 20.4109C11.8103 20.5509 12.1803 20.5509 12.5003 20.4109L19.2403 17.4109C19.8103 17.1609 20.1903 16.5809 20.1903 15.9509C20.1903 15.5409 20.5203 15.2109 20.9303 15.2109C21.3403 15.2109 21.6703 15.5409 21.6703 15.9509C21.6703 17.1709 20.9503 18.2709 19.8403 18.7709L13.1003 21.7709C12.7603 21.9209 12.3803 22.0009 12.0003 22.0009Z");
		path.setAttribute("fill", "#f0f0f0");
		
		svg.appendChild(path);
		
		return svg;
	},
	_createPinIconSVG: function()
	{
		const ns = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(ns, "svg");
		svg.setAttribute("width", "22px");
		svg.setAttribute("height", "22px");
		svg.setAttribute("viewBox", "0 0 1.43 1.43");
		svg.classList.add("group-layer-svg");

		const path = document.createElementNS(ns, "path");
		path.setAttribute("d", "M1.361 0.423 0.99 0.052c-0.038 -0.038 -0.099 -0.038 -0.138 0s-0.038 0.099 0 0.138l0.019 0.019 -0.446 0.294 -0.014 -0.014c-0.038 -0.038 -0.099 -0.038 -0.138 0s-0.038 0.099 0 0.138l0.198 0.198L0.066 1.232c-0.038 0.038 -0.038 0.102 0 0.14 0.038 0.038 0.102 0.038 0.14 0L0.613 0.963l0.173 0.173c0.038 0.038 0.099 0.038 0.138 0s0.038 -0.099 0 -0.138l-0.014 -0.014 0.291 -0.448 0.019 0.019c0.038 0.038 0.099 0.038 0.138 0 0.038 -0.033 0.038 -0.093 0.003 -0.132z");
		
		svg.appendChild(path);
		
		return svg;
	},
	/*Layers functions*/
	addBaseLayer: function(layer, layerName, groupName)
	{
		this._addLayer(layer, layerName, groupName, true);
	},
	addOverlay: function (layer, layerName, groupName) 
	{
		this._addLayer(layer, layerName, groupName, false);
    },
	removeLayer: function(layer)
	{
		this._map.removeLayer(layer);
		
		//console.log("GLC delete req for", layer._leaflet_id);
		
		for(let groupName in this._overlayLayers)
		{
			for(let layerID in this._overlayLayers[groupName])
			{
				const currentLayer = this._overlayLayers[groupName][layerID];
				//console.log("Found layer ",currentLayer._leaflet_id, " in ", groupName);
				
				//Check if our layer is a LayerGroup or regular layer, layer groups will only be tested top level search, so layers inside layers won't work
				if(currentLayer instanceof L.LayerGroup)
				{
					for(let groupLayerID in currentLayer._layers)
					{
						const groupLayer = currentLayer._layers[groupLayerID];
						if(layer._leaflet_id === groupLayer._leaflet_id)
						{
							//console.log("Found group layer ", groupLayer._leaflet_id, " to del");
							delete this._overlayLayers[groupName][layerID]._layers[groupLayerID];
						}
					}
				}
				else
				{
					if(layer._leaflet_id === currentLayer._leaflet_id)
					{
						//console.log("Found base layer ", currentLayer._leaflet_id, " to del");
						delete this._overlayLayers[groupName][layerID];
					}
				}
			}
		}
	},
	_addLayer: function(layer, layerName, groupName, isBaseLayer)
	{
		layer.options.displayName = layerName;
		
        groupName = groupName || 'Uncategorized';
		
		if(isBaseLayer === true)
		{
			layer.options.isBaseLayer = true;
			
			this._baseLayers[groupName] = this._baseLayers[groupName] || {};
			this._baseLayers[groupName][L.stamp(layer)] = layer;
		}
		else
		{
			this._overlayLayers[groupName] = this._overlayLayers[groupName] || {};
			this._overlayLayers[groupName][L.stamp(layer)] = layer;
		}
		
		if(this.options.autoZIndex && layer.setZIndex)
		{
			this._lastZIndex++;
			layer.setZIndex(this._lastZIndex);
			//console.log("Set Layer " + layer.options.displayName + " to " + this._lastZIndex);
		}
		
        this._render(this._menuContainer, this._container);
	},
	_createInput: function (layer, controlType) 
	{
		const input = document.createElement('input');
		input.type = controlType;
		input.className = 'leaflet-control-layers-selector';
		input.checked = this._map.hasLayer(layer);
		layer.control = input;
        L.DomEvent.on(input, 'change', this._onLayerCheckChange, { layer, control: this });
        return input;
    },
	_onLayerCheckChange: function (e) 
	{
        const layer = this.layer;
        if (layer) 
		{
			if (e.target.checked) 
			{
				if(layer.options && layer.options.isBaseLayer)
				{
					//Only a single base layer should be active
					for (let MapGroup in this.control._baseLayers) 
					{
						for(let baseLayerID in this.control._baseLayers[MapGroup])
						{
							let baseLayer = this.control._baseLayers[MapGroup][baseLayerID];
							if(layer != baseLayer && this.control._map.hasLayer(baseLayer))
							{
								//Remove all non active base layers from the map
								this.control._map.removeLayer(baseLayer);
								baseLayer.control.checked = false;
							}
						}
					}
				}
				
				this.control._map.addLayer(layer);
				
			} 
			else 
			{
				this.control._map.removeLayer(layer);
			}
        }
    },
    _createLabel: function (layer, input) 
	{
        const label = document.createElement('label');
        label.className = 'leaflet-control-layers-label';
        label.innerHTML = layer.options.displayName || 'Untitled';
        L.DomEvent.on(label, 'click', () => input.click());
        return label;
    },
	_render: function(menu, container)
	{
		if(!menu)
		{
			//Frist time create the toggle only menu area
			menu = L.DomUtil.create('div', 'group-layer-menu', container);
			menu.style.display = 'none';
		}
		else
		{
			menu.innerHTML = '';
		}
		
		//Insert our base layers elements
		for(const groupName in this._baseLayers)
		{
			const groupContainer = L.DomUtil.create('div', 'group-layer-group-container', menu);
			
			const groupLabel = L.DomUtil.create('label', 'group-layer-group-container-label', groupContainer);
			groupLabel.textContent = groupName;
			
			//Filter through the layers in this group
			const layers = this._baseLayers[groupName];
			for (const layerId in layers) 
			{
				const layer = layers[layerId];
				const input = this._createInput(layer,'Radio');
				const label = this._createLabel(layer, input);

				const layerContainer = L.DomUtil.create('div', 'group-layer-group-container-layer', groupContainer);
				layerContainer.appendChild(input);
				layerContainer.appendChild(label);
			}
		}
		
		const sep = L.DomUtil.create('div', 'group-layer-type-separator', menu);
		
		//Insert our overlay layer elements
		for(const groupName in this._overlayLayers)
		{
			const groupContainer = L.DomUtil.create('div', 'group-layer-group-container', menu);
			
			const groupLabel = L.DomUtil.create('label', 'group-layer-group-container-label', groupContainer);
			groupLabel.textContent = groupName;
			
			//Filter through the layers in this group
			const layers = this._overlayLayers[groupName];
			for (const layerId in layers) 
			{
				const layer = layers[layerId];
				const input = this._createInput(layer,'Checkbox');
				const label = this._createLabel(layer, input);

				const layerContainer = L.DomUtil.create('div', 'group-layer-group-container-layer', groupContainer);
				layerContainer.appendChild(input);
				layerContainer.appendChild(label);
			}
		}
		
		return menu;
	},
	/*Return an object holding all layers inside a given named group*/
	findLayersByGroupName: function(name)
	{
		let layers = this._overlayLayers[name];
		if(layers)
			return layers;
		
		return null;
	},
	findFirstLayerInGroup: function(name)
	{
		let layers = this.findLayersByGroupName(name);
		if(layers)
		{
			for(const layerId in layers)
			{
				const layer = layers[layerId];
				
				if(layer)
				{
					return layer;
				}
			}
		}
	},
	/*Search for a layer matching a given pred, if target layer is a group search sub layers */
	_searchForLayer(targetLayer, searchLayer)
	{
		if (targetLayer === searchLayer) {
			return searchLayer;
		}
		
		const self = this;
		if (searchLayer instanceof L.LayerGroup) {
			let layerMatch = null;
			searchLayer.eachLayer(function(groupLayer) {
				layerMatch = self._searchForLayer(targetLayer, groupLayer);
				if (layerMatch !== null) {
					return false;
				}
			});
			return layerMatch;
		}
		
		return null;
    }
});

L.control.groupLayerController = function(options) {
    return new L.Control.GroupLayerController(options);
}