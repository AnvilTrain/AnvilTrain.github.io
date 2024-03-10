//Js Enums are 'fun'
const ToolType = Object.freeze({
  Static: 'static',
  Spline: 'spline',
  Rect: 'rect',
  Eraser: 'erase'
});

L.DrawPanel = {Event:{}};

L.DrawPanel.Event.BaseEvent = 'DrawPanelEvent';
L.DrawPanel.Event.NewLayer = 'draw:NewLayer';
L.DrawPanel.Event.DeletLayer = 'draw:DeleteLayer';
L.DrawPanel.Event.ClearLayers = 'draw:ClearLayers';

L.DrawPanel.GroupLName = 'DrawLayerGroup';
L.DrawPanel.DrawPaneName = 'draw';

L.Control.DrawPanel = L.Control.extend({
	initialize: function (options) 
	{
		options = this._createOptions(options);
        L.setOptions(this, options);
		
		this._ElementPool = {}; //Container obj for diffrent common use DOM elements, currently with the exception of the root this._container
		
		this._IsPinned = false;
		this._IsOpen = false;
		
		this._DrawSlots = []; //Sidebar draw slots
		this._SelectingDrawSlot = null; //Used when the toolbox is open, this slot will be reciving the selected tool
		this._ActiveDrawTool = null; //The current selected draw slot /w tool
		this._ActiveDynObj = null; //The current dynamic shape (line/polygon that requires multiple clicks to draw)
		this._ActiveCursorObj = null; // Any map preview object that is tracked to the mouse position before placement
		
		this._IsToolboxOpen = false;
		this._ToolboxSlots = [];//Data for actual tools and their button elements, set by an external function call to bindTools
		this._ToolboxInputElements = {};//DOM Elements used to toolbox options input. i.e ToolTip name
		
		if(options.useColoris === true)
			this._AttachColoris();
    },
    onAdd: function(map) 
	{
		this._map = map;
		
		const container = L.DomUtil.create('div','draw-panel-container');
		this._container = container;
		
		L.DomEvent.disableClickPropagation(container);
		L.DomEvent.disableScrollPropagation(container);
		
		const buttonHeader = L.DomUtil.create('a','draw-panel-button', container);
		
		const menuIcon = document.createElement("div");
		//menuIcon.className = "draw-panel-button-icon";
		const iconSvg = this._createButtonIconSVG();
		menuIcon.appendChild(iconSvg);
		buttonHeader.appendChild(menuIcon);

		
		const titleText = L.DomUtil.create('h1','draw-panel-button-title', buttonHeader);
		this._ElementPool.titleText = titleText;
		titleText.innerHTML = this.options.panelOptions.title;
		titleText.style.display = 'none';
		
		const pinIconContainer = document.createElement("div");
		pinIconContainer.className = "draw-panel-button-icon";
		this._ElementPool.pinIconContainer = pinIconContainer;
		pinIconContainer.style.display = 'none';
		
		const pinIcon = this._createPinIconSVG();
		pinIconContainer.appendChild(pinIcon);
		
		buttonHeader.appendChild(pinIconContainer);

		container.appendChild(buttonHeader);
		
		const self = this;
		
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

        const menuContainer = L.DomUtil.create('div', 'draw-panel-menu', container);
		this._ElementPool.menuContainer = menuContainer;
		
        menuContainer.innerHTML = this.options.panelOptions.text;
		menuContainer.style.display = 'none';
		
		//Open the panel by default
		this.setPin(true);
		this._setupMenuElements();
		
		//Setup our map mouse events, do some BS in order to pipe this instance and the event data into a single function
		this._OnMapClickHandler = (e) => {
			this._OnMapClick(e, this);
		};
		
		this._OnMapRightClickHandler = (e) => {
			this._OnMapRightClick(e, this);
		};
		
		this._OnMapMouseMoveHandler = (e) => {
			this._OnMapMouseMove(e, this);
		};
		
		this._map.on("click", this._OnMapClickHandler);
		this._map.on("contextmenu", this._OnMapRightClickHandler);
		this._map.on("mousemove", this._OnMapMouseMoveHandler);
		
		//Setup our coloris input element, for now we have to init the coloris script outside this panel
		if(this.options.useColoris === true)
		{
			const colorisInput = document.createElement("input");
			this._ElementPool.colorisInput = colorisInput;
		
			colorisInput.id = "Draw-Color-Picker";
			colorisInput.setAttribute("data-type", "text");
			colorisInput.setAttribute("value", this.options.drawOptions.defaultColour);
			colorisInput.setAttribute("data-coloris", "");
			menuContainer.appendChild(colorisInput);
		}
		
		//Setup pane for draw layers to be above other layers
		this._map.createPane('draw');
		this._map.getPane('draw').style.zIndex = 600;
		this._map.getPane('draw').style.pointerEvents = 'none';
		
        return container;
    },
    onRemove: function(map) 
	{
		if(this._map)
		{
			this._map.off("click", this._OnMapClickHandler);
			this._map.off("contextmenu", this._OnMapRightClickHandler);
			this._map.off("mousemove", this._OnMapMouseMoveHandler);
		}
	},
	_AttachColoris: function()
	{
		var colorisCSS = document.createElement('link');
		colorisCSS.type = "text/css";
		colorisCSS.rel = "stylesheet";
		colorisCSS.href = "./coloris.css";
		colorisCSS.onload = function() {
			console.log("Coloris CSS OnLoad");
		};
		document.head.appendChild(colorisCSS);
		
		var colorisJS = document.createElement('script');
		colorisJS.src = "./coloris.js";
		colorisJS.onload = function() {
			console.log("Coloris JS OnLoad");
			Coloris({
				theme: 'polaroid',
				themeMode: 'dark',
				margin: 2,
				alpha: false
			});
		};
		document.head.appendChild(colorisJS);
		
		const self = this;
		document.addEventListener('coloris:pick', event => {
			const col = event.detail.color;
			
			//console.log('Coloris Color change:', col);
			
			//Update the colour of our preview obj
			if(self._ActiveCursorObj && self._ActiveCursorObj.setStyle)
			{
				self._ActiveCursorObj.setStyle({ color: col }); 
			}
			
			//Search through our template options and set the value for every 'color' key
			if(self._ActiveDrawTool && self._ActiveDrawTool.tool.options)
			{
				this._updateColor(self._ActiveDrawTool.tool.options, col);
			}
			
			//Update our current dynamic shape colour
			if(self._ActiveDynObj && self._ActiveDynObj.layer && self._ActiveDynObj.layer.setStyle)
			{
				self._ActiveDynObj.layer.setStyle({ color: col }); 
			}
		});
	},
	/*Return the current html coloris input element value or the options default colour*/
	_GetShapeColour: function()
	{
		if(this.options.useColoris === true)
		{
			if(this._ElementPool.colorisInput)
			{
				return this._ElementPool.colorisInput.value ?? this.options.drawOptions.defaultColour;
			}
		}
		
		return this.options.drawOptions.defaultColour;
	},
	/*Event fired any time the map is clicked*/
	_OnMapClick: function(e, parent)
	{
		if(parent._ActiveDrawTool)
		{
			const tool = parent._ActiveDrawTool.tool;
			
			//Force set a draw pane before we create any layers
			if(!tool.options.pane)
			{
				tool.options.pane = L.DrawPanel.DrawPaneName;
			}
			
			switch(tool.toolOptions.type)
			{
				case ToolType.Static:
					//We need to check for a position override before making our new layer
					var layerLatLng = e.latlng;
					if(tool.positionOptions)
					{
						layerLatLng = L.latLng(tool.positionOptions.y, tool.positionOptions.x);
					}
				
					//Create our layer
					const layer = new tool.type(layerLatLng, tool.options);
			
					//Force a high z-index on maker layers, as they will change z index based on lat pos, and zoom level ugh
					if(layer instanceof L.Marker)
					{
						if(!layer.options.zIndexOffset)
							layer.options.zIndexOffset = 100000;
					}
						
					//Attach any needed tooltip
					if(tool.tooltipOptions && (tool.toolOptions.allowTooltipOverride == undefined || tool.toolOptions.allowTooltipOverride === true))
					{
						let offset = L.point(0,0);
						if(tool.tooltipOptions.offset)
						{
							offset = L.point(tool.tooltipOptions.offset.x,tool.tooltipOptions.offset.y);
						}
					
						layer.bindTooltip(tool.tooltipOptions.text ?? "New Tooltip", { permanent: tool.tooltipOptions.permanent ?? false, direction: tool.tooltipOptions.direction ?? 'right', offset:offset, className: tool.tooltipOptions.className ?? "" });
					}
			
					document.dispatchEvent(new CustomEvent(L.DrawPanel.Event.BaseEvent, { detail: {updateType:L.DrawPanel.Event.NewLayer, layers:layer} }));
				break;
				case ToolType.Spline:
				case ToolType.Rect:
					if(this._ActiveDynObj)
					{
						//Ignore adding point if its the same as the last point
						const newPoint = [e.latlng.lat, e.latlng.lng];
						
						if(this._ActiveDynObj.path.length > 0)
						{
							const lastPoint =this._ActiveDynObj.path[this._ActiveDynObj.path.length-1];
							if(lastPoint[0] == newPoint[0] && lastPoint[1] == newPoint[1])
								break;
						}

						//Rectangle polygons need some extra work to handle the next click as the corners and not a path
						if(tool.toolOptions.type === ToolType.Rect)
						{
							if(this._ActiveDynObj.path.length >= 4)
								break;
							
							const bounds = L.latLngBounds(this._ActiveDynObj.path[0], newPoint);
							const rectPath = [bounds.getNorthWest(),bounds.getNorthEast(),bounds.getSouthEast(),bounds.getSouthWest()];
							this._ActiveDynObj.path = rectPath;
							this._ActiveDynObj.layer.setLatLngs(rectPath);
							break;
						}
							
						//Update splite to shape;
						this._ActiveDynObj.path.push(newPoint);
						this._ActiveDynObj.layer.setLatLngs(this._ActiveDynObj.path);
						//console.log("Added point " + e.latlng + " to _ActiveDynObj");
					}
					else
					{
						//Creating new "dynamic" shape
						const activePath = [[e.latlng.lat, e.latlng.lng]];
						const layer = new tool.type(activePath, tool.options);
						this._ActiveDynObj = {path:activePath, layer:layer};
						layer.addTo(this._map);
					
						//Note: Dynamic layer 'NewLayer' events are fired when the shape is commited to the map (right click/change tool, ect)
					}
				break;
				case ToolType.Eraser:

					//Scan through layers, find any on the draw pane
					//Then process via layer type if deletion would be valid
					let layers = [];
					parent._map.eachLayer(function (layer) 
					{
						const map = parent._map;
						
						if(!layer.options || layer.options.pane != L.DrawPanel.DrawPaneName)
							return;
						
						//Cache our marker icon calculations
						let markerBounds = undefined;
						if(layer instanceof L.Marker)
						{
							let iconRawBounds = layer._icon.getBoundingClientRect();
							let markerMapPos = layer.getLatLng();
							let markerLPos = map.latLngToLayerPoint(markerMapPos);
							
							let iconSize =  L.point(iconRawBounds.width / 2, iconRawBounds.height / 2);
							markerBounds = L.bounds(markerLPos.subtract(iconSize), markerLPos.add(iconSize));
						}
						
						//Workout if layer is valid for being removed, depending on type
						let isValidDel = false;
						if(layer instanceof L.Polyline && !(layer instanceof L.Polygon || layer instanceof L.Rectangle))
						{
							const latlngs = layer.getLatLngs();
							for (var i = 0; i < latlngs.length - 1; i++) 
							{
								var start = latlngs[i];
								var end = latlngs[i + 1];
								
								//Distance in pixels to the line
								var distance = parent._distanceToLineSegment(map,e.latlng,start,end);
								if (distance < 10)
								{
									isValidDel = true;
									break;
								}	
							}
						}
						else if(layer instanceof L.Polygon)
						{
							if(parent._isPointInsidePolygon(e.latlng, layer))
							{
								isValidDel = true;
							}
						}
						else if(layer instanceof L.Marker)
						{
							if(markerBounds && markerBounds.contains(parent._map.latLngToLayerPoint(e.latlng)))
								isValidDel = true;
						}
						else
						{
							if(layer.getBounds && layer.getBounds().contains(e.latlng))
								isValidDel = true;
						}
						
						if (isValidDel === true) 
							layers.push(layer);
					});
				
					if(layers.length > 0)
					{
						//console.log("Eraser layer ", layers);
						document.dispatchEvent(new CustomEvent(L.DrawPanel.Event.BaseEvent, { detail: {updateType:L.DrawPanel.Event.DeleteLayer, layers:layers} }));
					}
						
				break;
				default:
					//Unsupported value
					console.warn("Unknown draw tool type ", tool.toolOptions.type);
				break;
			}
		}
	},
	/*Event fired any time the map is right clicked*/
	_OnMapRightClick: function(e, parent)
	{
		if(parent._ActiveCursorObj)
		{
			parent._OnClearToolPreview();
		}
		
		if(parent._ActiveDrawTool)
		{
			//Remove our CSS for active tool before clearing
			this._ActiveDrawTool.drawSlot.element.classList.remove("draw-panel-slot-active");
			parent._ActiveDrawTool = null;
		}
		
		//Send our finished shape (with at least two points) to our map
		if(this._ActiveDynObj)
		{
			//Make sure our last active path is the displayed one (remove any temp points);
			this._ActiveDynObj.layer.setLatLngs(this._ActiveDynObj.path);
			
			if(this._ActiveDynObj.path.length > 1)
				document.dispatchEvent(new CustomEvent(L.DrawPanel.Event.BaseEvent, { detail: {updateType:L.DrawPanel.Event.NewLayer, layers:this._ActiveDynObj.layer} }));
			else
				this._map.removeLayer(this._ActiveDynObj.layer);
			
			this._ActiveDynObj = null;
		}
	},
	/*Event fired any time the mouse moves over the map*/
	_OnMapMouseMove: function(e, parent)
	{
		if(parent._ActiveDrawTool)
		{
			if(this._ActiveCursorObj && this._ActiveCursorObj.setLatLng)
			{
				this._ActiveCursorObj.setLatLng(e.latlng);
			}
		}
		
		//The CPU killer deep copy path array to replace temp path and redraw...
		if(this._ActiveDynObj)
		{
			if(this._ActiveDynObj.path.length > 0)
			{
				let previewPath = Array.from(this._ActiveDynObj.path);
				const newPoint = [e.latlng.lat, e.latlng.lng];
				const lastPoint = previewPath[previewPath.length-1];
				
				//Rect needs some extra help
				if(parent._ActiveDrawTool.tool.toolOptions.type === ToolType.Rect)
				{
					if(this._ActiveDynObj.path.length >= 4)
						return;
					
					//Fun lets redraw the bounds every mouse twitch
					const bounds = L.latLngBounds(previewPath[0], newPoint);
					const rectPath = [bounds.getNorthWest(),bounds.getNorthEast(),bounds.getSouthEast(),bounds.getSouthWest()];
					previewPath = rectPath;
				}
				else
				{
					//Only applies to spline based dyn shapes
					previewPath.push(newPoint);
				}

				this._ActiveDynObj.layer.setLatLngs(previewPath);
			}
		}
	},
	/*Takes an array of tool objects and processes them into the toolbox*/
	bindTools: function(toolsObj)
	{
		if(toolsObj && this._ElementPool.toolboxMenuContent)
		{
			//Process the tools (shapes/marker/ect) inside the 'toolbox'
			if(toolsObj.tools && Array.isArray(toolsObj.tools))
			{
				let self = this;
				for(let i = 0; i < toolsObj.tools.length; i++)
				{
					let toolboxItem = this._createToolboxItem(this._ElementPool.toolboxMenuContent, toolsObj.tools[i]);
					
					//Check for and create a new tab in the toolbox if needed
					let hasMatch = false;
					const tabs = this._ElementPool.toolboxMenuTabHead.querySelectorAll('a');
					for(let tabID in tabs)
					{
						const tabEle = tabs[tabID];
						
						if(tabEle.innerText === toolsObj.tools[i].toolOptions.tab )
						{
							hasMatch = true;
							break;
						}	
					}
					
					if(!hasMatch)
						this._createToolboxTab(this._ElementPool.toolboxMenuTabHead,toolsObj.tools[i]);
					
					
					//Create a new icon via its iconOptions and attach that to the marker
					if(toolsObj.tools[i].iconOptions)
					{
						const iconOp = toolsObj.tools[i].iconOptions;
						const icon = L.icon({ iconUrl:iconOp.iconUrl, iconSize: [iconOp.size, iconOp.size], iconAnchor:[iconOp.size/2, iconOp.size/2]});
						toolsObj.tools[i].options.icon = icon;
					}
					
					const toolObj = {element: toolboxItem, data: toolsObj.tools[i]};
					this._ToolboxSlots.push(toolObj);
				
					//Tools can be selected by default, default tools will take avaliable slots in order
					if(toolsObj.tools[i].toolOptions.isDefault === true)
					{
						for(let i=0; i < this._DrawSlots.length; i++)
						{
							//Template will but null if slot is empty, then manually set tool into slow without making it active
							if(!this._DrawSlots[i].drawTemplate)
							{
								this._DrawSlots[i].drawTemplate = toolObj.data;
								this._DrawSlots[i].element.innerText = toolObj.data.toolOptions.name;
								//self._OnSelectDrawTool(this._DrawSlots[i], toolObj);
								break;
							}
						}
					}
				
					toolboxItem.addEventListener('click', function() {
						self._OnSelectDrawTool(self._SelectingDrawSlot, toolObj);
						self._OnCloseToolbox();
						self._SelectingDrawSlot = null;
					});
				}
			}
		}
	},
	/*Combine input options with missing values with defaults returning an 
	options object that always has the correct properties*/
	_createOptions: function(options)
	{
		if(!options)
		{
			options = { position:"topleft", useColoris:false, panelOptions: {}, drawOptions:{} };
		}
		
		if(!options.panelOptions)
		{
			options.panelOptions = {};
		}
		
		if(!options.drawOptions)
		{
			options.drawOptions = {};
		}
		
		//Always set the suboptions
		const panelOpt = 
		{
			title: options.panelOptions.title ?? "Unnamed",
			text: options.panelOptions.title ?? "No Content",
			drawSlots: options.panelOptions.drawSlots ?? 5
		}
		
		const drawOpt = 
		{
			defaultColour: options.drawOptions.defaultColour ?? "red",
		}
		
		let opt = 
		{
			position: options.position ?? "topleft",
			useColoris: options.useColoris ?? false,
			panelOptions: panelOpt,
			drawOptions: drawOpt
		}
		
		return opt;
	},
	/*Pin the control opening it and holding it open*/
	setPin: function(isPinned)
	{
		this._IsPinned = isPinned;
			
		if(this._IsPinned == true)
			this._ElementPool.pinIconContainer.children[0].classList.add("draw-panel-button-active");
		else
			this._ElementPool.pinIconContainer.children[0].classList.remove("draw-panel-button-active");
			
		console.log("Draw pin to " + this._IsPinned );
		
		if(!this._IsOpen && isPinned)
		{
			this._OnControlOpen();
		}
	},
	/*Clears the menu (content) area of the panel and then calls sub-functions to fill it*/
	_setupMenuElements: function()
	{
		this._ElementPool.menuContainer.innerHTML = '';

		this._setupToolbox();
		this._setupDrawSlots();
		this._setupGuideAndClear();		
	},
	/*Create the DOM elements for the toolbox*/
	_setupToolbox: function()
	{
		const self = this;
		
		//Create our toolbox button for the menu
		/*const toolboxEle = document.createElement("a");
		toolboxEle.innerHTML = "Toolbox";
		toolboxEle.className = "draw-panel-toolbox-button";
		this._ElementPool.menuContainer.appendChild(toolboxEle);
		
		toolboxEle.addEventListener('click', function() {
			self._OnOpenToolbox();
        });*/
		
		//Create our actual toolbox overlay container
		const toolboxContainer = document.createElement("div");
		toolboxContainer.className = "draw-panel-overlay-container";
		toolboxContainer.style.display = "none";
		this._ElementPool.toolboxContainer = toolboxContainer;
		
		const toolboxMenu = document.createElement("div");
		toolboxMenu.className = "draw-panel-overlay-menu";
		toolboxContainer.appendChild(toolboxMenu);
		
		const toolboxMenuHeader = document.createElement("div");
		toolboxMenuHeader.className = "draw-panel-overlay-menu-header";
		
		const toolboxMenuHeaderTitle = document.createElement("p");
		toolboxMenuHeaderTitle.innerHTML = "Toolbox";
		toolboxMenuHeaderTitle.className = "draw-panel-overlay-menu-header-title";
		toolboxMenuHeader.appendChild(toolboxMenuHeaderTitle);
				
		const toolboxMenuHeaderClose = document.createElement("a");
		toolboxMenuHeaderClose.innerHTML = "✖";
		toolboxMenuHeaderClose.className = "draw-panel-overlay-menu-header-close";
		toolboxMenuHeaderClose.addEventListener('click', function() {
			self._OnCloseToolbox();
        });
		
		toolboxMenuHeader.appendChild(toolboxMenuHeaderClose);
		
		toolboxMenu.appendChild(toolboxMenuHeader);
		
		const toolboxMenuContentArea = document.createElement("div");
		toolboxMenuContentArea.className = "draw-panel-overlay-menu-content-area";
		toolboxMenu.appendChild(toolboxMenuContentArea);
		
		const toolboxMenuContentWrapper = document.createElement("div");
		toolboxMenuContentWrapper.className = "draw-panel-overlay-menu-content-wrapper";
		toolboxMenuContentArea.appendChild(toolboxMenuContentWrapper);
		
		const toolboxMenuContentTabHead = document.createElement("div");
		toolboxMenuContentTabHead.className = "draw-panel-overlay-menu-content-tabhead";
		toolboxMenuContentWrapper.appendChild(toolboxMenuContentTabHead);
		this._ElementPool.toolboxMenuTabHead = toolboxMenuContentTabHead;
		
		//Attach our default 'All' Tab via a fake tool obj
		this._createToolboxTab(toolboxMenuContentTabHead, {toolOptions:{tab:"All"}}, true);
		
		const toolboxMenuContent = document.createElement("div");
		toolboxMenuContent.className = "draw-panel-overlay-menu-content";
		toolboxMenuContentWrapper.appendChild(toolboxMenuContent);
		this._ElementPool.toolboxMenuContent = toolboxMenuContent;
		
		const toolboxMenuSidebar = document.createElement("div");
		toolboxMenuSidebar.className = "draw-panel-overlay-menu-sidebar";
		toolboxMenuContentArea.appendChild(toolboxMenuSidebar);
		
		const toolboxMenuSidebarTop = document.createElement("div");
		toolboxMenuSidebarTop.id = "draw-panel-overlay-menu-sidebar-top";
		toolboxMenuSidebar.appendChild(toolboxMenuSidebarTop);
		
		//Was planned for use with select button but currently unused
		const toolboxMenuSidebarBottom = document.createElement("div");
		toolboxMenuSidebarBottom.id = "draw-panel-overlay-menu-sidebar-bottom";
		toolboxMenuSidebar.appendChild(toolboxMenuSidebarBottom);
		
		/*Toolbox options*/
		const toolboxSidebarTitle = document.createElement("p");
		toolboxSidebarTitle.innerHTML = "Options";
		toolboxMenuSidebarTop.appendChild(toolboxSidebarTitle);
		
		const toolboxSidebarDesc = document.createElement("p");
		toolboxSidebarDesc.className = "draw-panel-overlay-menu-sidebar-heading";
		toolboxSidebarDesc.innerHTML = "Set options then select tool.";
		toolboxMenuSidebarTop.appendChild(toolboxSidebarDesc);
		
		const toolTipInput = document.createElement("input");
		toolTipInput.setAttribute("data-type", "text");
		toolTipInput.placeholder = "Tooltip Text";
		//toolTipInput.disabled = true;
		//toolTipInput.value="Help";
		toolboxMenuSidebarTop.appendChild(toolTipInput);
		this._ToolboxInputElements.TooltipEle = toolTipInput;
		
		const toolboxPosDesc = document.createElement("p");
		toolboxPosDesc.className = "draw-panel-overlay-menu-sidebar-heading";
		toolboxPosDesc.innerHTML = "Forced position";
		toolboxMenuSidebarTop.appendChild(toolboxPosDesc);
		
		const toolboxPosContainer = document.createElement("div");
		toolboxPosContainer.className = "draw-panel-overlay-menu-sidebar-group";
		toolboxMenuSidebarTop.appendChild(toolboxPosContainer);
		
		const xPosInput = document.createElement("input");
		xPosInput.className = "draw-panel-overlay-menu-sidebar-halfinput";
		xPosInput.setAttribute("data-type", "text");
		xPosInput.placeholder = "x";
		this._ToolboxInputElements.PosEleX = xPosInput;
		toolboxPosContainer.appendChild(xPosInput);
		
		const yPosInput = document.createElement("input");
		yPosInput.className = "draw-panel-overlay-menu-sidebar-halfinput";
		yPosInput.setAttribute("data-type", "text");
		yPosInput.placeholder = "y";
		this._ToolboxInputElements.PosEleY = yPosInput;
		toolboxPosContainer.appendChild(yPosInput);
		
		/*End Toolbox options*/
		
		//TODO this element should be an non hard coded option, also change css
		const parentEle = document.getElementById("content");
		parentEle.appendChild(toolboxContainer);
	},
	/*Create DOM element for a single toolbox item*/
	_createToolboxItem: function(parent, tool)
	{
		const toolboxMenuItem = document.createElement("div");
		toolboxMenuItem.className = "draw-panel-toolbox-menu-item";
		
		let iconUrl = "./img/icons/IconBear.png";
		if(tool.iconOptions && tool.iconOptions.iconUrl )
		{
			iconUrl = tool.iconOptions.iconUrl;
		}

		const toolImg = document.createElement("img");
		toolImg.src = iconUrl;
		toolboxMenuItem.appendChild(toolImg);
		
		const toolText = document.createElement("p");
		toolText.innerHTML = tool.toolOptions.name ?? "Unnamed Tool";
		toolboxMenuItem.appendChild(toolText);
		
		parent.appendChild(toolboxMenuItem);
		
		return toolboxMenuItem;
	},
	/*Create the DOM element for a single toolbox tab*/
	_createToolboxTab: function(parent, tool, isActive = false)
	{
		const toolboxTab = document.createElement("a");
		const disTabClass = "draw-panel-overlay-menu-content-tab-disabled";
		toolboxTab.innerText = tool.toolOptions.tab;
		toolboxTab.style.marginLeft = "5px";
		toolboxTab.className = `draw-panel-overlay-menu-content-tab${!isActive?` ${disTabClass}`:""}`;

		const self = this;
		toolboxTab.addEventListener('click', function() {
			if(self._ToolboxSlots)
			{
				for(let i = 0; i < self._ToolboxSlots.length; i++)
				{
					const slot = self._ToolboxSlots[i];
					if(slot.data.toolOptions.tab != tool.toolOptions.tab && tool.toolOptions.tab != "All")
					{
						slot.element.style.display = "none";
					}
					else
					{
						slot.element.style.display = "block";
					}
				}
			}
			
			//Handle tab active css
			let tabs = self._ElementPool.toolboxMenuTabHead.querySelectorAll('a');
			tabs.forEach((tabEle)=>{
				if(!tabEle.classList.contains(disTabClass))
					tabEle.classList.add(disTabClass);
			});

			toolboxTab.classList.remove(disTabClass);
        });
		
		parent.appendChild(toolboxTab);
	},
	/*Create the DOM elements for the draw slots*/
	_setupDrawSlots: function()
	{
		const self = this;
		
		let slotCount = this.options.panelOptions.drawSlots;
		if(!slotCount)
			slotCount = 5;
		
		for(let i = 0; i < slotCount; i++)
		{
			let slotEle = document.createElement("a");
			slotEle.innerHTML = `Slot ${i+1} - Unset`;
			slotEle.className = "draw-panel-slot";
			this._DrawSlots.push({drawTemplate: null, element: slotEle});
			this._ElementPool.menuContainer.appendChild(slotEle);
			
			slotEle.addEventListener('click', function(e) {
				e.preventDefault();
				self._OnDrawSlotClick(e);
			});
			
			slotEle.addEventListener('contextmenu', function(e) {
				e.preventDefault();
				self._OnDrawSlotClick(e, true);
			});
		}
	},
	/*Called when a draw slot is clicked or right clicked*/
	_OnDrawSlotClick(event, isRightClick)
	{
		for(let i = 0; i < this._DrawSlots.length; i++)
		{
			if(this._DrawSlots[i].element == event.currentTarget)
			{
				//Block slot click if the slot we clicked is already selected
				if(this._ActiveDrawTool && this._DrawSlots[i] === this._ActiveDrawTool.drawSlot)
					break;
				
				if(!this._DrawSlots[i].drawTemplate || isRightClick === true)
				{
					this._OnOpenToolbox();
					this._SelectingDrawSlot = this._DrawSlots[i];
					break;
				}
				
				this._OnSelectDrawTool(this._DrawSlots[i]);
				break;
			}
		}
		
		//Delete our current dyn shape if you click on a slot with one active
		if(this._ActiveDynObj)
		{
			this._map.removeLayer(this._ActiveDynObj.layer);
			this._ActiveDynObj = null;
		}
		
	},
	/*Called when a draw slot is clicked, or (currently) a toolbox item is selected*/
	_OnSelectDrawTool: function(drawSlotObj, toolboxObj, slotActive = true)
	{
		if(toolboxObj)
		{
			//Abort if the tool we just selected is already in a draw slot
			/*for(let i = 0; i < this._DrawSlots.length; i++)
			{
				if(this._DrawSlots[i].drawTemplate === toolboxObj.data)
				{
					//TODO select the toolbox slot that already contains that tool
					return;
				}
			}*/
			
			//Bind/replace options from the template with any input options from the toolbox inputs
			if(this._ToolboxInputElements.TooltipEle)
			{
				const tooltipObj = {isTemp:false, text:undefined, permanent: true, direction:'center', offset:{x:0,y:-50}, className: "draw-panel-marker-tooltip"};
				
				//Process our text
				if(this._ToolboxInputElements.TooltipEle.value == "")
				{
					//This could be temp text set before, or actual static text
					if(toolboxObj.data.tooltipOptions && toolboxObj.data.tooltipOptions.text)
						tooltipObj.text = toolboxObj.data.tooltipOptions.text;
					
					//if this was temp text (text set via the input before) then we want to clear it
					if(toolboxObj.data.tooltipOptions && toolboxObj.data.tooltipOptions.isTemp)
						tooltipObj.text = undefined;
				}
				else
				{
					tooltipObj.text = this._ToolboxInputElements.TooltipEle.value;
					tooltipObj.isTemp = true;
				}

				//Process our offset
				if(toolboxObj.data.tooltipOptions)
					tooltipObj.offset = toolboxObj.data.tooltipOptions.offset ? {x:toolboxObj.data.tooltipOptions.offset.x ?? 0,y:toolboxObj.data.tooltipOptions.offset.y ?? -50} : {x:0,y:-50}; 
				
				//If we have static tooltip set with text or if we have options text set we want tooltips
				if(tooltipObj.text || this._ToolboxInputElements.TooltipEle.value != "")
				{
					toolboxObj.data.tooltipOptions = tooltipObj;
				}
				else
				{
					//No default tooltip options set
					toolboxObj.data.tooltipOptions = undefined;
				}
				
				/*if(!toolboxObj.data.tooltipOptions && this._ToolboxInputElements.TooltipEle.value == "")
				{
					toolboxObj.data.tooltipOptions = undefined;
				}
				else
				{
					toolboxObj.data.tooltipOptions = {text: this._ToolboxInputElements.TooltipEle.value, permanent: true, direction:'center', offset:{x:0,y:-50}, className: "draw-panel-marker-tooltip"};
				}*/
				
				console.log("Replaced tooltip options");
			}
			
			if(this._ToolboxInputElements.PosEleX && this._ToolboxInputElements.PosEleY)
			{
				if(this._ToolboxInputElements.PosEleX.value == "" || this._ToolboxInputElements.PosEleY.value == "")
				{
					toolboxObj.data.positionOptions = undefined;
				}
				else
				{
					toolboxObj.data.positionOptions = {x:this._ToolboxInputElements.PosEleX.value,y:this._ToolboxInputElements.PosEleY.value};
				}
				
				console.log("Replaced position options");
			}
			
			
			//Update the draw slot with the tool data
			drawSlotObj.drawTemplate = toolboxObj.data;
			drawSlotObj.element.innerHTML = toolboxObj.data.toolOptions.name;
		}

		//If we have a active selected tool update our CSS to deselect
		if(this._ActiveDrawTool)
		{			
			this._ActiveDrawTool.drawSlot.element.classList.remove("draw-panel-slot-active");
		}
		
		drawSlotObj.element.classList.add("draw-panel-slot-active");
		
		//Actually set our active tool
		//Tool is just an easy ref to drawslot.drawTemplate contains the same data
		this._ActiveDrawTool = {tool:drawSlotObj.drawTemplate, drawSlot: drawSlotObj};
		
		//Delete any map preview cursor still attached to the mouse
		this._OnClearToolPreview();
		
		//Force update the colour options on the tool template ahead of creating it
		if(this._ActiveDrawTool.tool.options.color)
		{
			this._updateColor(this._ActiveDrawTool.tool.options, this._GetShapeColour());
		}
		
		//Create a new map preview cursor for our current tool (if it has one)
		if(this._ActiveDrawTool.tool.toolOptions.type === ToolType.Static)
		{
			const tool = this._ActiveDrawTool.tool;

			this._ActiveCursorObj = new tool.type([0,0], tool.options);
			this._map.addLayer(this._ActiveCursorObj);
		}
		
		console.log(`Selected '${this._ActiveDrawTool.tool.toolOptions.name}' draw tool`);
	},
	/*Deletes the current tool preview layer*/
	_OnClearToolPreview: function()
	{
		if(this._ActiveCursorObj)
		{
			this._map.removeLayer(this._ActiveCursorObj);
			this._ActiveCursorObj = null;
			
			console.log("Cleared tool preview");
		}
	},
	_setupGuideAndClear: function()
	{	
		const self = this;
	
		//Setup the guide overlay elements
		this._setupGuideOverlay();
		
		//Setup the guide and clear canvas buttons
		const guideClearDiv = document.createElement("div");
		guideClearDiv.className = "draw-panel-button-half-container";
		
		const guideDrawBtn = document.createElement("a");
		guideDrawBtn.innerHTML = "Guide";
		guideDrawBtn.className = "draw-panel-button-half";
		guideDrawBtn.style.marginTop = "5px";
		guideDrawBtn.style.marginBottom = "5px";
		
		guideDrawBtn.addEventListener('click', function(e) {
				e.preventDefault();
				self._ElementPool.guideOverlay.style = "Block";
		});
		guideClearDiv.appendChild(guideDrawBtn);
		
		const clearDrawBtn = document.createElement("a");
		clearDrawBtn.innerHTML = "Clear Canvas";
		clearDrawBtn.className = "draw-panel-button-half";
		clearDrawBtn.style.marginTop = "5px";
		clearDrawBtn.style.marginBottom = "5px";
		
		clearDrawBtn.addEventListener('click', function(e) {
				e.preventDefault();
				document.dispatchEvent(new CustomEvent(L.DrawPanel.Event.BaseEvent, { detail: {updateType:L.DrawPanel.Event.ClearLayers} }));
		});
		guideClearDiv.appendChild(clearDrawBtn);		
		
		this._ElementPool.menuContainer.appendChild(guideClearDiv);
	},
	_setupGuideOverlay: function()
	{
		const GuideContainer = document.createElement("div");
		GuideContainer.className = "draw-panel-overlay-container";
		GuideContainer.style.display = "None";		
		
		const guideMenu = document.createElement("div");
		guideMenu.className = "draw-panel-overlay-menu";
		guideMenu.id = "draw-panel-guide-menu";
		GuideContainer.appendChild(guideMenu);
		
		const guideMenuHeader = document.createElement("div");
		guideMenuHeader.className = "draw-panel-overlay-menu-header";
		
		const guideMenuHeaderTitle = document.createElement("p");
		guideMenuHeaderTitle.innerHTML = "Draw Guide";
		guideMenuHeaderTitle.className = "draw-panel-overlay-menu-header-title";
		guideMenuHeader.appendChild(guideMenuHeaderTitle);
				
		const guideMenuHeaderClose = document.createElement("a");
		guideMenuHeaderClose.innerHTML = "✖";
		guideMenuHeaderClose.className = "draw-panel-overlay-menu-header-close";
		
		guideMenuHeaderClose.addEventListener('click', function() {
			GuideContainer.style.display = "None";	
        });
		
		guideMenuHeader.appendChild(guideMenuHeaderClose);
		guideMenu.appendChild(guideMenuHeader);
		
		const guideMenuContent = document.createElement("div");
		guideMenuContent.className = "draw-panel-overlay-menu-content";
		guideMenuContent.id = "draw-panel-guide-menu-content";
		guideMenu.appendChild(guideMenuContent);
		
		//Let another function handle the text content elements
		this._setGuideText(guideMenuContent);
		
		const parentEle = document.getElementById("content");
		parentEle.appendChild(GuideContainer);
		
		this._ElementPool.guideOverlay = GuideContainer;
	},
	_setGuideText: function(textParent)
	{
		const title = document.createElement("h1");
		title.innerHTML = "Draw Tools Guide";
		
		const t1 = document.createElement("p");
		t1.innerHTML = "To get started with drawing on the map simply click on a slot, this will open the toolbox menu from which you can select a tool. Simply click on a tool to select it. Selecting a tool in the toolbox will automaticlly select its slot, this can be seen by the slots colour change.";
		
		const t2 = document.createElement("p");
		t2.innerHTML = "When a slot is selected simply click on the map in the location you want the shape to be placed. Then just right click when you're done to clear your draw slot selection.";
		
		const t3 = document.createElement("p");
		t3.innerHTML = "For multi-click shapes such as the lines/polygons simply keep clicking on the map to add points/locations for that shape to use. When you're done with the shape right click to confirm the shape and deselect its draw slot.";
		
		const t4 = document.createElement("p");
		t4.innerHTML = "If you want to change which tool is assigned to which slot, deselect the slot if its selected (right click on the map), then right click on the slot and the toolbox will open allowing the selected of a new tool.";
		
		//textParent.appendChild(title);
		textParent.appendChild(t1);
		textParent.appendChild(t2);
		textParent.appendChild(t3);
		textParent.appendChild(t4);
	},
	/*Fired when the toolbox is opened*/
	_OnOpenToolbox: function()
	{
		if(this._ElementPool.toolboxContainer)
		{
			this._ElementPool.toolboxContainer.style.display = "block";
			this._IsToolboxOpen = true;
		}
	},
	/*Fired when the toolbox is closed*/
	_OnCloseToolbox: function()
	{
		if(this._ElementPool.toolboxContainer)
		{
			this._ElementPool.toolboxContainer.style.display = "none";
			this._IsToolboxOpen = false;
		}
	},
	/*Fired when the control is opened (hover)*/
	_OnControlOpen: function()
	{
		if(!this._IsOpen)
		{
			this._IsOpen = true;
			
			this._ElementPool.menuContainer.style.display = 'block';
			this._ElementPool.titleText.style.display = 'block';
			this._ElementPool.pinIconContainer.style.display = 'block';
			
			this._container.classList.add('draw-panel-menu-open');
		}
	},
	/*Fired when the control is closed (mouse leave)*/
	_OnControlClose: function()
	{
		if(this._IsOpen)
		{
			this._IsOpen = false;
			
			this._ElementPool.menuContainer.style.display = 'none';
			this._ElementPool.titleText.style.display = 'none';
			this._ElementPool.pinIconContainer.style.display = 'none';
			
			this._container.classList.add('draw-panel-menu-open');
		}
	},
	/*Creates the DOM SVG element for the draw icon*/
	_createButtonIconSVG: function() 
	{
		const ns = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(ns, "svg");
		svg.setAttribute("width", "22px");
		svg.setAttribute("height", "22px");
		svg.setAttribute("viewBox", "0 0 48 48");
		svg.classList.add("draw-panel-svg");

		const path = document.createElementNS(ns, "path");
		path.setAttribute("d", "M38.657 18.536l2.44-2.44c2.534-2.534 2.534-6.658 0-9.193-1.227-1.226-2.858-1.9-4.597-1.9s-3.371.675-4.597 1.901l-2.439 2.439L38.657 18.536zM27.343 11.464L9.274 29.533c-.385.385-.678.86-.848 1.375L5.076 41.029c-.179.538-.038 1.131.363 1.532C5.726 42.847 6.108 43 6.5 43c.158 0 .317-.025.472-.076l10.118-3.351c.517-.17.993-.463 1.378-.849l18.068-18.068L27.343 11.464z");
		
		svg.appendChild(path);
		
		return svg;
	},
	/*Creates the DOM SVG element for the pin icon*/
	_createPinIconSVG: function()
	{
		
		const ns = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(ns, "svg");
		svg.setAttribute("width", "22px");
		svg.setAttribute("height", "22px");
		svg.setAttribute("viewBox", "0 0 1.43 1.43");
		svg.classList.add("draw-panel-svg");

		const path = document.createElementNS(ns, "path");
		path.setAttribute("d", "M1.361 0.423 0.99 0.052c-0.038 -0.038 -0.099 -0.038 -0.138 0s-0.038 0.099 0 0.138l0.019 0.019 -0.446 0.294 -0.014 -0.014c-0.038 -0.038 -0.099 -0.038 -0.138 0s-0.038 0.099 0 0.138l0.198 0.198L0.066 1.232c-0.038 0.038 -0.038 0.102 0 0.14 0.038 0.038 0.102 0.038 0.14 0L0.613 0.963l0.173 0.173c0.038 0.038 0.099 0.038 0.138 0s0.038 -0.099 0 -0.138l-0.014 -0.014 0.291 -0.448 0.019 0.019c0.038 0.038 0.099 0.038 0.138 0 0.038 -0.033 0.038 -0.093 0.003 -0.132z");
		
		svg.appendChild(path);
		
		return svg;
	},
	/*Recursivly search through an obj for keys called 'color' and replace the value with the input value*/
	_updateColor: function(obj, newColor)
	{
		if (typeof obj !== 'object' || obj === null) 
		{
			return obj;
		}

		if (Array.isArray(obj)) {
			for (let i = 0; i < obj.length; i++) 
			{
				obj[i] = this._updateColor(obj[i], newColor);
			}
		} 
		else 
		{
			for (let key in obj) 
			{
				if (obj.hasOwnProperty(key)) 
				{
					if (key === 'color') 
					{
						obj[key] = newColor;
					} 
					else 
					{
						obj[key] = this._updateColor(obj[key], newColor);
					}
				}
			}
		}
		
		return obj;
	},
	/*Return the pixel canvas distance from latlng to a line between A and B*/
	_distanceToLineSegment: function(map, latlng, latlngA, latlngB) {

        const p = map.latLngToLayerPoint(latlng),
           p1 = map.latLngToLayerPoint(latlngA),
           p2 = map.latLngToLayerPoint(latlngB);

        return L.LineUtil.pointToSegmentDistance(p, p1, p2);
    },
	/*Return bool if latlng point is inside a given polygon, SO 31790344*/
	_isPointInsidePolygon: function(latLng, poly)
	{
		let inside = false;
		let x = latLng.lat, y = latLng.lng;
		for (let ii=0; ii<poly.getLatLngs().length; ii++)
		{
			let polyPoints = poly.getLatLngs()[ii];
			for (let i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) 
			{
				let xi = polyPoints[i].lat, yi = polyPoints[i].lng;
				let xj = polyPoints[j].lat, yj = polyPoints[j].lng;

				let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
				if (intersect) 
					inside = !inside;
			}
		}

    return inside;
	}
});

L.control.drawPanel = function(options) {
    return new L.Control.DrawPanel(options);
};