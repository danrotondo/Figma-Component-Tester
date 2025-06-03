// Add interface for test options
interface TestOptions {
  testTextLengths: boolean;
  testResizing: boolean;
}

// Add cancellation flag
let isCancelled = false;

figma.showUI(__html__, { 
  width: 320,
  height: 400,
  themeColors: true,
  visible: true
});

figma.ui.onmessage = async (message) => {
  if (message.type === "cancelTests") {
    isCancelled = true;
    figma.notify("Cancelling tests...");
    return;
  }

  if (message.type === "runTests") {
    // Reset cancellation flag at the start of new tests
    isCancelled = false;
    
    const selectedNode = figma.currentPage.selection[0];
    const options: TestOptions = {
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
        const setHeader = await createTestGroup(
          selectedNode.name,
          "Testing all variants in component set"
        );
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
            const variantProps = await getVariantProperties(selectedNode, variant);
            await testComponent(variant, setHeader, options, variantProps);
          }
        }
      } else if (selectedNode.type === "COMPONENT") {
        // Check if this is part of a component set
        if (selectedNode.parent?.type === "COMPONENT_SET") {
          const componentSet = selectedNode.parent;
          console.log("🏁 Component is part of set:", componentSet.name);
          console.log("🏁 Component set properties:", JSON.stringify(componentSet.componentPropertyDefinitions, null, 2));
          
          // Get variant properties and test the component
          const variantProps = await getVariantProperties(componentSet, selectedNode);
          await testComponent(selectedNode, section, options, variantProps);
        } else {
          // Regular standalone component
          console.log("🏁 componentPropertyDefinitions:", JSON.stringify(selectedNode.componentPropertyDefinitions, null, 2));
          await testComponent(selectedNode, section, options);
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
    } catch (error) {
      console.error("🚨 Error during tests:", error);
      figma.ui.postMessage({ type: "error", message: "An error occurred while running tests." });
      if (section) section.remove();
    }
  }
};

function createSectionFrame(): FrameNode {
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
  const componentBounds = selectedNode.absoluteBoundingBox!;
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
      if (node === section || node === selectedNode) continue;
      
      const nodeBounds = node.absoluteBoundingBox;
      if (!nodeBounds) continue;
      
      // Check for overlap
      const overlap = !(
        xPosition > nodeBounds.x + nodeBounds.width + 50 || // 50px safety margin
        xPosition + 400 < nodeBounds.x - 50 ||
        yPosition > nodeBounds.y + nodeBounds.height + 50 ||
        yPosition < nodeBounds.y - 50
      );
      
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
async function getVariantProperties(componentSet: ComponentSetNode, variant: ComponentNode): Promise<Record<string, string>> {
  const setProperties = componentSet.componentPropertyDefinitions;
  const variantProps: Record<string, string> = {};
  
  // Get the variant's current property values
  for (const [key, def] of Object.entries(setProperties)) {
    if (def.type === "VARIANT") {
      const variantValue = variant.variantProperties?.[key];
      if (variantValue) {
        variantProps[key] = variantValue;
      }
    }
  }
  
  console.log("🏁 Variant properties:", variantProps);
  return variantProps;
}

async function createTestGroup(name: string, description: string): Promise<FrameNode> {
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
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  header.characters = name;
  header.fontSize = 14;
  header.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  header.fontName = { family: "Inter", style: "Medium" };
  
  // Create description text
  const text = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
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
}

async function testComponent(
  component: ComponentNode, 
  section: FrameNode, 
  options: TestOptions,
  variantProps?: Record<string, string>
) {
  console.log(`🧪 Testing component: ${component.name}`);
  console.log("🧪 Test options:", options);

  const propertyCombinations = await generateAllPropertyCombinations(
    component,
    variantProps
  );
  
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
    const group = await createTestGroup(groupName, description);
    section.appendChild(group);

    const instance = component.createInstance();
    instance.name = `${component.name} (${propertyDesc})`;
    await applyProperties(instance, combo);
    group.appendChild(instance);

    if (options.testTextLengths && !isCancelled) {
      const textGroup = await createTestGroup(
        "Text Length Tests",
        "Testing different text lengths"
      );
      group.appendChild(textGroup);
      
      const testStrings = [
        "Short text",
        "A bit longer of a text message",
        "A much longer wrapping text that should definitely wrap to multiple lines in most cases"
      ];

      const textNodes = findTextNodesWithExposedProperties(instance);
      
      for (const testString of testStrings) {
        if (isCancelled) break;

        const clone = instance.clone();
        clone.name = `${instance.name} (Text: "${testString}")`;
        
        for (const textNode of textNodes) {
          try {
            await figma.loadFontAsync(textNode.fontName as FontName);
            textNode.characters = testString;
          } catch (error) {
            console.error(`🚨 Error loading font for ${textNode.name}:`, error);
          }
        }
        textGroup.appendChild(clone);
      }
    }
    
    if (options.testResizing && !isCancelled) {
      const sizeGroup = await createTestGroup(
        "Size Tests",
        "Testing different component sizes"
      );
      group.appendChild(sizeGroup);
      
      const sizeVariations = [
        { width: 100, height: 40, label: "small" },
        { width: 200, height: 80, label: "medium" },
        { width: 300, height: 120, label: "large" }
      ];

      for (const size of sizeVariations) {
        if (isCancelled) break;

        const clone = instance.clone();
        clone.name = `${instance.name} (Size: ${size.label} ${size.width}x${size.height})`;
        clone.resize(size.width, size.height);
        sizeGroup.appendChild(clone);
      }
    }
  }
}

