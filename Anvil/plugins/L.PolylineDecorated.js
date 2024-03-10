/*
* Polyline using a L.polylineDecorator
* PolylineDecorator should be loaded before this script
*/
L.PolylineDecorated = L.Polyline.extend({
    initialize: function (latlngs, options) 
	{
		//Fix colour change issues for the decorator by killing any refrences to this obj
		options = this._deepCopyOptions(options);
		
        L.setOptions(this, options);
		this._setLatLngs(latlngs);
		
		this._decorator = L.polylineDecorator(this, null);
		this.buildPatterns();
    },
    onAdd: function(map) 
	{
		this._map = map;
		this._decorator.addTo(this._map);
		        
		L.Polyline.prototype.onAdd.call(this, map);
    },
	onRemove: function(map) 
	{
		if(this._map)
		{
			this._map.removeLayer(this._decorator);
		}
		
		L.Polyline.prototype.onRemove.call(this, map);
    },
	setLatLngs: function(latlngs) 
	{
		this._decorator.setPaths(latlngs);
		L.Polyline.prototype.setLatLngs.call(this, latlngs);
    },
	setStyle: function (style) 
	{
        this._decorator.setStyle(style);
		L.Polyline.prototype.setStyle.call(this, style);
		
		this._updateColor(this._decorator.options, style.color);
    },
	buildPatterns: function()
	{
		const decoOptions = this.options.decorationOptions;
		
		const patterns = [];
		for(let i = 0; i < decoOptions.patterns.length; i++)
		{
			const pattern = decoOptions.patterns[i];
			const symbolObj = pattern.symbolObj;
			
			const symbol = new symbolObj.type(symbolObj.options);
			
			patterns.push({offset:pattern.offset, repeat:pattern.repeat, symbol:symbol});
		}
		
		if(patterns.length > 0)
		{
			this._decorator.setPatterns(patterns);
		}
	},
	_deepCopyOptions: function(options)
	{
		let newOpts = JSON.parse(JSON.stringify(options));
		
		//We need to parse the refrence the the sumbol constructor through
		const decoOptions = newOpts.decorationOptions;
		for(let i = 0; i < decoOptions.patterns.length; i++)
		{
			decoOptions.patterns[i].symbolObj.type = options.decorationOptions.patterns[0].symbolObj.type;
		}
		
		return newOpts;
	},
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
	}
});


L.polylineDecorated = function (latlngs, options) {
    return new L.PolylineDecorated(latlngs, options);
};

/*
* Ruler Polyline
*/
L.PolylineRuler = L.Polyline.extend({
	initialize: function (latlngs, options) 
	{
        L.setOptions(this, options);
		this._setLatLngs(latlngs);
    },
    onAdd: function(map) 
	{
		this._map = map;
		L.Polyline.prototype.onAdd.call(this, map);
    },
	onRemove: function(map) 
	{
		L.Polyline.prototype.onRemove.call(this, map);
    },
	setLatLngs: function(latlngs) 
	{
		L.Polyline.prototype.setLatLngs.call(this, latlngs);
		this._updateLength();
    },
	_updateLength: function()
	{
		const distance = this._getLength();
		if(distance > 0)
		{
			let latDiff = Math.abs(this.getLatLngs()[0].lat - this.getLatLngs()[1].lat);
			let lngDiff = Math.abs(this.getLatLngs()[0].lng - this.getLatLngs()[1].lng);
			
			let dir = "top";
			if(latDiff > lngDiff)
			{
				dir = "right";
			}
			
			//Display travel time if a unit rate is set
			let travelTimeString;
			if(this.options.doTravelTime && this.options.doTravelTime === true && this.options.travelTimeUnit && this.options.travelTimeUnit > 0)
			{
				const SecTotal = (distance)/this.options.travelTimeUnit;
				const Mins = Math.floor(SecTotal / 60);
				const RemSec = SecTotal % 60;
				travelTimeString = SecTotal > 59 ? `${Mins} Minutes, ${RemSec.toFixed(0)} Seconds` : `${SecTotal.toFixed(2)} Seconds`;
			}
			
			this.bindTooltip(`${this.options.doTravelTime?"Dis: ":""}${this._formatNumber((distance/100).toFixed(2))} meters${travelTimeString ? `<br>${this.options.travelTimeTerm?this.options.travelTimeTerm:"Duration"}:${travelTimeString}`:""}`, { permanent: true, direction: dir }).openTooltip();
		}
	},
	_getLength: function()
	{
		/*let lastPoint;
		this.getLatLngs().forEach(function (latLng))
		{
			if (lastPoint) 
			{
				L.marker(latLng).bindPopup(`Distance from previous point: ${lastPoint.distanceTo(latLng).toFixed(2)} meter(s)`).addTo(map);
			}
			
			lastPoint = latLng;
		});*/
		
		
		const latlngs = this.getLatLngs();
        let distance = 0;

        for (let i = 0; i < latlngs.length - 1; i++) {
			if(this._map.options.crs === L.CRS.Simple)
			{
				distance += this._map.distance(latlngs[i], latlngs[i + 1]);
			}
			else
			{
				distance += (latlngs[i].distanceTo(latlngs[i + 1])); //Uses some earth pi BS
			}
        }
		
        return distance;
	},
	_formatNumber(num)
	{
		return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}
});

