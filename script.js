const input = document.getElementById('foodImageInput');
const preview = document.getElementById('previewImage');
const results = document.getElementById('mealResults');
const metrics = document.getElementById('metrics');

input.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.hidden = false;
});

const mealLibrary = {
  healthy: [
    {
      name: 'Grilled Salmon Quinoa Bowl', calories: 620, healthRating: 9,
      ingredients: ['150g salmon fillet', '1 cup cooked quinoa', 'spinach', 'cherry tomatoes', 'olive oil', 'lemon', 'garlic'],
      recipe: 'A high-protein omega-3 rich bowl with complex carbs and micronutrients.',
      steps: ['Season salmon with garlic, lemon, and pepper.', 'Grill salmon 4-5 mins each side.', 'Assemble quinoa, greens, and tomatoes.', 'Top with salmon and drizzle olive oil.']
    },
    {
      name: 'Turkey Veggie Stir-Fry', calories: 540, healthRating: 8,
      ingredients: ['lean turkey strips', 'broccoli', 'bell pepper', 'carrot', 'soy sauce', 'ginger', 'brown rice'],
      recipe: 'Lean protein stir-fry for satiety and lower-fat macros.',
      steps: ['Cook turkey in pan until browned.', 'Add vegetables and stir-fry 5-6 minutes.', 'Add soy + ginger.', 'Serve over brown rice.']
    }
  ],
  cheat: [
    {
      name: 'Loaded BBQ Cheeseburger Plate', calories: 1050, healthRating: 3,
      ingredients: ['beef patty', 'brioche bun', 'cheddar', 'bbq sauce', 'onion rings', 'potato wedges'],
      recipe: 'High-calorie comfort meal suitable for indulgence or bulking days.',
      steps: ['Grill burger patty to desired doneness.', 'Toast bun and assemble with cheese + sauce.', 'Bake or fry sides.', 'Serve hot with extra sauce.']
    },
    {
      name: 'Creamy Chicken Alfredo Pasta', calories: 980, healthRating: 4,
      ingredients: ['fettuccine', 'chicken breast', 'heavy cream', 'parmesan', 'butter', 'garlic'],
      recipe: 'Rich pasta option with high energy density.',
      steps: ['Cook pasta until al dente.', 'Pan-sear chicken and slice.', 'Make sauce with butter, cream, and parmesan.', 'Combine pasta, sauce, and chicken.']
    }
  ]
};
mealLibrary.mixed = [...mealLibrary.healthy, ...mealLibrary.cheat];

function calculateBmi(heightCm, weightKg) {
  return weightKg / ((heightCm / 100) ** 2);
}

function calculateTdee({ sex, weight, height, age, activity }) {
  const bmr = sex === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
  return Math.round(bmr * activity);
}

function inferGoalFromBmi(bmi) {
  if (bmi < 18.5) return 'gain';
  if (bmi < 25) return 'maintain';
  return 'lose';
}

function targetCalories(baseTdee, goal) {
  if (goal === 'lose') return baseTdee - 450;
  if (goal === 'gain') return baseTdee + 350;
  return baseTdee;
}

function scoreMealFit(mealCalories, goalCalories) {
  const diff = Math.abs(mealCalories - goalCalories / 3);
  return Math.max(0, 100 - Math.round((diff / (goalCalories / 3)) * 100));
}

function renderMeals(meals, dailyCalories) {
  results.innerHTML = '';
  meals.forEach((meal) => {
    const fit = scoreMealFit(meal.calories, dailyCalories);
    const el = document.createElement('article');
    el.className = 'meal';
    el.innerHTML = `
      <h3>${meal.name}</h3>
      <p><strong>Estimated Calories:</strong> ${meal.calories}</p>
      <p class="rating">Healthiness: ${meal.healthRating}/10</p>
      <p><strong>Meal fit score for your goal:</strong> ${fit}/100</p>
      <p><strong>Recipe:</strong> ${meal.recipe}</p>
      <p><strong>Ingredients:</strong></p>
      <ul>${meal.ingredients.map((i) => `<li>${i}</li>`).join('')}</ul>
      <p><strong>Cook instructions:</strong></p>
      <ol>${meal.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    `;
    results.appendChild(el);
  });
}

document.getElementById('generateBtn').addEventListener('click', () => {
  const height = Number(document.getElementById('height').value);
  const weight = Number(document.getElementById('weight').value);
  const age = Number(document.getElementById('age').value);
  const sex = document.getElementById('sex').value;
  const activity = Number(document.getElementById('activity').value);
  const goalMode = document.getElementById('goalMode').value;
  const manualCalories = Number(document.getElementById('manualCalories').value);
  const mealStyle = document.getElementById('mealStyle').value;

  if (!height || !weight || !age) {
    metrics.textContent = 'Please fill in height, weight, and age.';
    return;
  }

  const bmi = calculateBmi(height, weight);
  const autoGoal = inferGoalFromBmi(bmi);
  const chosenGoal = goalMode === 'auto' ? autoGoal : goalMode;
  const tdee = calculateTdee({ sex, weight, height, age, activity });
  const suggestedCalories = manualCalories || targetCalories(tdee, chosenGoal);

  metrics.innerHTML = `
    <p><strong>BMI:</strong> ${bmi.toFixed(1)} (${autoGoal} suggested in auto mode)</p>
    <p><strong>TDEE estimate:</strong> ${tdee} kcal/day</p>
    <p><strong>Daily calorie target:</strong> ${suggestedCalories} kcal/day (${chosenGoal} mode)</p>
  `;

  const pool = mealLibrary[mealStyle];
  const sorted = [...pool].sort((a, b) => scoreMealFit(b.calories, suggestedCalories) - scoreMealFit(a.calories, suggestedCalories));
  renderMeals(sorted, suggestedCalories);
});
