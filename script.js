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
    calculateBtn.disabled = list.length === 0;
  } catch (err) {
    console.error(err);
    showClassMessage('Could not load classes.');
  }
  onClassChanged(); // the selected class may have changed, so refresh categories and grades
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
const categoryTotal = document.getElementById('category-total');
const categoryNameInput = document.getElementById('category-name');
const categoryPercentInput = document.getElementById('category-percent');
const saveCategoryBtn = document.getElementById('save-category');
const cancelCategoryBtn = document.getElementById('cancel-category');
const deleteCategoryBtn = document.getElementById('delete-category');
const categoryMessage = document.getElementById('category-message');

let categoryItems = [];
let categoryTotalReady = false; // false until the current class's categories have loaded
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

// Live total line under the category list (display only; the main process checks again)
function updateCategoryTotal() {
  if (!classSelect.value || !categoryTotalReady) {
    categoryTotal.textContent = '';
    categoryTotal.classList.remove('warn');
    return;
  }
  const hundredths = categoryItems.reduce((sum, c) => sum + Math.round(c.percentage * 100), 0);
  const ok = hundredths === 10000;
  categoryTotal.textContent = ok
    ? `Total: ${hundredths / 100}%`
    : `Total: ${hundredths / 100}% (must be 100%)`;
  categoryTotal.classList.toggle('warn', !ok);
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
  updateCategoryTotal();
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
  clearFinalResult(); // categories changed, so any shown result is out of date
  const classId = classSelect.value;
  if (!classId) {
    categoryItems = [];
    categoryTotalReady = false;
    resetCategoryForm();
    renderGradeCategoryOptions();
    return;
  }
  try {
    const list = await window.categories.getByClass(classId);
    if (token !== categoryLoadToken) return; // a newer load replaced this one
    categoryItems = list;
    categoryTotalReady = true;
    renderCategories();
    renderGradeCategoryOptions(); // the grade dropdown follows the category list
  } catch (err) {
    console.error(err);
    showCategoryMessage('Could not load categories.');
  }
}

function onClassChanged() {
  showCategoryMessage('');
  showGradeMessage('');
  clearFinalResult();
  categoryItems = [];
  categoryTotalReady = false;
  gradeItems = [];
  resetCategoryForm();
  renderGradeCategoryOptions();
  resetGradeForm();
  loadCategories();
  loadGrades();
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
      await loadGrades(); // a renamed category changes the label on its grades
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
      await loadGrades(); // its grades were deleted along with it
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

// ---------- Grade section ----------
const gradeList = document.getElementById('grade-list');
const gradeNameInput = document.getElementById('grade-name');
const gradeCategorySelect = document.getElementById('grade-category');
const gradeScoreInput = document.getElementById('grade-score');
const saveGradeBtn = document.getElementById('save-grade');
const cancelGradeBtn = document.getElementById('cancel-grade');
const deleteGradeBtn = document.getElementById('delete-grade');
const gradeMessage = document.getElementById('grade-message');

// NOTE: not named "grades", because preload.js already exposes window.grades
let gradeItems = [];
let selectedGradeId = null; // null = add mode, otherwise edit mode
let gradeLoadToken = 0; // ignores out-of-date responses when switching classes quickly

function showGradeMessage(text) {
  gradeMessage.textContent = text;
}

function updateGradeControls() {
  const hasCategories = categoryItems.length > 0;
  gradeNameInput.disabled = !hasCategories;
  gradeCategorySelect.disabled = !hasCategories;
  gradeScoreInput.disabled = !hasCategories;
  saveGradeBtn.disabled = !hasCategories;
  deleteGradeBtn.disabled = selectedGradeId === null;
  saveGradeBtn.textContent = selectedGradeId === null ? 'Add' : 'Update';
  cancelGradeBtn.hidden = selectedGradeId === null;
}

function renderGradeCategoryOptions() {
  const previous = gradeCategorySelect.value;
  if (categoryItems.length === 0) {
    gradeCategorySelect.replaceChildren(new Option('No categories', ''));
  } else {
    gradeCategorySelect.replaceChildren(...categoryItems.map((c) => new Option(c.name, c.id)));
    if (categoryItems.some((c) => c.id === previous)) gradeCategorySelect.value = previous;
  }
  updateGradeControls();
}

function renderGrades() {
  gradeList.replaceChildren(
    ...gradeItems.map((g) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'grade-row';
      const selected = g.id === selectedGradeId;
      row.classList.toggle('selected', selected);
      row.setAttribute('aria-pressed', String(selected));

      const name = document.createElement('span');
      name.textContent = g.name; // textContent only, never innerHTML
      const category = document.createElement('span');
      category.className = 'grade-category-label';
      category.textContent = g.categoryName;
      const score = document.createElement('span');
      score.className = 'grade-score-label';
      score.textContent = `${g.score}%`;

      row.append(name, category, score);
      row.addEventListener('click', () => selectGrade(g.id));
      return row;
    })
  );
}

