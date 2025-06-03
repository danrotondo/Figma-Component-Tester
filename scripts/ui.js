document.getElementById("start-button").onclick = () => {
  const loadingState = document.getElementById("loading-state");
  const mainUI = document.getElementById("main-ui");

  // Show the loading state and hide the main UI
  loadingState.style.display = "block";
  mainUI.style.display = "none";

  // Send a message to the plugin to start the process
  parent.postMessage({ pluginMessage: { type: "runTests" } }, "*");
};

// Listen for messages from the plugin
window.onmessage = (event) => {
  const loadingState = document.getElementById("loading-state");
  const successState = document.getElementById("success-state");
  const errorState = document.getElementById("error-state");
  const mainUI = document.getElementById("main-ui");

  if (event.data.pluginMessage.type === "finished") {
    // Hide loading state and show success state
    loadingState.style.display = "none";
    successState.style.display = "block";
  } else if (event.data.pluginMessage.type === "error") {
    // Hide loading state and show error state
    loadingState.style.display = "none";
    errorState.style.display = "block";
  }
};

// Handle restart buttons for success and error states
document.getElementById("restart-button").onclick = () => {
  const successState = document.getElementById("success-state");
  const mainUI = document.getElementById("main-ui");

  successState.style.display = "none";
  mainUI.style.display = "block";
};

document.getElementById("restart-button-error").onclick = () => {
  const errorState = document.getElementById("error-state");
  const mainUI = document.getElementById("main-ui");

  errorState.style.display = "none";
  mainUI.style.display = "block";
};