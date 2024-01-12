L.Control.InfoPanel = L.Control.extend({
	options:
	{
		position: 'topleft',
		panelOptions: {title:"Unnamed Panel", text:"No Content"},
		dragOptions: {isDragEnabled: true, shapeTypes:[L.Circle]},
		gridOptions: {isGridsEnabled:true, grids:[{name: "Grid 1", isEnabled: "true", height:30, width:20, gridBounds: null, doGridMarkers: true, doPerCellMarkers: false, lineCol: "black", lineWeight: 2}]}
	},
	initialize: function (options) 
	{
		options = this._combineOptions(options);
        L.setOptions(this, options);
		
		this._IsPinned = false;
		this._IsOpen = false;
		
		this._HasInitPane = false;
		
		this._IsDragging = false;
		this._DragObj = null;
    },
    onAdd: function(map) 
	{
		this._map = map;
		
		const container = L.DomUtil.create('div','info-panel-container');
		this._container = container;
		
		L.DomEvent.disableClickPropagation(container);
		L.DomEvent.disableScrollPropagation(container);
		
		const buttonHeader = L.DomUtil.create('a','info-panel-button', container);
		
		const menuIcon = document.createElement("div");
		//menuIcon.className = "info-panel-button-icon";
		const iconSvg = this._createButtonIconSVG();
		menuIcon.appendChild(iconSvg);
		buttonHeader.appendChild(menuIcon);

		
		const titleText = L.DomUtil.create('h1','info-panel-button-title', buttonHeader);
		this._titleText = titleText;
		titleText.innerHTML = this.options.panelOptions.title;
		titleText.style.display = 'none';
		
		const pinIconContainer = document.createElement("div");
		pinIconContainer.className = "info-panel-button-icon";
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

        var menuContainer = L.DomUtil.create('div', 'info-panel-menu', container);
		this._menuContainer = menuContainer;
		
        menuContainer.innerHTML = this.options.panelOptions.text;
		menuContainer.style.display = 'none';
		
		//Open the panel by default
		this.setPin(true);
		this._setupElements();
		
		if(this.options.dragOptions.isDragEnabled === true)
		{
			this._SetupDrag();
		}
		
        return container;
    },
    onRemove: function(map) 
	{
		if(this._map)
		{
			this._map.off("mousemove", this._OnMapPosChangeHandler);
			this._map.off("mousemove", this._OnMapGridChangeHandler);
			
			this._map.off("mousemove", this._OnMapDragChangeHandler);
			this._map.off("mouseup", this._OnMapDragUpHandler);
			this._map.off("mousedown", this._OnMapDragDownHandler);
		}
	},
	/*Combine input options with missing values with defaults returning an 
	options object that always has the correct properties*/
	_combineOptions: function(options)
	{
		if(!options)
		{
			options = { position:"topleft", panelOptions: {}, gridOptions:{} };
		}
		
		if(!options.panelOptions)
		{
			options.panelOptions = {};
		}
		
		if(!options.dragOptions)
		{
			options.dragOptions = {};
		}
		
		if(!options.gridOptions)
		{
			options.gridOptions = {};
		}
		
		//Always set the suboptions
		const panelOpt = 
		{
			title: options.panelOptions.title ?? "Unnamed Panel",
			text: options.panelOptions.title ?? "No Content"
		}
		
		const dragOpt = 
		{
			isDragEnabled: options.dragOptions.isDragEnabled ?? true,
			shapeTypes: options.dragOptions.shapeTypes ?? [L.Circle]
		}
		
		//Process any grids in the grids array adding missing values
		let grids = [];
		if(options.gridOptions.grids)
		{
			for(let i = 0; i < options.gridOptions.grids.length; i++)
			{
				let gridOption = options.gridOptions.grids[i];
				grids.push({
					name: gridOption.name ?? "Grid",
					isEnabled: gridOption.isEnabled ?? false,
					height: gridOption.height ?? 30,
					width: gridOption.width ?? 20,
					gridBounds: gridOption.gridBounds ?? null,
					doGridMarkers: gridOption.doGridMarkers ?? true,
					doPerCellMarkers: gridOption.doPerCellMarkers ?? false,
					doShowInInfo: gridOption.doShowInInfo ?? true,
					lineCol: gridOption.lineCol ?? "black",
					lineWeight: gridOption.lineWeight ?? 2,
				});
			}
		}
		
		const gridOpt = 
		{
			isGridsEnabled: options.gridOptions.isGridsEnabled ?? true,
			grids: grids
		}
		
		let opt = 
		{
			position: options.position ?? 'topleft',
			panelOptions: panelOpt,
			dragOptions: dragOpt,
			gridOptions: gridOpt
		}
		
		return opt;
	},
	/*Pin the control opening it and holding it open*/
	setPin: function(isPinned)
	{
		this._IsPinned = isPinned;
			
		if(this._IsPinned == true)
			this._pinIconContainer.children[0].classList.add("info-panel-button-active");
		else
			this._pinIconContainer.children[0].classList.remove("info-panel-button-active");
			
		console.log("Info pin to " + this._IsPinned );
		
		if(!this._IsOpen && isPinned)
		{
			this._OnControlOpen();
		}
	},
	_setupElements: function()
	{
		this._menuContainer.innerHTML = '';
		
		/*let textEle = document.createElement("p");
		textEle.innerHTML = "Press Ctrl and Drag";
		this._menuContainer.appendChild(textEle);*/
		
		this._setupMouseMapPos();
		
		if(this.options.gridOptions.isGridsEnabled === true)
			this._setupMouseGridPos();
	},
	_setupMouseMapPos: function()
	{
		let textEle = document.createElement("p");
		textEle.innerHTML = "(Unset)";
		this._mapPosEle = textEle;
		this._menuContainer.appendChild(textEle);
		
		//Do our event BS to get both this and the event into a single function
		this._OnMapPosChangeHandler = (e) => {
			this._OnMapPosChange(e, this);
		};
		
		this._map.on("mousemove", this._OnMapPosChangeHandler);
	},
	_setupMouseGridPos: function()
	{
		let textEle = document.createElement("p");
		textEle.innerHTML = `Grid: (Unset)`;
		this._gridPosEle = textEle;
		this._menuContainer.appendChild(textEle);
		
		//Do our event BS to get both this and the event into a single function
		this._OnMapGridChangeHandler = (e) => {
			this._OnMapGridChange(e, this);
		};
		
		this._map.on("mousemove", this._OnMapGridChangeHandler);
	},
	_OnMapPosChange: function(e, parent)
	{
		if(parent._IsOpen == true)
				parent._mapPosEle.innerHTML = `Pos(y,x): (${Math.trunc(e.latlng.lat)},${Math.trunc(e.latlng.lng)})`;
	},
	_OnMapGridChange: function(e, parent)
	{
		if(parent._IsOpen)
		{
			let gridText = "";
			
			for(let i = 0; i < this.options.gridOptions.grids.length; i++)
			{
				const gridOptions = this.options.gridOptions.grids[i];
				
				if(gridOptions.isEnabled === true && gridOptions.doShowInInfo === true)
				{
					const bounds = gridOptions.gridBounds ?? this._map.getBounds();
				
					if(bounds && bounds.contains(e.latlng))
					{
						let BoundWidth = bounds.getEast() - bounds.getWest();
						let BoundHeight = bounds.getNorth() - bounds.getSouth();
						let CellSizeW = BoundWidth / gridOptions.width;
						let CellSizeH = BoundHeight / gridOptions.height;
			
						let YGridVal = (((bounds.getNorth() - e.latlng.lat) / CellSizeH) + 1);
						let XGridVal = (Math.abs((((bounds.getWest() - e.latlng.lng) / CellSizeW))) + 1);
					
						gridText += `${gridOptions.name}: (${parent._numToLetter(Math.trunc(XGridVal))},${Math.trunc(YGridVal)})<br>`
					}
					else
					{
						gridText += "Grid: (0,0)<br>";
					}
				}
			}
			
			parent._gridPosEle.innerHTML = gridText;
		}
	},
	_SetupDrag: function()
	{
		let textEle = document.createElement("p");
		textEle.innerHTML = "";
		this._selectionEle = textEle;
		this._menuContainer.appendChild(textEle);
		
		this._OnMapDragChangeHandler = (e) => {
			this._OnMapDragChange(e, this);
		};
		
		this._OnMapDragDownHandler = (e) => {
			this._OnMapDragDownChange(e, this);
		};
		
		this._OnMapDragUpHandler = (e) => {
			this._OnMapDragUpChange(e, this);
		};
		
		this._map.on("mousemove", this._OnMapDragChangeHandler);
		this._map.on("mouseup", this._OnMapDragUpHandler);
		this._map.on("mousedown", this._OnMapDragDownHandler);
	},
	/*Fired when the mouse moves over the map, used for drag box*/
	_OnMapDragChange: function(e, parent)
	{
		if(parent._IsDragging === true)
		{
			parent._map.removeLayer(parent._DragObj.shape);
			const rect = L.rectangle([parent._DragObj.startPoint,[e.latlng]], {color: "#ff7800", weight: 1}).addTo(parent._map);
			parent._DragObj = {startPoint: parent._DragObj.startPoint, shape:rect};
			
			let shapes = parent.getShapesInMapBounds(parent._map, rect.getBounds(), parent.options.dragOptions.shapeTypes);
			
			parent._selectionEle.innerHTML = `${shapes.length} objs`;
		}
	},
	/*Fired when the mouse is pressed on the map, used for drag box*/
	_OnMapDragDownChange: function(e, parent)
	{
		if (!e.originalEvent.ctrlKey || ((e.originalEvent.which !== 1) && (e.originalEvent.button !== 1))) { return false; }
		
		if(!parent._IsDragging === true)
		{
			parent._IsDragging = true;
			parent._map.dragging.disable();
			
			const start = [e.latlng];
			const rect = L.rectangle(start, {color: "#ff7800", weight: 1}).addTo(parent._map);
			
			parent._DragObj = {startPoint: start, shape:rect};
		}
	},
	/*Fired when the mouse is lifted on the map, used for drag box*/
	_OnMapDragUpChange: function(e, parent)
	{
		if(parent._IsDragging === true)
		{
			parent._map.removeLayer(parent._DragObj.shape);
			parent._map.dragging.enable();
			
			parent._DragObj = null;
			parent._IsDragging = false;
		}
	},
	getShapesInMapBounds: function(map, bounds, types)
	{
		var shapes = [];
		map.eachLayer( function(layer) {
			for(let i = 0; i < types.length; i++)
			{
				if(layer instanceof types[i])
				{
					if(bounds.contains(layer.getLatLng())) {
						shapes.push(layer);
					}
					break;
				}
			}
		});
		return shapes;
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
			
			this._container.classList.add('info-panel-menu-open');
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
			
			this._container.classList.add('info-panel-menu-open');
		}
	},
	_createButtonIconSVG: function() 
	{
		const ns = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(ns, "svg");
		svg.setAttribute("width", "22px");
		svg.setAttribute("height", "22px");
		//svg.setAttribute("viewBox", "0 0 30 30");
		svg.classList.add("info-panel-svg");

		const path = document.createElementNS(ns, "path");
		path.setAttribute("d", "M12,2C6.477,2,2,6.477,2,12s4.477,10,10,10s10-4.477,10-10S17.523,2,12,2z M12,17L12,17c-0.552,0-1-0.448-1-1v-4 c0-0.552,0.448-1,1-1h0c0-0.552,0.448-1,1-1v4C13,16.552,12.552,17,12,17z M12.5,9h-1C11.224,9,11,8.776,11,8.5v-1 C11,7.224,11.224,7,11.5,7h1C12.776,7,13,7.224,13,7.5v1C13,8.776,12.776,9,12.5,9z");
		//path.setAttribute("fill", "#f0f0f0");
		
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
		svg.classList.add("info-panel-svg");

		const path = document.createElementNS(ns, "path");
		path.setAttribute("d", "M1.361 0.423 0.99 0.052c-0.038 -0.038 -0.099 -0.038 -0.138 0s-0.038 0.099 0 0.138l0.019 0.019 -0.446 0.294 -0.014 -0.014c-0.038 -0.038 -0.099 -0.038 -0.138 0s-0.038 0.099 0 0.138l0.198 0.198L0.066 1.232c-0.038 0.038 -0.038 0.102 0 0.14 0.038 0.038 0.102 0.038 0.14 0L0.613 0.963l0.173 0.173c0.038 0.038 0.099 0.038 0.138 0s0.038 -0.099 0 -0.138l-0.014 -0.014 0.291 -0.448 0.019 0.019c0.038 0.038 0.099 0.038 0.138 0 0.038 -0.033 0.038 -0.093 0.003 -0.132z");
		
		svg.appendChild(path);
		
		return svg;
	},
	//Create a grid pane then generate a grid layer before returning it
	createGridLayers:function()
	{
		if(this._map && this.options.gridOptions.grids && this.options.gridOptions.isGridsEnabled === true)
		{
			//Define a new pane for the grid so we can set its z-index (grid should always be above all other layers)
			//TODO check for pane name collision
			
			if(!this._HasInitPane)
			{
				this._map.createPane('grid');
				this._map.getPane('grid').style.zIndex = 650;
				this._map.getPane('grid').style.pointerEvents = 'none';
				
				this._HasInitPane = true;
			}
			
			let gridLayers = [];
			for(let i = 0; i < this.options.gridOptions.grids.length; i++)
			{
				const gridOptions = this.options.gridOptions.grids[i];
				if(gridOptions.isEnabled === true)
				{
					gridLayers.push({name:gridOptions.name, layer:this._drawGridLayer(gridOptions)});
				}
			}
			
			return gridLayers;
		}
		
		return null;
	},
	_drawGridLayer:function(gridOptions)
	{	
		const gridSizeW = gridOptions.width;
		const gridSizeH = gridOptions.height;
		const bounds = gridOptions.gridBounds ?? this._map.getBounds();
		const col = gridOptions.lineCol;
		const weight = gridOptions.lineWeight;
		const doMarkers = gridOptions.doGridMarkers;
		const doPerCellMarkers = gridOptions.doPerCellMarkers;
		
		const boundWidth = bounds.getEast() - bounds.getWest();
		const boundHeight = bounds.getNorth() - bounds.getSouth();

		const cellSizeW = boundWidth / gridSizeW;
		const cellSizeH = boundHeight / gridSizeH;
		
		let gridGroup = L.layerGroup();
		
		//Debug bounds box
		//L.rectangle(bounds, { color: "red", fillColor: 'transparent', weight: 2, interactive: false }).addTo(this._map);
		
		//Vertical lines and text
		for (let i = 1; i <= gridSizeW; i++) 
		{
			//Grid Lines (Skipped on the last loop but needed for drawing text)
			if(i != gridSizeW)
			{
				let top = [bounds.getNorth(), bounds.getWest() + (i * cellSizeW)];
				let bottom = [bounds.getSouth(),  bounds.getWest() + (i * cellSizeW)];
			
				let line = new L.polyline( [top, bottom], { color: col, weight: weight , opacity: 1, interactive: false, pane: 'grid' });
				gridGroup.addLayer(line);
			}
			
			//Top Grid Text markers
			if(doMarkers === true)
			{
				let textY = bounds.getNorth() + (cellSizeH / 2);//+ TopTextYManualOffset;
				let textX = (bounds.getWest() + (i * cellSizeW)) - (cellSizeW / 2);
				let textPos = [textY, textX];
			
				let text = L.marker(textPos, { icon: L.divIcon({ html: this._numToLetter(i), className: 'grid-top-marker'}), interactive: false, pane: 'grid' });
				gridGroup.addLayer(text);
			}
		} 
		
		//Horizontal lines
		for (let i = 1; i <= gridSizeH; i++) 
		{
			//Grid Lines (Skipped on the last loop but needed for drawing text)
			if(i != gridSizeH)
			{
				let left = [bounds.getNorth() - (i * cellSizeH), bounds.getWest()];
				let right = [(bounds.getNorth() - i * cellSizeH), bounds.getEast()];
			
				let line = new L.polyline( [left, right], { color: col, weight: weight, opacity: 1, interactive: false, pane: 'grid' });
				gridGroup.addLayer(line);
			}

			//Side Grid Text markers
			if(doMarkers === true)
			{
				let textY = (bounds.getNorth() - (i * cellSizeH)) + (cellSizeH / 2);
				let textX = bounds.getWest() - (cellSizeW / 2); //- TopTextXManualOffset; 
				let textPos = [textY, textX];
			
				let text = L.marker(textPos, { icon: L.divIcon({ html: i, className: 'grid-side-marker'}), interactive: false, pane: 'grid' });
				gridGroup.addLayer(text);
			}
			
			//Per cell text
			if(doPerCellMarkers === true)
			{
				for(let j = 1; j <= gridSizeW; j++)
				{
					if(j != gridSizeH)
					{
						let textY = (bounds.getNorth() - (i * cellSizeH)) + (cellSizeH / 2);
						let textX = (bounds.getWest() + (j * cellSizeW)) - (cellSizeW / 2);
						let textPos = [textY, textX];
			
						let text = L.marker(textPos, { icon: L.divIcon({ html: this._numToLetter(j) + i, className: 'grid-top-marker'}), interactive: false, pane: 'grid' });
						gridGroup.addLayer(text);
					}
				}
			}
		}
		
		gridGroup.options.IsGridGroup = true;
		
		return gridGroup;
	},
	/*Return a capital letter for a given number 1-26 A-Z*/
	_numToLetter: function(num)
	{
		return (num + 9).toString(36).toUpperCase();
	}
});

L.control.infoPanel = function(options) {
    return new L.Control.InfoPanel(options);
}