function resetGradeForm() {
  selectedGradeId = null;
  gradeNameInput.value = '';
  gradeScoreInput.value = '';
  // the category dropdown is left alone, so several grades can be added to one category
  updateGradeControls();
  renderGrades();
}

function selectGrade(id) {
  if (selectedGradeId === id) {
    resetGradeForm(); // clicking the selected row again deselects it
    return;
  }
  const grade = gradeItems.find((g) => g.id === id);
  if (!grade) return;
  selectedGradeId = id;
  gradeNameInput.value = grade.name;
  gradeCategorySelect.value = grade.categoryId;
  gradeScoreInput.value = grade.score;
  showGradeMessage('');
  updateGradeControls();
  renderGrades();
}

async function loadGrades() {
  const token = ++gradeLoadToken;
  clearFinalResult(); // grades changed, so any shown result is out of date
  const classId = classSelect.value;
  if (!classId) {
    gradeItems = [];
    resetGradeForm();
    return;
  }
  try {
    const list = await window.grades.getByClass(classId);
    if (token !== gradeLoadToken) return; // a newer load replaced this one
    gradeItems = list;
    if (selectedGradeId !== null && !gradeItems.some((g) => g.id === selectedGradeId)) {
      resetGradeForm(); // the selected grade no longer exists
    } else {
      renderGrades();
    }
  } catch (err) {
    console.error(err);
    showGradeMessage('Could not load grades.');
  }
}

async function saveGrade() {
  const categoryId = gradeCategorySelect.value;
  if (!categoryId) {
    showGradeMessage('Add a grade category first.');
    return;
  }

  const name = gradeNameInput.value.trim();
  const score = gradeScoreInput.valueAsNumber; // NaN when empty

  if (!name) {
    showGradeMessage('Enter an assignment name.');
    gradeNameInput.focus();
    return;
  }
  if (Number.isNaN(score)) {
    showGradeMessage('Enter a score.');
    gradeScoreInput.focus();
    return;
  }

  saveGradeBtn.disabled = true; // prevents double-submits
  try {
    const result =
      selectedGradeId === null
        ? await window.grades.create(categoryId, name, score)
        : await window.grades.update(selectedGradeId, categoryId, name, score);

    if (result.saved) {
      showGradeMessage('');
      resetGradeForm();
      await loadGrades();
    } else {
      showGradeMessage(gradeFailureText(result));
    }
  } catch (err) {
    console.error(err);
    showGradeMessage('Could not save the grade.');
  } finally {
    updateGradeControls();
  }
}

function gradeFailureText(result) {
  switch (result.reason) {
    case 'empty':
      return 'Enter an assignment name.';
    case 'bad_score':
      return 'Score must be 0 to 200, with at most 2 decimals.';
    case 'no_category':
      return 'That category no longer exists.';
    case 'not_found':
      return 'That grade or category no longer exists.';
    default:
      return 'Could not save the grade.';
  }
}

async function deleteGrade() {
  if (selectedGradeId === null) return;
  try {
    const { deleted } = await window.grades.remove(selectedGradeId);
    if (deleted) {
      showGradeMessage('');
      resetGradeForm();
      await loadGrades();
    }
  } catch (err) {
    console.error(err);
    showGradeMessage('Could not delete the grade.');
  }
}

saveGradeBtn.addEventListener('click', saveGrade);
cancelGradeBtn.addEventListener('click', () => {
  showGradeMessage('');
  resetGradeForm();
});
deleteGradeBtn.addEventListener('click', deleteGrade);
[gradeNameInput, gradeScoreInput].forEach((input) =>
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveGrade();
  })
);

// ---------- Final grade ----------
const calculateBtn = document.getElementById('calculate');
const calcMessage = document.getElementById('calc-message');
const finalGradeValue = document.getElementById('final-grade');
const finalPercent = document.getElementById('final-percent');

function showCalcMessage(text) {
  calcMessage.textContent = text;
}

// Hides the shown result and any calculation message
function clearFinalResult() {
  finalGradeValue.textContent = '';
  finalPercent.hidden = true;
  showCalcMessage('');
}

function calcFailureText(result) {
  switch (result.reason) {
    case 'no_categories':
      return 'Add grade categories first.';
    case 'weights':
      return `Categories add up to ${result.total}%, not 100%. Fix them to calculate.`;
    default:
      return 'Could not calculate the grade.';
  }
}

async function calculateGrade() {
  const classId = classSelect.value;
  if (!classId) {
    showCalcMessage('Pick or add a class first.');
    return;
  }

  calculateBtn.disabled = true; // prevents double-clicks
  try {
    const result = await window.finalGradeApi.calculate(classId);
    clearFinalResult();
    if (result.calculated) {
      finalGradeValue.textContent = result.grade.toFixed(2);
      finalPercent.hidden = false;
    } else {
      showCalcMessage(calcFailureText(result));
    }
  } catch (err) {
    console.error(err);
    clearFinalResult();
    showCalcMessage('Could not calculate the grade.');
  } finally {
    calculateBtn.disabled = !classSelect.value;
  }
}

calculateBtn.addEventListener('click', calculateGrade);

updateCategoryControls();
updateGradeControls();
loadClasses();