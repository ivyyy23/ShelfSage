const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI      = null;
let model      = null; // general-purpose model (suggestions, vision, summary)
let recipeModel = null; // structured JSON recipe model (gemini-1.5-flash)

// ── System instruction for the recipe model (verbatim from spec) ──────────────
const RECIPE_SYSTEM_INSTRUCTION =
  'You are a Professional Chef API. Create appetizing, logically sound recipes using:\n\n' +
  'Selected Ingredients: (Must include at least one).\n' +
  'Ingredient Pool: (The unselected ingredients; Optional to use these to improve the dish).\n' +
  'Kitchen Essentials: ONLY Salt, Pepper, Water, and Oil. Do NOT assume flour, sugar, or butter unless in the pool.\n' +
  'Equipment: Blender, Oven, Microwave, Toaster, Stovetop, Refrigerator, Steamer, Rice Cooker, Instant Pot.\n' +
  "Quality Rule: Never suggest unappetizing \"literal\" combinations like sautéed milk or milk salad. " +
  'Use culinary techniques like reducing, simmering, or blending to create real dishes ' +
  '(e.g., Bread Pudding, Creamy Pasta, or Emulsified Sauces).';

// ── JSON response schema for two recipes ─────────────────────────────────────
const RECIPE_RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      recipe_name:  { type: 'string', description: 'Specific dish name reflecting the ingredients and style' },
      prep_time:    { type: 'string', description: 'Estimated total cook time, e.g. "20 minutes"' },
      ingredients:  {
        type: 'array',
        items: { type: 'string' },
        description: 'Only ingredients actually used in the recipe. Inline prep descriptors are encouraged, e.g. "diced onion", "grated cheese".'
      },
      instructions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Ordered cooking steps. No trivial prep (washing/peeling). Each step must match the ingredients listed.'
      }
    },
    required: ['recipe_name', 'prep_time', 'ingredients', 'instructions']
  }
};

function initGemini() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // General-purpose model — used for suggestions, vision, and dashboard summary
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Dedicated recipe model — gemini-1.5-flash with system instruction + structured JSON output
    recipeModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: RECIPE_SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RECIPE_RESPONSE_SCHEMA
      }
    });

    console.log('✨ Gemini AI initialized (general: gemini-2.0-flash | recipes: gemini-1.5-flash)');
    return true;
  }
  console.log('⚠️  No Gemini API key found — using mock suggestions');
  return false;
}

