const foldBtn = document.querySelector('button[aria-label="fold window button"]');
const closeBtn = document.querySelector('button[aria-label="close window button"]');

foldBtn.addEventListener("click", () => window.windowControls.minimize());
closeBtn.addEventListener("click", () => window.windowControls.close());