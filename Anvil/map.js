const leafMap = {
	map: undefined,
	groupLayerController: undefined,
	infoControl: undefined,
	uiController: undefined,
	mapSettings: undefined,
	mapOptions: undefined,
	isDataLoaded: false,
	init: function(){
		console.log("Init leafMap");
		
		//Defer load obj data, process the data when we're ready
		if (document.readyState === "loading") 
		{
			document.addEventListener("DOMContentLoaded", (event) => {
				if(leafMap.isDataLoaded === false)
					leafMap.processAnvilData(leafMap.mapSettings.MapHeight, leafMap.mapSettings.MapWidth);
			});
		} 
		else 
		{
			if(leafMap.isDataLoaded === false)
				leafMap.processAnvilData(leafMap.mapSettings.MapHeight, leafMap.mapSettings.MapWidth);
		}
		
		this.map = L.map('leafMap', {
			crs: L.CRS.Simple,
			maxZoom: -3,
			maxNativeZoom: -3,
			minZoom: -11,
			minNativeZoom: -11,
			preferCanvas: true,
			doubleClickZoom: false,
			attributionControl: false
		});
		
		//Load plugins and layer controls
		L.control.watermark({ position: 'bottomright', text: 'Map 1.5.0 | Game 63832 | By Cooltrain' }).addTo(this.map);
		
		this.groupLayerController = L.control.groupLayerController(
		{
			position: 'topright',
			panelOptions: {
				title: "Layers"
			}
		}).addTo(this.map);
		//L.control.mapOptions({position: 'topright', text: 'Coming Soon!' }).addTo(this.map);

		this.mapSettings = new MapSettings();
		
		//Check the info panel to see other default options
		this.infoControl = L.control.infoPanel({
			position: 'topleft',
			panelOptions: {
				title: "Info"
			},
			dragOptions:
			{
				isDragEnabled: true,
				shapeTypes: [L.Circle, L.Donut]
			},
			gridOptions: {
				isGridsEnabled: true,
				grids: [
					{
						name: "Grid",
						isEnabled : true,
						height: this.mapSettings.GridHeight,
						width: this.mapSettings.GridWidth,
						gridBounds: this.mapSettings.MapBounds,
						doGridMarkers: true,
						doPerCellMarkers: false,
						doShowInInfo: true,
						//lineCol: "black",
						//lineWeight: 2,
					},
					{
						name: "Region Grid",
						isEnabled : false,
						height: 3,
						width: 2,
						gridBounds: this.mapSettings.MapBounds,
						doGridMarkers: false,
						doPerCellMarkers: false,
						doShowInInfo: false,
						//lineCol: "black",
						//lineWeight: 2,
					}
				]
			}
		}).addTo(this.map);

		//Setup our draw control
		this.drawControl = L.control.drawPanel({
			position: 'topleft',
			useColoris: true,
			panelOptions: {
				title: "Draw",
				drawSlots: 8
			},
			drawOptions: {
				defaultColour: 'red'
			}
		}).addTo(this.map);
		
		//Subscribe to draw layer events
		const self = this;
		const DrawGroupParent = "Custom Drawing";
		const DrawGroupName = "Draw";
		document.addEventListener(L.DrawPanel.Event.BaseEvent,(event) => {
			const eventObj = event.detail;
			
			switch(eventObj.updateType)
			{
				case L.DrawPanel.Event.NewLayer:
					const layer = eventObj.layers;
					
					let drawLayer = self.groupLayerController.findFirstLayerInGroup(DrawGroupName);
					if(drawLayer)
					{
						//Force toggle the draw layer if its hidden
						if(drawLayer.control && !drawLayer.control.checked)
						{
							drawLayer.control.click();
						}
				
						drawLayer.addLayer(layer);
					}
					else
					{
						let drawGroup = L.layerGroup();
						drawGroup.tag = L.DrawPanel.GroupLName;
						drawGroup.addLayer(layer);
						drawGroup.addTo(self.map);
			
						self.groupLayerController.addOverlay(drawGroup, DrawGroupParent, DrawGroupName);
					}
					
					//Debug for layer placement (Needs to happen after the layer is on the map)
					if(self.mapSettings.DebugFlags && self.mapSettings.DebugFlags.DebugDrawLayerBounds === true)
					{
						
						
						
						if(layer instanceof L.LayerGroup)
						{
							//Our layer is inside a layer group
							for(let layerID in layer._layers)
							{
								var subLayer = layer._layers[layerID];
								if(subLayer instanceof L.Marker)
								{
									if(!subLayer._icon)
										continue;
								
									let iconRawBounds = subLayer._icon.getBoundingClientRect();
									let markerMapPos = subLayer.getLatLng();
									let markerLPos = self.map.latLngToLayerPoint(markerMapPos);
							
									let iconSize =  L.point( iconRawBounds.width/ 2, iconRawBounds.height/ 2);
									let markerBounds = L.bounds(markerLPos.subtract(iconSize), markerLPos.add(iconSize));
							
									let mapBounds = L.latLngBounds(self.map.layerPointToLatLng(markerBounds.min), self.map.layerPointToLatLng(markerBounds.max));
									L.rectangle(mapBounds, {color: 'blue', weight: 1, fillOpacity: 0, interactive:false}).addTo(self.map);
								}
								else
								{
									if(subLayer.getBounds)
										L.rectangle(layer.getBounds(), {color: 'blue', weight: 1, fillOpacity: 0, interactive:false}).addTo(self.map);
								}
							}
						}
						else
						{
							//Not in layer group, is standalone layer
							if(layer instanceof L.Marker)
							{
								if(!layer._icon)
									return;
								
								let iconRawBounds = layer._icon.getBoundingClientRect();
								let markerMapPos = layer.getLatLng();
								let markerLPos = self.map.latLngToLayerPoint(markerMapPos);
							
								let iconSize =  L.point( iconRawBounds.width/ 2, iconRawBounds.height/ 2);
								let markerBounds = L.bounds(markerLPos.subtract(iconSize), markerLPos.add(iconSize));
							
								let mapBounds = L.latLngBounds(self.map.layerPointToLatLng(markerBounds.min), self.map.layerPointToLatLng(markerBounds.max));
								L.rectangle(mapBounds, {color: 'blue', weight: 1, fillOpacity: 0, interactive:false}).addTo(self.map);
							}
							else
							{
								if(layer.getBounds)
									L.rectangle(layer.getBounds(), {color: 'blue', weight: 1, fillOpacity: 0, interactive:false}).addTo(self.map);
							}
						}
					}

				break;
				case L.DrawPanel.Event.DeleteLayer:
					if(eventObj.layers && eventObj.layers.length > 0)
					{
						for(let i = 0; i < eventObj.layers.length; i++)
						{
							//TODO check if the layer we're deleting is in a group layer which is now empty, or would be empty after delete, and delete that group too
							self.groupLayerController.removeLayer(eventObj.layers[i]);
						}
					}
				break;
			case L.DrawPanel.Event.ClearLayers:
				let drawGroupParent = leafMap.groupLayerController.findLayersByGroupName(DrawGroupName);
				if(drawGroupParent)
				{
					for(const layerId in drawGroupParent)
					{
						let drawLayer = drawGroupParent[layerId];
						if(drawLayer && drawLayer instanceof L.LayerGroup)
						{
							if(drawLayer.control && drawLayer.control.checked === true)
							{
								console.log("Clearing draw layer", drawLayer._leaflet_id);
								drawLayer.clearLayers();
							}
						}
					}
				}
			
			break;
			default:
				console.log("Unknown DrawPanel:LayerUpdate " + eventObj.updateType);
			}
		});
		
		//Bind the tools/shapes we want in the draw menu to the control
		this.drawControl.bindTools(this.getDrawTools());
		
		console.log("Found map settings " + this.mapSettings.MapHeight + " x " + this.mapSettings.MapWidth);
		this.loadAnvilSettings(this.mapSettings);
		
		//Manual added river fording lines
		this.insertMapCrossingPaths();
		
	},
	/*Define the draw tools to be used by the draw panel*/
	getDrawTools: function()
	{
		const toolbox = {tools:[]};
		
		toolbox.tools.push({ type: null, toolOptions:{ name: "Inks Eraser", type: ToolType.Eraser, tab: DrawTabType.Tool, isDefault: true }, options: { }});
		
		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Town Homestead Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 64000, interactive: false, compOptions:{middleDot: true}} });
		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Homestead Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 4800, interactive: false, compOptions:{middleDot: true}} });

		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Town Core 0 Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 4000, interactive: false, compOptions:{middleDot: true}} });
		//toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Town Core 20 Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 6000, interactive: false }});
		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Town Core 50 Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 9000, interactive: false, compOptions:{middleDot: true}} });

		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Old TownHall Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 12000, interactive: false, compOptions:{middleDot: true}} });

		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Large Camp Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 5400, interactive: false, compOptions:{middleDot: true}} });
		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Pump No-Build Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 8000, interactive: false, compOptions:{middleDot: true}} });
		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Well No-Build Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 4000, interactive: false, compOptions:{middleDot: true}} });
		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Water Wheel No-Build Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 4000, interactive: false, compOptions:{middleDot: true}} });
		
		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Beacon Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 12000, interactive: false, compOptions:{middleDot: true}} });
		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "T1 Town Beacon Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 12000, interactive: false, compOptions:{middleDot: true}} });
		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "T2 Town Beacon Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 15000, interactive: false, compOptions:{middleDot: true}} });
		toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "T3 Town Beacon Radius", type: ToolType.Static, tab: DrawTabType.Radius }, options: { color:'red', radius: 20000, interactive: false, compOptions:{middleDot: true}} });
		
		//toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Storm Radius", type: ToolType.Static }, options: { color:'red', radius: 120000, interactive: false }});
		
		toolbox.tools.push({ type:L.polygon, toolOptions:{ name: "Polygon Tool", type: ToolType.Spline, tab: DrawTabType.Tool }, options: { color:'red', interactive: false }});
		toolbox.tools.push({ type:L.polyline, toolOptions:{ name: "Line Tool", type: ToolType.Spline, tab: DrawTabType.Tool }, options: { color:'red', interactive: false }});
		toolbox.tools.push({ type:L.polygon, toolOptions:{ name: "Rect Tool", type: ToolType.Rect, tab: DrawTabType.Tool }, options: { color:'red', interactive: false }});
		
		//This needs a symbol set but we current set it inside the init for the custom type
		toolbox.tools.push({ type:L.polylineDecorated, toolOptions:{ name: "Arrow Line", type: ToolType.Spline, tab: DrawTabType.Tool },
		options: {color:'red', interactive: false, decorationOptions:{ patterns: [{ offset: 25, repeat: 25, symbolObj:{type:L.Symbol.arrowHead, options:{ pixelSize: 15, pathOptions: { stroke: true, color: 'red', interactive: false} }} }] }}});
		
		toolbox.tools.push({ type:L.PolylineRuler, toolOptions:{ name: "Ruler", type: ToolType.Spline, tab: DrawTabType.Tool }, options: {color:'red', dashArray: '10, 10', doTravelTime: false, travelTimeTerm:"Run", travelTimeUnit: 525, interactive: false }});
		toolbox.tools.push({ type: L.positionMarker, toolOptions:{ name: "Position Pin", type: ToolType.Static, tab: DrawTabType.Tool, allowTooltipOverride: false}, options: {draggable:true, interactive: true}});

		//toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Beacon Composite", type: ToolType.Static }, options: { radius: 23000, color:'red', interactive: false, compOptions:{layers:[{type:L.circle, options: {radius: 18500, color:'red', interactive: false }},{type:L.circle, options: {radius: 12000, color:'red', interactive: false }}]} }});
	
		toolbox.tools.push({ type:L.marker, toolOptions:{ name: "Ancient T1", type: ToolType.Static, tab: DrawTabType.Icon},
		iconOptions:{iconUrl: "./img/icons/IconAncientT1.png", size: 76},
		tooltipOptions:{offset:{y:-43}},
		options: { interactive: false }});
		
		toolbox.tools.push({ type:L.marker, toolOptions:{ name: "Ancient T2", type: ToolType.Static, tab: DrawTabType.Icon},
		iconOptions:{iconUrl: "./img/icons/IconAncientT2.png", size: 76},
		options: { interactive: false }});
		
		toolbox.tools.push({ type:L.marker, toolOptions:{ name: "Ancient T3", type: ToolType.Static, tab: DrawTabType.Icon},
		iconOptions:{iconUrl: "./img/icons/IconAncientT3.png", size: 76},
		tooltipOptions:{offset:{y:-55}},
		options: { interactive: false }});
		
		toolbox.tools.push({ type:L.marker, toolOptions:{ name: "Remnant T1", type: ToolType.Static, tab: DrawTabType.Icon},
		iconOptions:{iconUrl: "./img/icons/IconRemnantT1.png", size: 76},
		tooltipOptions:{offset:{y:-45}},
		options: { interactive: false }});
		
		toolbox.tools.push({ type:L.marker, toolOptions:{ name: "Remnant T2", type: ToolType.Static, tab: DrawTabType.Icon},
		iconOptions:{iconUrl: "./img/icons/IconRemnantT2.png", size: 76},
		options: { interactive: false }});
		
		toolbox.tools.push({ type:L.marker, toolOptions:{ name: "Remnant T3", type: ToolType.Static, tab: DrawTabType.Icon},
		iconOptions:{iconUrl: "./img/icons/IconRemnantT3.png", size: 76},
		tooltipOptions:{offset:{y:-55}},
		options: { interactive: false }});

		//Structure Icons
		toolbox.tools.push({ type:L.marker, toolOptions:{ name: "Large Camp", type: ToolType.Static, tab: DrawTabType.Icon}, 
		iconOptions:{iconUrl: "./img/icons/IconCamp.png", size: 64}, 
		tooltipOptions:{offset:{y:-42}}, 
		options: { interactive: false }});

		toolbox.tools.push({ type:L.marker, toolOptions:{ name: "Homestead", type: ToolType.Static, tab: DrawTabType.Icon}, 
		iconOptions:{iconUrl: "./img/icons/IconHomestead.png", size: 64}, 
		tooltipOptions:{offset:{y:-42}}, 
		options: { interactive: false }});
		//Foxhole region testing
		//toolbox.tools.push({ type:L.CompositeCircle, toolOptions:{ name: "Foxhole Hex", type: true }, options: { color:'red', radius: 219700, interactive: false }});
		//toolbox.tools.push({ type:L.marker, toolOptions:{ name: "Remnant Hex Img", type: true }, iconOptions:{iconUrl: "./img/FoxholeRegion.png", size: 218}, options: { interactive: false }});
		
		
		return toolbox;
	},
	loadAnvilSettings: function(mapSettings)
	{
		if(!this.map)
			return;
		
		//Base Calligo
		this.map.fitBounds(mapSettings.MapBounds);
		let mapBaseImg = L.imageOverlay(mapSettings.MapImage, mapSettings.MapBounds, {interactive:false}).addTo(this.map);
		let mapBaseOld = L.imageOverlay(mapSettings.MapImageOld, mapSettings.MapBounds, {interactive:false});
		
		this.groupLayerController.addBaseLayer(mapBaseImg, "Calligo", "Maps");
		this.groupLayerController.addBaseLayer(mapBaseOld, "Calligo Old", "Maps");

		//Game Tree Overlay
		const TreeOverlayBounds = L.latLngBounds([mapSettings.MapBounds.getNorth() - mapSettings.MapTreeOverlayYOffset, mapSettings.MapBounds.getWest()],[mapSettings.MapBounds.getSouth() - mapSettings.MapTreeOverlayYOffset, mapSettings.MapBounds.getEast()]);
		let mapTreeOverlayImg = L.imageOverlay(mapSettings.MapTreeImage, TreeOverlayBounds, {interactive:false}).addTo(this.map);
		this.groupLayerController.addOverlay(mapTreeOverlayImg, "Map Trees", "General");
		
		//Mod border img test
		//let mapModBorder = L.imageOverlay("./img/modborder.png", mapSettings.MapBounds, {interactive:false});
		//this.groupLayerController.addOverlay(mapModBorder, "Mod Borders", "Borders");
		
		//Create our grid layer and add it to our layer controller
		if(this.infoControl)
		{
			let grids = this.infoControl.createGridLayers();
			if(grids)
			{
				for(let i = 0; i < grids.length; i++)
				{
					
					this.groupLayerController.addOverlay(grids[i].layer, grids[i].name, "General");
				}
			}
		}
	},
	processAnvilData: function(mapHeight, mapWidth)
	{
		console.log("Starting map data processing");
		const sTime = Date.now();
		
		if(typeof Calligo01MapData === 'undefined')
		{
			console.warn("Map obj data missing, cannot process.");
			return;
		}
		
		console.log("Found map data with " + Calligo01MapData.length + " objs");
		
		if(typeof Calligo01GroupData === 'undefined')
		{
			console.warn("Map groups data missing, cannot process.");
			return;
		}
		
		console.log("Found group data with " + Calligo01GroupData.length + " objs");

		//let MapGroupNames = getmapGroups(worldData);
		//console.log(MapGroupNames);
	
		let mapGroups = this.groupMapObjects(Calligo01GroupData, Calligo01MapData);
		
		let hasDoneBorderDebug = false;
		
		for(let i =0; i < mapGroups.length; i++)
		{			
			let mapGrp = mapGroups[i];
			let heatData = [];
			
			//Skip certian map groups
			if(this.mapSettings.DebugFlags && this.mapSettings.DebugFlags.DebugRegionBorders === false)
			{
				if(mapGrp.GroupName === "Borders Debug")
					continue;
			}
			
			//Attempt to find a matching layer for this map group
			this.map.eachLayer(function(layer){
				if(layer.name == mapGrp.GroupName)
				{
					//Match on this layer, abort the function, duplicate names not supported
					console.log("Duplicate map grp name not supported")
					return;
				}
			});
			
			if(!mapGrp.MapObjs)
			{
				console.log("mapGrp \'" + mapGrp.GroupName + "\' has no attached MapObjs, will be skipped");
				continue;
			}
			
			console.log("Creating " + mapGrp.GroupName + " group layer with " + mapGrp.MapObjs.length + " objs");
				
			let group = L.layerGroup();
			let popupOptions = { maxWidth: 500 };
			
			let mapBorderPoints = [];
			
			for(let j = 0; j < mapGrp.MapObjs.length; j++)
			{
				let worldObj = mapGrp.MapObjs[j];
				let mapPos = GamePosToMapPos(worldObj.Pos);
				let shapes = [];
				
				//Handle our click/popup text
				let popupText = "";
				
				if(worldObj.Type)
					popupText += `Type: ${worldObj.Type}<br>`;
				
				if(worldObj.AltName)
					popupText += `Name: ${worldObj.AltName}<br>`;
			
				if(worldObj.Name)
					popupText += `Obj-Name: ${worldObj.Name}<br>Map Pos: ${[mapPos.Y, mapPos.X]}`;
				
				//Actually create the shapes
				if(mapGrp.GroupName === "Borders Debug" && hasDoneBorderDebug === false)
				{
					//TODO needs automation via the data
					if(this.mapSettings.DebugFlags && this.mapSettings.DebugFlags.DebugRegionBorders === true)
					{		
						//Y: 390840, X: 183160 - Parent
						//Y: 1302678.6, X: 794042.75 - Extents
						const halfHeight = 1302678.6 / 2;
						const halfWidth = 794042.75 / 2;
						let bounds = L.rectangle([[390840-halfHeight,183160-halfWidth],[390840+halfHeight, 183160+halfWidth]], {color: 'blue', weight: 1, fillOpacity: 0 , interactive:false});
						shapes.push(bounds);
						hasDoneBorderDebug = true;
					}
				}
				
				if (worldObj.Name.includes("BPMapBorderActor"))
				{
					//TODO this should be moved as it now has nothing to do with the worldObj itself
					//Also assumes there will always be a single one of these objects
					this._insertMapBorders(shapes, popupOptions);
				}
				else if (worldObj.Name.includes("BorderNorth"))
				{
					//Map Borders... they're all called BorderNorth
					//We just need to workout which point is which (in any order)
					if(mapBorderPoints.length == 3)
					{
						let leftPos = 0;
						let rightPos = 0;
						let topPos = 0;
						let bottomPos = 0;
						
						mapBorderPoints.push(mapPos);
						
						for(let i = 0; i < mapBorderPoints.length; i++)
						{
							if(mapBorderPoints[i].X < leftPos)
							{
								leftPos = mapBorderPoints[i].X;
							}
							
							if(mapBorderPoints[i].X > rightPos)
							{
								rightPos = mapBorderPoints[i].X;
							}
							
							if(mapBorderPoints[i].Y > topPos)
							{
								topPos = mapBorderPoints[i].Y;
							}
							
							if(mapBorderPoints[i].Y < bottomPos)
							{
								bottomPos = mapBorderPoints[i].Y;
							}
						}
						
						//We should have worked out points positions now
						//if not I'm sure this is going to be jank
						let bounds = [[topPos,leftPos],[bottomPos,rightPos]];
						shapes.push(L.rectangle(bounds, { color: "red", fillColor: 'transparent', weight: 2, interactive: false }));
						
						console.log("Set MapRawBounds", bounds);
					}
					else
					{
						mapBorderPoints.push(mapPos);
					}
				}
				else
				{
					//Check if this obj has an image and plcae it within the bounds of our shape
					if(mapGrp.ImgName != null)
					{
						//Select the correct radius for the shape
						let rads = mapGrp.Radius;
						if(mapGrp.InsideRadius && mapGrp.InsideRadius > 0)
						{
							rads = mapGrp.InsideRadius;
						}
						
						let topLeftY = mapPos.Y - (rads * (mapGrp.ImgScale / 100));
						let topLeftX = mapPos.X - (rads * (mapGrp.ImgScale / 100));
							
						let bottomRightY = mapPos.Y + (rads * (mapGrp.ImgScale / 100));
						let bottomRightX = mapPos.X + (rads * (mapGrp.ImgScale / 100));
													
						const topLeft = [topLeftY, topLeftX];
						const bottomRight = [bottomRightY, bottomRightX];

						const imgBounds = L.latLngBounds(topLeft, bottomRight);
							
						shapes.push(L.imageOverlay("./img/icons/" + mapGrp.ImgName, imgBounds, {opacity: 0.7, className: 'ResImg'}));
						
						//let debug = L.rectangle(ImgBounds, { color: "red", weight: 1 });
						//group.addLayer(debug);
					}

					//Some areas should be donut shaped with a minimum radius
					if(mapGrp.InsideRadius > 0)
					{
						shapes.push(L.donut([mapPos.Y, mapPos.X],{ radius: mapGrp.Radius, innerRadius: mapGrp.InsideRadius, color: mapGrp.HexColour}).bindPopup(popupText, popupOptions));
					}
					else
					{
						//Main circle shape for most objects
						if(mapGrp.GroupName == "Location Markers")
						{
							shapes.push(L.marker([mapPos.Y, mapPos.X], { opacity: 0, interactive: false }).bindTooltip(worldObj.AltName, {permanent: true, direction: "center", className: "tooltipLabels", offset: [-20, 30] }));
						}
						else
						{
							shapes.push(L.circle([mapPos.Y, mapPos.X], { radius: mapGrp.Radius, color: mapGrp.HexColour }).bindPopup(popupText, popupOptions));
						}
						
						//Testing heatmap stuff, duplicate data points for effect
						if(this.mapSettings.DebugFlags && this.mapSettings.DebugFlags.DebugDoHeatMap)
						{
							let posMultiplier = 5;
							if(worldObj.AltName && worldObj.AltName.includes("Branch"))
							{
								posMultiplier = 100;
							}
							
							for(let i = 0; i < posMultiplier; i++)
							{
								heatData.push([mapPos.Y, mapPos.X]);
							}
						}
					}
				}
				
				//Add any shapes/layers into our group
				for(let s = 0; s < shapes.length; s++)
				{
					group.addLayer(shapes[s]);
				}
			}
			
			//Tag our group of layers with a group name under a its parent group name
			if(mapGrp.ParentGroupName)
			{
				this.groupLayerController.addOverlay(group, mapGrp.GroupName, mapGrp.ParentGroupName);
				
				if(mapGrp.GroupName == "Location Markers")
				{
					group.addTo(this.map);
				}
				
				if(this.mapSettings.DebugFlags && this.mapSettings.DebugFlags.DebugDoHeatMap === true && heatData.length > 0)
				{
					//Good heat values for trees
					//TODO tweak values for other object types
					let HeatLayer = L.heatLayer(heatData, 
					{
						radius:20,
						blur: 0,
						maxZoom: 1,
					});
					
					this.groupLayerController.addOverlay(HeatLayer, mapGrp.GroupName + " Heat", mapGrp.ParentGroupName);
				}
			}
			else
			{
				this.groupLayerController.addOverlay(group, mapGrp.GroupName, "Misc");
			}
		}
	
		console.log(`Finished world obj mapping, took ${Date.now() - sTime}ms`);
		this.isDataLoaded = true;
		let loadingEle = document.getElementById('loadingOverlay');
		if(loadingEle)
			loadingEle.style.display = "none";
	},
	_insertMapBorders: function(OutputShapes, PopupOptions)
	{
		const RegionsHeight = this.mapSettings.RegionBorders.Height;
		const RegionsWidth = this.mapSettings.RegionBorders.Width;
		const BorderSize = this.mapSettings.RegionBorders.BorderSize;
		const BorderBounds = this.mapSettings.RegionBorders.Bounds ?? this.mapSettings.MapBounds;

		//Cursed
		const RegionWidth = (BorderBounds.getEast() - BorderBounds.getWest()) / RegionsWidth;
		const RegionHeight = (BorderBounds.getNorth() - BorderBounds.getSouth()) / RegionsHeight;

		const MapTop = BorderBounds.getNorth();
		const MapLeft = BorderBounds.getWest();
		const MapBottom = this.mapSettings.RegionBorders.BoundsBottomOverride ?? BorderBounds.getSouth();//Manual replace for border resize but we want to keep hoz borders the same
					
		//Vertical Region Borders
		for(let rH = 1; rH <= RegionsHeight; rH++)
		{
			for(let rW = 1; rW <= RegionsWidth-1; rW++)
			{
				//Used by vertical borders for offset from the left
				const LeftOffset = this.mapSettings.RegionBorders.OffsetsX ? this.mapSettings.RegionBorders.OffsetsX[rW-1] : 0;
				
				//Remember its Y,X
				const TopLeft = [MapTop - (RegionHeight * (rH-1)), (MapLeft - LeftOffset) + ((RegionWidth * rW) - (BorderSize/2))];
				const BottomRight = [Math.max(MapTop - (RegionHeight * (rH)),MapBottom), (MapLeft - LeftOffset) + ((RegionWidth * rW) + (BorderSize/2))];
				const bounds = [TopLeft, BottomRight];
							
				//console.log("Bottom right ", BottomRight, MapBottom);
							
				let col = "#ff7800" //`#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0').toUpperCase()}`;
							
				OutputShapes.push(L.rectangle(bounds, { color: col, weight: 2 }).bindPopup("Region Border", PopupOptions));
			}
		}
					
		//Horizontal Region Borders
		for(let rH = 1; rH <= RegionsHeight - 1; rH++)
		{
			for(let rW = 1; rW <= RegionsWidth; rW++)
			{
				//Used by horizontal borders for offset from the top
				const TopOffset = this.mapSettings.RegionBorders.OffsetsY ? this.mapSettings.RegionBorders.OffsetsY[rH-1] : 0;
				
				//Remember its Y,X
				const TopLeft = [(MapTop - TopOffset) - ((RegionHeight * rH) - (BorderSize/2)), MapLeft + (RegionWidth * (rW - 1))];
				const BottomRight = [(MapTop - TopOffset) - (RegionHeight * rH) - (BorderSize/2), MapLeft + (RegionWidth * rW)];
				const bounds = [TopLeft, BottomRight];
							
				let col = "#ff7800"; //`#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0').toUpperCase()}`;
							
				OutputShapes.push(L.rectangle(bounds, { color: col, weight: 2 }).bindPopup("Region Border", PopupOptions));
			}
		}
	},
	/*Attach map objects onto their parent group via GroupID*/
	groupMapObjects: function(groupObjs, mapObjs)
	{
		for(let i=0; i < groupObjs.length; i++)
		{
			for(let j =0; j < mapObjs.length; j++)
			{
				if(groupObjs[i].GroupID == mapObjs[j].GroupID)
				{
					if(!groupObjs[i].MapObjs){
						groupObjs[i].MapObjs = [mapObjs[j]];
						continue;
					}
						
					groupObjs[i].MapObjs.push(mapObjs[j]);
				}
			}
		}
		
		return groupObjs;
	},
	insertMapCrossingPaths: function()
	{
		let pathOptions = { color: 'blue', weight: 5, opacity: 1 };
		
		let crossing1 = L.polyline( [[433280, -50624], [428992, -50624]], pathOptions).bindPopup("Two way crossing");
		let crossing2 = L.polyline( [[434368, -145088], [432576, -144256]], pathOptions).bindPopup("Two way crossing");
		let crossing3 = L.polyline( [[512000, -128448], [512832, -130432]], pathOptions).bindPopup("One way crossing, bottom/right to top/left only");
		let crossing4 = L.polyline( [[474816, -130816], [472768, -129472]], pathOptions).bindPopup("Two way crossing");
		let crossing5 = L.polyline( [[440064, -163648], [438144, -165056]], pathOptions).bindPopup("Two way crossing");
		let crossing6 = L.polyline( [[122304, -37696], [120192, -36864]], pathOptions).bindPopup("Two way crossing");
		
		let crossingsGrp = L.layerGroup();
		crossingsGrp.addLayer(crossing1);
		crossingsGrp.addLayer(crossing2);
		crossingsGrp.addLayer(crossing3);
		crossingsGrp.addLayer(crossing4);
		crossingsGrp.addLayer(crossing5);
		crossingsGrp.addLayer(crossing6);
		
		this.groupLayerController.addOverlay(crossingsGrp, "River Crossings", "General");
	},
};

