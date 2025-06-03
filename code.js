"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Add cancellation flag
let isCancelled = false;
figma.showUI(__html__, {
    width: 320,
    height: 400,
    themeColors: true,
    visible: true
});
figma.ui.onmessage = (message) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (message.type === "cancelTests") {
        isCancelled = true;
        figma.notify("Cancelling tests...");
        return;
    }
    if (message.type === "runTests") {
        // Reset cancellation flag at the start of new tests
        isCancelled = false;
        const selectedNode = figma.currentPage.selection[0];
        const options = {
            testTextLengths: message.testTextLengths,
            testResizing: message.testResizing
        };
        if (!selectedNode || !(selectedNode.type === "COMPONENT" || selectedNode.type === "COMPONENT_SET")) {
            figma.ui.postMessage({ type: "error", message: "Please select a component or component set to test." });
            return;
        }
        const section = createSectionFrame();
        console.log("🏁 Selection is:", selectedNode.type, selectedNode.name);
        console.log("🏁 Component name: ", selectedNode.name);
        try {
            if (selectedNode.type === "COMPONENT_SET") {
                // Testing a component set
                console.log("🏁 Testing component set:", selectedNode.name);
                console.log("🏁 Component set properties:", JSON.stringify(selectedNode.componentPropertyDefinitions, null, 2));
                // Create a header for this component set
                const setHeader = yield createTestGroup(selectedNode.name, "Testing all variants in component set");
                section.appendChild(setHeader);
                // Test each variant in the set
                for (const variant of selectedNode.children) {
                    if (isCancelled) {
                        console.log("🛑 Tests cancelled");
                        section.remove();
                        figma.ui.postMessage({ type: "cancelled" });
                        figma.notify("Tests cancelled");
                        return;
                    }
                    if (variant.type === "COMPONENT") {
                        console.log("🏁 Testing variant:", variant.name);
                        const variantProps = yield getVariantProperties(selectedNode, variant);
                        yield testComponent(variant, setHeader, options, variantProps);
                    }
                }
            }
            else if (selectedNode.type === "COMPONENT") {
                // Check if this is part of a component set
                if (((_a = selectedNode.parent) === null || _a === void 0 ? void 0 : _a.type) === "COMPONENT_SET") {
                    const componentSet = selectedNode.parent;
                    console.log("🏁 Component is part of set:", componentSet.name);
                    console.log("🏁 Component set properties:", JSON.stringify(componentSet.componentPropertyDefinitions, null, 2));
                    // Get variant properties and test the component
                    const variantProps = yield getVariantProperties(componentSet, selectedNode);
                    yield testComponent(selectedNode, section, options, variantProps);
                }
                else {
                    // Regular standalone component
                    console.log("🏁 componentPropertyDefinitions:", JSON.stringify(selectedNode.componentPropertyDefinitions, null, 2));
                    yield testComponent(selectedNode, section, options);
                }
            }
            if (isCancelled) {
                console.log("🛑 Tests cancelled");
                section.remove();
                figma.ui.postMessage({ type: "cancelled" });
                figma.notify("Tests cancelled");
                return;
            }
            figma.ui.postMessage({ type: "finished" });
            figma.notify("✅ Tests completed!");
        }
        catch (error) {
            console.error("🚨 Error during tests:", error);
            figma.ui.postMessage({ type: "error", message: "An error occurred while running tests." });
            if (section)
                section.remove();
        }
    }
});
function createSectionFrame() {
    const selectedNode = figma.currentPage.selection[0];
    const section = figma.createFrame();
    // Set up section styling with Splunk UI theme colors
    section.layoutMode = "VERTICAL";
    section.primaryAxisSizingMode = "AUTO";
    section.counterAxisSizingMode = "AUTO";
    section.paddingLeft = 24;
    section.paddingRight = 24;
    section.paddingTop = 24;
    section.paddingBottom = 24;
    section.itemSpacing = 24;
    section.name = "Component Test Results";
    section.fills = [
        {
            type: "SOLID",
            color: { r: 0.11, g: 0.11, b: 0.12 } // Splunk dark background color
        }
    ];
    section.cornerRadius = 4;
    // Add header with description
    const header = figma.createFrame();
    header.layoutMode = "VERTICAL";
    header.primaryAxisSizingMode = "AUTO";
    header.counterAxisSizingMode = "AUTO";
    header.itemSpacing = 8;
    header.fills = [];
    const title = figma.createText();
    const description = figma.createText();
    // Load fonts
    Promise.all([
        figma.loadFontAsync({ family: "Inter", style: "Semi Bold" }),
        figma.loadFontAsync({ family: "Inter", style: "Regular" })
    ]).then(() => {
        title.characters = "Component Test Results";
        title.fontSize = 16;
        title.fontName = { family: "Inter", style: "Semi Bold" };
        title.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        description.characters = "This plugin tests your component with different property combinations, text lengths, and sizes. Select a component and choose your test options below.";
        description.fontSize = 13;
        description.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.65 } }];
    });
    header.appendChild(title);
    header.appendChild(description);
    section.appendChild(header);
    // Position the section
    const componentBounds = selectedNode.absoluteBoundingBox;
    let xPosition = componentBounds.x + componentBounds.width + 100;
    let yPosition = componentBounds.y;
    // Check if there's enough space to the right
    const pageNodes = figma.currentPage.children;
    const rightEdge = Math.max(...pageNodes.map(node => {
        const bounds = node.absoluteBoundingBox;
        return bounds ? bounds.x + bounds.width : 0;
    }));
    // If not enough space on the right, try below the component
    if (xPosition + 400 > rightEdge) { // Assuming minimum section width of 400px
        xPosition = componentBounds.x;
        yPosition = componentBounds.y + componentBounds.height + 100; // 100px gap below
    }
    // Find any overlapping nodes at the target position
    let hasOverlap = true;
    const maxAttempts = 5;
    let attempts = 0;
    while (hasOverlap && attempts < maxAttempts) {
        hasOverlap = false;
        for (const node of pageNodes) {
            if (node === section || node === selectedNode)
                continue;
            const nodeBounds = node.absoluteBoundingBox;
            if (!nodeBounds)
                continue;
            // Check for overlap
            const overlap = !(xPosition > nodeBounds.x + nodeBounds.width + 50 || // 50px safety margin
                xPosition + 400 < nodeBounds.x - 50 ||
                yPosition > nodeBounds.y + nodeBounds.height + 50 ||
                yPosition < nodeBounds.y - 50);
            if (overlap) {
                hasOverlap = true;
                // Try moving down in 100px increments
                yPosition += 100;
                break;
            }
        }
        attempts++;
    }
    // Position the section
    section.x = xPosition;
    section.y = yPosition;
    return section;
}
// Helper function to get variant properties from a component set
function getVariantProperties(componentSet, variant) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const setProperties = componentSet.componentPropertyDefinitions;
        const variantProps = {};
        // Get the variant's current property values
        for (const [key, def] of Object.entries(setProperties)) {
            if (def.type === "VARIANT") {
                const variantValue = (_a = variant.variantProperties) === null || _a === void 0 ? void 0 : _a[key];
                if (variantValue) {
                    variantProps[key] = variantValue;
                }
            }
        }
        console.log("🏁 Variant properties:", variantProps);
        return variantProps;
    });
}
function createTestGroup(name, description) {
    return __awaiter(this, void 0, void 0, function* () {
        const group = figma.createFrame();
        group.name = name;
        group.layoutMode = "VERTICAL";
        group.primaryAxisSizingMode = "AUTO";
        group.counterAxisSizingMode = "AUTO";
        group.itemSpacing = 16;
        group.paddingLeft = 16;
        group.paddingRight = 16;
        group.paddingTop = 16;
        group.paddingBottom = 16;
        group.cornerRadius = 4;
        group.fills = [
            {
                type: "SOLID",
                color: { r: 0.14, g: 0.15, b: 0.16 } // Splunk card background color
            }
        ];
        // Add subtle border
        group.strokes = [{
                type: "SOLID",
                color: { r: 0.2, g: 0.21, b: 0.23 }
            }];
        group.strokeWeight = 1;
        // Create header text
        const header = figma.createText();
        yield figma.loadFontAsync({ family: "Inter", style: "Medium" });
        header.characters = name;
        header.fontSize = 14;
        header.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        header.fontName = { family: "Inter", style: "Medium" };
        // Create description text
        const text = figma.createText();
        yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
        text.characters = description;
        text.fontSize = 12;
        text.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.65 } }];
        text.lineHeight = { value: 18, unit: "PIXELS" };
        const textContainer = figma.createFrame();
        textContainer.layoutMode = "VERTICAL";
        textContainer.primaryAxisSizingMode = "AUTO";
        textContainer.counterAxisSizingMode = "AUTO";
        textContainer.itemSpacing = 8;
        textContainer.fills = [];
        textContainer.appendChild(header);
        textContainer.appendChild(text);
        group.appendChild(textContainer);
        return group;
    });
}
function testComponent(component, section, options, variantProps) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`🧪 Testing component: ${component.name}`);
        console.log("🧪 Test options:", options);
        const propertyCombinations = yield generateAllPropertyCombinations(component, variantProps);
        console.log(`🧪 propertyCombinations: ${propertyCombinations}`);
        for (const combo of propertyCombinations) {
            if (isCancelled) {
                console.log("🛑 Cancelling component tests");
                return;
            }
            console.log("🧪 Testing property combination:", combo);
            const propertyDesc = Object.entries(combo)
                .map(([key, value]) => `${key}=${value}`)
                .join(", ");
            const groupName = `${component.name} - ${propertyDesc}`;
            const description = `Testing combination:\n${propertyDesc}`;
            const group = yield createTestGroup(groupName, description);
            section.appendChild(group);
            const instance = component.createInstance();
            instance.name = `${component.name} (${propertyDesc})`;
            yield applyProperties(instance, combo);
            group.appendChild(instance);
            if (options.testTextLengths && !isCancelled) {
                const textGroup = yield createTestGroup("Text Length Tests", "Testing different text lengths");
                group.appendChild(textGroup);
                const testStrings = [
                    "Short text",
                    "A bit longer of a text message",
                    "A much longer wrapping text that should definitely wrap to multiple lines in most cases"
                ];
                const textNodes = findTextNodesWithExposedProperties(instance);
                for (const testString of testStrings) {
                    if (isCancelled)
                        break;
                    const clone = instance.clone();
                    clone.name = `${instance.name} (Text: "${testString}")`;
                    for (const textNode of textNodes) {
                        try {
                            yield figma.loadFontAsync(textNode.fontName);
                            textNode.characters = testString;
                        }
                        catch (error) {
                            console.error(`🚨 Error loading font for ${textNode.name}:`, error);
                        }
                    }
                    textGroup.appendChild(clone);
                }
            }
            if (options.testResizing && !isCancelled) {
                const sizeGroup = yield createTestGroup("Size Tests", "Testing different component sizes");
                group.appendChild(sizeGroup);
                const sizeVariations = [
                    { width: 100, height: 40, label: "small" },
                    { width: 200, height: 80, label: "medium" },
                    { width: 300, height: 120, label: "large" }
                ];
                for (const size of sizeVariations) {
                    if (isCancelled)
                        break;
                    const clone = instance.clone();
                    clone.name = `${instance.name} (Size: ${size.label} ${size.width}x${size.height})`;
                    clone.resize(size.width, size.height);
                    sizeGroup.appendChild(clone);
                }
            }
        }
    });
}
function applyProperties(instance, properties) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        console.log("🔵 Applying properties to instance:", instance.id);
        console.log("🔵 Properties to apply:", properties);
        try {
            // Separate properties into main and nested
            const mainProps = {};
            const nestedProps = {};
            // First sort properties into main and nested
            for (const [key, value] of Object.entries(properties)) {
                if (key.includes('/')) {
                    // This is a nested property
                    const [instanceName, propName] = key.split('/');
                    if (!nestedProps[instanceName]) {
                        nestedProps[instanceName] = {};
                    }
                    nestedProps[instanceName][propName] = value;
                }
                else {
                    // This is a main property
                    mainProps[key] = value;
                }
            }
            // Apply main component properties
            if (Object.keys(mainProps).length > 0) {
                const mainComponent = yield instance.getMainComponentAsync();
                if (!mainComponent) {
                    console.warn("⚠️ No main component found for instance");
                    return;
                }
                // Get property definitions from component set if available
                const componentSet = ((_a = mainComponent.parent) === null || _a === void 0 ? void 0 : _a.type) === "COMPONENT_SET" ? mainComponent.parent : null;
                const propertySource = componentSet || mainComponent;
                // Convert properties to correct types
                const convertedProps = {};
                for (const [key, value] of Object.entries(mainProps)) {
                    const def = propertySource.componentPropertyDefinitions[key];
                    if ((def === null || def === void 0 ? void 0 : def.type) === "BOOLEAN") {
                        convertedProps[key] = value === "true";
                    }
                    else if ((def === null || def === void 0 ? void 0 : def.type) === "VARIANT") {
                        convertedProps[key] = value;
                    }
                    else {
                        convertedProps[key] = value;
                    }
                }
                instance.setProperties(convertedProps);
                console.log("✅ Applied main properties:", convertedProps);
            }
            // Apply nested component properties
            if (Object.keys(nestedProps).length > 0) {
                console.log("🔍 Applying nested properties:", nestedProps);
                // Function to recursively find and update nested instances
                function updateNestedInstances(node) {
                    return __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        if ("children" in node) {
                            for (const child of node.children) {
                                yield updateNestedInstances(child);
                            }
                        }
                        if (node.type === "INSTANCE" && node.isExposedInstance) {
                            const nodeName = node.name;
                            if (nodeName in nestedProps) {
                                console.log(`🎯 Found nested instance to update: "${nodeName}"`);
                                const nestedMain = yield node.getMainComponentAsync();
                                if (!nestedMain) {
                                    console.warn(`⚠️ No main component found for nested instance: ${nodeName}`);
                                    return;
                                }
                                // Get property definitions from component set if available
                                const nestedComponentSet = ((_a = nestedMain.parent) === null || _a === void 0 ? void 0 : _a.type) === "COMPONENT_SET" ? nestedMain.parent : null;
                                const nestedPropertySource = nestedComponentSet || nestedMain;
                                // Convert nested properties to correct types
                                const convertedNestedProps = {};
                                for (const [key, value] of Object.entries(nestedProps[nodeName])) {
                                    const def = nestedPropertySource.componentPropertyDefinitions[key];
                                    if ((def === null || def === void 0 ? void 0 : def.type) === "BOOLEAN") {
                                        convertedNestedProps[key] = value === "true";
                                    }
                                    else if ((def === null || def === void 0 ? void 0 : def.type) === "VARIANT") {
                                        convertedNestedProps[key] = value;
                                    }
                                    else {
                                        convertedNestedProps[key] = value;
                                    }
                                }
                                node.setProperties(convertedNestedProps);
                                console.log(`✅ Applied nested properties to "${nodeName}":`, convertedNestedProps);
                            }
                        }
                    });
                }
                yield updateNestedInstances(instance);
            }
        }
        catch (err) {
            console.error("🚨 Error applying properties:", err);
            if (err instanceof Error) {
                console.error("Error message:", err.message);
                console.error("Error stack:", err.stack);
            }
        }
    });
}
function generateAllPropertyCombinations(component, variantProps) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // Always get properties from component set if available, otherwise from standalone component
        const componentSet = ((_a = component.parent) === null || _a === void 0 ? void 0 : _a.type) === "COMPONENT_SET" ? component.parent : null;
        const propertySource = componentSet || component;
        // Get all property definitions including nested ones
        const allDefs = Object.assign({}, propertySource.componentPropertyDefinitions);
        // Collect nested component properties
        function collectNestedProps(node) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a;
                if ("children" in node && Array.isArray(node.children)) {
                    for (const child of node.children) {
                        yield collectNestedProps(child);
                    }
                }
                if (node.type === "INSTANCE" && node.isExposedInstance) {
                    console.log("👀 Found nested instance! :", node.name);
                    const nestedMain = yield node.getMainComponentAsync();
                    if (!nestedMain) {
                        console.log("Nope?");
                        return;
                    }
                    // For nested components, get properties from their component set if available
                    const nestedComponentSet = ((_a = nestedMain.parent) === null || _a === void 0 ? void 0 : _a.type) === "COMPONENT_SET" ? nestedMain.parent : null;
                    const nestedPropertySource = nestedComponentSet || nestedMain;
                    const nestedDefs = nestedPropertySource.componentPropertyDefinitions;
                    console.log("👀 Nested component properties:", JSON.stringify(nestedDefs, null, 2));
                    // Add all non-variant properties from nested components
                    for (const [key, def] of Object.entries(nestedDefs)) {
                        // For nested components in sets, only include non-variant properties
                        if (!nestedComponentSet || def.type !== "VARIANT") {
                            const combinedKey = `${node.name}/${key}`;
                            allDefs[combinedKey] = def;
                            console.log("👀 Added nested property:", combinedKey);
                        }
                    }
                }
            });
        }
        // Create an instance to collect nested properties
        const testInstance = component.createInstance();
        yield collectNestedProps(testInstance);
        testInstance.remove(); // Clean up the test instance
        console.log("📋 All property definitions (including nested):", allDefs);
        const combinations = [];
        // If we have variant properties, start with those as the base
        if (variantProps && Object.keys(variantProps).length > 0) {
            combinations.push(Object.assign({}, variantProps));
        }
        // Filter out properties that are already handled by variantProps
        const propertyKeys = Object.keys(allDefs).filter(key => {
            // Skip variant properties if we already have variantProps
            if (variantProps && allDefs[key].type === "VARIANT") {
                return false;
            }
            return true;
        });
        if (propertyKeys.length === 0) {
            console.log("ℹ️ No additional properties to combine beyond variant properties");
            return combinations.length > 0 ? combinations : [{}];
        }
        // If we have no combinations yet, start with an empty object
        if (combinations.length === 0) {
            combinations.push({});
        }
        // Generate combinations for remaining properties
        for (const key of propertyKeys) {
            const def = allDefs[key];
            if (!def)
                continue;
            const currentCombos = [...combinations];
            combinations.length = 0;
            for (const combo of currentCombos) {
                switch (def.type) {
                    case "BOOLEAN":
                        combinations.push(Object.assign(Object.assign({}, combo), { [key]: "true" }), Object.assign(Object.assign({}, combo), { [key]: "false" }));
                        break;
                    case "INSTANCE_SWAP":
                        if (def.variantOptions && def.variantOptions.length > 0) {
                            for (const value of def.variantOptions) {
                                combinations.push(Object.assign(Object.assign({}, combo), { [key]: value }));
                            }
                        }
                        else {
                            combinations.push(Object.assign({}, combo));
                        }
                        break;
                    default:
                        combinations.push(Object.assign({}, combo));
                }
            }
        }
        console.log(`📦 Generated ${combinations.length} combinations for component: ${component.name}`);
        console.log("📦 Combinations:", combinations);
        return combinations;
    });
}
function findTextNodesWithExposedProperties(node) {
    const textNodes = [];
    function traverse(node) {
        if (node.type === "TEXT" && node.componentPropertyReferences && Object.keys(node.componentPropertyReferences).length > 0) {
            textNodes.push(node);
        }
        else if ("children" in node && Array.isArray(node.children)) {
            for (const child of node.children) {
                traverse(child);
            }
        }
    }
    traverse(node);
    return textNodes;
}
function collectExposedProperties(node) {
    let properties = {};
    console.log("🔵 Collecting exposed props from node:", node.name);
    if (node.type === "INSTANCE") {
        console.log("🔵 Found instance:", node.name);
        console.log("   - Variant properties:", node.variantProperties);
        console.log("   - Component property references:", node.componentPropertyReferences);
        properties = Object.assign(Object.assign({}, properties), node.variantProperties);
        properties = Object.assign(Object.assign({}, properties), node.componentPropertyReferences);
    }
    if ("children" in node && Array.isArray(node.children)) {
        for (const child of node.children) {
            properties = Object.assign(Object.assign({}, properties), collectExposedProperties(child));
        }
    }
    return properties;
}
