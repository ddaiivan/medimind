document.addEventListener('DOMContentLoaded', () => { // Wait for DOM to be ready

    // --- DOM Elements ---
    const topicInput = document.getElementById('topicInput');
    const generateBtn = document.getElementById('generateBtn');
    const mindmapSvg = d3.select('#mindmapSvg');
    const exportPngBtn = document.getElementById('exportPngBtn');
    const exportPngMobileBtn = document.getElementById('exportPngMobileBtn');
    const mindmapContainer = document.querySelector('.mindmap-container');
    const contextMenu = document.getElementById('contextMenu');
    const ctxAddBtn = document.getElementById('ctxAddBtn');
    const ctxRemoveBtn = document.getElementById('ctxRemoveBtn');
    const ctxExploreBtn = document.getElementById('ctxExploreBtn');
    const nodeEditInput = document.getElementById('nodeEditInput');

    if (!topicInput || !generateBtn || !mindmapSvg.node() || !mindmapContainer || !exportPngBtn ||
        !contextMenu || !ctxAddBtn || !ctxRemoveBtn || !ctxExploreBtn || !nodeEditInput || !exportPngMobileBtn) {
        console.error("One or more essential DOM elements not found!");
        return;
    }

    // --- Helper: Check if device is mobile ---
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // --- Mobile Export Helper ---
    async function exportMobilePng() {
        const svgElement = document.getElementById('mindmapSvg');
        if (!svgElement || !currentMindmapData) {
            alert("No mind map to export.");
            return;
        }

        // Show loading indicator
        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading-indicator';
        loadingEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating high-quality PNG...';
        document.body.appendChild(loadingEl);

        try {
            console.log('Starting mobile export process...');
            
            // Dapatkan semua node dalam mindmap
            const nodes = svgElement.querySelectorAll('.node');
            if (nodes.length === 0) {
                document.body.removeChild(loadingEl);
                alert("No nodes found in the mindmap.");
                return;
            }
            
            // Dapatkan grup utama dan transformasi
            const gElement = svgElement.querySelector('g');
            
            // Membuat SVG baru yang akan digunakan untuk export
            const svgNS = "http://www.w3.org/2000/svg";
            const exportSvg = document.createElementNS(svgNS, "svg");
            
            // Salin atribut dari SVG asli yang diperlukan
            exportSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            exportSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
            
            // Salin gaya CSS yang diperlukan
            const style = document.createElementNS(svgNS, "style");
            style.textContent = `
                .node rect { stroke: #aaa; stroke-width: 1px; }
                .node text { font-family: Arial, sans-serif; text-anchor: middle; fill: #333; }
                .link { fill: none; stroke: #adb5bd; stroke-width: 1.5px; }
                text { font-family: Arial, sans-serif; }
            `;
            exportSvg.appendChild(style);
            
            // Tambahkan semua konten SVG ke SVG baru
            const clonedG = gElement.cloneNode(true);
            
            // Reset transformasi pada grup untuk capture seluruh content
            clonedG.removeAttribute("transform");
            exportSvg.appendChild(clonedG);
            
            // Cari bounds dari seluruh node untuk menentukan viewBox
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            nodes.forEach(node => {
                const rect = node.querySelector('rect');
                const nodeTransform = node.getAttribute('transform');
                let nodeX = 0, nodeY = 0;
                
                if (nodeTransform) {
                    const translateMatch = nodeTransform.match(/translate\(([^,]+),([^)]+)\)/);
                    if (translateMatch && translateMatch[1] && translateMatch[2]) {
                        nodeX = parseFloat(translateMatch[1]);
                        nodeY = parseFloat(translateMatch[2]);
                    }
                }
                
                if (rect) {
                    const width = parseFloat(rect.getAttribute('width'));
                    const height = parseFloat(rect.getAttribute('height'));
                    const x = parseFloat(rect.getAttribute('x') || 0);
                    const y = parseFloat(rect.getAttribute('y') || 0);
                    
                    // Hitung posisi absolut dari node
                    const left = nodeX + x;
                    const right = nodeX + x + width;
                    const top = nodeY + y;
                    const bottom = nodeY + y + height;
                    
                    minX = Math.min(minX, left);
                    maxX = Math.max(maxX, right);
                    minY = Math.min(minY, top);
                    maxY = Math.max(maxY, bottom);
                }
            });
            
            // Tambahkan padding
            const padding = 50;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;
            
            // Set dimensi SVG
            const width = maxX - minX;
            const height = maxY - minY;
            exportSvg.setAttribute("width", width.toString());
            exportSvg.setAttribute("height", height.toString());
            exportSvg.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
            
            // Tambahkan background putih
            const background = document.createElementNS(svgNS, "rect");
            background.setAttribute("x", minX.toString());
            background.setAttribute("y", minY.toString());
            background.setAttribute("width", width.toString());
            background.setAttribute("height", height.toString());
            background.setAttribute("fill", "white");
            exportSvg.insertBefore(background, exportSvg.firstChild);
            
            // Konversi SVG ke string
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(exportSvg);
            
            // Konversi ke Blob untuk image
            const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
            
            // Gunakan method yang lebih sederhana dan langsung
            const DOMURL = window.URL || window.webkitURL || window;
            const url = DOMURL.createObjectURL(svgBlob);
            
            const downloadImage = new Image();
            downloadImage.width = width;
            downloadImage.height = height;
            
            downloadImage.onload = function() {
                const canvas = document.createElement('canvas');
                const scale = 2; // Gunakan scale yang sama dengan web untuk konsistensi
                canvas.width = width * scale;
                canvas.height = height * scale;
                
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(scale, scale);
                ctx.drawImage(downloadImage, 0, 0);
                
                // Simpan sebagai PNG
                const filename = (currentMindmapData.topic || 'mindmap').replace(/\s+/g, '_');
                
                // Cara yang lebih kompatibel untuk mobile
                canvas.toBlob((blob) => {
                    const downloadUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `${filename}_mobile.png`;
                    
                    // iOS Safari workaround
                    if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        
                        // Tambahan untuk iOS - gunakan data URL langsung
                        const reader = new FileReader();
                        reader.onload = function() {
                            const dataUrl = reader.result;
                            const img = document.createElement('img');
                            img.src = dataUrl;
                            
                            // Buat div untuk tampilan preview
                            const previewDiv = document.createElement('div');
                            previewDiv.className = 'image-preview-container';
                            previewDiv.style.position = 'fixed';
                            previewDiv.style.top = '0';
                            previewDiv.style.left = '0';
                            previewDiv.style.right = '0';
                            previewDiv.style.bottom = '0';
                            previewDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
                            previewDiv.style.zIndex = '10000';
                            previewDiv.style.display = 'flex';
                            previewDiv.style.flexDirection = 'column';
                            previewDiv.style.alignItems = 'center';
                            previewDiv.style.justifyContent = 'center';
                            previewDiv.style.padding = '20px';
                            
                            img.style.maxWidth = '100%';
                            img.style.maxHeight = '80%';
                            img.style.objectFit = 'contain';
                            
                            const infoText = document.createElement('p');
                            infoText.style.color = 'white';
                            infoText.style.margin = '20px 0';
                            infoText.textContent = 'Press and hold image to save';
                            
                            const closeBtn = document.createElement('button');
                            closeBtn.textContent = 'Close';
                            closeBtn.style.padding = '10px 20px';
                            closeBtn.style.backgroundColor = '#0d6efd';
                            closeBtn.style.color = 'white';
                            closeBtn.style.border = 'none';
                            closeBtn.style.borderRadius = '4px';
                            closeBtn.style.marginTop = '20px';
                            
                            closeBtn.onclick = function() {
                                document.body.removeChild(previewDiv);
                                document.body.removeChild(loadingEl);
                            };
                            
                            previewDiv.appendChild(img);
                            previewDiv.appendChild(infoText);
                            previewDiv.appendChild(closeBtn);
                            document.body.appendChild(previewDiv);
                            
                            // Cleanup
                            URL.revokeObjectURL(downloadUrl);
                            URL.revokeObjectURL(url);
                        };
                        reader.readAsDataURL(blob);
                    } else {
                        // Android dan browser lain
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        
                        // Cleanup untuk non-iOS
                        setTimeout(() => {
                            URL.revokeObjectURL(downloadUrl);
                            URL.revokeObjectURL(url);
                            document.body.removeChild(loadingEl);
                        }, 200);
                    }
                }, 'image/png', 0.95);
            };
            
            downloadImage.onerror = function(err) {
                console.error('Error loading SVG for export:', err);
                alert('Failed to export. Please try again.');
                URL.revokeObjectURL(url);
                document.body.removeChild(loadingEl);
            };
            
            downloadImage.src = url;
            
        } catch (error) {
            console.error('Mobile export failed:', error);
            alert('Failed to export PNG: ' + (error.message || 'Unknown error'));
            document.body.removeChild(loadingEl);
        }
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
            const response = await fetch('https://gemini-mindmap-worker.daivanfebrijuansetiya.workers.dev/expand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodeName: nodeName, parentContext: parentContext, rootContext: rootContext }), });
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
            // --- Get the state of the includeDetails checkbox ---
            const includeDetailsCheckbox = document.getElementById('includeDetailsCheckbox');
            const includeDetails = includeDetailsCheckbox ? includeDetailsCheckbox.checked : true; // Default to true if not found
            console.log(`Sending request with includeDetails: ${includeDetails}`);
            // --- End get state ---

            const response = await fetch('https://gemini-mindmap-worker.daivanfebrijuansetiya.workers.dev/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // --- Include includeDetails in the request body ---
                body: JSON.stringify({ topic: topic, includeDetails: includeDetails }),
            });
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

        const originalRoot = d3.hierarchy(data);
        const nodes = originalRoot.descendants();
        const links = originalRoot.links();
            const nodeById = new Map(nodes.map(d => [d.data, d])); // Map original data object to hierarchy node

            // --- Start: Symmetrical Left-Right Layout ---
            if (originalRoot.children && originalRoot.children.length > 0) {
                const firstLevelChildren = originalRoot.children;

                // --- Define Color Palette & Map First Level Children to Colors ---
                const branchColors = ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#d9d9d9", "#bc80bd", "#ccebc5", "#ffed6f"]; // Expanded palette slightly
                const firstLevelColorMap = new Map();
                firstLevelChildren.forEach((child, index) => {
                    // Use child.data as key because the 'd' in style function refers to hierarchy node which has .data
                    firstLevelColorMap.set(child.data, branchColors[index % branchColors.length]);
                });
                // --- End Color Mapping ---

                const midPoint = Math.ceil(firstLevelChildren.length / 2);
                const leftChildrenData = firstLevelChildren.slice(0, midPoint).map(c => c.data);
            const rightChildrenData = firstLevelChildren.slice(midPoint).map(c => c.data);

            const treeLayout = d3.tree().nodeSize([verticalNodeSeparation, horizontalLevelSeparation]);

            // Function to calculate layout for a subtree
            const layoutSubtree = (childrenData) => {
                if (!childrenData || childrenData.length === 0) return { nodes: [], links: [] };
                // Create a temporary root for layout calculation
                const tempRootData = { name: "__temp_root__", children: childrenData };
                const tempHierarchy = d3.hierarchy(tempRootData);
                treeLayout(tempHierarchy);
                // Exclude the temporary root from results, adjust depth
                const subtreeNodes = tempHierarchy.descendants().slice(1).map(n => {
                    n.depth -= 1; // Adjust depth relative to original root
                    return n;
                });
                const subtreeLinks = tempHierarchy.links(); // Links within the subtree
                return { nodes: subtreeNodes, links: subtreeLinks };
            };

            // Layout left and right subtrees independently
            const leftLayout = layoutSubtree(leftChildrenData);
            const rightLayout = layoutSubtree(rightChildrenData);

            // Reset original node positions (except root)
            nodes.forEach(n => { if (n !== originalRoot) { n.x = undefined; n.y = undefined; }});

            // Position root node
            originalRoot.x = 0;
            originalRoot.y = 0;
            originalRoot.side = 'center';

            // Apply calculated positions back to original hierarchy nodes
            leftLayout.nodes.forEach(tempNode => {
                const originalNode = nodeById.get(tempNode.data);
                if (originalNode) {
                    originalNode.x = tempNode.x; // Use calculated vertical position
                    originalNode.y = -tempNode.y - horizontalLevelSeparation; // Negate and offset horizontal
                    originalNode.side = 'left';
                }
            });
            rightLayout.nodes.forEach(tempNode => {
                const originalNode = nodeById.get(tempNode.data);
                if (originalNode) {
                    originalNode.x = tempNode.x; // Use calculated vertical position
                    originalNode.y = tempNode.y + horizontalLevelSeparation; // Offset horizontal
                    originalNode.side = 'right';
                }
            });

            // --- Prepare links ---
            const allLinks = [];
            // Links from root to first level
            firstLevelChildren.forEach(child => {
                allLinks.push({ source: originalRoot, target: child });
            });
            // Links within left subtree
            leftLayout.links.forEach(link => {
                const source = nodeById.get(link.source.data);
                const target = nodeById.get(link.target.data);
                if (source && target) allLinks.push({ source, target });
            });
            // Links within right subtree
            rightLayout.links.forEach(link => {
                const source = nodeById.get(link.source.data);
                const target = nodeById.get(link.target.data);
                if (source && target) allLinks.push({ source, target });
            });

            // --- Adjust Initial Centering ---
            let scale = 1, translateX = 0, translateY = 0;
            if (isInitialRender) {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                nodes.forEach(d => { // Use the updated positions on original nodes
                    if (d.y < minX) minX = d.y;
                    if (d.y > maxX) maxX = d.y;
                    if (d.x < minY) minY = d.x;
                    if (d.x > maxY) maxY = d.x;
                });
                minX -= nodeRectWidth / 2; maxX += nodeRectWidth / 2;
                minY -= 50; maxY += 50;
                const treeWidth = maxX - minX; const treeHeight = maxY - minY;
                const scaleX = treeWidth > 0 ? svgWidth / treeWidth : 1;
                const scaleY = treeHeight > 0 ? svgHeight / treeHeight : 1;
                scale = Math.min(scaleX, scaleY, 1);
                translateX = (svgWidth - treeWidth * scale) / 2 - minX * scale;
                translateY = (svgHeight - treeHeight * scale) / 2 - minY * scale;
                const initialTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
                g.attr('transform', initialTransform);
                svg.call(zoom.transform, initialTransform);
                isInitialRender = false;
            }

            // --- Draw Links ---
            g.selectAll(".link")
             .data(allLinks) // Use combined links
             .enter().append("path")
             .attr("class", "link")
             .attr("d", d3.linkHorizontal().x(d => d.y).y(d => d.x)); // Link generator uses node objects

            // --- Draw Nodes ---
            const node = g.selectAll(".node")
                          .data(nodes) // Use original nodes with updated positions
                          .enter().append("g")
                          .attr("class", "node")
                          .attr("transform", d => `translate(${d.y},${d.x})`)
                          .on('click', function(event, d) { selectNode(event, d, this); })
                          .on('dblclick', function(event, d) { event.stopPropagation(); contextMenu.style.display = 'none'; showNodeEditor(d, this); });

            // Draw rectangles
            node.insert("rect", ":first-child")
                .attr("width", nodeRectWidth)
                .attr("x", -nodeRectWidth / 2)
                .attr("rx", 5).attr("ry", 5)
                .style("stroke", "#aaa").style("stroke-width", "1px")
                .style("fill", d => {
                    if (d.depth === 0) return "#f0e68c"; // Root color

                    // Find the ancestor at depth 1 (the first-level child)
                    let firstLevelAncestor = d;
                    while (firstLevelAncestor.depth > 1) {
                        firstLevelAncestor = firstLevelAncestor.parent;
                    }

                    // Get color from the map using the ancestor's data object as the key
                    // Use d.data if the node itself is a first-level child
                    const ancestorData = firstLevelAncestor ? firstLevelAncestor.data : d.data;
                    return firstLevelColorMap.get(ancestorData) || "#d9d9d9"; // Default to gray if not found
                });

            // Draw text
            node.append("text")
                .attr("class", "node-name")
                .attr("dominant-baseline", "middle")
                .attr("dy", "0em")
                .style("text-anchor", "middle")
                .attr("x", 0)
                .style("font-size", d => d.depth === 0 ? "12px" : (d.depth === 1 ? "11px" : "10px"))
                .style("font-weight", d => d.depth === 0 ? "bold" : "normal")
                .text(d => d.data.name || d.data.topic || 'Root')
                .call(wrapTextInsideNode, textWrapWidth);

            // Adjust rectangle height
            node.each(function(d) {
                const nodeGroup = d3.select(this);
                const textElement = nodeGroup.select("text.node-name").node();
                let contentHeight = 20;
                if (textElement) contentHeight = textElement.getBBox().height;
                const rectHeight = contentHeight + (nodePadding * 3);
                nodeGroup.select("rect").attr("height", rectHeight).attr("y", -rectHeight / 2);
            });

        } else {
            // Handle case with only a root node or no children
            originalRoot.x = svgHeight / 2; // Center vertically
            originalRoot.y = svgWidth / 2;  // Center horizontally
            g.attr('transform', `translate(${originalRoot.y}, ${originalRoot.x})`); // Apply transform to group

            const node = g.selectAll(".node")
                          .data([originalRoot])
                          .enter().append("g")
                          .attr("class", "node")
                          // No translate here as group is already translated
                          .on('click', function(event, d) { selectNode(event, d, this); })
                          .on('dblclick', function(event, d) { event.stopPropagation(); contextMenu.style.display = 'none'; showNodeEditor(d, this); });

            node.insert("rect", ":first-child")
                .attr("width", nodeRectWidth)
                .attr("x", -nodeRectWidth / 2)
                .attr("rx", 5).attr("ry", 5)
                .style("stroke", "#aaa").style("stroke-width", "1px")
                .style("fill", "#f0e68c");

            node.append("text")
                .attr("class", "node-name")
                .attr("dominant-baseline", "middle")
                .attr("dy", "0em")
                .style("text-anchor", "middle")
                .attr("x", 0)
                .style("font-size", "12px").style("font-weight", "bold")
                .text(d => d.data.name || d.data.topic || 'Root')
                .call(wrapTextInsideNode, textWrapWidth);

             node.each(function(d) {
                const nodeGroup = d3.select(this);
                const textElement = nodeGroup.select("text.node-name").node();
                let contentHeight = 20;
                if (textElement) contentHeight = textElement.getBBox().height;
                const rectHeight = contentHeight + (nodePadding * 3);
                nodeGroup.select("rect").attr("height", rectHeight).attr("y", -rectHeight / 2);
            });
             isInitialRender = false; // Still need to set this
        }
        // --- End: Symmetrical Left-Right Layout ---


        svg.on('click', function(event) { if (event.target === this) { if (selectedNodeElement) { d3.select(selectedNodeElement).select('rect').style('stroke', '#aaa').style('stroke-width', '1px'); } selectedNodeData = null; selectedNodeElement = null; contextMenu.style.display = 'none'; hideNodeEditorAndSave(); } });
        console.log("Mindmap rendering complete.");
    }


    // --- Event Listeners ---
    generateBtn.addEventListener('click', () => { const topic = topicInput.value.trim(); if (topic) { fetchMindmapData(topic); } else { alert('Please enter a medical topic.'); } });
    
    // Mengganti handler exportPngBtn untuk perbaikan tampilan yang terpotong
    exportPngBtn.addEventListener('click', () => { 
        const svgElement = document.getElementById('mindmapSvg'); 
        if (!svgElement || !currentMindmapData) { 
            alert("No mind map to export."); 
            return; 
        }
        
        // Tampilkan loading indicator
        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading-indicator';
        loadingEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating high-quality PNG...';
        document.body.appendChild(loadingEl);
        
        try {
            // Dapatkan semua node dalam mindmap
            const nodes = svgElement.querySelectorAll('.node');
            if (nodes.length === 0) {
                document.body.removeChild(loadingEl);
                alert("No nodes found in the mindmap.");
                return;
            }
            
            // Dapatkan grup utama dan transformasi
            const gElement = svgElement.querySelector('g');
            
            // Membuat SVG baru yang akan digunakan untuk export
            const svgNS = "http://www.w3.org/2000/svg";
            const exportSvg = document.createElementNS(svgNS, "svg");
            
            // Salin atribut dari SVG asli yang diperlukan
            exportSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            exportSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
            
            // Salin gaya CSS yang diperlukan
            const style = document.createElementNS(svgNS, "style");
            style.textContent = `
                .node rect { stroke: #aaa; stroke-width: 1px; }
                .node text { font-family: Arial, sans-serif; text-anchor: middle; fill: #333; }
                .link { fill: none; stroke: #adb5bd; stroke-width: 1.5px; }
                text { font-family: Arial, sans-serif; }
            `;
            exportSvg.appendChild(style);
            
            // Tambahkan semua konten SVG ke SVG baru
            const clonedG = gElement.cloneNode(true);
            
            // Reset transformasi pada grup untuk capture seluruh content
            clonedG.removeAttribute("transform");
            exportSvg.appendChild(clonedG);
            
            // Cari bounds dari seluruh node untuk menentukan viewBox
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            nodes.forEach(node => {
                const rect = node.querySelector('rect');
                const nodeTransform = node.getAttribute('transform');
                let nodeX = 0, nodeY = 0;
                
                if (nodeTransform) {
                    const translateMatch = nodeTransform.match(/translate\(([^,]+),([^)]+)\)/);
                    if (translateMatch && translateMatch[1] && translateMatch[2]) {
                        nodeX = parseFloat(translateMatch[1]);
                        nodeY = parseFloat(translateMatch[2]);
                    }
                }
                
                if (rect) {
                    const width = parseFloat(rect.getAttribute('width'));
                    const height = parseFloat(rect.getAttribute('height'));
                    const x = parseFloat(rect.getAttribute('x') || 0);
                    const y = parseFloat(rect.getAttribute('y') || 0);
                    
                    // Hitung posisi absolut dari node
                    const left = nodeX + x;
                    const right = nodeX + x + width;
                    const top = nodeY + y;
                    const bottom = nodeY + y + height;
                    
                    minX = Math.min(minX, left);
                    maxX = Math.max(maxX, right);
                    minY = Math.min(minY, top);
                    maxY = Math.max(maxY, bottom);
                }
            });
            
            // Tambahkan padding
            const padding = 50;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;
            
            // Set dimensi SVG
            const width = maxX - minX;
            const height = maxY - minY;
            exportSvg.setAttribute("width", width.toString());
            exportSvg.setAttribute("height", height.toString());
            exportSvg.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
            
            // Tambahkan background putih
            const background = document.createElementNS(svgNS, "rect");
            background.setAttribute("x", minX.toString());
            background.setAttribute("y", minY.toString());
            background.setAttribute("width", width.toString());
            background.setAttribute("height", height.toString());
            background.setAttribute("fill", "white");
            exportSvg.insertBefore(background, exportSvg.firstChild);
            
            // Konversi SVG ke string
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(exportSvg);
            
            // Konversi ke base64 untuk image
            const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
            
            // Gunakan method yang lebih sederhana dan langsung
            const DOMURL = window.URL || window.webkitURL || window;
            const url = DOMURL.createObjectURL(svgBlob);
            
            const downloadImage = new Image();
            downloadImage.width = width;
            downloadImage.height = height;
            
            downloadImage.onload = function() {
                const canvas = document.createElement('canvas');
                const scale = 2; // Menurunkan scale agar kompatibel di semua device
                canvas.width = width * scale;
                canvas.height = height * scale;
                
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(scale, scale);
                ctx.drawImage(downloadImage, 0, 0);
                
                // Simpan sebagai PNG
                const filename = (currentMindmapData.topic || 'mindmap').replace(/\s+/g, '_');
                
                // Cara 1: Download langsung
                canvas.toBlob((blob) => {
                    const downloadUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `${filename}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    // Cleanup
                    setTimeout(() => {
                        URL.revokeObjectURL(downloadUrl);
                        URL.revokeObjectURL(url);
                        document.body.removeChild(loadingEl);
                    }, 200);
                }, 'image/png', 0.95);
            };
            
            downloadImage.onerror = function(err) {
                console.error('Error loading SVG for export:', err);
                alert('Failed to export. Please try again.');
                URL.revokeObjectURL(url);
                document.body.removeChild(loadingEl);
            };
            
            downloadImage.src = url;
            
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export PNG: ' + (error.message || 'Unknown error'));
            document.body.removeChild(loadingEl);
        }
    });
    
    exportPngMobileBtn.addEventListener('click', () => { exportMobilePng(); });
    ctxAddBtn.addEventListener('click', () => { if (selectedNodeData) addChildNode(); });
    ctxRemoveBtn.addEventListener('click', () => { if (selectedNodeData) removeNode(); });
    ctxExploreBtn.addEventListener('click', () => { if (selectedNodeData) exploreNode(); });
    nodeEditInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { hideNodeEditorAndSave(); } else if (event.key === 'Escape') { nodeEditInput.style.display = 'none'; if (editingNodeData) { g.selectAll(".node").filter(d => d === editingNodeData).select("text.node-name").style('display', null); } editingNodeData = null; } });
    nodeEditInput.addEventListener('blur', () => { if (nodeEditInput.style.display !== 'none') { hideNodeEditorAndSave(); } });
    contextMenu.style.display = 'none';

}); // End of DOMContentLoaded listener
