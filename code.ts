figma.showUI(__html__, { width: 400, height: 240 });

figma.ui.onmessage = async (message) => {
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
      const component = selectedNode as ComponentNode;
      const variants = component.variantProperties || {};
      const combinations = generateSingleCombination(variants);
      // Further processing...
    } else if (selectedNode.type === "COMPONENT_SET") {
      const componentSet = selectedNode as ComponentSetNode;
      testComponentSetVariants(componentSet, section);
    } else {
      //figma.notify("Selected node is not a Component or Component Set.");
      figma.ui.postMessage({ type: "error" });
      return;
    }
    figma.ui.postMessage({ type: "finished" });
    //figma.notify("Tests completed!");
  }
};

function testComponentSetVariants(componentSet: ComponentSetNode, section: FrameNode) {
  const components = componentSet.children.filter((child) => child.type === "COMPONENT") as ComponentNode[];

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

function generateSingleCombination(variants: Record<string, string>): { [key: string]: string } {
  return { ...variants }; // Directly use the variants set as the single combination
}

function applyProperties(instance: InstanceNode, properties: { [key: string]: string }) {
  for (const key in properties) {
    instance.setProperties({ [key]: properties[key] });
  }
}

async function testTextWrapping(component: ComponentNode, section: FrameNode) {
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
          await figma.loadFontAsync(textNode.fontName as FontName); // Load font asynchronously
          textNode.characters = testString; // Update the text content
          console.log(`Successfully updated textNode.characters to: ${textNode.characters}`);
          textNode.name = `Test for: ${testString.slice(0, 15)}...`;
        } catch (error) {
          console.error(`Error loading font for textNode "${textNode.name}":`, error);
        }
      }
    }

    section.appendChild(instance);
    console.log(`Section child count after adding instance: ${section.children.length}`);
  }

  baseInstance.remove(); // Clean up
}


function findTextNodes(node: SceneNode, depth = 0): TextNode[] {
  const maxDepth = 50; // Limit recursion depth to prevent stack overflow
  if (depth > maxDepth) {
    console.warn(`Max depth (${maxDepth}) reached for node traversal.`);
    return [];
  }

  let textNodes: TextNode[] = [];
  if (node.type === "TEXT") {
    textNodes.push(node);
  } else if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      textNodes.push(...findTextNodes(child, depth + 1));
    }
  }
  return textNodes;
}

async function loadFonts(textNodes: TextNode[]) {
  const uniqueFonts = new Set(textNodes.map((textNode) => textNode.fontName as FontName));
  for (const font of uniqueFonts) {
    await figma.loadFontAsync(font);
  }
}