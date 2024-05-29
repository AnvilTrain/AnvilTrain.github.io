const RaidManagerTab = Object.freeze({
  List: 'list',
  Calculator: 'calc'
});

const StaticDmgValue = Object.freeze({
  Torch: 10,
  Flask: 20,
  Ram: 250
})

const StaticRngRange = Object.freeze({
  Min: 0.75,
  Max: 1.25
})


const ListTableColumns = [
	{id:1, name:"Structure", class:"cell-name"},
	{id:2, name:"Health (Default/Extra)"},
	{id:3, name:"Torch (Min/Max)"},
	{id:4, name:"Flask (Min/Max)"},
	{id:5, name:"Ram (Min/Max)", class:"cell-last"}
];

const raidManager = {
	structureData:[],
	listStructureElements:[],
	calcStructureElements:[],
	tabList:{},
	currentTab:{},
	init:function(){
		console.log("Init raid");
		
		const self = this;
		
		document.addEventListener("DOMContentLoaded", () => 
		{
			self._setupTabs();
			
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
				self._fillListStructureRows(self.structureData, self.structureListParentEle, self.rngInputEle);
				self._fillRaidCalcStructureList(self.structureData, self.structureCraftParentEle);
			});
			
			//Starting Tab
			self._setTab(RaidManagerTab.List);
		});
	},
	/*Setup our tabs*/
	_setupTabs:function()
	{
		let self = this;
		const listTabBtn = document.getElementById("listTabBtn");
		const listTabContainer = document.getElementById("listTab");
		
		const calcTabBtn = document.getElementById("calcTabBtn");
		const calcTabContainer = document.getElementById("calcTab");
			
		//define our tabs with attached elements
		this.tabList[RaidManagerTab.List] = {id:RaidManagerTab.List, tabButton: listTabBtn, tabContainer: listTabContainer, tabElements: this.listStructureElements};
		this.tabList[RaidManagerTab.Calc] = {id:RaidManagerTab.Calc, tabButton: calcTabBtn, tabContainer: calcTabContainer, tabElements: this.calcStructureElements};	
		
		listTabBtn.addEventListener('click', function() {
			self._setTab(RaidManagerTab.List);
		});

		calcTabBtn.addEventListener('click', function() {
			//self._setTab(RaidManagerTab.Calc);
		});
		
		this._setupListTab();
		this._setupCalcTab();
	},
	/*Switches to a specific tab*/
	_setTab:function(tabName)
	{
		if(this.tabList && this.tabList[tabName])
		{
			//Current tab and new tab is not the same
			if(this.currentTab != this.tabList[tabName])
			{
				//Clear search before we switch
				if(this.searchListInputEle)
				{
					this._applySearchCalc();
					this.searchListInputEle.value = "";
				}
					
				if(this.searchCalcInputEle)
				{
					this.searchCalcInputEle.value = "";
					this._applySearchList();
				}
					
				//Now switch tabs
				this.currentTab = this.tabList[tabName];
				this.currentTab.tabButton.classList.remove('raidTabBtn-disabled');
				this.currentTab.tabContainer.style.display = "flex";

				//Update the other tabs
				for(let tabName in this.tabList)
				{
					let tab = this.tabList[tabName];
					
					if(tab.id != this.currentTab.id)
					{
						tab.tabButton.classList.add('raidTabBtn-disabled');
						tab.tabContainer.style.display = "none";
					}
				}
				
				console.log(`Switched tab to ${this.currentTab.id}`);
			}
		}
	},
	_setupListTab:function()
	{
		const self = this;
		
		//const parent = document.getElementById("listTab");
		//const gridTopWrap = document.getElementById("listWrap");
		
		this.structureListParentEle = document.getElementById("listBottomContent");
		
		this.searchListInputEle = document.getElementById("listSearchbar");
		this.searchListInputEle.addEventListener('input', function () {
			self._applySearchList();
		});

		this.rngInputEle = document.getElementById("listRng");
		
		if(this.rngInputEle)
		{
			this.rngInputEle.style.width = "25px";
			this.rngInputEle.value = "20";
			this.rngInputEle.placeholder = "RNG Extra";
			this.rngInputEle.addEventListener('input', function () {
				//This is also very cursed
				if(!isNaN(this.value))
				{
					let rowsParent = document.getElementById("listBottomContent");
					rowsParent.innerHTML = "";
					self._fillListStructureRows(self.structureData, self.structureListParentEle, self.rngInputEle);//Lets just throw everything away and restart!
				}
			});
		}

	},
	_setupCalcTab:function()
	{
		const self = this;
		const parent = document.getElementById("calcTab");
		
		this.searchCalcInputEle = document.getElementById("calcSearch");
		this.searchCalcInputEle.addEventListener('input', function () {
			self._applySearchCalc();
		});
		
		this.structureCraftParentEle = document.getElementById("calcLeftBottom");
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
			if(!data[i].MaxHealth || data[i].MaxHealth === 0 || data[i].IsReleasedAndEnabled === 0)
			{
				continue;
			}
			
			//Cache the damage per structure per source
			const dmg = [];
			for (const [key, value] of Object.entries(StaticDmgValue)) {
				dmg.push({Src:key, value: data[i].MaxHealth / value});
			}

			this.structureData.push(
			{
				structure:
				{
					codename:data[i].CodeNameString,
					name:data[i].NameText,
					tierText:data[i].Tier > 0 && !data[i].NameText.includes("Tier") ? ` (T${data[i].Tier})` : "",
					iconLink:`https://anvilempires.wiki.gg/wiki/Special:Redirect/file/${data[i].Icon}`,
					health:data[i].MaxHealth
				},
				dmg:dmg
			});
		}
		
		console.log("Finished struct data with " + this.structureData.length);
	},
	_fillListStructureRows:function(data, parent, rngExtraValue)
	{
		if(!data)
		{
			console.log("No structure data to fill struct list");
			return;
		}	
		
		const self = this;
		
		//Flush our list before we refill it
		this.listStructureElements = [];
		
		const headerRow = document.createElement("div");
		headerRow.className = "row row-header";
		
		for(let i = 0; i < ListTableColumns.length; i++)
		{
			const cell = document.createElement("div");
			cell.innerText = ListTableColumns[i].name;
			
			if(ListTableColumns[i].class)
				cell.className = `cell ${ListTableColumns[i].class}`;
			else
				cell.className = "cell";
			
			headerRow.appendChild(cell);
		}
		
		const listHeadParent = document.getElementById("listTopHeader");
		listHeadParent.innerHTML = "";
		listHeadParent.appendChild(headerRow);

		//Build our structures into the data we want
		for(let i = 0; i < data.length; i++)
		{	
			const structure = data[i].structure;
			const dmg = data[i].dmg;
	
			const row = document.createElement("div");
			row.className = "row";
			const rowData = {Health:structure.health};

			//Column cells in each row
			for(let j = 1; j <= ListTableColumns.length; j++)
			{
				const cell = document.createElement("div");
				let cellClass = `cell${(j == 1 ? " cell-name" : `${(j==5 ? " cell-last" : "")}`)}`;
				cell.className = cellClass;
				
				//I Hate all of this
				const cellText = document.createElement("span");
				switch(j)
				{
					case 1:
						const cellImg = document.createElement("img");
						cellImg.src = structure.iconLink;
						cellImg.width = "48";
						cellImg.height = "48";
						cell.appendChild(cellImg);
						
						cellText.innerText = `${structure.name}${structure.tierText}`;
					break;
					case 2:
						if(rngExtraValue)
							cellText.innerText = `${structure.health} / ${structure.health + (structure.health * (rngExtraValue.value / 100))}`;
						else
							cellText.innerText = `${structure.health}`;
					break;
					case 3:
						cellText.innerText = `${Math.ceil(structure.health / (StaticDmgValue.Torch * StaticRngRange.Max))} / ${Math.ceil(structure.health / (StaticDmgValue.Torch * StaticRngRange.Min))}`;
					break;
					case 4:
						cellText.innerText = `${Math.ceil(structure.health / (StaticDmgValue.Flask * StaticRngRange.Max))} / ${Math.ceil(structure.health / (StaticDmgValue.Flask * StaticRngRange.Min))}`;
					break;
					case 5:
						cellText.innerText = `${Math.ceil(structure.health / StaticDmgValue.Ram * StaticRngRange.Max)} / ${Math.ceil(structure.health / (StaticDmgValue.Ram * StaticRngRange.Min))}`;
					break;
					default:
						cellText.innerText = `Broken Cell [${i},${j}]`;
					break;
				}
				
				cell.appendChild(cellText);
				row.appendChild(cell);
			}
			
			//Codename as key for each row element
			this.listStructureElements.push({codename:structure.codename, rowData:rowData, ele:row});
			
			parent.appendChild(row);
		}
		
		//TODO store the list of structures elements into a temp list before sorting, then store the temp list in the listStructureElements
		//TODO Heading row has also been deleted...
		//Scuffed sort by HP (Swap b - a to change sort direction)
		this.listStructureElements.sort((a, b) => b.rowData.Health - a.rowData.Health);
		parent.innerHTML = "";
		for(let i = 0; i < this.listStructureElements.length; i++)
		{
			parent.appendChild(this.listStructureElements[i].ele);
		}
		
		
		console.log("Finished rows");
		
		//Test if we need to apply results of a search
		this._applySearchList();
	},
	_fillRaidCalcStructureList:function(data, parent)
	{
		if(!data)
		{
			console.log("No structure data to fill calc list");
			return;
		}
		
		const headerRow = document.createElement("div");
		headerRow.className = "row row-header";
		const cell_1 = document.createElement("div");
		cell_1.innerText = "Structure";
		cell_1.className = "cell cell-name";
		const cell_2 = document.createElement("div");
		cell_2.innerText = "Health (Default/Extra)";
		cell_2.className = "cell cell-hp";
		headerRow.appendChild(cell_1);
		headerRow.appendChild(cell_2);
		parent.appendChild(headerRow);
		
		//Build our structures into the data we want
		for(let i = 0; i < data.length; i++)
		{	
			const structure = data[i].structure;
	
			const row = document.createElement("div");
			row.className = "row";

			//Column cells in each row
			for(let j =0; j < 3; j++)
			{
				let cellEle = undefined;
				if(j == 2)
				{
					const rowAddButton = document.createElement("a");
					rowAddButton.className="calcTabAddButton"
					rowAddButton.innerText = "Add";
			
					rowAddButton.addEventListener('click', function() {
						//TODO
						//craftManager.addCraft(elementList,baseData.CodeNameString);
					});
					
					cellEle = rowAddButton;
				}
				else
				{
					const cell = document.createElement("div");
					let cellClass = "cell " + (j == 0 ? "cell-name" : "");
					cell.className = cellClass;
					cellEle = cell;
				}

				//I Hate all of this
				switch(j)
				{
					case 0:
						cellEle.innerHTML = `<img src=${structure.iconLink} width="48" height="48"><span>${structure.name}${structure.tierText}</span>`;
					break;
					case 1:
						cellEle.innerHTML = `<span>${structure.health} / ${structure.health}</span>`;
					break;
					case 2:
						//Don't worry about it, it handles itself in creation, also yes this code is shit
						break;
					default:
						cellEle.innerHTML = `<span>Cell [${i},${j}]</span>`;
					break;
				}
				row.appendChild(cellEle);
			}
			
			//Codename as key for each row element
			this.calcStructureElements.push({codename:structure.codename, ele:row});
			
			parent.appendChild(row);
		}
		
		//Test if we need to apply results of a search
		this._applySearchCalc();
	},
	_createDataRow:function()
	{
		
	},
	_applySearchList:function()
	{
		if(!this.searchListInputEle)
			return;
		
		const rows = document.querySelectorAll('.row:not(.row-header)');

		const searchValue = this.searchListInputEle.value.toLowerCase();
		rows.forEach(function (row) 
		{
			let rowText = row.innerText.toLowerCase();
			row.style.display = (rowText.includes(searchValue) || rowText == "") ? 'flex' : 'none';
		});
	},
	_applySearchCalc:function()
	{
		if(!this.searchCalcInputEle)
			return;
		
		const rows = document.querySelectorAll('.row:not(.row-header)');

		const searchValue = this.searchCalcInputEle.value.toLowerCase();
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