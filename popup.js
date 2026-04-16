// Wait for the popup HTML to load before accessing elements.
document.addEventListener('DOMContentLoaded', () => {
  // Get a reference to the button in popup.html.
  const helloButton = document.getElementById('helloButton');

  // Add a click handler so the alert runs when the button is pressed.
  helloButton.addEventListener('click', () => {
    alert('Hello from extension');
  });
});
