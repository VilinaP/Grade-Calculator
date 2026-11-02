// Window buttons
const foldBtn = document.querySelector('button[aria-label="fold window button"]');
const closeBtn = document.querySelector('button[aria-label="close window button"]');

foldBtn?.addEventListener('click', () => window.windowControls.minimize());
closeBtn?.addEventListener('click', () => window.windowControls.close());

// Class section
const classSelect = document.getElementById('pick-class');
const deleteClassBtn = document.getElementById('delete-class');
const addClassBtn = document.getElementById('add-class');
const newClassInput = document.getElementById('new-class-name');
const classMessage = document.getElementById('class-message');

function showClassMessage(text) {
  classMessage.textContent = text;
}

async function loadClasses(selectId) {
  try {
    const list = await window.classes.getAll();
    classSelect.replaceChildren(...list.map((c) => new Option(c.name, c.id)));
    if (selectId && list.some((c) => c.id === selectId)) classSelect.value = selectId;
    deleteClassBtn.disabled = list.length === 0;
  } catch (err) {
    console.error(err);
    showClassMessage('Could not load classes.');
  }
}

async function addClass() {
  const name = newClassInput.value.trim();
  if (!name) {
    showClassMessage('Enter a class name first.');
    newClassInput.focus();
    return;
  }

  addClassBtn.disabled = true; // prevents double-submits
  try {
    const result = await window.classes.create(name);
    if (result.created) {
      newClassInput.value = '';
      showClassMessage('');
      await loadClasses(result.id);
    } else if (result.reason === 'duplicate') {
      showClassMessage('A class with that name already exists.');
    } else {
      showClassMessage('Enter a class name first.');
    }
  } catch (err) {
    console.error(err);
    showClassMessage('Could not add the class.');
  } finally {
    addClassBtn.disabled = false;
  }
}

async function deleteClass() {
  if (!classSelect.value) return;
  try {
    const { deleted } = await window.classes.remove(classSelect.value);
    if (deleted) {
      showClassMessage('');
      await loadClasses();
    }
  } catch (err) {
    console.error(err);
    showClassMessage('Could not delete the class.');
  }
}

addClassBtn.addEventListener('click', addClass);
deleteClassBtn.addEventListener('click', deleteClass);
newClassInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addClass();
});

loadClasses();