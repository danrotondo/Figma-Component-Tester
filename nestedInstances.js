figma.ui.onmessage = async (message) => {
    if (message.type === "runTests") {
      const selectedNode = figma.currentPage.selection[0];
  
      if (!selectedNode || !(selectedNode.type === "COMPONENT" || selectedNode.type === "COMPONENT_SET")) {
        figma.notify("Please select a valid Component or Component Set.");
        return;
      }
  
      const section = figma.createFrame(); // Section frame setup
      section.layoutMode = "VERTICAL";
      section.primaryAxisSizingMode = "AUTO";
      section.counterAxisSizingMode = "AUTO";
      section.paddingLeft = 16;
      section.paddingRight = 16;
      section.paddingTop = 16;
      section.paddingBottom = 16;
      section.itemSpacing = 16;
      section.name = "Test Section";
  
      if (selectedNode.type === "COMPONENT_SET") {
        await processComponentSetVariants(selectedNode, section); // Handle Component Sets
      } else if (selectedNode.type === "COMPONENT") {
        await processComponentProperties(selectedNode, section); // Handle single Components
      }
  
      figma.notify("Tests completed successfully!");
    }
  };
  
  /**
   * Traverse the node hierarchy and collect exposed properties from nested instances.
   */
  function collectExposedProperties(node: SceneNode): Record<string, string> {
    let properties: Record<string, string> = {};
  
    if (node.type === "INSTANCE") {
      // Collect exposed variant properties
      properties = { ...properties, ...node.variantProperties };
      // Collect component property references
      properties = { ...properties, ...node.componentPropertyReferences };
      console.log(`Instance "${node.name}" properties:`, properties);
    }
  
    // Recursively collect properties from children
    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        properties = { ...properties, ...collectExposedProperties(child) };
      }
    }
  
    return properties;
  }
  
  /**
   * Process properties for a single Component, including nested instances.
   */
  async function processComponentProperties(component: ComponentNode, section: FrameNode) {
    console.log(`Processing component: ${component.name}`);
  
    // Create an instance for testing
    const instance = component.createInstance();
    const allProperties = collectExposedProperties(instance);
  
    console.log("Collected Exposed Properties:", allProperties);
  
    // Example: Apply specific updates to exposed properties
    Object.keys(allProperties).forEach((propName) => {
      if (propName === "ExampleProperty") {
        instance.variantProperties![propName] = "UpdatedValue"; // Update exposed variant
        console.log(`Updated "${propName}" to "UpdatedValue"`);
      }
    });
  
    section.appendChild(instance); // Append the instance to the section frame
  }
  
  /**
   * Process variants for a Component Set, including nested properties.
   */
  async function processComponentSetVariants(componentSet: ComponentSetNode, section: FrameNode) {
    const components = componentSet.children.filter(
      (child) => child.type === "COMPONENT"
    ) as ComponentNode[];
  
    for (const component of components) {
      console.log(`Processing component: ${component.name}`);
  
      const instance = component.createInstance();
      const allProperties = collectExposedProperties(instance);
  
      console.log("Collected Exposed Properties:", allProperties);
  
      // Example: Apply specific updates to exposed properties
      Object.keys(allProperties).forEach((propName) => {
        if (propName === "ExampleProperty") {
          instance.variantProperties![propName] = "UpdatedValue"; // Update exposed variant
          console.log(`Updated "${propName}" to "UpdatedValue"`);
        }
      });
  
      section.appendChild(instance); // Append the instance to the section frame
    }
  }
  