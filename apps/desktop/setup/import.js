const choose = document.getElementById('choose');
const form = document.getElementById('form');
const protectedFields = document.getElementById('protected');
const secret = document.getElementById('secret');
const pins = document.getElementById('pins');
const status = document.getElementById('status');
const error = document.getElementById('error');
const activate = form.querySelector('button');

function busy(value) {
  choose.disabled = value;
  activate.disabled = value;
}

choose.addEventListener('click', async () => {
  busy(true);
  error.textContent = '';
  try {
    const result = await window.importDatabase.choose();
    if (!result) return;
    if (result.error) {
      error.textContent = result.error;
      return;
    }
    secret.value = '';
    protectedFields.hidden = result.profiles.length === 0;
    secret.required = !protectedFields.hidden;
    pins.replaceChildren();
    result.profiles.forEach((name, index) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.id = `pin-${index}`;
      input.type = 'password';
      input.inputMode = 'numeric';
      input.pattern = '[0-9]{4}';
      input.maxLength = 4;
      input.autocomplete = 'off';
      input.required = true;
      label.htmlFor = input.id;
      label.textContent = `PIN de ${name}`;
      pins.append(label, input);
    });
    status.textContent = `Cópia verificada de ${result.file}.`;
    form.hidden = false;
    (protectedFields.hidden ? activate : secret).focus();
  } finally {
    busy(false);
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  busy(true);
  error.textContent = '';
  try {
    const result = await window.importDatabase.confirm({
      secret: secret.value,
      pins: Array.from(pins.querySelectorAll('input'), input => input.value),
    });
    if (result?.error) error.textContent = result.error;
  } finally {
    busy(false);
  }
});
