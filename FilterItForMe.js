"use strict";

main();


// Relevant tags for filtering
const relevantTags = new Set(["div","li","span","p","a","b","i","u","h1","h2","h3","h4","h5","h6","em"]);

// Tags for simple formatting 
// (they get a special treatment in the replacement algorithm below)
const formattingTags = new Set(["a","b","i","u"]);

// Filter terms specified by the user
var filterlist = [];

// Filter only whole word matches?
var bMatchWholeWordsOnly = true;


/**
 * The main algorithm of this extension
 */
async function main()
{
	console.time('FilterIt');

	let bOK = await LoadSettings();
	if (!bOK)
		return;

	await FilterDocument();

	// Show execution time in console
	console.timeEnd('FilterIt');
}

/**
 * Retrieves the filter list and other options from local storage
 */
async function LoadSettings()
{
	// Try to retrieve the filter list from storage
	let ret = await LoadFilterlist();
	if (!ret)
		return false;

	await LoadOptions();

	if (filterlist != null)
	{
		console.log("FilterIt - items in the filter list: " + filterlist.length);
	}

	// Check if the user set any filters yet
	return filterlist != null && filterlist.length > 0;
}

/**
 * Retrieves the filter list from local storage
 */
async function LoadFilterlist()
{
	// gets called below
	async function ReadFilterlistFromStorage()
	{
		return new Promise((resolve, reject) => 
		{
			let results = browser.storage.local.get({storagelist: []});
			results.then(
				function(item) 
				{
					if (item != null && item.storagelist != null && item.storagelist != undefined)
					{
						resolve(item.storagelist);
					}
					else
					{
						reject();
					}
				},
				function(e) { console.error(e); reject(); }
			)
		});
	}

	let storagelist = await ReadFilterlistFromStorage();
	if (storagelist != null && storagelist != undefined)
	{
		filterlist = storagelist;
		return true;
	}
	else
	{
		return false;
	}
}

/**
 * Retrieves the options from local storage
 */
async function LoadOptions()
{
	// gets called below
	async function LoadMatchingOption()
	{
		return new Promise((resolve, reject) => 
		{
			let results = browser.storage.local.get({"optionMatch": true});
			results.then(
				function(item) 
				{
					if (item != null && item.optionMatch != null && item.optionMatch != undefined)
					{
						resolve(item.optionMatch);
					}
					else
					{
						reject();
					}
				},
				function(e) { console.error(e); reject(); }
			)
		});
	}

	let optionMatch = await LoadMatchingOption();
	if (optionMatch != null && optionMatch != undefined)
	{
		bMatchWholeWordsOnly = optionMatch;
	}
	return true;
}

/**
 * Applies the user defined filter to the website document
 */
async function FilterDocument()
{
	// Create an iterator for all the Nodes
	var nodeIterator = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	if (nodeIterator == null)
	{
		console.log("Error: nodeIterator == null");
		return;
	}

	var node;
	var tagName;
	var nodeData;
	while (node = nodeIterator.nextNode())
	{
		nodeData = node.data.trim().toLowerCase();
		tagName = node.parentElement.tagName.toLowerCase();

		if (NodeCanBeSkipped(nodeData, tagName))
			continue;

		// Check if the node text contains one of the filtered terms
		if (NodeMatchesFilteredItems(nodeData))
		{
			// +++ DEBUG +++
			//console.log("node.tagName: " + node.tagName + ", node.data: " + node.data);
			
			// Find a suitable parent node
			var parentNode = FindSuitableParentNode(node);

			// Clear the text in all the sibling notes of this node
			if (parentNode != null)
				ClearAllChildNodes(parentNode);

			// This node gets the "+++ filtered +++" text
			node.data = "+++ filtered +++";
		}

		// +++ DEBUG +++
		//console.log("tagName: " + tagName + ", node.data: " + node.data);
	}
}

/**
 * Determines if a node can be skipped or not
 * @returns true if the node can be skipped
 */
function NodeCanBeSkipped(nodeData, tagName)
{
	// minimum of text: 3 characters
	if (nodeData.length <= 3)
		return true;

	// check if it's one of the relevant html tags
	return !relevantTags.has(tagName);
}

/**
 * Compares the node text to the items in the filter list
 * @returns true if the node text contains at least one text in the filter list
*/
function NodeMatchesFilteredItems(nodeData)
{
	let filter;
	for (let i = 0; i < filterlist.length; i++)
	{
		filter = filterlist[i].toLowerCase();
		if (nodeData.search(filter) != -1)
		{
			console.log("Simple Match: nodeData:" + nodeData + ", filter:" + filter);

			//  if the whole word only option is active, then another check is necessary
			if (bMatchWholeWordsOnly)
			{
				let regex = new RegExp("\\b" + filter + "\\b");
				return regex.test(nodeData);
			}
			else
			{
				return true;
			}
		}
	}
	return false;
}

/**
 * Searches for a suitable parent node of the node that matches the filter list
 * Hint: parent nodes that describe simple formatting, for example <a> or <b>, are not suitable
 */
function FindSuitableParentNode(node)
{
	var parentNode = node.parentElement;
	while (parentNode != null)
	{
		var parentNodeTag = parentNode.tagName.toLowerCase();
		if (formattingTags.has(parentNodeTag))
		{
			parentNode = parentNode.parentElement;
		}
		else 
		{
			break;
		}
	}
	return parentNode;
}

/**
 * Clears the text of all the child notes
 * @param parentNode: the node whose siblings have to be cleared
 * @param recursionLayer: the layer of the recursive call (max: 3)
 */
function ClearAllChildNodes(parentNode, recursionLayer = 1)
{
	// +++ DEBUG +++
	//console.log("-parentNode.tagName: " + parentNode.tagName + ", parentNode.data: " + parentNode.data);

	// Clear all the child notes
	for (var childNode of parentNode.childNodes)
	{
		// +++ DEBUG +++
		//console.log("--childNode.tagName: " + childNode.tagName + ", childNode.data: " + childNode.data);

		childNode.data = "";

		// recursive call
		if (recursionLayer <= 3)
			ClearAllChildNodes(childNode, recursionLayer + 1);
	}
}
