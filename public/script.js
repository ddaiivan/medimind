document.addEventListener('DOMContentLoaded', () => { // Wait for DOM to be ready

    // --- DOM Elements ---
    const topicInput = document.getElementById('topicInput');
    const generateBtn = document.getElementById('generateBtn');
    const mindmapSvg = d3.select('#mindmapSvg');
    const exportPngBtn = document.getElementById('exportPngBtn');
    const mindmapContainer = document.querySelector('.mindmap-container');
    const contextMenu = document.getElementById('contextMenu');
    const ctxAddBtn = document.getElementById('ctxAddBtn');
    const ctxRemoveBtn = document.getElementById('ctxRemoveBtn');
    const ctxExploreBtn = document.getElementById('ctxExploreBtn');
    const nodeEditInput = document.getElementById('nodeEditInput');

    if (!topicInput || !generateBtn || !mindmapSvg.node() || !mindmapContainer || !exportPngBtn ||
        !contextMenu || !ctxAddBtn || !ctxRemoveBtn || !ctxExploreBtn || !nodeEditInput) {
        console.error("One or more essential DOM elements not found!");
        return;
    }

    // --- D3 Setup ---
    const svgWidth = mindmapContainer.clientWidth || 600;
    const svgHeight = mindmapContainer.clientHeight || 500;
    const svg = mindmapSvg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    const g = svg.append('g');

    // --- State Variables ---
    let currentMindmapData = null;
    let selectedNodeData = null;
    let selectedNodeElement = null;
    let editingNodeData = null;
    let isInitialRender = true;

    // --- Configuration ---
    const nodeRectWidth = 150;
    const nodePadding = 5;
    const textWrapWidth = nodeRectWidth - (nodePadding * 2);
    const verticalNodeSeparation = 90;
    const horizontalLevelSeparation = 220;

    // --- D3 Zoom Behavior ---
    const zoom = d3.zoom().scaleExtent([0.1, 3]).on('zoom', (event) => {
        g.attr('transform', event.transform);
        contextMenu.style.display = 'none';
        nodeEditInput.style.display = 'none';
    });
    svg.call(zoom).on("dblclick.zoom", null);

    // --- Helper: Text Wrapping (Reverted to simpler version with text-anchor) ---
    function wrapTextInsideNode(textSelection, width) {
      textSelection.each(function() {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let word; let line = []; let lineNumber = 0;
        const lineHeight = 1.1; const dy = parseFloat(text.attr("dy") || 0);
        text.attr("y", null).text(null);
        text.style("text-anchor", "middle").attr("x", 0);
        let tspan = text.append("tspan").attr("x", 0).attr("dy", dy + "em");
        while (word = words.pop()) {
          line.push(word); tspan.text(line.join(" "));
          if (tspan.node().getComputedTextLength() > width && line.length > 1) {
            line.pop(); tspan.text(line.join(" ")); line = [word];
            tspan = text.append("tspan").attr("x", 0).attr("dy", lineHeight + "em").text(word);
            lineNumber++;
          }
        }
        const lines = lineNumber + 1;
        text.attr("y", -( (lines - 1) * lineHeight / 2 ) + "em" );
      });
    }

    // --- Helper: Node Selection & Context Menu ---
    function selectNode(event, d, element) {
        event.stopPropagation();
        if (selectedNodeElement) d3.select(selectedNodeElement).select('rect').style('stroke', '#aaa').style('stroke-width', '1px');
        contextMenu.style.display = 'none'; nodeEditInput.style.display = 'none';
        if (selectedNodeElement === element) { selectedNodeElement = null; selectedNodeData = null; return; }
        selectedNodeElement = element; selectedNodeData = d;
        d3.select(selectedNodeElement).select('rect').style('stroke', 'red').style('stroke-width', '2px');
        const nodeRect = d3.select(element).select('rect').node(); if (!nodeRect) return;
        const containerRect = mindmapContainer.getBoundingClientRect();
        const svgPointTL = mindmapSvg.node().createSVGPoint(); svgPointTL.x = parseFloat(nodeRect.getAttribute('x')); svgPointTL.y = parseFloat(nodeRect.getAttribute('y'));
        const svgPointBR = mindmapSvg.node().createSVGPoint(); svgPointBR.x = svgPointTL.x + parseFloat(nodeRect.getAttribute('width')); svgPointBR.y = svgPointTL.y + parseFloat(nodeRect.getAttribute('height'));
        const matrix = element.getScreenCTM(); if (!matrix) { console.error("Could not get screen CTM."); return; }
        const screenPointTL = svgPointTL.matrixTransform(matrix); const screenPointBR = svgPointBR.matrixTransform(matrix);
        const menuMargin = 8; let menuLeft = screenPointBR.x - containerRect.left + menuMargin; let menuTop = screenPointTL.y - containerRect.top;
        const menuWidth = contextMenu.offsetWidth; const menuHeight = contextMenu.offsetHeight;
        if (menuLeft + menuWidth > containerRect.width) menuLeft = screenPointTL.x - containerRect.left - menuWidth - menuMargin;
        if (menuTop + menuHeight > containerRect.height) menuTop = screenPointBR.y - containerRect.top - menuHeight;
        if (menuTop < 0) menuTop = 0; if (menuLeft < 0) menuLeft = menuMargin;
        contextMenu.style.left = `${menuLeft}px`; contextMenu.style.top = `${menuTop}px`;
        contextMenu.style.display = 'block'; ctxRemoveBtn.disabled = !selectedNodeData.parent;
    }

    // --- Helper: Show Node Editor ---
    function showNodeEditor(d, element) {
        editingNodeData = d;
        const nodeGroup = element;
        const rectElement = d3.select(nodeGroup).select('rect').node();
        const textElement = d3.select(nodeGroup).select('text.node-name').node();
        if (!rectElement || !textElement) return;
        d3.select(textElement).style('display', 'none');
        const containerRect = mindmapContainer.getBoundingClientRect();
        const svgPoint = mindmapSvg.node().createSVGPoint(); svgPoint.x = 0; svgPoint.y = 0;
        const matrix = nodeGroup.getScreenCTM(); if (!matrix) { console.error("Could not get screen CTM for editing."); return; }
        const screenPoint = svgPoint.matrixTransform(matrix);
        const currentRectHeight = parseFloat(rectElement.getAttribute('height'));
        const inputWidth = nodeRectWidth - nodePadding; const inputHeight = currentRectHeight - nodePadding;
        const finalLeft = screenPoint.x - containerRect.left - inputWidth / 2;
        const finalTop = screenPoint.y - containerRect.top - inputHeight / 2;
        nodeEditInput.style.left = `${finalLeft}px`; nodeEditInput.style.top = `${finalTop}px`;
        nodeEditInput.style.width = `${inputWidth}px`; nodeEditInput.style.height = `${inputHeight}px`;
        nodeEditInput.style.fontSize = d3.select(textElement).style('font-size');
        nodeEditInput.value = d.data.name || d.data.topic || "";
        nodeEditInput.style.display = 'block'; nodeEditInput.focus(); nodeEditInput.select();
    }

    // --- Helper: Hide Node Editor and Save ---
    function hideNodeEditorAndSave() {
        if (!editingNodeData || nodeEditInput.style.display === 'none') return;
        const newName = nodeEditInput.value.trim();
        const oldName = editingNodeData.data.name || editingNodeData.data.topic;
        nodeEditInput.style.display = 'none';
        if (newName && newName !== oldName) {
            editingNodeData.data.name = newName;
            renderMindmap(currentMindmapData);
        } else {
             g.selectAll(".node").filter(d => d === editingNodeData).select("text.node-name").style('display', null);
        }
        editingNodeData = null;
    }

    // --- Helper: Add Child Node ---
    function addChildNode() {
        if (!selectedNodeData) return;
        const newNodeName = "New Node"; const newNode = { name: newNodeName, children: [] };
        if (!selectedNodeData.data.children) selectedNodeData.data.children = [];
        selectedNodeData.data.children.push(newNode);
        renderMindmap(currentMindmapData);
        const newHierarchy = d3.hierarchy(currentMindmapData); let addedNodeD3Data = null;
        newHierarchy.each(d => { if (d.data === newNode) addedNodeD3Data = d; });
        if (addedNodeD3Data) {
             const addedNodeElement = g.selectAll(".node").filter(d => d === addedNodeD3Data).node();
             if (addedNodeElement) setTimeout(() => showNodeEditor(addedNodeD3Data, addedNodeElement), 50);
             else console.error("Could not find added node element after render.");
        } else console.error("Could not find added node data after render.");
        selectedNodeData = null; selectedNodeElement = null; contextMenu.style.display = 'none';
    }

    // --- Helper: Remove Node ---
    function removeNode() {
        if (!selectedNodeData || !selectedNodeData.parent) { alert("Cannot remove the root node or no node selected."); return; }
        const parentData = selectedNodeData.parent.data; if (!parentData.children) return;
        const index = parentData.children.findIndex(child => child === selectedNodeData.data);
        if (index > -1) { parentData.children.splice(index, 1); renderMindmap(currentMindmapData); selectedNodeData = null; selectedNodeElement = null; contextMenu.style.display = 'none'; }
        else { console.error("Could not find node to remove."); alert("Failed to remove node."); contextMenu.style.display = 'none';}
    }

    // --- Helper: Explore Node (AI Expansion) ---
    async function exploreNode() {
         if (!selectedNodeData || !selectedNodeData.data) return;
        const nodeName = selectedNodeData.data.name || selectedNodeData.data.topic;
        const parentNode = selectedNodeData.parent; const parentContext = parentNode ? (parentNode.data.name || parentNode.data.topic) : "";
        const rootNode = selectedNodeData.ancestors().find(node => node.depth === 0); const rootContext = rootNode ? (rootNode.data.name || rootNode.data.topic) : "";
        ctxAddBtn.disabled = true; ctxRemoveBtn.disabled = true; ctxExploreBtn.disabled = true;
        ctxExploreBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exploring...';
        console.log(`Exploring node: ${nodeName}, parent: ${parentContext}, root: ${rootContext}`);
        try {
            const response = await fetch('/.netlify/functions/expand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodeName: nodeName, parentContext: parentContext, rootContext: rootContext }), });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `HTTP error! status: ${response.status}`); }
            // --- Updated response handling ---
            const expansionResult = await response.json();
            const newChildren = expansionResult.nodes; // Get nodes from the response object
            const modelUsed = expansionResult._modelUsed; // Get model info
            console.log(`Expanded using model: ${modelUsed}`);
            console.log('Received expansion:', newChildren);
            // --- End of update ---
            if (newChildren && newChildren.length > 0) { if (!selectedNodeData.data.children) selectedNodeData.data.children = []; newChildren.forEach(child => { if (!child.children) child.children = []; selectedNodeData.data.children.push(child); }); renderMindmap(currentMindmapData); }
            else { alert(`No additional sub-points found for "${nodeName}".`); }
        } catch (error) { console.error('Error exploring node:', error); alert(`Failed to explore node: ${error.message}`); }
        finally { ctxExploreBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Explore'; ctxAddBtn.disabled = false; ctxExploreBtn.disabled = false; contextMenu.style.display = 'none'; selectedNodeData = null; selectedNodeElement = null; }
    }

    // --- Core Functions ---
    async function fetchMindmapData(topic) {
        console.log(`Fetching data for topic: ${topic}`);
        generateBtn.disabled = true; generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        selectedNodeData = null; selectedNodeElement = null; contextMenu.style.display = 'none';
        isInitialRender = true;
        try {
            const response = await fetch('/.netlify/functions/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: topic }), });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `HTTP error! status: ${response.status}`); }
            const data = await response.json();
            console.log('Received data:', data);
            // --- Log model used ---
            if (data._modelUsed) {
                console.log(`Generated using model: ${data._modelUsed}`);
            }
            // --- End log ---
            if (!data.children) data.children = [];
            currentMindmapData = data;
            renderMindmap(currentMindmapData);
        } catch (error) { console.error('Error fetching or processing mind map data:', error); alert(`Error generating mind map: ${error.message}`); }
        finally { generateBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Search'; generateBtn.disabled = false; }
    }

    function renderMindmap(data) {
        if (!data) { g.selectAll('*').remove(); selectedNodeData = null; selectedNodeElement = null; contextMenu.style.display = 'none'; return; }
        console.log("Rendering mindmap...");
        g.selectAll('*').remove(); contextMenu.style.display = 'none'; nodeEditInput.style.display = 'none';
        const root = d3.hierarchy(data); const layoutType = 'tree';
        let treeLayout = d3.tree().nodeSize([verticalNodeSeparation, horizontalLevelSeparation]); treeLayout(root);
        let scale = 1, translateX = 0, translateY = 0;

        if (isInitialRender) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            root.each(d => { let x = d.y, y = d.x; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; });
            const treeWidth = maxX - minX; const treeHeight = maxY - minY;
            scale = Math.min(svgWidth / (treeWidth + 200), svgHeight / (treeHeight + 100), 1);
            translateX = (svgWidth - treeWidth * scale) / 2 - minX * scale;
            translateY = (svgHeight - treeHeight * scale) / 2 - minY * scale;
            const initialTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
            g.attr('transform', initialTransform);
            svg.call(zoom.transform, initialTransform);
            isInitialRender = false;
        }

        g.selectAll(".link").data(root.links()).enter().append("path").attr("class", "link").attr("d", d3.linkHorizontal().x(node => node.y).y(node => node.x));
        const node = g.selectAll(".node").data(root.descendants()).enter().append("g").attr("class", "node").attr("transform", d => `translate(${d.y},${d.x})`).on('click', function(event, d) { selectNode(event, d, this); }).on('dblclick', function(event, d) { event.stopPropagation(); contextMenu.style.display = 'none'; showNodeEditor(d, this); });
        node.insert("rect", ":first-child").attr("width", nodeRectWidth).attr("x", -nodeRectWidth / 2).attr("rx", 5).attr("ry", 5).style("stroke", "#aaa").style("stroke-width", "1px")
            .style("fill", d => { if (d.depth === 0) return "#f0e68c"; let ancestor = d; while (ancestor.depth > 1) ancestor = ancestor.parent; const categoryColorMap = { "Etiology": "#8dd3c7", "Risk Factors": "#ffffb3", "Pathogenesis": "#bebada", "Clinical Manifestations": "#fb8072", "Physical Examination": "#80b1d3", "Diagnostic Investigations": "#fdb462", "Management": "#b3de69" }; const categoryName = ancestor ? ancestor.data.name : d.data.name; return categoryColorMap[categoryName] || "#d9d9d9"; })
            .each(function(d) { const nodeGroup = this.parentNode; const textElement = d3.select(nodeGroup).select("text.node-name").node(); let contentHeight = 20; if (textElement) contentHeight = textElement.getBBox().height; const rectHeight = contentHeight + (nodePadding * 3); d3.select(this).attr("height", rectHeight).attr("y", -rectHeight / 2); });
        node.append("text").attr("class", "node-name").attr("dominant-baseline", "middle").attr("dy", "0em")
            .style("text-anchor", "middle") .attr("x", 0)
            .style("font-size", d => d.depth === 0 ? "12px" : (d.depth === 1 ? "11px" : "10px")).style("font-weight", d => d.depth === 0 ? "bold" : "normal").text(d => d.data.name || d.data.topic || 'Root')
            .call(wrapTextInsideNode, textWrapWidth);
        svg.on('click', function(event) { if (event.target === this) { if (selectedNodeElement) { d3.select(selectedNodeElement).select('rect').style('stroke', '#aaa').style('stroke-width', '1px'); } selectedNodeData = null; selectedNodeElement = null; contextMenu.style.display = 'none'; hideNodeEditorAndSave(); } });
        console.log("Mindmap rendering complete.");
    }

    // --- Event Listeners ---
    generateBtn.addEventListener('click', () => { const topic = topicInput.value.trim(); if (topic) { fetchMindmapData(topic); } else { alert('Please enter a medical topic.'); } });
    exportPngBtn.addEventListener('click', () => { const svgElement = document.getElementById('mindmapSvg'); if (svgElement && currentMindmapData) { const options = { filename: (currentMindmapData.topic || 'mindmap').replace(/\s+/g, '_'), backgroundColor: '#ffffff', scale: 8, embedFonts: true }; if (typeof saveSvgAsPng !== 'undefined') { saveSvgAsPng(svgElement, `${options.filename}.png`, options); } else { console.error("saveSvgAsPng library not loaded."); alert("Error exporting PNG: Library not found."); } } else { alert("No mind map to export."); } });
    ctxAddBtn.addEventListener('click', () => { if (selectedNodeData) addChildNode(); });
    ctxRemoveBtn.addEventListener('click', () => { if (selectedNodeData) removeNode(); });
    ctxExploreBtn.addEventListener('click', () => { if (selectedNodeData) exploreNode(); });
    nodeEditInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { hideNodeEditorAndSave(); } else if (event.key === 'Escape') { nodeEditInput.style.display = 'none'; if (editingNodeData) { g.selectAll(".node").filter(d => d === editingNodeData).select("text.node-name").style('display', null); } editingNodeData = null; } });
    nodeEditInput.addEventListener('blur', () => { if (nodeEditInput.style.display !== 'none') { hideNodeEditorAndSave(); } });
    contextMenu.style.display = 'none';

}); // End of DOMContentLoaded listener
