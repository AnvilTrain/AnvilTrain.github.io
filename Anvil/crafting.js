const CraftManagerTab = Object.freeze({
  Items: 'items',
  Structures: 'struct'
});

const craftManager = {
	productionData:[],
	structureElements:[],
	itemElements:[],
	craftList:[],
	craftTotals:[],
	tabList:{},
	currentTab:{},
	craftSettings:{},
	init:function(){
		console.log("Init crafting");
		
		this.craftSettings = new CraftSettings();
		var self = this;
		
		//Bind clicks for our tab buttons and filter dropdown after content load
		document.addEventListener("DOMContentLoaded", () => 
		{
			self._setupTabs();
			self._setupSearchBar();
			self._setupListClear();
			self._setupCatFilter();
			
			//Fetch wiki item data (codename, name, icon)
			const itemPromise = wikiQuery('https://anvilempires.wiki.gg/index.php?title=Special:CargoExport&tables=itemdata,&fields=itemdata.CodeNameString,itemdata.NameText,itemdata.Icon,itemdata.PrimaryTable,itemdata.IsReleasedAndEnabled&limit=2000&format=json');
			itemPromise.then(function(itemData){
				
				if(!itemData)
					return;
				
				console.log(`Got Item data with \'${itemData.length}\' entires`);
				self._fillItemElements(itemData);
				
				//Fetch wiki production data(all of it)
				const prodPromise = wikiQuery('https://anvilempires.wiki.gg/index.php?title=Special:CargoExport&tables=production,&fields=production.SourceCodeName,production.SourceType,production.SourceTier,production.ProducedItem,production.OutputCount,production.ProductionType,production.ProductionValue,production.CostInput1,production.CostInput1Count,production.CostInput2,production.CostInput2Count,production.CostInput3,production.CostInput3Count,production.bCrateProducedItems&limit=2000&format=json');
				prodPromise.then(function(prodData){
					self.productionData = prodData;
					self._bindRecipesToItems(prodData);
					
					console.log(`Got Prod data with \'${prodData.length}\' entires`);
				});
				
				//Get our category data and link it to our tab
				self._bindCatFilterData(CraftManagerTab.Items, itemData);
				
				//Set our tab, see _setupTabs for valid options
				self._setTab(CraftManagerTab.Items);
			});

			//Fetch wiki structure data (all of it)
			const structPromise = wikiQuery('https://anvilempires.wiki.gg/index.php?title=Special:CargoExport&tables=structuretiers,&fields=structuretiers.CodeNameString,structuretiers.NameText,structuretiers.Icon,structuretiers.Tier,structuretiers.IsBaseTier,structuretiers.RequiredTool,structuretiers.BuildSiteCategory,structuretiers.ResourceBranchesRequirement,structuretiers.ResourceFibreRequirement,structuretiers.AnimalFatRequirement,structuretiers.AnimalBonesRequirement,structuretiers.ProcessedLeatherRequirement,structuretiers.ProcessedWoodRequirement,structuretiers.ProcessedStoneRequirement,structuretiers.ProcessedIronRequirement,structuretiers.ReinforcedWoodRequirement,structuretiers.SilverRequirement,structuretiers.IsReleasedAndEnabled,&limit=2000&format=json');
			structPromise.then(function(structData){
				console.log(`Got Struct data with \'${structData.length}\' entires`);
				self._fillStructureElements(structData);
				
				//Get our category data and link it to our tab
				self._bindCatFilterData(CraftManagerTab.Structures, structData);
			});
			
		});
	},
	_setupTabs:function()
	{
		let self = this;
		const itemTabBtn = document.getElementById("left-side-item-tab");
		const itemTabContainer = document.getElementById("left-side-bottom-item");
		
		const structTabBtn = document.getElementById("left-side-structure-tab");
		const structTabContainer = document.getElementById("left-side-bottom-structure");
			
		//define our tabs with attached elements
		this.tabList[CraftManagerTab.Items] = {id:CraftManagerTab.Items, tabButton: itemTabBtn, tabContainer: itemTabContainer, tabElements: this.itemElements, CatFilterList: null, CatFilterKey:"PrimaryTable"};
		this.tabList[CraftManagerTab.Structures] = {id:CraftManagerTab.Structures, tabButton: structTabBtn, tabContainer: structTabContainer, tabElements: this.structureElements, CatFilterList: null, CatFilterKey:"BuildSiteCategory"};	
		
		itemTabBtn.addEventListener('click', function() {
			self._setTab(CraftManagerTab.Items);
		});

		structTabBtn.addEventListener('click', function() {
			self._setTab(CraftManagerTab.Structures);
		});
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
				clearSearchBtn = document.getElementById("left-side-search-clear");
				clearSearchBtn.click();
				
				//Now switch tabs
				this.currentTab = this.tabList[tabName];
				this.currentTab.tabButton.classList.remove('left-side-tab-button-disabled');
				this.currentTab.tabContainer.style.display = "flex";
				
				this._updateResultsText(this.currentTab.tabElements.length);
				
				//Set the data for the category filters
				if(this.currentTab.CatFilterList)
				{
					let select = document.getElementById("left-side-filter");
					select.disabled = false;
					this._populateSelectElement(select, this.currentTab.CatFilterList);
				}
				else
				{
					//This tab doesn't have any filter dropdown, disable it
					let select = document.getElementById("left-side-filter");
			
					//Reset selection
					select.selectedIndex = 0;
					select.dispatchEvent(new Event('change', {bubbles:true}));

					select.disabled = true;
				}
				
				//Update the other tabs
				for(let tabName in this.tabList)
				{
					let tab = this.tabList[tabName];
					
					if(tab.id != this.currentTab.id)
					{
						tab.tabButton.classList.add('left-side-tab-button-disabled');
						tab.tabContainer.style.display = "none";
					}
				}
				
				console.log(`Switched tab to ${this.currentTab.id}`);
			}
		}
	},
	_setupCatFilter:function()
	{
		let select = document.getElementById("left-side-filter");

		let self = this;

		//Bind to our cat options doprdown change event
		select.addEventListener("change", function() {
			if(self.currentTab.tabElements && self.currentTab.tabElements.length > 0)
			{
				let count = 0;
				for(let i = 0; i < self.currentTab.tabElements.length; i++ )
				{
					let tabEle = self.currentTab.tabElements[i];
						
					//None option should reset all
					if(select.value == "None")
					{
						tabEle.element.style.display = 'flex';
						count++;
						continue;
					}
						
					//Apply display settings to specific items
					if(tabEle.data.baseData[self.currentTab.CatFilterKey] != select.value)
					{
						tabEle.element.style.display = 'none';
					}
					else
					{
						tabEle.element.style.display = 'flex';
						count++;
					}	
				}
				
				self._updateResultsText(count);
			}
		});
	},
	//Extract our tab filter categorys from our data and find it to a specific tab
	_bindCatFilterData(tabID, data)
	{
		if(!this.tabList[tabID] || !this.tabList[tabID].CatFilterKey)
			return;
		
		let cats = [];
		for(let i = 0; i < data.length; i++)
		{
			if(data[i][this.tabList[tabID].CatFilterKey] && !cats.includes(data[i][this.tabList[tabID].CatFilterKey]))
			{
				if(data[i][this.tabList[tabID].CatFilterKey] === "" || data[i][this.tabList[tabID].CatFilterKey] == "World")
				{
					continue;
				}
					
				let d = data[i][this.tabList[tabID].CatFilterKey];
				cats.push(d);
			}
		}
			
		this.tabList[tabID].CatFilterList = cats;
	},
	_setupSearchBar:function()
	{
		let self = this;
		
		let searchBar = document.getElementById("left-side-search");
		searchBar.value = "";
		let clearSearchBtn = document.getElementById("left-side-search-clear");
		searchBar.addEventListener("input", function() {
				
			if(!self.currentTab)
			{
				return;
			}

			//Actually do the damn search
			if(self.currentTab && self.currentTab.tabElements.length > 0)
			{
				let tally = 0;
				for(let i = 0; i < self.currentTab.tabElements.length; i++ )
				{
					let currentObj = self.currentTab.tabElements[i];
						
					//Blank value should reset all elements
					if(searchBar.value === "")
					{
						currentObj.element.style.display = 'flex';
						tally++;
						continue;
					}
						
					//Apply display settings to specific items
					if(currentObj.data.baseData.NameText.toLowerCase().includes(searchBar.value.toLowerCase()))
					{
						currentObj.element.style.display = 'flex';
						tally++;
					}
					else
					{
						currentObj.element.style.display = 'none';
					}
				}
				
				//Update display count
				self._updateResultsText(tally);
			}
				
			//Toggle clear button when we have input
			if(searchBar.value.length > 0)
			{
				clearSearchBtn.style.display = 'block';
			}
			else
			{
				clearSearchBtn.style.display = 'none';
			}
		});
		
		//Handle clear button click
		clearSearchBtn.addEventListener("click", function() {
				
			searchBar.value = '';
			clearSearchBtn.style.display = 'none';
				
			self._resetSearchItems(self.currentTab.tabElements);
		});
	},
	_setupListClear:function()
	{
		let self = this;
		
		let clearListBtn = document.getElementById("right-side-list-clear");
		clearListBtn.addEventListener("click", function() {
			
			console.log("Item list clear");
			
			if(self.craftList && self.craftList.length > 0)
			{
				for(let i = 0; i < self.craftList.length; i++)
				{
					let listItem = self.craftList[i];
					if(listItem)
					{
						listItem.element.remove();
					}
				}
				
				self.craftList = [];
				self._updateTotalCostValue();
			}
		});
	},
	/*Reset the display options set by a search bar query*/
	_resetSearchItems:function(elements)
	{
		if(elements && elements.length > 0)
		{
			for(let i = 0; i < elements.length; i++ )
			{
				let currentItem = elements[i];
				currentItem.element.style.display = 'flex';
			}
			
			this._updateResultsText(elements.length);
		}
	},
	_updateResultsText:function(tally)
	{
		let resultsText = document.getElementById("left-side-results");
		if(resultsText && this.currentTab && this.currentTab.tabElements)
		{
			if(!tally)
			{
				tally = 0;
				for(let i = 0; i < this.currentTab.tabElements.length; i++)
				{
					let currentObj = this.currentTab.tabElements[i];
					if(currentObj.element.style.display != "none")
					{
						tally++;
					}
				}
			}
			
			resultsText.innerHTML = `${tally} results`;
		}
	},
	_fillStructureElements:function(data)
	{
		if(!data || data.length == 0)
			return;
		
		const costMappings = 
		{
			ResourceBranchesRequirement: "Branches",
			ResourceFibreRequirement: "Fibre",
			AnimalFatRequirement: "Animal Fat",
			AnimalBonesRequirement: "Animal Bones",
			ProcessedLeatherRequirement: "Tanned Leather",
			ProcessedWoodRequirement: "Wood Planks",
			ProcessedStoneRequirement: "Stone Bricks",
			ProcessedIronRequirement: "Iron Ingots",
			ReinforcedWoodRequirement: "Reinforced Wood Planks",
			SilverRequirement: "Silver"
		};
		
		data = data.sort(this._sortByProp("CodeNameString"));
		
		let parent = document.getElementById("left-side-bottom-structure");
		
		for (let i = 0; i < data.length; i++) 
		{
			if(data[i].IsReleasedAndEnabled === 0 || data[i].BuildSiteCategory === "World")
				continue;
				
			let objElement = this.createItemElement(this.structureElements,data[i]);
			parent.appendChild(objElement);
			
			//Process structure cost
			let structureCost = [];

			const inputItems = [];
			for(const [prop, name] of Object.entries(costMappings))
			{
				if(data[i][prop])
					inputItems.push({name:name,value:data[i][prop]});
			}
			if (inputItems.length > 0) 
			{
				//This object format us also used by items recipe costs
				//So ID would be used if this structure had multiple ways to craft, same for active
				//Hash is used for duplicate/multiple recipe checking, again only for items
				//producedAmount also items
				structureCost.push({id:0, hash:null, producedObj:data[i].CodeNameString, producedAmount:1, isItemBarrled:false, inputItems:inputItems, active:true});
			}
			
			this.structureElements.push({data:{baseData:data[i],costData:structureCost,rawCostData:[]},element:objElement});
		}
		
		/*Add blank empty objects to fill the spacing for alignment*/
		/*let BlanksCount = 5 - (this.structureElements.length % 5);
		for(let i = 0; i < BlanksCount; i++)
		{
			let objElement = this.createItemElement(null);
			objElement.style.visibility = 'hidden';
			parent.appendChild(objElement);
		}*/
	},
	_fillItemElements:function(data)
	{
		if(!data || data.length == 0)
			return;
		
		data = data.sort(this._sortByProp("NameText"));
		
		let parent = document.getElementById("left-side-bottom-item");
		
		for (let i = 0; i < data.length; i++) 
		{	
			if(data[i].IsReleasedAndEnabled === 0 || data[i].NameText == "Hands")
				continue;
		
			let objElement = this.createItemElement(this.itemElements,data[i]);
			parent.appendChild(objElement);
			
			this.itemElements.push({data:{baseData:data[i],costData:[],rawCostData:[]},element:objElement});
		}
		
		/*Add blank empty objects to fill the spacing for alignment*/
		/*let BlanksCount = 5 - (this.itemElements.length % 5);
		for(let i = 0; i < BlanksCount; i++)
		{
			let objElement = this.createItemElement(null);
			objElement.style.visibility = 'hidden';
			parent.appendChild(objElement);
		}*/
	},
	/*Create an item/structure element for the left side display area*/
	createItemElement(elementList,baseData)
	{
		const parent = document.createElement("div");
		parent.className = "obj-cube";
			
		if(baseData != null)
		{
			let self = this;
			
			const img = document.createElement("img");
			/*img.addEventListener('error', () => {
				console.log(`Image for ${baseData.CodeNameString} failed to load`);
				img.src = '';
				img.src = `${self.craftSettings.wikiImgURL}${baseData.Icon}`;
			});*/
			//Find or bind the wiki image to the src of the image
			img.src = `${this.craftSettings.wikiImgURL}${baseData.Icon}`;
			parent.appendChild(img);
			
			const name = document.createElement("p");
			const tierVal = baseData.Tier > 0 ? ` (T${baseData.Tier})` : "";
			name.innerHTML = `${baseData.NameText || "Unknown"}${tierVal}`;
			parent.appendChild(name);
			
			const cubeBottom = document.createElement("div");
			cubeBottom.className = "obj-cube-bottom"
			
			const cat = document.createElement("h2");
			cat.innerHTML = `${baseData.BuildSiteCategory ? baseData.BuildSiteCategory : (baseData.PrimaryTable ? baseData.PrimaryTable : "Unknown")}`;
			cubeBottom.appendChild(cat);
			
			const wikiButton = document.createElement("a");
			wikiButton.className="StructButton"
			wikiButton.innerHTML = "Wiki";
			wikiButton.href = `https://anvilempires.wiki.gg/wiki/${baseData.NameText}`;
			wikiButton.target = "_blank";
			cubeBottom.appendChild(wikiButton);
			
			const addButton = document.createElement("a");
			addButton.className="StructButton"
			addButton.innerHTML = "Add";
			
			addButton.addEventListener('click', function() {
				craftManager.addCraft(elementList,baseData.CodeNameString);
			});
			cubeBottom.appendChild(addButton);
			
			parent.appendChild(cubeBottom);
		}
			
		return parent;
	},
	//Binds item recipe cost data onto each item
	//Structure cost binding is handled inside _fillStructureElements
	_bindRecipesToItems(prodData)
	{
		const validRecipies = [];
		
		//Loop through raw prod data, process out invalid entires
		for(let i =0; i < this.productionData.length; i++)
		{
			const prodItem = this.productionData[i];
			
			//Skip world drop items or recipes with no produced item
			if(prodItem.ProductionType == "WorldDrop" || !prodItem.ProducedItem)
				continue;
			
			//Skip recipes from disabled or missing structures
			//TODO this is a race condition with items -> prod data. If prod rest call completes before structures this will be empty
			const structure = this.structureElements.find(S => S.data.baseData.CodeNameString == prodItem.SourceCodeName);
			if(!structure || structure.data.baseData.IsReleasedAndEnabled == 0)
				continue;
			
			validRecipies.push(prodItem)
		}
		
		//Do we have any valid recipes?
		if(validRecipies.length > 0)
		{
			for(let i = 0; i < validRecipies.length; i++)
			{
				let inputItems = [];
				for(let j = 1; j <= 3; j++)
				{
					const Prop1 = `CostInput${j}`;
					const Prop2 = `CostInput${j}Count`;
					
					if(validRecipies[i][Prop1])
						inputItems.push({codename:validRecipies[i][Prop1], name:this._getItemName(validRecipies[i][Prop1]), value: validRecipies[i][Prop2]});
				}
				
				//Check if this item recipie actually has costs set
				if(inputItems.length > 0)
				{
					//Grab the item this recipe will be binded to
					const parentItem = this.itemElements.find(item => item.data.baseData.CodeNameString == validRecipies[i].ProducedItem);
					if(!parentItem)
						continue;
					
					//String all input costs and values to make a hash
					let costHash = inputItems.map(c => `${c.codename}${c.value}`).join('');
					
					//Check if this item already has an exact duplicate of this recipe/cost hash
					let IsDupe = parentItem.data.costData.some(recipe => recipe.hash === costHash);
					if(IsDupe) continue;
						
					//Insert non duplicate recipe input items onto item
					parentItem.data.costData.push({id:parentItem.data.costData.length, hash:costHash, producedObj:validRecipies[i].ProducedItem, producedAmount:validRecipies[i].OutputCount, isItemBarrled:validRecipies[i].bCrateProducedItems == 1, inputItems:inputItems, active: (parentItem.data.costData.length == 0)});
				
					//Do the same for raw costs (DISABLED ON THIS BRANCH)
					/*
					const rawItems = this._getRawItems(inputItems);
					let rawCostHash = inputItems.map(c => `${c.codename}${c.value}`).join('');
					
					let IsRawDupe = parentItem.data.rawCostData.some(recipe => recipe.hash === rawCostHash);
					if(IsRawDupe) continue;
					
					parentItem.data.rawCostData.push({id:parentItem.data.rawCostData.length, hash:rawCostHash, producedObj:validRecipies[i].ProducedItem, producedAmount:validRecipies[i].OutputCount, isItemBarrled:validRecipies[i].bCrateProducedItems == 1, inputItems:rawItems, active: (parentItem.data.rawCostData.length == 0)});
					*/
				}
				else
				{
					//No input items for this recipe, can't be crafted or recipe is invalid
					console.log(validRecipies[i].ProducedItem + " has no valid craft sources");
				}
			}
			
		}
	},
	/*Create an item element for the right side top display area*/
	createCraftListElement(data)
	{
		let self = this;
		
		const parent = document.createElement("div");
		parent.className = "list-cube";
		
		/*Define both top and bottom list item sections*/
		const top = document.createElement("div");
		top.className = "list-cube-top";
		
		const bottom = document.createElement("div");
		bottom.className = "list-cube-bottom";
		bottom.style.display = "none";
		
		/*Start top area*/
		
		/*Delete button*/
		const delButton = document.createElement("a");
		delButton.classList.add("list-cube-button");
		delButton.classList.add("list-cube-button-del");
		delButton.innerHTML = "✖";
		delButton.addEventListener('click', event => {
			event.preventDefault();
			self.removeCraft(data.baseData.CodeNameString);
		});
		top.appendChild(delButton);
		
		/*Image and Name*/
		const img = document.createElement("img");
		img.src = `${this.craftSettings.wikiImgURL}${data.baseData.Icon}`;
		top.appendChild(img);
			
		const name = document.createElement("p");
		const tierVal = data.baseData.Tier > 0 ? ` (T${data.baseData.Tier})` : "";
		//Note this will cause issues if there is a produced item with mixed barrel/non barrled items
		name.innerHTML = `${data.baseData.NameText}${tierVal}${data.costData.length > 0 && data.costData[0].isItemBarrled ?" (Barrel)":""}`;
		top.appendChild(name);
		
		/*Quanity input area*/
		const inputContainer = document.createElement("div");
		inputContainer.className ="list-cube-input-container"  
		const numericPattern = /^\d+$/;

		const minusButton = document.createElement("button");
		minusButton.innerHTML="-";
		minusButton.addEventListener('click', event => {
			event.preventDefault();
			let currentValue = Number(countField.value) || 2;
			if(currentValue < 0)
			{
				currentValue = 2;
			}
			
			if(currentValue > 1)
			{
				countField.value = currentValue - 1;
				self._updateCraftListRecipes(data.baseData.CodeNameString, countField.value);
				self._updateTotalCostValue();
			}
		});
		inputContainer.appendChild(minusButton);
			
		const countField = document.createElement("input");
		countField.className="CraftListInput"
		countField.setAttribute("value","1");
		countField.addEventListener("input", function() {
			
			if(numericPattern.test(countField.value) && countField.value >= 1)
			{
				self._updateCraftListRecipes(data.baseData.CodeNameString, countField.value);
				self._updateTotalCostValue();
			}
		});

		inputContainer.appendChild(countField);
			
		const plusButton = document.createElement("button");
		plusButton.innerHTML="+";
		plusButton.addEventListener('click', event => {
			event.preventDefault();
			let currentValue = Number(countField.value) || 1;
			
			if(currentValue < 0)
			{
				currentValue = 1;
			}
			
			if(currentValue > 0)
			{
				countField.value = currentValue + 1;
				self._updateCraftListRecipes(data.baseData.CodeNameString, countField.value);
				self._updateTotalCostValue();
			}
		});
		inputContainer.appendChild(plusButton);
		top.appendChild(inputContainer);
		
		/*Expand button*/
		const expandButton = document.createElement("a");
		expandButton.classList.add("list-cube-button");
		expandButton.classList.add("list-cube-button-exp");
		expandButton.innerHTML = "▼";
		expandButton.style.lineHeight= "22px";
		expandButton.addEventListener('click', event => {
			event.preventDefault();
				
			//Toggle our expansioin area
			if(bottom.style.display != "none")
			{
				bottom.style.display = "none";
				expandButton.innerHTML = "▼";
			}
			else
			{
				bottom.style.display = "flex";
				expandButton.innerHTML = "▲";
			}
		});
		top.appendChild(expandButton);
		parent.appendChild(top);
		
		/*Start bottom expansion area*/

		parent.appendChild(bottom);

		return parent;
	},
	/*Create an item total element for the right side bottom display area*/
	createCraftTotalElement(data)
	{
		const parent = document.createElement("div");
		parent.className = "total-cost-cube";
		
		let imgSrc = "./img/icons/IconBear.png";
		for(let i = 0; i < this.itemElements.length; i++)
		{
			if(this.itemElements[i].data.baseData.NameText == data.name)
			{
				imgSrc = `${this.craftSettings.wikiImgURL}${this.itemElements[i].data.baseData.Icon}`;
				break;
			}
		}
		
		const img = document.createElement("img");
		img.src = imgSrc;
		parent.appendChild(img);
		
		const text = document.createElement("p");
		text.innerHTML = `${data.name} [${data.value}]`
		parent.appendChild(text);
		
		return parent;
	},
	/*Add a crafting item into the right side top crafting list*/
	addCraft:function(list,craftedCodename)
	{
		const self = this;
		if(this.craftList)
		{
			for(let i = 0; i < this.craftList.length; i++)
			{
				//Already crafting this item, uhh skip it
				if(this.craftList[i].data.baseData.CodeNameString == craftedCodename)
					return;
			}
			
			//Setup our parent structure
			const parent = document.getElementById("right-side-content");
			
			//Grab our data from our list
			let combiData = null;
			for(let i = 0; i < list.length; i++)
			{
				if(list[i].data.baseData.CodeNameString == craftedCodename)
				{
					combiData = list[i].data;
				}	
			}
			
			let listElement = this.createCraftListElement(combiData);
			parent.appendChild(listElement);
			
			this.craftList.push({data:combiData, element:listElement});
			console.log(`Added ${combiData.baseData.NameText} to craft list`);
			
			//Update our craft totals values
			this._updateCraftListRecipes(combiData.baseData.CodeNameString, 1);
			this._updateTotalCostValue();
		}
	},
	/*Remove a crafting item from the crafting list*/
	removeCraft(CodeNameString)
	{
		if(this.craftList)
		{
			for(let i=0; i < this.craftList.length; i++)
			{
				let craftItem = this.craftList[i];
				
				if(craftItem.data.baseData.CodeNameString == CodeNameString)
				{
					craftItem.element.remove();
					this.craftList.splice(i, 1);
				}
			}
			
			console.log(`Removed ${CodeNameString} from craft list`);
			this._updateTotalCostValue();
		}
	},
	_updateCraftListRecipes(codeNameString, amount)
	{
		console.log(`Updating ${codeNameString} to count ${amount}`);
		
		if(this.craftList)
		{
			for(let i = 0; i <this.craftList.length; i++)
			{
				let craftItem = this.craftList[i];
				
				if(craftItem.data.baseData.CodeNameString == codeNameString)
				{
					let parent = craftItem.element.getElementsByClassName("list-cube-bottom")[0];
					
					if(!parent)
						return;
					
					parent.innerHTML = '';
						
					if(craftItem.data.costData.length >0)
					{
						//Loop through each cost item (recipe), each recipe item will have its own array of costs
						for(let j = 0; j < craftItem.data.costData.length; j++)
						{
							//A single recipe could contain many costs (each resource)
							let currentCostData = craftItem.data.costData[j];
								
							const costParent = document.createElement("div");
							costParent.className = "list-cube-bottom-container";
								
							//First item or any active item
							if(currentCostData.active == true)
							{
								costParent.classList.add("list-cube-bottom-container-active");
							}
								
							//Set our click recipe listner only if the item has multiple recipes
							if(craftItem.data.costData.length > 1)
							{
								let self = this;
								costParent.addEventListener('click', event => {
									event.preventDefault();

									self._OnRecipeChoiceChange(currentCostData);
								});
							}

								
							for(let k = 0; k < currentCostData.inputItems.length; k++)
							{
								//A single input item
								let inputItem = currentCostData.inputItems[k];
								
								const costLineParent = document.createElement("div");
								costLineParent.className = "list-cube-bottom-line";
								
								const costImg = document.createElement("img");
								
								//Loop to find item images
								let imgSrc = "./img/icons/IconBear.png";
								if(this.itemElements && this.itemElements.length >0)
								{
									for(let i = 0; i < this.itemElements.length; i++)
									{
										if(this.itemElements[i].data.baseData.NameText == inputItem.name)
										{
											imgSrc = `${this.craftSettings.wikiImgURL}${this.itemElements[i].data.baseData.Icon}`;
											break;
										}
									}
								}

								costImg.src = imgSrc;
								costLineParent.appendChild(costImg);
								
								const costText = document.createElement("h2");
								costText.innerHTML = `${inputItem.name} [${Math.ceil(amount / currentCostData.producedAmount) * inputItem.value}]`;
	
								costLineParent.appendChild(costText);
								
								costParent.appendChild(costLineParent);
							}

							parent.appendChild(costParent);
						}
					}
					else
					{
						//Oh this item has no craft data... uhh
						const costText = document.createElement("h2");
						costText.style.color = "#acacac";
						costText.style.fontStyle = "italic";
						costText.innerHTML = "Unknown cost";
						parent.appendChild(costText);
					}
				}
			}
		}
	},
	/*Fired when a item in the craft list has multiple recipes and a recipe is clicked*/
	_OnRecipeChoiceChange(selectedCost)
	{
		if(this.craftList)
		{
			for(let i = 0; i < this.craftList.length; i++)
			{
				let craftItem = this.craftList[i];
				
				if(craftItem.data.baseData.CodeNameString == selectedCost.producedObj)
				{
					let parent = craftItem.element.getElementsByClassName("list-cube-bottom")[0];
					let costContainers = parent.getElementsByClassName("list-cube-bottom-container");
					
					for(let j = 0; j < costContainers.length; j++)
					{
						costContainers[j].classList.remove("list-cube-bottom-container-active");
					}
					
					//Disable all before we reset
					for(let j = 0; j < craftItem.data.costData.length; j++)
					{
						craftItem.data.costData[j].active = false;
					}
					
					//Id being the recipe order
					costContainers[selectedCost.id].classList.add("list-cube-bottom-container-active");
				}
			}
			
			selectedCost.active = true
			this._updateTotalCostValue();
		}
	},
	/*Recalculate and recreate all total crafting cost elements*/
	_updateTotalCostValue()
	{
		if(this.craftList)
		{
			let parent = document.getElementById("right-side-bottom"); 
			
			//Craft list is empty, clear any display elements to allow a clean default message box
			if(this.craftList.length == 0)
			{
				let oldCosts = parent.getElementsByClassName("total-cost-cube");
				while(oldCosts.length > 0)
				{
					oldCosts[0].remove();
				}
				
				return;
			}
			
			//Wipe all current craft totals
			this.craftTotals = [];

			//Calculate the costs for the current craft list
			for(let i=0; i < this.craftList.length; i++)
			{
				//Loop through the craft list and add containers for the resource types to our craft totals array
				let craftListItem = this.craftList[i];
				
				for(let j = 0; j < craftListItem.data.costData.length; j++)
				{
					let itemRecipe = craftListItem.data.costData[j];
					let craftCount = craftListItem.element.getElementsByClassName("CraftListInput")[0].value;
					
					//This recipe isn't selected
					if(!itemRecipe.active)
					{
						continue;
					}
					
					for(let k = 0; k < itemRecipe.inputItems.length; k++)
					{
						let inputItem = itemRecipe.inputItems[k];
						
						if(this.craftTotals[inputItem.name] === undefined)
						{
							this.craftTotals[inputItem.name] = {name:inputItem.name, value:(Math.ceil(craftCount / itemRecipe.producedAmount)* inputItem.value)};
						}
						else
						{
							this.craftTotals[inputItem.name].value += (Math.ceil(craftCount / itemRecipe.producedAmount) * inputItem.value);
						}
					}
					
					/*const raws = this._getRawCost(itemRecipe);
					if(rawModeCheck && rawModeCheck.checked && raws.length >0)
					{
						for(let k = 0; k < raws.length;  k++)
						{
							let name = this._getItemName(raws[i].codename);
							
							if(this.craftTotals[name] === undefined)
							{
								this.craftTotals[name] = {name:name, value:(raws[i].value * craftCount)};
							}
							else
							{
								this.craftTotals[name].value += (raws[i].value * craftCount);
							}
						}
					}
					else
					{
						for(let k = 0; k < itemRecipe.inputItems.length; k++)
						{
							let inputItem = itemRecipe.inputItems[k];
						
							if(this.craftTotals[inputItem.name] === undefined)
							{
								this.craftTotals[inputItem.name] = {name:inputItem.name, value:(Math.ceil(craftCount / itemRecipe.producedAmount)* inputItem.value)};
							}
							else
							{
								this.craftTotals[inputItem.name].value += (Math.ceil(craftCount / itemRecipe.producedAmount) * inputItem.value);
							}
						}
					}*/
				
				}
			}
			
			//Delete all the old cost elements before redraw
			let oldCosts = parent.getElementsByClassName("total-cost-cube");
			while(oldCosts.length > 0)
			{
				oldCosts[0].remove();
			}
				
			//Recreate the elements
			for(let craftName in this.craftTotals)
			{
				let resource = this.craftTotals[craftName];
				
				const costEle = this.createCraftTotalElement(resource);
				parent.appendChild(costEle);
			}
		}
	},
	/*Attempt to find the raw input cost for an array of input items*/
	/*Item Format {codename:"example",name:"Example",value:1}*/
	_getRawItems(items)
	{
		if(!this.productionData)
			return items;
	
		let exportItems = [];
	
		for(let i = 0; i < items.length; i++)
		{
			let inputItems = [];
			let inputItem = items[i];
			
			for(let j = 0; j < this.productionData.length; j++)
			{
				//TODO this will return the first matching input cost for this item
				//there could be multiple/cheaper/'better' recipes to use
				if(this.productionData[j].ProducedItem == inputItem.codename)
				{
					//We found the input for this item
					if(this.productionData[j].CostInput1)
					{
						inputItems.push({codename:this.productionData[j].CostInput1, value:this.productionData[j].CostInput1Count});
						inputItems = inputItems.concat(this._getRawItems([{ codename: this.productionData[j].CostInput1 }]));
					}
					if(this.productionData[j].CostInput2)
					{
						inputItems.push({codename:this.productionData[j].CostInput2, value:this.productionData[j].CostInput2Count});
						inputItems = inputItems.concat(this._getRawItems([{ codename: this.productionData[j].CostInput2 }]));
					}
					if(this.productionData[j].CostInput3)
					{
						inputItems.push({codename:this.productionData[j].CostInput3, value:this.productionData[j].CostInput3Count});
						inputItems = inputItems.concat(this._getRawItems([{ codename: this.productionData[j].CostInput3 }]));
					}
					
					break
				}
			}
			
			//This item can't be made from anything else (thats known to this data)
			if(!inputItems.length > 0)
			{
				console.log("Hit root item");
			}
			
			//TODO we need tally up items already in the export items list with items we're adding
			//i.e multiple silver entries
			exportItems = exportItems.concat(inputItems.length > 0 ? inputItems : [inputItem]);
		}
		
		return exportItems;
	},
	/*Return the NameText for an input CodeNameString for a given item in the itemElements list*/
	_getItemName:function(CodeNameString)
	{
		if(this.itemElements && this.itemElements.length > 0)
		{
			for(let i =0; i < this.itemElements.length; i++)
			{
				let itemObj = this.itemElements[i];
							
				if(itemObj.data.baseData.CodeNameString == CodeNameString)
				{
					return itemObj.data.baseData.NameText || "Unknown";
				}
			}
		}
		
		return "Unknown";
	},
	_sortByProp:function(property)
	{
		var sortOrder = 1;
		if(property[0] === "-") {
			sortOrder = -1;
			property = property.substr(1);
		}
		return function (a,b) {
        /* next line works with strings and numbers */
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
		}
	},
	_populateSelectElement(ele, options)
	{
		if(!ele)
			return;
		
		ele.innerHTML = '';
		
		let noneOption = document.createElement("option");
		noneOption.text = "None";
		noneOption.value = "None";
		ele.appendChild(noneOption);
		
		for(let i = 0; i < options.length; i++)
		{
			let option = document.createElement("option");
			option.text = options[i];
			option.value = options[i]; // You can set a value if needed
			ele.appendChild(option);
		}
	}
};

class CraftSettings
{
	wikiImgURL = "https://anvilempires.wiki.gg/wiki/Special:Redirect/file/";
	rawMode = false;
}

craftManager.init();

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