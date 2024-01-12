var raidManager = {
	structureElements:[],
	structureData:[],
	init:function(){
		console.log("Init raid");
		
		const self = this;
		
		document.addEventListener("DOMContentLoaded", () => 
		{
			self._setupPage();
			
			//Fetch wiki item data (codename, name, icon)
			//const weaponPromise = wikiQuery('https://anvilempires.wiki.gg/index.php?title=Special:CargoExport&tables=tools,&fields=tools.CodeNameString,tools.NameText,tools.Icon,tools.DamageType1,tools.Damage1,tools.DamageType2,tools.Damage2,tools.IsReleasedAndEnabled&limit=2000&format=json');
			/*weaponPromise.then(function(data){
				console.log(`Got tool data with \'${data.length}\' entires`);
				//self._fillItemElements(data);
			});*/

			//Fetch wiki structure data (all of it)
			const structPromise = wikiQuery('https://anvilempires.wiki.gg/index.php?title=Special:CargoExport&tables=structuretiers,&fields=structuretiers.CodeNameString,structuretiers.NameText,structuretiers.Icon,structuretiers.Tier,structuretiers.IsBaseTier,structuretiers.MaxHealth,structuretiers.BuildSiteCategory,structuretiers.IsReleasedAndEnabled,&limit=2000&format=json');
			structPromise.then(function(data){
				console.log(`Got Struct data with \'${data.length}\' entires`);
				self._fillStructData(data);
				self._fillStructureRows(self.structureData, self.gridParentEle, self.rngInputEle);
			});
		});
	},
	_setupPage:function()
	{
		const self = this;
		
		const parent = document.getElementById("content");
		const gridWrapper = document.createElement("div");
		gridWrapper.id="gridWrap";
		parent.appendChild(gridWrapper);
		
		const gridTop = document.createElement("div");
		gridTop.id="gridTop";
		gridWrapper.appendChild(gridTop);
	
		const descEle = document.createElement("p");
		descEle.innerHTML = "This table displays the brute force damage required to destory the target. The 'Min' value assumes no rng and maximum possible damage, the 'Max' assumes the same but a set amount extra to counter the unknown RNG. 20% extra minimum is recomended. This does *NOT* factor in any burn damage.<br>This is all based off the current understanding of damage, and could be incorrect.";
		gridTop.appendChild(descEle);
		
		const searchEle = document.createElement("input");
		searchEle.type = "text";
		searchEle.placeholder = "Search...";
		this.searchInputEle = searchEle;
		searchEle.addEventListener('input', function () {
			self._applySearch();
		});
		gridTop.appendChild(searchEle);

		const rngLbl = document.createElement("label");
		rngLbl.innerHTML="Extra %:";
		gridTop.appendChild(rngLbl);
		
		const rngInputEle = document.createElement("input");
		rngInputEle.type = "text";
		rngInputEle.style.width = "25px";
		rngInputEle.value = "20";
		rngInputEle.placeholder = "RNG Extra";
		rngInputEle.addEventListener('input', function () {
			//This is also very cursed
			if(!isNaN(this.value))
			{
				let rowsParent = document.getElementById("gridBottom");
				rowsParent.innerHTML = "";
				self._fillStructureRows(self.structureData, self.gridParentEle, self.rngInputEle);//Lets just throw everything away and restart!
			}
		});
		this.rngInputEle = rngInputEle;
		gridTop.appendChild(rngInputEle);
		
		const gridBottom = document.createElement("div");
		gridBottom.id="gridBottom";
		this.gridParentEle = gridBottom;
		gridWrapper.appendChild(gridBottom);
	},
	_fillStructData:function(data)
	{
		if(!data)
		{
			console.log("No structure data to fill grid");
			return;
		}
		
		for(let i = 0; i < data.length; i++)
		{
			if(data[i].MaxHealth == 0 || data[i].IsReleasedAndEnabled === 0)
			{
				continue;
			}
			
			this.structureData.push({codename:data[i].CodeNameString,name:data[i].NameText,tierText:data[i].Tier > 0 && !data[i].NameText.includes("Tier") ? ` (T${data[i].Tier})` : "",iconLink:`https://anvilempires.wiki.gg/wiki/Special:Redirect/file/${data[i].Icon}`,health:data[i].MaxHealth});
		}
		
		console.log("Finished struct data with " + this.structureData.length);
	},
	_fillStructureRows:function(data, parent, rngExtraValue)
	{
		if(!data)
		{
			console.log("No structure data to fill grid");
			return;
		}		
		
		const self = this;
		
		//TODO remove and handle with tools
		const TORCH_DMG = 10;
		const FLASK_DMG = 30;
		const RAM_DMG = 250;
		
		//Flush our list before we refill it
		this.structureElements = [];
		
		//Temp fixed header
		const headerRow = document.createElement("div");
		headerRow.className = "row row-header";
		const cell_1 = document.createElement("div");
		cell_1.innerHTML = "Structure";
		cell_1.className = "cell cell-name";
		const cell_2 = document.createElement("div");
		cell_2.innerHTML = "Health (Default/Extra)";
		cell_2.className = "cell cell-hp";
		const cell_3 = document.createElement("div");
		cell_3.innerHTML = "Torch (Min/Max)";
		cell_3.className = "cell";
		const cell_4 = document.createElement("div");
		cell_4.innerHTML = "Flasks (Min/Max)";
		cell_4.className = "cell";
		const cell_5 = document.createElement("div");
		cell_5.innerHTML = "Ram (Min/Max)";
		cell_5.className = "cell";
		headerRow.appendChild(cell_1);
		headerRow.appendChild(cell_2);
		headerRow.appendChild(cell_3);
		headerRow.appendChild(cell_4);
		headerRow.appendChild(cell_5);
		parent.appendChild(headerRow);

		//Build our structures into the data we want
		for(let i = 0; i < data.length; i++)
		{			
			const row = document.createElement("div");
			row.className = "row";

			//Column cells in each row
			for(let j =0; j < 5; j++)
			{
				const cell = document.createElement("div");
				let cellClass = "cell " + (j == 0 ? "cell-name" : "");
				cell.className = cellClass;
				
				//I Hate all of this
				switch(j)
				{
					case 0:
						cell.innerHTML = `<img src=${data[i].iconLink} width="48" height="48"><span>${data[i].name}${data[i].tierText}</span>`;
					break;
					case 1:
						cell.innerHTML = `<span>${data[i].health} / ${data[i].health + (data[i].health * (rngExtraValue.value / 100))}</span>`;
					break;
					case 2:
						cell.innerHTML = `<span>${Math.ceil(data[i].health / TORCH_DMG)} / ${Math.ceil(data[i].health / TORCH_DMG + data[i].health / TORCH_DMG * (rngExtraValue.value / 100))}</span>`;
					break;
					case 3:
						cell.innerHTML = `<span>${Math.ceil(data[i].health / FLASK_DMG)} / ${Math.ceil(data[i].health / FLASK_DMG + data[i].health / FLASK_DMG * (rngExtraValue.value / 100))}</span>`;
					break;
					case 4:
						cell.innerHTML = `<span>${Math.ceil(data[i].health / RAM_DMG)} / ${Math.ceil(data[i].health / RAM_DMG + data[i].health / RAM_DMG * (rngExtraValue.value / 100))}</span>`;
					break;
					default:
						cell.innerHTML = `<span>Cell [${i},${j}]</span>`;
					break;
				}
				row.appendChild(cell);
			}
			
			//Codename as key for each row element
			this.structureElements.push({codename:data[i].codename, ele:row});
			
			parent.appendChild(row);
		}
		
		console.log("Finished rows");
		
		//Test if we need to apply results of a search
		this._applySearch();
	},
	_applySearch()
	{
		if(!this.searchInputEle)
			return;
		
		const rows = document.querySelectorAll('.row:not(.row-header)');

		const searchValue = this.searchInputEle.value.toLowerCase();
		rows.forEach(function (row) 
		{
			let rowText = row.innerText.toLowerCase();
			row.style.display = (rowText.includes(searchValue) || rowText == "") ? 'flex' : 'none';
		});
	}
}

raidManager.init();

/*Misc Functions and classes*/
function wikiQuery(Url)
{
	return rawQuery('https://corsproxy.io/?',Url);
}

async function rawQuery(proxyUrl, apiUrl) {
  try {
    const response = await fetch(`${proxyUrl}${apiUrl}`);
    
    if (!response.ok) {
      throw new Error(`Request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
	
  } catch (error) {
    console.error("RawQuery error:", error);
  }
}