type ComponentPropertyDefinition = {
  type: "BOOLEAN" | "TEXT" | "INSTANCE_SWAP" | "VARIANT";
  defaultValue?: string | boolean;
  variantOptions?: string[];
};

async function applyProperties(instance: InstanceNode, properties: Record<string, string>) {
  console.log("🔵 Applying properties to instance:", instance.id);
  console.log("🔵 Properties to apply:", properties);

  try {
    // Separate properties into main and nested
    const mainProps: Record<string, string | boolean> = {};
    const nestedProps: Record<string, Record<string, string | boolean>> = {};

    // First sort properties into main and nested
    for (const [key, value] of Object.entries(properties)) {
      if (key.includes('/')) {
        // This is a nested property
        const [instanceName, propName] = key.split('/');
        if (!nestedProps[instanceName]) {
          nestedProps[instanceName] = {};
        }
        nestedProps[instanceName][propName] = value;
      } else {
        // This is a main property
        mainProps[key] = value;
      }
    }

    // Apply main component properties
    if (Object.keys(mainProps).length > 0) {
      const mainComponent = await instance.getMainComponentAsync();
      if (!mainComponent) {
        console.warn("⚠️ No main component found for instance");
        return;
      }

      // Get property definitions from component set if available
      const componentSet = mainComponent.parent?.type === "COMPONENT_SET" ? mainComponent.parent : null;
      const propertySource = componentSet || mainComponent;

      // Convert properties to correct types
      const convertedProps: Record<string, string | boolean> = {};
      for (const [key, value] of Object.entries(mainProps)) {
        const def = propertySource.componentPropertyDefinitions[key];
        if (def?.type === "BOOLEAN") {
          convertedProps[key] = value === "true";
        } else if (def?.type === "VARIANT") {
          convertedProps[key] = value;
        } else {
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
      async function updateNestedInstances(node: SceneNode) {
        if ("children" in node) {
          for (const child of node.children) {
            await updateNestedInstances(child);
          }
        }

        if (node.type === "INSTANCE" && node.isExposedInstance) {
          const nodeName = node.name;
          if (nodeName in nestedProps) {
            console.log(`🎯 Found nested instance to update: "${nodeName}"`);
            
            const nestedMain = await node.getMainComponentAsync();
            if (!nestedMain) {
              console.warn(`⚠️ No main component found for nested instance: ${nodeName}`);
              return;
            }

            // Get property definitions from component set if available
            const nestedComponentSet = nestedMain.parent?.type === "COMPONENT_SET" ? nestedMain.parent : null;
            const nestedPropertySource = nestedComponentSet || nestedMain;

            // Convert nested properties to correct types
            const convertedNestedProps: Record<string, string | boolean> = {};
            for (const [key, value] of Object.entries(nestedProps[nodeName])) {
              const def = nestedPropertySource.componentPropertyDefinitions[key];
              if (def?.type === "BOOLEAN") {
                convertedNestedProps[key] = value === "true";
              } else if (def?.type === "VARIANT") {
                convertedNestedProps[key] = value;
              } else {
                convertedNestedProps[key] = value;
              }
            }

            node.setProperties(convertedNestedProps);
            console.log(`✅ Applied nested properties to "${nodeName}":`, convertedNestedProps);
          }
        }
      }

      await updateNestedInstances(instance);
    }
  } catch (err) {
    console.error("🚨 Error applying properties:", err);
    if (err instanceof Error) {
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
    }
  }
}

async function generateAllPropertyCombinations(
  component: ComponentNode,
  variantProps?: Record<string, string>
): Promise<Array<Record<string, string>>> {
  // Always get properties from component set if available, otherwise from standalone component
  const componentSet = component.parent?.type === "COMPONENT_SET" ? component.parent : null;
  const propertySource = componentSet || component;

  // Get all property definitions including nested ones
  const allDefs: Record<string, ComponentPropertyDefinition> = {
    ...propertySource.componentPropertyDefinitions
  };

  // Collect nested component properties
  async function collectNestedProps(node: SceneNode) {
    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        await collectNestedProps(child);
      }
    }
  
    if (node.type === "INSTANCE" && node.isExposedInstance) {
      console.log("👀 Found nested instance! :", node.name);
      const nestedMain = await node.getMainComponentAsync();
      if (!nestedMain) { 
        console.log("Nope?"); 
        return;
      }

      // For nested components, get properties from their component set if available
      const nestedComponentSet = nestedMain.parent?.type === "COMPONENT_SET" ? nestedMain.parent : null;
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
  }

  // Create an instance to collect nested properties
  const testInstance = component.createInstance();
  await collectNestedProps(testInstance);
  testInstance.remove(); // Clean up the test instance

  console.log("📋 All property definitions (including nested):", allDefs);

  const combinations: Array<Record<string, string>> = [];
  
  // If we have variant properties, start with those as the base
  if (variantProps && Object.keys(variantProps).length > 0) {
    combinations.push({ ...variantProps });
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
    if (!def) continue;

    const currentCombos = [...combinations];
    combinations.length = 0;

    for (const combo of currentCombos) {
      switch (def.type) {
        case "BOOLEAN":
          combinations.push(
            { ...combo, [key]: "true" },
            { ...combo, [key]: "false" }
          );
          break;

        case "INSTANCE_SWAP":
          if (def.variantOptions && def.variantOptions.length > 0) {
            for (const value of def.variantOptions) {
              combinations.push({ ...combo, [key]: value });
            }
          } else {
            combinations.push({ ...combo });
          }
          break;

        default:
          combinations.push({ ...combo });
      }
    }
  }

  console.log(`📦 Generated ${combinations.length} combinations for component: ${component.name}`);
  console.log("📦 Combinations:", combinations);

  return combinations;
}

function findTextNodesWithExposedProperties(node: SceneNode): TextNode[] {
  const textNodes: TextNode[] = [];

  function traverse(node: SceneNode) {
    if (node.type === "TEXT" && node.componentPropertyReferences && Object.keys(node.componentPropertyReferences).length > 0) {
      textNodes.push(node);
    } else if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return textNodes;
}

function collectExposedProperties(node: SceneNode): Record<string, string> {
  let properties: Record<string, string> = {};
  console.log("🔵 Collecting exposed props from node:", node.name);

  if (node.type === "INSTANCE") {
    console.log("🔵 Found instance:", node.name);
    console.log("   - Variant properties:", node.variantProperties);
    console.log("   - Component property references:", node.componentPropertyReferences);

    properties = { ...properties, ...node.variantProperties };
    properties = { ...properties, ...node.componentPropertyReferences };
  }

  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      properties = { ...properties, ...collectExposedProperties(child) };
    }
  }

  return properties;
}
