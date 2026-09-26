function startScrollEngine() {
  if (scrollInterval) clearInterval(scrollInterval);
  
  // Speeds >= 1 decrease interval time (faster)
  // Speeds < 1 increase interval time (slower)
  const baseInterval = scrollSpeed >= 1 
    ? 60 / scrollSpeed 
    : 60 * (2 - scrollSpeed);

  scrollInterval = setInterval(() => {
    window.scrollBy(0, 1);
    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 2) {
      toggleAutoScroll();
    }
  }, baseInterval);
}

function changeScrollSpeed(amount) {
  // Allows speed to adjust from -5 (very slow) to 10 (very fast)
  scrollSpeed = Math.max(-5, Math.min(10, scrollSpeed + amount));
  document.getElementById('scrollSpeedLabel').textContent = scrollSpeed;
  if (isScrolling) startScrollEngine(); 
}
