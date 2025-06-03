figma.ui.onmessage = async (message) => {
    if (message.type === "runTests") {
      const selectedNode = figma.currentPage.selection[0];
  
      if (!selectedNode || !(selectedNode.type === "COMPONENT" || selectedNode.type === "COMPONENT_SET" || selectedNode.type === "INSTANCE")) {
        figma.ui.postMessage({ type: "error" });
        return;
      }
  
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
  
      try {
        if (selectedNode.type === "INSTANCE" && selectedNode.parent?.type === "COMPONENT_SET") {
          // Handle selected variant testing
          const instance = selectedNode as InstanceNode;
          await testSelectedVariant(instance, section);
        } else if (selectedNode.type === "COMPONENT") {
          const component = selectedNode as ComponentNode;
          const variants = component.variantProperties || {};
          const combinations = generateSingleCombination(variants);
          // Further processing for single component
        } else if (selectedNode.type === "COMPONENT_SET") {
          const componentSet = selectedNode as ComponentSetNode;
          testComponentSetVariants(componentSet, section);
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
   * Check if a component matches the given variant properties.
   */
  function matchesVariantProperties(component: ComponentNode, variantProperties: Record<string, string>): boolean {
    const componentProps = component.variantProperties || {};
    return Object.keys(variantProperties).every(
      (key) => componentProps[key] === variantProperties[key]
    );
  }
  