const input = document.getElementById('foodImageInput');
const preview = document.getElementById('previewImage');
const scanStatus = document.getElementById('scanStatus');
const scanResults = document.getElementById('scanResults');
const metrics = document.getElementById('metrics');
const mealResults = document.getElementById('mealResults');
const analyzeBtn = document.getElementById('analyzeBtn');
const generateBtn = document.getElementById('generateBtn');

const hasScanUi = input && preview && scanStatus && scanResults && analyzeBtn;
const hasMealUi = metrics && mealResults && generateBtn;

function appLog(level, message, details) {
  const fn = level === 'error' ? console.error : console.info;
  fn(`[Foodie AI] ${message}`, details || '');
}

window.addEventListener('error', (event) => {
  appLog('error', 'Global error captured', {
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno
  });

  if (typeof event.filename === 'string' && event.filename.startsWith('chrome-extension://')) {
    appLog('info', 'This error comes from a browser extension, not app code.', event.filename);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  appLog('error', 'Unhandled promise rejection', event.reason);
});

let imageDataUrl = '';
if (hasScanUi) {
  appLog('info', 'Scan UI initialized.');
  input.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      imageDataUrl = reader.result;
      preview.src = imageDataUrl;
      preview.hidden = false;
    };
    reader.readAsDataURL(file);
  });
}

function fallbackVisionEstimate() {
  return {
    identified_foods: ['Mixed meal (fallback estimate)'],
    estimated_total_calories: 650,
    macros: { protein_g: 35, carbs_g: 70, fat_g: 25 },
    confidence: 'low',
    notes: 'No API key provided, this is a demo estimate. Add an OpenAI API key for real vision analysis.'
  };
}

async function analyzeWithOpenAI(apiKey, model) {
  const prompt = `Identify foods in this image and estimate nutrition. Return strict JSON with keys: identified_foods (string[]), estimated_total_calories (number), macros {protein_g, carbs_g, fat_g}, confidence (low|medium|high), notes (string).`;
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: imageDataUrl }] }],
      text: { format: { type: 'json_object' } }
    })
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  const raw = data.output_text || '{}';
  return JSON.parse(raw);
}

function renderScan(result) {
  scanResults.innerHTML = `<article class="scan-card">
    <h3>Detected Foods</h3><p>${(result.identified_foods || []).join(', ')}</p>
    <p><strong>Estimated Calories:</strong> ${result.estimated_total_calories ?? 'n/a'} kcal</p>
    <p><strong>Macros:</strong> Protein ${result.macros?.protein_g ?? '?'}g • Carbs ${result.macros?.carbs_g ?? '?'}g • Fat ${result.macros?.fat_g ?? '?'}g</p>
    <p class="rating">Confidence: ${result.confidence || 'unknown'}</p>
    <p>${result.notes || ''}</p>
  </article>`;
}

if (hasScanUi) {
  analyzeBtn.addEventListener('click', async () => {
    if (!imageDataUrl) return (scanStatus.textContent = 'Please upload an image first.');
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('model').value;
    scanStatus.textContent = 'Analyzing image...';
    try {
      const result = apiKey ? await analyzeWithOpenAI(apiKey, model) : fallbackVisionEstimate();
      renderScan(result);
      scanStatus.textContent = 'Analysis complete.';
    } catch (err) {
      scanStatus.textContent = `Analysis failed: ${err.message}. Showing fallback estimate.`;
      renderScan(fallbackVisionEstimate());
    }
  });
}

const mealLibrary = { healthy:[{name:'Grilled Salmon Quinoa Bowl',calories:620,healthRating:9,ingredients:['salmon','quinoa','spinach','tomatoes','olive oil'],recipe:'Omega-3 rich protein bowl.',steps:['Season salmon','Grill salmon','Assemble bowl','Serve']},{name:'Turkey Veggie Stir-Fry',calories:540,healthRating:8,ingredients:['turkey','broccoli','peppers','carrots','brown rice'],recipe:'Lean high-satiety stir-fry.',steps:['Cook turkey','Add veggies','Season','Serve over rice']}], cheat:[{name:'Loaded BBQ Cheeseburger Plate',calories:1050,healthRating:3,ingredients:['beef','brioche bun','cheddar','bbq sauce','wedges'],recipe:'Indulgent high-calorie option.',steps:['Grill patty','Assemble burger','Cook sides','Serve']},{name:'Chicken Alfredo Pasta',calories:980,healthRating:4,ingredients:['pasta','chicken','cream','parmesan'],recipe:'Rich pasta for cheat/bulk days.',steps:['Boil pasta','Cook chicken','Make sauce','Combine']}]};
mealLibrary.mixed=[...mealLibrary.healthy,...mealLibrary.cheat];
const bmi=(h,w)=>w/((h/100)**2); const tdee=({sex,weight,height,age,activity})=>Math.round(((sex==='male')?10*weight+6.25*height-5*age+5:10*weight+6.25*height-5*age-161)*activity);
const infer=(b)=>b<18.5?'gain':b<25?'maintain':'lose'; const target=(base,g)=>g==='lose'?base-450:g==='gain'?base+350:base;
const fit=(meal,goal)=>Math.max(0,100-Math.round((Math.abs(meal-goal/3)/(goal/3))*100));

function renderMeals(meals, daily) {
  mealResults.innerHTML='';
  meals.forEach((m)=>{const s=fit(m.calories,daily); const el=document.createElement('article'); el.className='meal'; el.innerHTML=`<h3>${m.name}</h3><p><strong>Calories:</strong> ${m.calories}</p><p class="rating">Healthiness: ${m.healthRating}/10</p><p><strong>Goal fit:</strong> ${s}/100</p><p>${m.recipe}</p><p><strong>Ingredients:</strong></p><ul>${m.ingredients.map(i=>`<li>${i}</li>`).join('')}</ul><p><strong>Cook instructions:</strong></p><ol>${m.steps.map(i=>`<li>${i}</li>`).join('')}</ol>`; mealResults.appendChild(el);});
}

if (hasMealUi) {
  appLog('info', 'Meal planner UI initialized.');
  generateBtn.addEventListener('click',()=>{
    const height=+document.getElementById('height').value, weight=+document.getElementById('weight').value, age=+document.getElementById('age').value;
    const sex=document.getElementById('sex').value, activity=+document.getElementById('activity').value, goalMode=document.getElementById('goalMode').value;
    const manual=+document.getElementById('manualCalories').value, style=document.getElementById('mealStyle').value;
    if(!height||!weight||!age) return (metrics.textContent='Please fill in height, weight, and age.');
    const b=bmi(height,weight), auto=infer(b), chosen=goalMode==='auto'?auto:goalMode, base=tdee({sex,weight,height,age,activity}), cals=manual||target(base,chosen);
    metrics.innerHTML=`<p><strong>BMI:</strong> ${b.toFixed(1)} (${auto} in auto mode)</p><p><strong>TDEE:</strong> ${base} kcal/day</p><p><strong>Target:</strong> ${cals} kcal/day (${chosen})</p>`;
    const sorted=[...mealLibrary[style]].sort((a,b)=>fit(b.calories,cals)-fit(a.calories,cals)); renderMeals(sorted,cals);
  });
}
