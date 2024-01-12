L.Control.Watermark = L.Control.extend({
    onAdd: function(map) {
		
		var container = L.DomUtil.create('div');
		container.style.pointerEvents = 'none';
		var h1 = L.DomUtil.create('h1');
		container.appendChild(h1);
		
		h1.innerHTML= this.options.text;
		h1.style.color = 'white';
		h1.style.background = '#0000005e';
		h1.style.padding = '5px';
		h1.style.pointerEvents = 'none';
		
		L.DomEvent.disableClickPropagation(container);
		L.DomEvent.disableClickPropagation(h1);
		
        return container;
    },

    onRemove: function(map) {}
});

L.control.watermark = function(options) {
    return new L.Control.Watermark(options);
}