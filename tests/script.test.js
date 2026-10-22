"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const scriptPath = path.join(__dirname, "..", "script.js");
const htmlPath = path.join(__dirname, "..", "index.html");
const source = fs.readFileSync(scriptPath, "utf8");
const html = fs.readFileSync(htmlPath, "utf8");
const HISTORY_KEY = "aphrodite-bmi-history";
const FIXED_ISO_DATE = "2030-01-02T03:04:05.000Z";

class TestDate extends Date {
  constructor(value) {
    super(value === undefined ? FIXED_ISO_DATE : value);
  }

  static now() {
    return new Date(FIXED_ISO_DATE).getTime();
  }
}

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  toggle(name, force) {
    const classes = new Set(this.element.className.split(/\s+/).filter(Boolean));
    const shouldAdd = force === undefined ? !classes.has(name) : force;
    if (shouldAdd) classes.add(name);
    else classes.delete(name);
    this.element.className = [...classes].join(" ");
    return shouldAdd;
  }
}

class FakeElement {
  constructor(id, { value = "", className = "" } = {}) {
    this.id = id;
    this.value = value;
    this.textContent = "";
    this.innerHTML = "";
    this.className = className;
    this.classList = new FakeClassList(this);
    this.attributes = {};
    this.listeners = new Map();
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.focusCount = 0;
    this.scrollOptions = null;
  }

  get value() {
    return this._value;
  }

  set value(value) {
    this._value = String(value);
  }

  addEventListener(type, callback) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) {
      listener({ target: this, preventDefault() {}, ...event });
    }
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  focus() {
    this.focusCount += 1;
    this.ownerDocument.activeElement = this;
  }

  scrollIntoView(options) {
    this.scrollOptions = options;
  }
}

function createCalculator({
  initialStorage = null,
  getItemError = null,
  setItemError = null,
  removeItemError = null,
  mobile = false,
  reducedMotion = false
} = {}) {
  const initialValues = {
    age: "",
    height: "170",
    weight: "65",
    feet: "",
    inches: "",
    pounds: ""
  };
  const ids = [
    ...Object.keys(initialValues),
    "form",
    "metric",
    "imperial",
    "storage-status",
    "history-list",
    "history-count",
    "clear",
    "error",
    "value",
    "category",
    "description",
    "guidance",
    "marker",
    "reset-button",
    "result-title",
    "result"
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeElement(id, {
    value: initialValues[id] ?? "",
    className: id === "metric" ? "" : id === "imperial" ? "" : ""
  })]));

  elements.metric.hidden = false;
  elements.imperial.hidden = true;
  elements.marker.hidden = true;
  elements.form.reset = () => {
    for (const [id, value] of Object.entries(initialValues)) elements[id].value = value;
  };

  const unitButtons = ["metric", "imperial"].map(unit => {
    const button = new FakeElement(`unit-${unit}`, {
      className: unit === "metric" ? "unit active" : "unit"
    });
    button.dataset = { unit };
    button.setAttribute("aria-pressed", String(unit === "metric"));
    return button;
  });

  const inputs = Object.keys(initialValues).map(id => elements[id]);
  const document = {
    activeElement: null,
    querySelector(selector) {
      return selector.startsWith("#") ? elements[selector.slice(1)] : null;
    },
    querySelectorAll(selector) {
      if (selector === ".unit") return unitButtons;
      if (selector === "#form input") return inputs;
      return [];
    }
  };
  for (const element of Object.values(elements)) element.ownerDocument = document;
  for (const button of unitButtons) button.ownerDocument = document;

  const data = new Map();
  if (initialStorage !== null) data.set(HISTORY_KEY, initialStorage);
  const storageCalls = { get: 0, set: 0, remove: 0 };
  const localStorage = {
    getItem(key) {
      storageCalls.get += 1;
      if (getItemError) throw getItemError;
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      storageCalls.set += 1;
      if (setItemError) throw setItemError;
      data.set(key, String(value));
    },
    removeItem(key) {
      storageCalls.remove += 1;
      if (removeItemError) throw removeItemError;
      data.delete(key);
    }
  };

  const context = {
    document,
    localStorage,
    Date: TestDate,
    JSON,
    Number,
    Array,
    Math,
    Error,
    window: {
      matchMedia(query) {
        return {
          matches: query.includes("max-width") ? mobile : reducedMotion
        };
      }
    }
  };
  vm.runInNewContext(source, context, { filename: "script.js" });

  return {
    elements,
    unitButtons,
    inputs,
    storageCalls,
    storedHistory() {
      const stored = data.get(HISTORY_KEY);
      return stored === undefined ? null : JSON.parse(stored);
    },
    submit() {
      elements.form.dispatch("submit", { preventDefault() {} });
    },
    clickUnit(unit) {
      unitButtons.find(button => button.dataset.unit === unit).dispatch("click");
    },
    clickReset() {
      elements["reset-button"].dispatch("click");
    },
    clickClear() {
      elements.clear.dispatch("click");
    },
    input(id) {
      elements.form.dispatch("input", { target: elements[id] });
    }
  };
}

