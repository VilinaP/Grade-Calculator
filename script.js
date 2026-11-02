// Window buttons
const foldBtn = document.querySelector('button[aria-label="fold window button"]');
const closeBtn = document.querySelector('button[aria-label="close window button"]');

foldBtn?.addEventListener('click', () => window.windowControls.minimize());
closeBtn?.addEventListener('click', () => window.windowControls.close());

// ---------- Class section ----------
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
  onClassChanged(); // the selected class may have changed, so refresh categories
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
classSelect.addEventListener('change', onClassChanged);

// ---------- Category section ----------
const categoryList = document.getElementById('category-list');
const categoryNameInput = document.getElementById('category-name');
const categoryPercentInput = document.getElementById('category-percent');
const saveCategoryBtn = document.getElementById('save-category');
const cancelCategoryBtn = document.getElementById('cancel-category');
const deleteCategoryBtn = document.getElementById('delete-category');
const categoryMessage = document.getElementById('category-message');

// NOTE: not named "categories", because preload.js already exposes window.categories
let categoryItems = [];
let selectedCategoryId = null; // null = add mode, otherwise edit mode
let categoryLoadToken = 0; // ignores out-of-date responses when switching classes quickly

function showCategoryMessage(text) {
  categoryMessage.textContent = text;
}

function updateCategoryControls() {
  const hasClass = Boolean(classSelect.value);
  categoryNameInput.disabled = !hasClass;
  categoryPercentInput.disabled = !hasClass;
  saveCategoryBtn.disabled = !hasClass;
  deleteCategoryBtn.disabled = selectedCategoryId === null;
  saveCategoryBtn.textContent = selectedCategoryId === null ? 'Add' : 'Update';
  cancelCategoryBtn.hidden = selectedCategoryId === null;
}

function renderCategories() {
  categoryList.replaceChildren(
    ...categoryItems.map((c) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'category-row';
      const selected = c.id === selectedCategoryId;
      row.classList.toggle('selected', selected);
      row.setAttribute('aria-pressed', String(selected));

      const name = document.createElement('span');
      name.textContent = c.name; // textContent only, never innerHTML
      const pct = document.createElement('span');
      pct.textContent = `${c.percentage}%`;

      row.append(name, pct);
      row.addEventListener('click', () => selectCategory(c.id));
      return row;
    })
  );
}

function resetCategoryForm() {
  selectedCategoryId = null;
  categoryNameInput.value = '';
  categoryPercentInput.value = '';
  updateCategoryControls();
  renderCategories();
}

function selectCategory(id) {
  if (selectedCategoryId === id) {
    resetCategoryForm(); // clicking the selected row again deselects it
    return;
  }
  const category = categoryItems.find((c) => c.id === id);
  if (!category) return;
  selectedCategoryId = id;
  categoryNameInput.value = category.name;
  categoryPercentInput.value = category.percentage;
  showCategoryMessage('');
  updateCategoryControls();
  renderCategories();
}

async function loadCategories() {
  const token = ++categoryLoadToken;
  const classId = classSelect.value;
  if (!classId) {
    categoryItems = [];
    resetCategoryForm();
    return;
  }
  try {
    const list = await window.categories.getByClass(classId);
    if (token !== categoryLoadToken) return; // a newer load replaced this one
    categoryItems = list;
    renderCategories();
  } catch (err) {
    console.error(err);
    showCategoryMessage('Could not load categories.');
  }
}

function onClassChanged() {
  showCategoryMessage('');
  categoryItems = [];
  resetCategoryForm();
  loadCategories();
}

async function saveCategory() {
  const classId = classSelect.value;
  if (!classId) return;

  const name = categoryNameInput.value.trim();
  const percentage = categoryPercentInput.valueAsNumber; // NaN when empty

  if (!name) {
    showCategoryMessage('Enter a category name.');
    categoryNameInput.focus();
    return;
  }
  if (Number.isNaN(percentage)) {
    showCategoryMessage('Enter a percentage.');
    categoryPercentInput.focus();
    return;
  }

  saveCategoryBtn.disabled = true; // prevents double-submits
  try {
    const result =
      selectedCategoryId === null
        ? await window.categories.create(classId, name, percentage)
        : await window.categories.update(selectedCategoryId, name, percentage);

    if (result.saved) {
      showCategoryMessage('');
      resetCategoryForm();
      await loadCategories();
    } else {
      showCategoryMessage(categoryFailureText(result));
    }
  } catch (err) {
    console.error(err);
    showCategoryMessage('Could not save the category.');
  } finally {
    updateCategoryControls();
  }
}

function categoryFailureText(result) {
  switch (result.reason) {
    case 'empty':
      return 'Enter a category name.';
    case 'bad_percentage':
      return 'Percentage must be 0 to 100, with at most 2 decimals.';
    case 'duplicate':
      return 'This class already has a category with that name.';
    case 'over':
      return `That would go over 100%. This class has ${result.remaining}% left.`;
    case 'no_class':
      return 'That class no longer exists.';
    case 'not_found':
      return 'That category no longer exists.';
    default:
      return 'Could not save the category.';
  }
}

async function deleteCategory() {
  if (selectedCategoryId === null) return;
  try {
    const { deleted } = await window.categories.remove(selectedCategoryId);
    if (deleted) {
      showCategoryMessage('');
      resetCategoryForm();
      await loadCategories();
    }
  } catch (err) {
    console.error(err);
    showCategoryMessage('Could not delete the category.');
  }
}

saveCategoryBtn.addEventListener('click', saveCategory);
cancelCategoryBtn.addEventListener('click', () => {
  showCategoryMessage('');
  resetCategoryForm();
});
deleteCategoryBtn.addEventListener('click', deleteCategory);
[categoryNameInput, categoryPercentInput].forEach((input) =>
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveCategory();
  })
);

updateCategoryControls();
loadClasses();