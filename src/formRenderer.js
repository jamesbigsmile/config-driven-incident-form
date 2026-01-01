async function loadConfig() {
  const params = new URLSearchParams(window.location.search);
  const formType = params.get('form') || 'incident';
  const lang = params.get('lang') || 'en';
  
  const configFile =
    formType === 'audit'
      ? '../config/audit-form.json'
      : '../config/incident-form.json';

  const response = await fetch(configFile);
  if (!response.ok) {
    console.error('Failed to load config', response.statusText);
    return null;
  }
  
  const config = await response.json();
  
  if (config.languages && config.languages[lang]) {
    const langData = config.languages[lang];
    if (langData.title) config.title = langData.title;
  }
  
  console.log(`Loaded ${formType} config in ${lang}:`, config);
  return config;
}

function createField(field, userRole = 'user') {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';
  wrapper.dataset.fieldId = field.id;

  // Permissions check (AFTER building field)
  if (field.permissions && (!field.permissions.roles || !field.permissions.roles.includes(userRole))) {
    wrapper.classList.add('permission-hidden');
    return wrapper;
  }

  const label = document.createElement('label');
  label.setAttribute('for', field.id);
  label.textContent = field.label;

  if (field.required) {
    const span = document.createElement('span');
    span.className = 'required';
    span.textContent = '*';
    label.appendChild(span);
  }

  let input;

  switch (field.type) {
    case 'textarea':
      input = document.createElement('textarea');
      if (field.rows) input.rows = field.rows;
      break;
    case 'select':
      input = document.createElement('select');
      (field.options || []).forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt;
        optionEl.textContent = opt;
        input.appendChild(optionEl);
      });
      break;
    case 'date':
    case 'time':
    case 'text':
    default:
      input = document.createElement('input');
      input.type = field.type || 'text';
  }

  input.id = field.id;
  input.name = field.id;
  if (field.placeholder) input.placeholder = field.placeholder;
  if (field.required) input.required = true;

  wrapper.appendChild(label);
  wrapper.appendChild(input);

  if (field.helpText) {
    const help = document.createElement('div');
    help.className = 'field-help';
    help.textContent = field.helpText;
    wrapper.appendChild(help);
  }

  if (field.visibleIf) {
    wrapper.dataset.visibleIfField = field.visibleIf.field;
    wrapper.dataset.visibleIfEquals = field.visibleIf.equals;
  }

  return wrapper;
}

function applyVisibilityRules(formEl) {
  const fields = Array.from(formEl.querySelectorAll('.field'));
  const fieldMap = {};
  fields.forEach(f => {
    const input = f.querySelector('input, select, textarea');
    if (input) fieldMap[input.name] = input;
  });

  function updateVisibility() {
    fields.forEach(wrapper => {
      const depField = wrapper.dataset.visibleIfField;
      const depValue = wrapper.dataset.visibleIfEquals;
      if (!depField) return;

      const controller = fieldMap[depField];
      if (!controller) return;

      const shouldShow = controller.value === depValue;
      wrapper.style.display = shouldShow ? '' : 'none';
    });
  }

  Object.values(fieldMap).forEach(input => {
    input.addEventListener('change', updateVisibility);
  });
  updateVisibility();
}

function renderForm(config) {
  const params = new URLSearchParams(window.location.search);
  const userRole = params.get('role') || 'user';  // Pass to fields

  const formMeta = document.getElementById('form-metadata');
  const formEl = document.getElementById('dynamic-form');

  const title = document.createElement('h2');
  title.textContent = config.title;
  const desc = document.createElement('p');
  desc.textContent = config.description;
  formMeta.appendChild(title);
  formMeta.appendChild(desc);

  const sections = [...config.sections].sort((a, b) => (a.order || 0) - (b.order || 0));

  sections.forEach((section, index) => {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'section';

    const sectionTitle = document.createElement('h3');
    sectionTitle.className = 'section-title';

    if (config.layout && config.layout.showSectionNumbers) {
      sectionTitle.textContent = `${index + 1}. ${section.label}`;
    } else {
      sectionTitle.textContent = section.label;
    }

    sectionEl.appendChild(sectionTitle);

    if (section.helpText) {
      const help = document.createElement('p');
      help.className = 'section-help';
      help.textContent = section.helpText;
      sectionEl.appendChild(help);
    }

    (section.fields || []).forEach(field => {
      const fieldEl = createField(field, userRole);  // Pass userRole
      sectionEl.appendChild(fieldEl);
    });

    formEl.appendChild(sectionEl);
  });

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Submit Incident';
  formEl.appendChild(submit);

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!formEl.checkValidity()) {
      const validationSummary = document.getElementById('validation-summary') || 
        createValidationSummary(formEl);
      validationSummary.textContent = 'Please fix the errors above before submitting.';
      validationSummary.classList.add('show');
      return;
    }
    
    const validationSummary = document.getElementById('validation-summary');
    if (validationSummary) {
      validationSummary.classList.remove('show');
    }
    
    const formData = new FormData(formEl);
    const data = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    const outputSection = document.getElementById('form-output');
    const outputJson = document.getElementById('output-json');
    outputJson.textContent = JSON.stringify(data, null, 2);
    outputSection.classList.remove('hidden');
  });

  applyVisibilityRules(formEl);
}

function createValidationSummary(formEl) {
  const validationSummary = document.createElement('div');
  validationSummary.id = 'validation-summary';
  validationSummary.className = 'validation-summary';
  formEl.appendChild(validationSummary);
  return validationSummary;
}

document.addEventListener('DOMContentLoaded', async () => {
  const config = await loadConfig();
  if (config) {
    renderForm(config);
  }
});