//Draw panel tab types
const DrawTabType = Object.freeze({
	Tool: 'tools',
	Radius: 'radius',
	Icon: 'icons',
});

//Define static map settings
class MapSettings
{
	MapHeight = 1110000;
	MapWidth = 800000;
	YOriginOffset = -423130;
	XOriginOffset = 197310;
	PosYOffset = 0;
	PosXOffset = 0;
	MapBounds = L.latLngBounds([0,0],[0,0]); //MapHeight and MapWidth form this bounds with the offset, this only applies to the content inside the map image
	MapImage = './img/AnvilMap_Nov27.png';
	MapTreeImage = './img/AnvilMapTreeLayerCustom.png';
	MapTreeOverlayYOffset = 0;
	MapTopoImage = './img/GigaMap_TopgoGraphic.png';
	MapImageOld = './img/AnvilMapOld.png';
	GridWidth = 20;
	GridHeight = 30;
	GridMarkers = true;
	BorderHalfH = 1302678.6 / 2;
	BorderHalfW = 794042.75 / 2;
	RegionBorders = 
	{
		Height:3, 
		Width:2,
		BorderSize: 9600,
		Bounds: L.latLngBounds([[390840-this.BorderHalfH,183160-this.BorderHalfW],[390840+this.BorderHalfH, 183160+this.BorderHalfW]]), //Bounds based of the map border obj positions
		//BoundsBottomOverride: -124191.83, 
		//OffsetsX:[1000], 
		//OffsetsY:[61500,71000] //Each array entry aligns with each border
	};
	DebugFlags =
	{
		DebugRegionBorders: false,
		DebugDrawLayerBounds:false,
		DebugDoHeatMap: false
	}
	constructor() 
	{
		this.PosYOffset = (this.MapHeight / 2) -  Math.abs(this.YOriginOffset);
		this.PosXOffset = (this.MapWidth / 2)  - Math.abs(this.XOriginOffset);
		this.MapBounds = L.latLngBounds([this.PosYOffset * -1, this.PosXOffset * -1], [this.MapHeight - this.PosYOffset, this.MapWidth - this.PosXOffset]);
	}
}

leafMap.init();

/*Misc Functions and classes*/
function RelativePos(v1, v2)
{
	return [v1[0] + v2[0], v1[1] + v2[1]];
}

//Convert a game map position to a leaflet map world position
function GamePosToMapPos(pos)
{
	return {
		Y: pos.Y * -1,
		X: pos.X
	};
}

/*Add a extra tag onto layer groups*/
L.LayerGroup.include({
    getLayerTag: function (tag) {
        for (var i in this._layers) {
            if (this._layers[i].tag == tag) {
               return this._layers[i];
            }
        }
    }
});