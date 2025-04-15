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
figma.showUI(__html__, { width: 400, height: 240 });
figma.ui.onmessage = (message) => __awaiter(void 0, void 0, void 0, function* () {
    if (message.type === "runTests") {
        const selectedNode = figma.currentPage.selection[0];
        if (!selectedNode || !(selectedNode.type === "COMPONENT" || selectedNode.type === "COMPONENT_SET")) {
            //figma.notify("Please select a valid Component or Component Set.");
            figma.ui.postMessage({ type: "error" });
            return;
        }
        const section = figma.createFrame();
        section.layoutMode = "VERTICAL"; // Enable Auto Layout
        section.primaryAxisSizingMode = "AUTO"; // Auto size vertically
        section.counterAxisSizingMode = "AUTO"; // Auto size horizontally
        section.paddingLeft = 16; // Optional padding
        section.paddingRight = 16;
        section.paddingTop = 16;
        section.paddingBottom = 16;
        section.itemSpacing = 16; // Spacing between instances
        section.name = "Test Section";
        //single component not working 
        if (selectedNode.type === "COMPONENT") {
            const component = selectedNode;
            const variants = component.variantProperties || {};
            const combinations = generateSingleCombination(variants);
            // Further processing...
        }
        else if (selectedNode.type === "COMPONENT_SET") {
            const componentSet = selectedNode;
            testComponentSetVariants(componentSet, section);
        }
        else {
            //figma.notify("Selected node is not a Component or Component Set.");
            figma.ui.postMessage({ type: "error" });
            return;
        }
        figma.ui.postMessage({ type: "finished" });
        //figma.notify("Tests completed!");
    }
});
function testComponentSetVariants(componentSet, section) {
    const components = componentSet.children.filter((child) => child.type === "COMPONENT");
    components.forEach((component) => {
        const variants = component.variantProperties || {};
        const combo = generateSingleCombination(variants); // Create the single combination
        //console.log(`Testing component ${component.name} with props:`, combo); // Debugging log
        const instance = component.createInstance();
        applyProperties(instance, combo); // Apply the single combination
        // Add the basic single combination instance
        section.appendChild(instance);
        // Call testTextWrapping to generate instances for each test string
        testTextWrapping(component, section);
    });
}
function generateSingleCombination(variants) {
    return Object.assign({}, variants); // Directly use the variants set as the single combination
}
function applyProperties(instance, properties) {
    for (const key in properties) {
        instance.setProperties({ [key]: properties[key] });
    }
}
function testTextWrapping(component, section) {
    return __awaiter(this, void 0, void 0, function* () {
        const testStrings = [
            "Short text",
            "This is a slightly longer sentence to test wrapping behavior.",
            "A really long piece of text that should definitely wrap onto multiple lines if wrapping is enabled properly in the text layer."
        ];
        const baseInstance = component.createInstance();
        console.log(`Base instance created: "${baseInstance.name}"`);
        const textNodes = findTextNodes(baseInstance);
        console.log(`Found ${textNodes.length} text nodes in base instance.`);
        if (textNodes.length === 0) {
            //figma.notify(`Component "${component.name}" does not contain any text layers.`);
            baseInstance.remove(); // Clean up
            return;
        }
        for (const testString of testStrings) {
            const instance = component.createInstance();
            console.log(`Created instance for test string "${testString}":`, instance);
            const instanceTextNodes = findTextNodes(instance);
            console.log(`Updating ${instanceTextNodes.length} text nodes in instance "${instance.name}"`);
            for (const textNode of instanceTextNodes) {
                if (textNode.type === "TEXT") {
                    try {
                        yield figma.loadFontAsync(textNode.fontName); // Load font asynchronously
                        textNode.characters = testString; // Update the text content
                        console.log(`Successfully updated textNode.characters to: ${textNode.characters}`);
                        textNode.name = `Test for: ${testString.slice(0, 15)}...`;
                    }
                    catch (error) {
                        console.error(`Error loading font for textNode "${textNode.name}":`, error);
                    }
                }
            }
            section.appendChild(instance);
            console.log(`Section child count after adding instance: ${section.children.length}`);
        }
        baseInstance.remove(); // Clean up
    });
}
function findTextNodes(node, depth = 0) {
    const maxDepth = 50; // Limit recursion depth to prevent stack overflow
    if (depth > maxDepth) {
        console.warn(`Max depth (${maxDepth}) reached for node traversal.`);
        return [];
    }
    let textNodes = [];
    if (node.type === "TEXT") {
        textNodes.push(node);
    }
    else if ("children" in node && Array.isArray(node.children)) {
        for (const child of node.children) {
            textNodes.push(...findTextNodes(child, depth + 1));
        }
    }
    return textNodes;
}
function loadFonts(textNodes) {
    return __awaiter(this, void 0, void 0, function* () {
        const uniqueFonts = new Set(textNodes.map((textNode) => textNode.fontName));
        for (const font of uniqueFonts) {
            yield figma.loadFontAsync(font);
        }
    });
}