function expectValidationFailure(app, field, value, messagePart) {
  app.elements[field].value = value;
  const previousResult = app.elements.value.textContent;
  const previousCount = app.elements["history-count"].textContent;
  app.submit();
  assert.match(app.elements.error.textContent, new RegExp(messagePart, "i"));
  assert.equal(app.elements[field].getAttribute("aria-invalid"), "true");
  assert.equal(app.elements.value.textContent, previousResult);
  assert.equal(app.elements["history-count"].textContent, previousCount);
}

test("startup leaves the result empty and renders the empty history state", () => {
  const app = createCalculator();

  assert.equal(app.elements.value.textContent, "");
  assert.equal(app.elements.category.textContent, "");
  assert.match(app.elements["history-list"].innerHTML, /will appear here/);
  assert.equal(app.elements["history-count"].textContent, "0 saved");
  assert.equal(app.elements.clear.disabled, true);
  assert.equal(app.storageCalls.get, 1);
  assert.equal(app.storageCalls.set, 0);
});

test("HTML smoke check wires essential calculator inputs, outputs, and assets", () => {
  for (const id of [
    "form", "age", "height", "weight", "feet", "inches", "pounds",
    "value", "category", "marker", "description", "guidance",
    "error", "history-count", "history-list", "clear", "reset-button"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing essential element #${id}`);
  }

  assert.match(html, /<link rel="stylesheet" href="styles\.css">/);
  assert.match(html, /<script src="script\.js"><\/script>/);
  assert.match(html, /aria-label="Height in feet"/);
  assert.match(html, /aria-label="Height in inches"/);
});

test("valid default metric values calculate BMI and save deterministic history", () => {
  const app = createCalculator();

  app.submit();

  assert.equal(app.elements.value.textContent, "22.5");
  assert.equal(app.elements.category.textContent, "Healthy range");
  assert.equal(app.elements.category.className, "category healthy");
  assert.match(app.elements.description.textContent, /within the commonly used healthy range/);
  assert.match(app.elements.guidance.textContent, /balanced meals/);
  assert.equal(app.elements.marker.hidden, false);
  assert.ok(Math.abs(parseFloat(app.elements.marker.style.left) - 41.637831603229536) < 1e-10);
  assert.equal(app.elements["history-count"].textContent, "1 saved");
  assert.equal(app.elements.clear.disabled, false);
  assert.deepEqual(app.storedHistory(), [{
    bmi: "22.5",
    cat: "healthy",
    age: null,
    date: FIXED_ISO_DATE
  }]);
});

test("all adult BMI category boundaries use the expected inclusive thresholds", () => {
  const app = createCalculator();
  app.elements.height.value = "100";

  for (const [weight, expected] of [
    ["18.49", "under"],
    ["18.5", "healthy"],
    ["24.999", "healthy"],
    ["25", "over"],
    ["29.999", "over"],
    ["30", "obese"]
  ]) {
    app.elements.weight.value = weight;
    app.submit();
    assert.equal(app.elements.category.className, `category ${expected}`, `BMI boundary ${weight}`);
  }
});

test("minimum and maximum accepted metric values calculate without invalid numbers", () => {
  const app = createCalculator();

  app.elements.height.value = "50";
  app.elements.weight.value = "10";
  app.submit();
  assert.equal(app.elements.value.textContent, "40.0");

  app.elements.height.value = "260";
  app.elements.weight.value = "500";
  app.submit();
  assert.equal(app.elements.value.textContent, "74.0");
  assert.equal(Number.isFinite(Number(app.elements.value.textContent)), true);
});

test("extreme but valid metric measurements clamp the marker to the scale endpoints", () => {
  const app = createCalculator();

  app.elements.height.value = "260";
  app.elements.weight.value = "10";
  app.submit();
  assert.equal(app.elements.category.className, "category under");
  assert.equal(app.elements.marker.style.left, "0%");

  app.elements.height.value = "50";
  app.elements.weight.value = "500";
  app.submit();
  assert.equal(app.elements.category.className, "category obese");
  assert.equal(app.elements.marker.style.left, "100%");
});

test("metric height rejects empty, whitespace, numeric edge cases and Unicode text", () => {
  const app = createCalculator();

  for (const value of [
    "",
    " ",
    "\t\n",
    "0",
    "-1",
    "49.9",
    "260.1",
    "NaN",
    "Infinity",
    "-Infinity",
    "1e309",
    "1e308",
    "-1e308",
    "9".repeat(1000),
    "身長",
    "طول",
    "身長طولé🙂",
    "altura",
    "🙂",
    "170 cm"
  ]) {
    expectValidationFailure(app, "height", value, "height between 50 and 260");
  }
});

test("metric weight rejects zero, negatives, overflow, malformed and Unicode values", () => {
  const app = createCalculator();
  app.elements.height.value = "170";

  for (const value of [
    "",
    " ",
    "0",
    "-0.1",
    "-500",
    "9.9",
    "500.1",
    "NaN",
    "Infinity",
    "-Infinity",
    "1e309",
    "1e308",
    "-1e308",
    "8".repeat(1000),
    "六十五",
    "وزن",
    "é",
    "体重وزنé🙂",
    "⚖️",
    "65kg"
  ]) {
    expectValidationFailure(app, "weight", value, "weight between 10 and 500");
  }
});

test("null-like and non-string metric input values are rejected like malformed browser values", () => {
  const app = createCalculator();

  for (const value of [null, undefined, false, {}, []]) {
    expectValidationFailure(app, "height", value, "height between 50 and 260");
  }

  app.elements.height.value = "170";
  for (const value of [null, undefined, false, {}, []]) {
    expectValidationFailure(app, "weight", value, "weight between 10 and 500");
  }
});

test("decimal metric values calculate with one-decimal result rounding", () => {
  const app = createCalculator();
  app.elements.height.value = "172.5";
  app.elements.weight.value = "67.35";

  app.submit();

  const expected = (67.35 / (1.725 ** 2)).toFixed(1);
  assert.equal(app.elements.value.textContent, expected);
});

test("invalid calculations preserve the prior displayed result and do not add history", () => {
  const app = createCalculator();
  app.submit();
  const result = app.elements.value.textContent;
  const history = app.storedHistory();

  app.elements.weight.value = "-5";
  app.submit();

  assert.equal(app.elements.value.textContent, result);
  assert.deepEqual(app.storedHistory(), history);
  assert.equal(app.elements["history-count"].textContent, "1 saved");
});

test("age is optional, adults use BMI categories, and under-20 uses age-specific guidance", () => {
  const app = createCalculator();

  app.submit();
  assert.equal(app.elements.category.textContent, "Healthy range");

  app.elements.age.value = "19";
  app.submit();
  assert.equal(app.elements.category.className, "category ageSpecific");
  assert.equal(app.elements.marker.hidden, true);
  assert.match(app.elements.description.textContent, /not intended for people under 20/);

  app.elements.age.value = "20";
  app.submit();
  assert.equal(app.elements.category.textContent, "Healthy range");
  assert.equal(app.elements.marker.hidden, false);
});

test("age validation rejects fractional, out-of-range, whitespace, and Unicode input", () => {
  const app = createCalculator();

  for (const value of [" ", "1", "121", "-2", "19.5", "NaN", "Infinity", "-Infinity", "1e308", "١٨", "十八", "🙂", "1".repeat(1000)]) {
    expectValidationFailure(app, "age", value, "age from 2 to 120");
  }
});

test("missing age remains optional while null-like and non-string values are rejected", () => {
  const app = createCalculator();

  app.elements.age.value = "";
  app.submit();
  assert.equal(app.elements.category.textContent, "Healthy range");

  for (const value of [null, undefined, false, {}]) {
    expectValidationFailure(app, "age", value, "age from 2 to 120");
  }
});

test("imperial conversion calculates correctly with omitted inches treated as zero", () => {
  const app = createCalculator();
  app.clickUnit("imperial");
  app.elements.feet.value = "5";
  app.elements.inches.value = "7";
  app.elements.pounds.value = "143";

  app.submit();

  const heightMeters = (5 * 12 + 7) * 0.0254;
  const weightKg = 143 * 0.45359237;
  assert.equal(app.elements.value.textContent, (weightKg / heightMeters ** 2).toFixed(1));
  assert.equal(app.elements.category.textContent, "Healthy range");
  assert.equal(app.elements.metric.hidden, true);
  assert.equal(app.elements.imperial.hidden, false);

  app.elements.inches.value = "";
  app.submit();
  const fiveFeetMeters = 5 * 12 * 0.0254;
  assert.equal(app.elements.value.textContent, (weightKg / fiveFeetMeters ** 2).toFixed(1));
});

test("every BMI category boundary is preserved after imperial conversion", () => {
  const app = createCalculator();
  const heightInches = 67;
  const heightMeters = heightInches * 0.0254;
  app.clickUnit("imperial");
  app.elements.feet.value = "5";
  app.elements.inches.value = "7";

  for (const [bmi, expected] of [
    [18.499, "under"],
    [18.5, "healthy"],
    [24.999, "healthy"],
    [25, "over"],
    [29.999, "over"],
    [30, "obese"]
  ]) {
    const pounds = (bmi * heightMeters ** 2) / 0.45359237;
    app.elements.pounds.value = String(pounds);
    app.submit();
    assert.equal(app.elements.category.className, `category ${expected}`, `imperial BMI boundary ${bmi}`);
  }
});

test("imperial feet validation rejects missing, fractional, zero, negative, and oversized values", () => {
  const app = createCalculator();
  app.clickUnit("imperial");

  for (const value of ["", " ", "0", "-1", "0.5", "8.1", "9", "NaN", "Infinity", "-Infinity", "1e308", "８", "🙂", "1".repeat(1000)]) {
    expectValidationFailure(app, "feet", value, "height between 1 and 8 feet");
  }
});

test("imperial inches validation rejects negative, twelve, infinity and malformed values", () => {
  const app = createCalculator();
  app.clickUnit("imperial");
  app.elements.feet.value = "5";

  for (const value of ["-0.1", "12", "12.1", "Infinity", "-Infinity", "NaN", "1e308", "一", "🙂", "1".repeat(1000)]) {
    expectValidationFailure(app, "inches", value, "inches from 0 up to");
  }
});

test("imperial pounds validation rejects missing, zero, negative, oversized and unusual inputs", () => {
  const app = createCalculator();
  app.clickUnit("imperial");
  app.elements.feet.value = "5";
  app.elements.inches.value = "7";

  for (const value of ["", " ", "0", "-1", "21.9", "1100.1", "1101", "NaN", "Infinity", "-Infinity", "1e309", "1e308", "⚖️", "١٤٣", "143公斤🙂", "1".repeat(1000)]) {
    expectValidationFailure(app, "pounds", value, "weight between 22 and 1,100");
  }
});

test("null-like and non-string Imperial height and weight inputs are rejected", () => {
  const app = createCalculator();
  app.clickUnit("imperial");

  for (const value of [null, undefined, false, {}]) {
    expectValidationFailure(app, "feet", value, "height between 1 and 8 feet");
  }

  app.elements.feet.value = "5";
  for (const value of [null, undefined, false, {}]) {
    expectValidationFailure(app, "inches", value, "inches from 0 up to");
  }

  app.elements.inches.value = "7";
  for (const value of [null, undefined, false, {}]) {
    expectValidationFailure(app, "pounds", value, "weight between 22 and 1,100");
  }
});

test("accepted imperial endpoints produce finite BMI values", () => {
  const app = createCalculator();
  app.clickUnit("imperial");

  app.elements.feet.value = "1";
  app.elements.inches.value = "0";
  app.elements.pounds.value = "22";
  app.submit();
  assert.equal(Number.isFinite(Number(app.elements.value.textContent)), true);

  app.elements.feet.value = "8";
  app.elements.inches.value = "11.9";
  app.elements.pounds.value = "1100";
  app.submit();
  assert.equal(Number.isFinite(Number(app.elements.value.textContent)), true);
});

test("switching units updates visibility and pressed state and clears validation", () => {
  const app = createCalculator();
  app.elements.height.value = "0";
  app.submit();
  assert.ok(app.elements.error.textContent);

  app.clickUnit("imperial");
  assert.equal(app.elements.metric.hidden, true);
  assert.equal(app.elements.imperial.hidden, false);
  assert.equal(app.unitButtons[0].getAttribute("aria-pressed"), "false");
  assert.equal(app.unitButtons[1].getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.error.textContent, "");

  app.clickUnit("metric");
  assert.equal(app.elements.metric.hidden, false);
  assert.equal(app.elements.imperial.hidden, true);
  assert.equal(app.unitButtons[0].getAttribute("aria-pressed"), "true");
  assert.equal(app.unitButtons[1].getAttribute("aria-pressed"), "false");
});

test("input events remove invalid state and clear the message", () => {
  const app = createCalculator();
  app.elements.height.value = "0";
  app.submit();
  assert.equal(app.elements.height.getAttribute("aria-invalid"), "true");

  app.input("height");
  assert.equal(app.elements.height.getAttribute("aria-invalid"), null);
  assert.equal(app.elements.error.textContent, "");
});

test("repeated calculations add new entries and retain only the newest eight", () => {
  const app = createCalculator();

  for (let index = 0; index < 10; index += 1) {
    app.elements.weight.value = String(60 + index);
    app.submit();
  }

  assert.equal(app.elements["history-count"].textContent, "8 saved");
  assert.equal(app.storedHistory().length, 8);
  assert.equal(app.storedHistory()[0].bmi, (69 / 1.7 ** 2).toFixed(1));
});

test("mobile calculation focuses the result and respects reduced-motion preference", () => {
  const app = createCalculator({ mobile: true, reducedMotion: true });

  app.submit();

  assert.equal(app.elements["result-title"].focusCount, 1);
  assert.equal(app.elements.result.scrollOptions.behavior, "auto");
  assert.equal(app.elements.result.scrollOptions.block, "start");
});

test("desktop calculation does not move focus or scroll to the result", () => {
  const app = createCalculator({ mobile: false });

  app.submit();

  assert.equal(app.elements["result-title"].focusCount, 0);
  assert.equal(app.elements.result.scrollOptions, null);
});

test("reset restores default metric fields and clears result without clearing history", () => {
  const app = createCalculator();
  app.clickUnit("imperial");
  app.elements.age.value = "19";
  app.elements.feet.value = "5";
  app.elements.inches.value = "7";
  app.elements.pounds.value = "143";
  app.submit();
  const historyBeforeReset = app.storedHistory();

  app.clickReset();

  assert.equal(app.elements.age.value, "");
  assert.equal(app.elements.height.value, "170");
  assert.equal(app.elements.weight.value, "65");
  assert.equal(app.elements.feet.value, "");
  assert.equal(app.elements.inches.value, "");
  assert.equal(app.elements.pounds.value, "");
  assert.equal(app.elements.metric.hidden, false);
  assert.equal(app.elements.imperial.hidden, true);
  assert.equal(app.elements.value.textContent, "—");
  assert.equal(app.elements.category.textContent, "Ready to calculate");
  assert.equal(app.elements.marker.hidden, true);
  assert.deepEqual(app.storedHistory(), historyBeforeReset);
});

test("clear history removes persisted data and updates the disabled state", () => {
  const app = createCalculator();
  app.submit();
  assert.equal(app.elements.clear.disabled, false);

  app.clickClear();

  assert.equal(app.storedHistory(), null);
  assert.equal(app.elements["history-count"].textContent, "0 saved");
  assert.equal(app.elements.clear.disabled, true);
  assert.match(app.elements["history-list"].innerHTML, /will appear here/);
  assert.equal(app.storageCalls.remove, 1);
});

test("valid saved history is loaded, limited to eight, and rendered with expected output", () => {
  const saved = Array.from({ length: 10 }, (_, index) => ({
    bmi: String(18.5 + index),
    cat: "healthy",
    age: index === 0 ? 20 : null,
    date: FIXED_ISO_DATE
  }));
  const app = createCalculator({ initialStorage: JSON.stringify(saved) });

  assert.equal(app.elements["history-count"].textContent, "8 saved");
  assert.equal(app.elements.clear.disabled, false);
  assert.equal((app.elements["history-list"].innerHTML.match(/history-item/g) || []).length, 8);
  assert.match(app.elements["history-list"].innerHTML, /Healthy range/);
  assert.match(app.elements["history-list"].innerHTML, /18\.5/);
});

test("history loading safely rejects malformed JSON and invalid top-level types", () => {
  for (const saved of ["{broken", "null", "{}", "42", "\"text\"", "true"]) {
    const app = createCalculator({ initialStorage: saved });
    assert.equal(app.elements["history-count"].textContent, "0 saved", saved);
    assert.match(app.elements["storage-status"].textContent, /history could not be read/);
    assert.match(app.elements["history-list"].innerHTML, /will appear here/);
  }
});

test("history loading filters null, missing, wrong-type and malformed entries", () => {
  const saved = JSON.stringify([
    null,
    undefined,
    {},
    { bmi: null, cat: "healthy", date: FIXED_ISO_DATE },
    { bmi: "", cat: "healthy", date: FIXED_ISO_DATE },
    { bmi: false, cat: "healthy", date: FIXED_ISO_DATE },
    { bmi: [], cat: "healthy", date: FIXED_ISO_DATE },
    { bmi: {}, cat: "healthy", date: FIXED_ISO_DATE },
    { bmi: " ", cat: "under", date: FIXED_ISO_DATE },
    { bmi: "0", cat: "under", date: FIXED_ISO_DATE },
    { bmi: -1, cat: "under", date: FIXED_ISO_DATE },
    { bmi: "not a number", cat: "healthy", date: FIXED_ISO_DATE },
    { bmi: "22.5", cat: "unknown", date: FIXED_ISO_DATE },
    { bmi: "22.5", cat: "constructor", date: FIXED_ISO_DATE },
    { bmi: "22.5", cat: "__proto__", date: FIXED_ISO_DATE },
    { bmi: "22.5", cat: "healthy", date: 123 },
    { bmi: "22.5", cat: "healthy", date: FIXED_ISO_DATE },
    { bmi: 23, cat: "ageSpecific", date: FIXED_ISO_DATE, age: "19" }
  ]);
  const app = createCalculator({ initialStorage: saved });

  assert.equal(app.elements["history-count"].textContent, "2 saved");
  assert.equal((app.elements["history-list"].innerHTML.match(/history-item/g) || []).length, 2);
  assert.match(app.elements["history-list"].innerHTML, /Age-specific interpretation needed/);
});

test("history loading rejects non-positive and non-finite BMI values", () => {
  const saved = JSON.stringify([
    { bmi: 0, cat: "under", date: FIXED_ISO_DATE },
    { bmi: -2.5, cat: "under", date: FIXED_ISO_DATE },
    { bmi: " ", cat: "under", date: FIXED_ISO_DATE },
    { bmi: "Infinity", cat: "obese", date: FIXED_ISO_DATE },
    { bmi: "-Infinity", cat: "under", date: FIXED_ISO_DATE },
    { bmi: "22.5", cat: "healthy", date: FIXED_ISO_DATE }
  ]);
  const app = createCalculator({ initialStorage: saved });

  assert.equal(app.elements["history-count"].textContent, "1 saved");
  assert.equal((app.elements["history-list"].innerHTML.match(/history-item/g) || []).length, 1);
  assert.match(app.elements["history-list"].innerHTML, /22\.5/);
});

test("invalid dates and unusual BMI values render without throwing or injecting markup", () => {
  const saved = JSON.stringify([
    { bmi: "Infinity", cat: "healthy", date: FIXED_ISO_DATE },
    { bmi: "22.55", cat: "healthy", date: "not-a-date", age: null },
    { bmi: 23.25, cat: "healthy", date: "<img src=x onerror=alert(1)>" }
  ]);
  const app = createCalculator({ initialStorage: saved });

  assert.equal(app.elements["history-count"].textContent, "2 saved");
  assert.match(app.elements["history-list"].innerHTML, /Date unavailable/);
  assert.match(app.elements["history-list"].innerHTML, /23\.3/);
  assert.doesNotMatch(app.elements["history-list"].innerHTML, /<img/);
});

test("storage read errors are reported while the calculator remains usable", () => {
  const app = createCalculator({ getItemError: new Error("blocked") });

  assert.match(app.elements["storage-status"].textContent, /history could not be read/);
  app.submit();
  assert.equal(app.elements.value.textContent, "22.5");
  assert.equal(app.elements["history-count"].textContent, "1 saved");
});

test("storage write errors preserve the visible calculation and report that it was not saved", () => {
  const app = createCalculator({ setItemError: new Error("quota exceeded") });

  app.submit();

  assert.equal(app.elements.value.textContent, "22.5");
  assert.equal(app.elements["history-count"].textContent, "1 saved");
  assert.match(app.elements["storage-status"].textContent, /browser storage is unavailable/);
  assert.equal(app.storedHistory(), null);
});

test("storage removal errors still clear the current history and report persistence failure", () => {
  const app = createCalculator({ removeItemError: new Error("storage disabled") });
  app.submit();

  app.clickClear();

  assert.equal(app.elements["history-count"].textContent, "0 saved");
  assert.match(app.elements["storage-status"].textContent, /History was cleared for this visit/);
});

test("event handlers tolerate repeated switches, reset, and clear interactions", () => {
  const app = createCalculator();

  app.clickUnit("imperial");
  app.clickUnit("imperial");
  app.clickUnit("metric");
  app.clickUnit("metric");
  app.clickReset();
  app.clickReset();
  app.clickClear();
  app.clickClear();

  assert.equal(app.elements.metric.hidden, false);
  assert.equal(app.elements.imperial.hidden, true);
  assert.equal(app.elements.height.value, "170");
  assert.equal(app.elements["history-count"].textContent, "0 saved");
  assert.equal(app.elements.clear.disabled, true);
});