// Generate a usage suggestion for a pantry item
async function generateSuggestion(itemName, expirationDate, category) {
  // Try Gemini first
  if (model) {
    try {
      const daysLeft = Math.ceil(
        (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const urgency =
        daysLeft <= 0 ? 'expired today or already past expiration' :
        daysLeft <= 1 ? 'expires tomorrow' :
        daysLeft <= 3 ? `expires in ${daysLeft} days` :
        `still fresh for ${daysLeft} more days`;

      const prompt = `You are ShelfSage, a smart pantry assistant. Give a short, practical suggestion (2-3 sentences max) for using this pantry item:

Item: ${itemName}
Category: ${category}
Status: ${urgency}

Suggest a simple way to use this item today. Be specific with a recipe idea or usage tip. Keep it friendly and concise.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Gemini API error:', error.message);
      return getMockSuggestion(itemName, category);
    }
  }

  return getMockSuggestion(itemName, category);
}

/**
 * Validate that a date string is parseable and in the future.
 * Returns normalised "YYYY-MM-DD" or null.
 */
function validateFutureDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return null;
  return d.toISOString().split('T')[0];
}

// Identify food from an uploaded image using Gemini Vision
async function identifyFoodFromImage(imageBuffer, mimeType) {
  if (model) {
    try {
      const prompt = `Analyze this food item or food label image and respond with ONLY a JSON object (no markdown, no code fences) in this exact format:
{"name": "food name", "category": "best matching category from: Dairy, Produce, Meat, Grains, Canned, Condiments, Frozen, Beverages, Snacks, Other", "estimatedShelfLifeDays": number, "expirationDate": "YYYY-MM-DD or null"}

If this is a food label or packaging:
- Look for text like "Best By", "Best Before", "Use By", "Exp", "BB", "Expires", "Expiry Date" followed by a date
- Extract that expiry date and return it in YYYY-MM-DD format
- For month/year only dates (e.g. "03/2026" or "Mar 2026"), use the 1st day of that month
- The expiry date must be today or in the future — if it is in the past, set "expirationDate" to null

If no expiry date is visible in the image, set "expirationDate" to null.
Be specific about the food item name.`;

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text().trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Validate the returned date — reject past or malformed dates
        parsed.expirationDate = validateFutureDate(parsed.expirationDate);
        return parsed;
      }
      throw new Error('Could not parse Gemini response');
    } catch (error) {
      console.error('Gemini Vision error:', error.message);
      return { name: '', category: 'Other', estimatedShelfLifeDays: 7, expirationDate: null };
    }
  }

  return { name: '', category: 'Other', estimatedShelfLifeDays: 7, expirationDate: null };
}

// Generate a dashboard summary
async function generateDashboardSummary(items) {
  const expiring = items.filter(i => {
    const days = Math.ceil((new Date(i.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 3;
  });

  if (model && expiring.length > 0) {
    try {
      const itemList = expiring.map(i => i.name).join(', ');
      const prompt = `You are ShelfSage, a pantry assistant. Give a brief, friendly 1-2 sentence tip about using these expiring items: ${itemList}. Be practical and encouraging.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Gemini summary error:', error.message);
    }
  }

  if (expiring.length === 0) return 'All your items are fresh! 🌿 No items expiring soon.';
  return `You have ${expiring.length} item${expiring.length > 1 ? 's' : ''} expiring soon. Consider using ${expiring.slice(0, 3).map(i => i.name).join(', ')} today!`;
}

// Mock suggestions when Gemini is unavailable
function getMockSuggestion(itemName, category) {
  const suggestions = {
    'Milk': '🥛 Make a creamy smoothie by blending milk with a banana and a drizzle of honey. Perfect for a quick breakfast!',
    'Yogurt': '🍦 Layer yogurt with granola and fresh berries for a delicious parfait. Great as a snack or light dessert.',
    'Leftover Pasta': '🍝 Reheat and toss with olive oil, garlic, and parmesan for a quick lunch. Add any veggies you have on hand!',
    'Eggs': '🍳 Whisk up a veggie scramble with whatever produce you have. Add cheese for extra flavor!',
    'Bread': '🍞 Make French toast — dip slices in an egg-milk mixture with cinnamon, then pan-fry until golden.',
    'Spinach': '🥬 Sauté with garlic and a splash of lemon juice for a quick side dish. Also great tossed into pasta or omelets.',
    'Chicken Breast': '🍗 Dice and stir-fry with your favorite vegetables and soy sauce for a 15-minute dinner.',
    'Cheese': '🧀 Grate over pasta, melt into a quesadilla, or enjoy sliced with crackers for a snack.',
    'Rice': '🍚 Cook a batch and use for stir-fry bowls, burrito filling, or a simple side dish throughout the week.',
    'Canned Beans': '🫘 Rinse and add to a quick chili, taco filling, or toss into a salad for extra protein.',
    'Pasta': '🍝 Cook al dente and toss with olive oil, cherry tomatoes, and fresh basil for a simple weeknight dinner.',
    'Olive Oil': '🫒 Use as a base for salad dressing — mix with lemon juice, salt, and herbs for a fresh vinaigrette.',
    'Peanut Butter': '🥜 Spread on toast with banana slices, or stir into oatmeal for a protein-packed breakfast.',
    'Frozen Peas': '❄️ Toss frozen peas into pasta in the last minute of cooking, or blend into a quick green soup.',
    'Apples': '🍎 Slice and enjoy with peanut butter, or dice into oatmeal with cinnamon for a warm breakfast.'
  };

  if (suggestions[itemName]) return suggestions[itemName];

  // Generic category-based suggestions
  const categoryDefaults = {
    'Dairy': `🥛 Use your ${itemName} in a recipe today — try adding it to a creamy sauce or enjoying it as a snack.`,
    'Produce': `🥗 Add ${itemName} to a salad, stir-fry, or smoothie before it goes bad. Fresh is best!`,
    'Meat': `🍖 Cook ${itemName} today with simple seasoning — salt, pepper, and garlic go a long way.`,
    'Grains': `🌾 ${itemName} makes a great base for a meal bowl. Cook and pair with your favorite toppings.`,
    'Canned': `🥫 Open and add ${itemName} to soups, stews, or grain bowls for a quick nutrient boost.`,
    'Frozen': `❄️ ${itemName} is great from frozen — add directly to stir-fries, soups, or pasta dishes.`
  };

  return categoryDefaults[category] || `💡 Use your ${itemName} today! Check online for quick recipe ideas with this ingredient.`;
}

/**
 * Map a validated recipe JSON object → the UI string format the frontend renders.
 * Each recipe card in the frontend splits on "\n\n---\n\n" and displays pre-line text.
 *
 * Expected shape: { recipe_name, prep_time, ingredients: string[], instructions: string[] }
 */
function formatRecipeForUI(r) {
  const name         = (r.recipe_name  || 'Recipe').trim();
  const time         = (r.prep_time    || '?').trim();
  const ingredients  = Array.isArray(r.ingredients)  ? r.ingredients  : [];
  const instructions = Array.isArray(r.instructions) ? r.instructions : [];

  const ingredientLine  = ingredients.join(', ')  || 'None';
  const instructionList = instructions
    .map((step, i) => `${i + 1}. ${step.trim()}`)
    .join('\n');

  return [
    `🍳 ${name}`,
    `Ingredients: ${ingredientLine}`,
    `Instructions:`,
    instructionList,
    `⏱️ ${time}`
  ].join('\n');
}

// Cuisine-style hints — rotated per call so repeated requests produce variety
const VARIATIONS = [
  'Lean toward Mediterranean or Middle Eastern flavors where the ingredients allow.',
  'Lean toward Asian flavors (Japanese, Thai, Chinese, Korean) where the ingredients allow.',
  'Consider a breakfast or brunch angle if the ingredients suit it.',
  'Lean toward Latin American or Mexican flavors where the ingredients allow.',
  'Go for classic Western comfort food — hearty, warming, familiar.'
];

// Suggest recipes using selected pantry items.
// requiredItems: user-selected ingredients — at least one must appear in each recipe.
// optionalItems: rest of the pantry — use freely to improve the dish.
async function generateRecipeSuggestion({ requiredItems, optionalItems } = {}) {
  const required = Array.isArray(requiredItems) ? requiredItems : [];
  const optional = Array.isArray(optionalItems) ? optionalItems : [];

  if (required.length === 0 && optional.length === 0) {
    return '🍽️ Add some items to your pantry first, then come back for recipe ideas!';
  }

  const requiredList = required.map(i => i.name).join(', ');
  const optionalList = optional.map(i => i.name).join(', ');
  const variationHint = VARIATIONS[Math.floor(Math.random() * VARIATIONS.length)];

  // ── Gemini 1.5 Flash — structured JSON call ──────────────────────────────
  if (recipeModel) {
    try {
      const userPrompt = [
        'Generate exactly 2 different, appetizing recipes.',
        '',
        requiredList ? `Selected Ingredients (use at least one per recipe): ${requiredList}` : '',
        optionalList ? `Ingredient Pool (optional, use to improve the dish): ${optionalList}`  : '',
        '',
        `Style hint: ${variationHint}`,
        '',
        'Rules:',
        '- Each recipe must use at least one Selected Ingredient.',
        '- Only list ingredients that are actually used in the instructions.',
        '- No trivial prep steps (no "wash", no "peel"). Describe actual cooking.',
        '- If no appetizing recipe is possible, return: recipe_name="Thoughts and Prayers", ingredients=["Nothing!"], instructions=["Order in."], prep_time="0 minutes".'
      ].filter(Boolean).join('\n');

      const result = await recipeModel.generateContent(userPrompt);
      const raw    = result.response.text().trim();

      // Parse and validate the JSON array
      const parsed = JSON.parse(raw);
      const recipes = Array.isArray(parsed) ? parsed : [parsed];

      if (recipes.length === 0) throw new Error('Empty recipe array returned');

      return recipes.map(formatRecipeForUI).join('\n\n---\n\n');

    } catch (error) {
      console.error('Recipe generation error:', error.message);
      // Fall through to mock below
    }
  }

  // ── Offline / API-unavailable fallback ───────────────────────────────────
  const all = [...required, ...optional];
  if (all.length === 0) {
    return formatRecipeForUI({
      recipe_name:  'Thoughts and Prayers',
      prep_time:    '0 minutes',
      ingredients:  ['Nothing!'],
      instructions: ['Order in.']
    });
  }

  const a = required[0] || optional[0];
  const b = required[1] || optional[1];
  const nameA = a.name;
  const nameB = b?.name;

  const mockA = formatRecipeForUI({
    recipe_name:  nameB ? `${nameA} & ${nameB} Sauté` : `Sautéed ${nameA}`,
    prep_time:    '10 minutes',
    ingredients:  nameB ? [nameA, nameB] : [nameA],
    instructions: [
      'Heat a pan over medium heat with a drizzle of oil.',
      `Add ${nameA} and cook for 3–4 minutes, stirring occasionally.`,
      nameB
        ? `Add ${nameB} and cook for 2 more minutes. Season with salt and pepper.`
        : 'Season with salt and pepper. Serve hot.'
    ]
  });

  const mockB = formatRecipeForUI({
    recipe_name:  nameB ? `${nameA} & ${nameB} Salad` : `${nameA} Salad`,
    prep_time:    '5 minutes',
    ingredients:  nameB ? [nameA, nameB] : [nameA],
    instructions: [
      nameB
        ? `Combine ${nameA} and ${nameB} in a bowl.`
        : `Place ${nameA} in a bowl.`,
      'Drizzle with olive oil and season with salt and pepper.',
      'Toss gently and serve immediately.'
    ]
  });

  return `${mockA}\n\n---\n\n${mockB}`;
}

module.exports = { initGemini, generateSuggestion, identifyFoodFromImage, generateDashboardSummary, generateRecipeSuggestion };
