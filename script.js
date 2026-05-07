const $ = (id) => document.getElementById(id);
const input = $('foodImageInput');
const preview = $('previewImage');
const scanStatus = $('scanStatus');
const scanResults = $('scanResults');
const metrics = $('metrics');
const mealResults = $('mealResults');

let imageDataUrl = '';
input?.addEventListener('change', (e) => {
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

function safeParseJSON(maybeJson, fallback) {
  try { return JSON.parse(maybeJson); } catch { return fallback; }
}

function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const txt = data?.output?.flatMap((o) => o?.content || []).find((c) => c?.type === 'output_text')?.text;
  return typeof txt === 'string' ? txt : '';
}

async function callOpenAI({ apiKey, model, input }) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 220)}`);
  }
  return res.json();
}

function fallbackVisionEstimate() {
  return { identified_foods: ['Spaghetti with meat sauce'], estimated_total_calories: 780, macros: { protein_g: 28, carbs_g: 92, fat_g: 31 }, confidence: 'low', notes: 'Fallback estimate. Add API key for real vision analysis.' };
}

async function analyzeWithOpenAI(apiKey, model) {
  const prompt = `Analyze this food photo. Return ONLY valid JSON with: identified_foods(string[]), estimated_total_calories(number), macros{protein_g(number),carbs_g(number),fat_g(number)}, confidence("low"|"medium"|"high"), notes(string).`;
  const data = await callOpenAI({
    apiKey,
    model,
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: imageDataUrl }] }]
  });
  const parsed = safeParseJSON(extractOutputText(data), null);
  if (!parsed || !Array.isArray(parsed.identified_foods)) throw new Error('Model returned non-JSON or unexpected format.');
  return parsed;
}

function renderScan(result) {
  scanResults.innerHTML = `<article class="scan-card"><h3>Detected Foods</h3><p>${(result.identified_foods || []).join(', ')}</p><p><strong>Estimated Calories:</strong> ${result.estimated_total_calories ?? 'n/a'} kcal</p><p><strong>Macros:</strong> Protein ${result.macros?.protein_g ?? '?'}g • Carbs ${result.macros?.carbs_g ?? '?'}g • Fat ${result.macros?.fat_g ?? '?'}g</p><p class="rating">Confidence: ${result.confidence || 'unknown'}</p><p>${result.notes || ''}</p></article>`;
}

$('analyzeBtn')?.addEventListener('click', async () => {
  if (!imageDataUrl) return (scanStatus.textContent = 'Please upload an image first.');
  const apiKey = $('apiKey').value.trim();
  const model = $('model').value;
  scanStatus.textContent = 'Analyzing image...';
  try {
    const result = apiKey ? await analyzeWithOpenAI(apiKey, model) : fallbackVisionEstimate();
    renderScan(result);
    scanStatus.textContent = apiKey ? 'Analysis complete.' : 'Analysis complete (fallback mode).';
  } catch (err) {
    scanStatus.textContent = `Analysis failed: ${err.message}`;
    renderScan(fallbackVisionEstimate());
  }
});

function bmi(h,w){ return w/((h/100)**2); }
function tdee({sex,weight,height,age,activity}){ const bmr=(sex==='male')?10*weight+6.25*height-5*age+5:10*weight+6.25*height-5*age-161; return Math.round(bmr*activity); }
function inferGoal(b){ return b<18.5?'gain':b<25?'maintain':'lose'; }
function targetCalories(base,g){ return g==='lose'?base-450:g==='gain'?base+350:base; }
function fit(meal,goal){ return Math.max(0,100-Math.round((Math.abs(meal-goal/3)/(goal/3))*100)); }

function fallbackMeals(style) {
  const healthy=[{name:'Salmon Quinoa Bowl',calories:620,health_rating:9,ingredients:['salmon','quinoa','spinach'],recipe:'Protein + complex carbs bowl',instructions:['Grill salmon','Cook quinoa','Assemble bowl']}];
  const cheat=[{name:'Cheeseburger Plate',calories:980,health_rating:3,ingredients:['beef','bun','cheese','potatoes'],recipe:'High-calorie comfort meal',instructions:['Cook patty','Assemble burger','Bake fries']}];
  if (style==='healthy') return healthy; if (style==='cheat') return cheat; return [...healthy,...cheat];
}

async function generateAIMeals({apiKey,model,style,calories,goal,bmiValue}) {
  const prompt = `Create 3 ${style} meal suggestions for a user goal=${goal}, bmi=${bmiValue.toFixed(1)}, daily_calorie_target=${calories}. Return ONLY JSON array. Each item keys: name, calories(number), health_rating(1-10), ingredients(string[]), recipe(string), instructions(string[]).`;
  const data = await callOpenAI({ apiKey, model, input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }] });
  const meals = safeParseJSON(extractOutputText(data), null);
  if (!Array.isArray(meals)) throw new Error('Meal planner JSON format was invalid.');
  return meals;
}

function renderMeals(meals,daily){
  mealResults.innerHTML='';
  meals.forEach((m)=>{const score=fit(m.calories||600,daily);const el=document.createElement('article');el.className='meal';el.innerHTML=`<h3>${m.name}</h3><p><strong>Calories:</strong> ${m.calories}</p><p class="rating">Healthiness: ${m.health_rating}/10</p><p><strong>Goal fit:</strong> ${score}/100</p><p>${m.recipe}</p><p><strong>Ingredients:</strong></p><ul>${(m.ingredients||[]).map(i=>`<li>${i}</li>`).join('')}</ul><p><strong>Cook instructions:</strong></p><ol>${(m.instructions||[]).map(i=>`<li>${i}</li>`).join('')}</ol>`;mealResults.appendChild(el);});
}

$('generateBtn')?.addEventListener('click', async ()=>{
  const height=+$('height').value, weight=+$('weight').value, age=+$('age').value;
  if(!height||!weight||!age) return (metrics.textContent='Please fill in height, weight, and age.');
  const sex=$('sex').value, activity=+$('activity').value, goalMode=$('goalMode').value, manual=+$('manualCalories').value, style=$('mealStyle').value;
  const b=bmi(height,weight), auto=inferGoal(b), chosen=goalMode==='auto'?auto:goalMode, base=tdee({sex,weight,height,age,activity}), cals=manual||targetCalories(base,chosen);
  metrics.innerHTML=`<p><strong>BMI:</strong> ${b.toFixed(1)} (${auto} in auto mode)</p><p><strong>TDEE:</strong> ${base} kcal/day</p><p><strong>Target:</strong> ${cals} kcal/day (${chosen})</p>`;

  const apiKey = $('apiKey').value.trim();
  const model = $('model').value;
  try {
    mealResults.innerHTML = '<p>Generating AI meals...</p>';
    const meals = apiKey ? await generateAIMeals({apiKey,model,style,calories:cals,goal:chosen,bmiValue:b}) : fallbackMeals(style);
    renderMeals(meals,cals);
  } catch (err) {
    mealResults.innerHTML = `<p>AI meal planning failed: ${err.message}. Showing fallback meals.</p>`;
    renderMeals(fallbackMeals(style),cals);
  }
});
