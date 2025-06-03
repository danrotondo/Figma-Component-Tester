figma.showUI(__html__, { width: 400, height: 240 });

figma.ui.onmessage = async (message) => {
  if (message.type === "runTests") {
    const selectedNode = figma.currentPage.selection[0];

    if (!selectedNode || !(selectedNode.type === "COMPONENT" || selectedNode.type === "COMPONENT_SET" || selectedNode.type === "INSTANCE")) {
      figma.ui.postMessage({ type: "error" });
      return;
    }

    const section = createSectionFrame();

    console.log("Selection is:", selectedNode.type);

    try {
      if (selectedNode.type === "COMPONENT") {
        await testComponent(selectedNode, section);
      } else if (selectedNode.type === "COMPONENT_SET") {
        await testComponentSetVariants(selectedNode, section);
      } else {
        figma.ui.postMessage({ type: "error" });
        return;
      }
      figma.ui.postMessage({ type: "finished" });
      figma.notify("Tests completed!");
    } catch (error) {
      console.error("Error during tests:", error);
      figma.ui.postMessage({ type: "error" });
    }
  }
};

/**
 * Creates a section frame to hold test results.
 */
function createSectionFrame(): FrameNode {
  const section = figma.createFrame();
  section.layoutMode = "VERTICAL";
  section.primaryAxisSizingMode = "AUTO";
  section.counterAxisSizingMode = "AUTO";
  section.paddingLeft = 16;
  section.paddingRight = 16;
  section.paddingTop = 16;
  section.paddingBottom = 16;
  section.itemSpacing = 16;
  section.name = "Test Section";
  return section;
}

/**
 * Tests a single component by generating all property combinations.
 */
async function testComponent(component: ComponentNode, section: FrameNode) {
  console.log(`Testing component: ${component.name}`);

  const propertyCombinations = generateAllPropertyCombinations(component);

  for (const combo of propertyCombinations) {
    console.log(`Testing property combination:`, combo);

    const instance = component.createInstance();
    applyProperties(instance, combo);
    section.appendChild(instance);

    // Optionally, test text wrapping for each combination
    await testTextWrapping(instance, section);
  }
}

/**
 * Tests all variants of a Component Set, and for each variant, all property combinations.
 */
async function testComponentSetVariants(componentSet: ComponentSetNode, section: FrameNode) {
  const components = componentSet.children.filter((child) => child.type === "COMPONENT") as ComponentNode[];

  for (const component of components) {
    console.log(`Testing variant: ${component.name}`);
    await testComponent(component, section);
  }
}

/**
 * Generates all possible combinations of boolean, variant, and text properties for a component.
 */
function generateAllPropertyCombinations(component: ComponentNode): Array<Record<string, string>> {
  const properties = component.componentPropertyReferences || {};
  const keys = Object.keys(properties);

  const combinations: Array<Record<string, string>> = [];

  function generateCombo(index: number, currentCombo: Record<string, string>) {
    if (index === keys.length) {
      combinations.push({ ...currentCombo }); // Push the current combination when all properties are processed
      return;
    }

    const key = keys[index];
    const propertyType = component.componentPropertyDefinitions?.[key]?.type;

    if (propertyType === "BOOLEAN") {
      // Generate combinations for boolean properties
      ["true", "false"].forEach((value) => {
        currentCombo[key] = value; // Apply the boolean value
        generateCombo(index + 1, currentCombo); // Recurse for the next property
        delete currentCombo[key]; // Backtrack
      });
    } else if (propertyType === "VARIANT") {
      // Generate combinations for variant properties
      const variantOptions = component.variantProperties?.[key];
      if (variantOptions) {
        Object.values(variantOptions).forEach((value) => {
          currentCombo[key] = value; // Apply the variant value
          generateCombo(index + 1, currentCombo); // Recurse for the next property
          delete currentCombo[key]; // Backtrack
        });
      }
    } else {
      // Default behavior for unsupported property types
      generateCombo(index + 1, currentCombo);
    }
  }

  generateCombo(0, {});
  return combinations;
}

/**
 * Determines possible values for a property (boolean, variant, etc.).
 */
function getPossibleValuesForProperty(component: ComponentNode, propertyKey: string): string[] {
  const propertyType = component.componentPropertyDefinitions?.[propertyKey]?.type;

  if (propertyType === "BOOLEAN") {
    return ["true", "false"];
  } else if (propertyType === "VARIANT") {
    const variantOptions = component.variantProperties?.[propertyKey];
    return variantOptions ? Object.values(variantOptions) : [];
  }

  // Default to an empty array for unsupported types
  return [];
}

/**
 * Applies a set of properties to an instance.
 */
function applyProperties(instance: InstanceNode, properties: Record<string, string>) {
  for (const key in properties) {
    instance.setProperties({ [key]: properties[key] });
  }
}

/**
 * Tests text wrapping for an instance.
 */
async function testTextWrapping(instance: InstanceNode, section: FrameNode) {
  const testStrings = [
    "Short text",
    "This is a slightly longer sentence to test wrapping behavior.",
    "A really long piece of text that should definitely wrap onto multiple lines if wrapping is enabled properly in the text layer."
  ];

  const textNodes = findTextNodesWithExposedProperties(instance);

  for (const testString of testStrings) {
    const clone = instance.clone();
    for (const textNode of textNodes) {
      try {
        await figma.loadFontAsync(textNode.fontName as FontName);
        textNode.characters = testString; // Update text content
      } catch (error) {
        console.error(`Error loading font for textNode "${textNode.name}":`, error);
      }
    }
    section.appendChild(clone);
  }
}

/**
 * Finds text nodes that have exposed component properties.
 */
function findTextNodesWithExposedProperties(node: SceneNode): TextNode[] {
  const textNodes: TextNode[] = [];

  function traverse(node: SceneNode) {
    if (node.type === "TEXT" && node.componentPropertyReferences && Object.keys(node.componentPropertyReferences).length > 0) {
      textNodes.push(node);
    } else if ("children" in node) {
      for (const child of node.children as SceneNode[]) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return textNodes;
}