L.polylineRuler = function (latlngs, options) {
    return new L.PolylineRuler(latlngs, options);
};


/*
* Position Marker
*/
L.PositionMarker = L.Marker.extend({
	options: {
        draggable: true,
		interactive: true
    },
	initialize: function (latlngs, options){

		L.setOptions(this, options);
		this.setLatLng(latlngs);
		
		this.updateTooltipContent();
		this.bindTooltip(this._tooltipContent,{ permanent:true, direction:"center", offset:L.point(-15,-35), className:"draw-panel-marker-tooltip"});
    },
	onAdd: function(map) 
	{
		this._map = map;
		L.Marker.prototype.onAdd.call(this, map);
		this.on('drag', this.updateTooltipContent, this);
    },
	onRemove: function(map) 
	{
		L.Marker.prototype.onRemove.call(this, map);
    },
	setLatLng: function(latlngs) 
	{
		L.Marker.prototype.setLatLng.call(this, latlngs);
    },
	updateTooltipContent: function()
	{
		this._tooltipContent = `Y:${this.getLatLng().lat * -1},X:${this.getLatLng().lng}`;
		this.setTooltipContent(this._tooltipContent);
	}
	
});
L.positionMarker = function (latlng, options) {
    return new L.PositionMarker(latlng, options);
};

/*
* Composite circle (Circle with other layers attached)
*/
L.CompositeCircle = L.Circle.extend({
	initialize: function (latlng, options)
	{
		//Default leaflet circle stuff
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
		if (isNaN(this.options.radius))
		{
			throw new Error('Circle radius cannot be NaN'); 
		}
		
		this._mRadius = this.options.radius;
		
		//Custom stuff
		this._layers = [];
	},
	onAdd: function(map) 
	{
		this._map = map;
		L.Circle.prototype.onAdd.call(this, map);
			
		//Load all our options layers onto the map
		if(this.options && this.options.compOptions)
		{
			const compOptions = this.options.compOptions;
			if(compOptions.middleDot === true)
			{
				let dot = new L.Circle(this._latlng, {radius: 100, color:this.options.color, interactive: false }).addTo(this._map);;
				this.addLayer(dot);
			}
			
			if(compOptions.layers && Array.isArray(compOptions.layers) && compOptions.layers.length > 0)
			{
				const layers = compOptions.layers;
				for(let i =0; i < layers.length; i++)
				{
					let layer = new layers[i].type(this._latlng, layers[i].compOptions).addTo(this._map);
					this.addLayer(layer);
				}
			}
		}
	},
	onRemove: function(map) 
	{
		L.Circle.prototype.onRemove.call(this, map);
		
		if(map && this._layers)
		{
			for(let i =0; i < this._layers.length; i++)
			{
				map.removeLayer(this._layers[i]);
			}
		}
	},
	setLatLng: function(latlng) 
	{
		L.Circle.prototype.setLatLng.call(this, latlng);
		this._update();
    },
	setStyle: function(style) 
	{
		L.Circle.prototype.setStyle.call(this, style);
		this._update(style);
    },
	getBounds: function()
	{
		return L.Circle.prototype.getBounds.call(this);
	},
	_update: function(input)
	{
		if(this._layers)
		{
			for(let i =0; i < this._layers.length; i++)
			{
				if(this._layers[i].setLatLng)
				{
					this._layers[i].setLatLng(this._latlng);
				}
				
				if(this._layers[i].setStyle)
				{
					this._layers[i].setStyle(input);
				}
			}
		}
	},
	addLayer: function(layer) 
	{
		this._layers.push(layer);
	},
});


L.compositeCircle = function (latlng, options) {
    return new L.CompositeCirle(latlng, options);
};
