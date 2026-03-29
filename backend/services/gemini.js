const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

function initGemini() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.log('✨ Gemini AI initialized');
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

// Identify food from an uploaded image using Gemini Vision
async function identifyFoodFromImage(imageBuffer, mimeType) {
  if (model) {
    try {
      const prompt = `Analyze this food item or food label image and respond with ONLY a JSON object (no markdown, no code fences) in this exact format:
{"name": "food name", "category": "best matching category from: Dairy, Produce, Meat, Grains, Canned, Condiments, Frozen, Beverages, Snacks, Other", "estimatedShelfLifeDays": number, "expirationDate": "YYYY-MM-DD or null"}

If this is a food label or packaging:
- Look for text like "Best By", "Best Before", "Use By", "Exp", "BB", "Expires", "Expiry Date" followed by a date
- Extract that expiry date and return it in YYYY-MM-DD format
- For month/year dates (e.g. "03/2026"), use the last day of that month

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
        return JSON.parse(jsonMatch[0]);
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

// Suggest recipes using selected pantry items
// requiredItems: items user explicitly selected (MUST appear in recipe)
// optionalItems: rest of pantry (AI may use these too)
async function generateRecipeSuggestion({ requiredItems, optionalItems } = {}) {
  const required = Array.isArray(requiredItems) ? requiredItems : [];
  const optional = Array.isArray(optionalItems) ? optionalItems : [];

  if (required.length === 0 && optional.length === 0) {
    return '🍽️ Add some items to your pantry first, then come back for recipe ideas!';
  }

  const requiredList = required.map(i => i.name).join(', ');
  const optionalList = optional.map(i => i.name).join(', ');

  // Random variation style hint for each call
  const VARIATIONS = [
    'Consider Mediterranean or Middle Eastern flavor profiles if compatible.',
    'Consider Asian (Japanese, Thai, Chinese) cooking styles if compatible.',
    'Consider a breakfast or brunch angle if ingredients allow.',
    'Consider Latin American or Mexican flavor profiles if compatible.',
    'Consider a comfort food, hearty, warming approach if compatible.'
  ];
  const variationHint = VARIATIONS[Math.floor(Math.random() * VARIATIONS.length)];

  if (model) {
    try {
      const requiredSection = requiredList
        ? `REQUIRED INGREDIENTS (must appear in every recipe): ${requiredList}`
        : '';
      const optionalSection = optionalList
        ? `OPTIONAL PANTRY ITEMS (may use to complement): ${optionalList}`
        : '';

      const prompt = `You are ShelfSage, a home cooking assistant. Generate 2 realistic, edible recipes.

${requiredSection}
${optionalSection}

PRE-PROCESSING — do this silently before generating recipes:
- If any ingredient name is unrecognizable, unclear, or not a real food item, ignore it completely as if it were not listed.
- Classify each remaining ingredient into one of: dairy, protein, grain, fruit, vegetable, condiment, beverage.

COMPATIBILITY RULES — strictly enforced:
- dairy (milk, yogurt, cream, cheese) → smoothies, sauces, soups, desserts, baked goods. NEVER combine raw dairy with raw meat in the same dish.
- fruit (strawberries, apples, berries, banana, mango) → smoothies, desserts, fresh salads. Only combine with savory meat if it is a well-known dish (e.g. mango chicken, apple pork chops).
- bread → sandwiches, toast, French toast, croutons, bread pudding.
- eggs → omelettes, scrambles, fried rice, baking.
- protein / meat (chicken, beef, fish, tofu) → savory only (stir-fry, roast, soup, curry, grill).
- grain (rice, pasta, oats, flour) → base for bowls, soups, baked goods, porridge.
- vegetable → soups, stir-fry, salads, roasted sides, omelettes.
- condiment (soy sauce, olive oil, hot sauce, vinegar) → supporting / seasoning role only, never the main ingredient.

RECIPE RULES:
1. Use 2–5 ingredients per recipe.
2. Only combine COMPATIBLE categories. If required items span incompatible categories (e.g. strawberries + chicken), assign each to a SEPARATE recipe using a valid subset — do NOT mix them.
3. Dish name must clearly reflect the actual ingredients (e.g. "Spinach Egg Scramble", "Strawberry Yogurt Smoothie"). NEVER use generic placeholders like "Quick Bowl", "Pantry Skillet", or "Simple Plate".
4. Only use ingredients from the lists above. The only allowed additions are: water, salt, pepper, cooking oil.
5. Both recipes must be distinctly different dishes (different cooking method or cuisine).
6. ${variationHint}
7. If — after ignoring unrecognized items and applying compatibility rules — no valid recipe is possible, output ONLY the fail-safe.

FAIL-SAFE (output this and NOTHING ELSE when no valid recipe exists):
🍳 Thoughts and Prayers
Ingredients: Nothing!
Instructions:
1. Order in.
⏱️ 0 minutes

OUTPUT FORMAT — follow exactly, no markdown, no bold, no extra blank lines inside a recipe:

🍳 <Dish Name>
Ingredients: <comma-separated>
Instructions:
1. <step>
2. <step>
3. <step>
⏱️ <X> minutes

---

🍳 <Dish Name>
Ingredients: <comma-separated>
Instructions:
1. <step>
2. <step>
3. <step>
⏱️ <X> minutes

The separator between recipes is exactly "---" on its own line. Output nothing outside this format.`;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Recipe generation error:', error.message);
    }
  }

  // Fallback mock when Gemini is unavailable — build something ingredient-specific
  const all = [...required, ...optional];
  if (all.length === 0) {
    return `🍳 Thoughts and Prayers\nIngredients: Nothing!\nInstructions:\n1. Order in.\n⏱️ 0 minutes`;
  }

  const a = required[0] || optional[0];
  const b = required[1] || optional[1];
  const nameA = a.name;
  const nameB = b?.name;
  const pairLabel = nameB ? `${nameA} & ${nameB}` : nameA;

  return `🍳 ${pairLabel} Sauté
Ingredients: ${requiredList || optionalList}
Instructions:
1. Heat a pan over medium heat with a drizzle of oil
2. Add ${nameA} and cook for 3-4 minutes, stirring occasionally
3. ${nameB ? `Add ${nameB} and cook 2 more minutes` : 'Season with salt and pepper'}
4. Serve hot
⏱️ 10 minutes

---

🥗 ${nameA} with ${nameB || 'Seasoning'}
Ingredients: ${nameB ? `${nameA}, ${nameB}` : nameA}
Instructions:
1. Prepare ${nameA} — wash or peel as needed
2. ${nameB ? `Combine with ${nameB}` : 'Season with salt, pepper, and a drizzle of olive oil'}
3. Serve immediately
⏱️ 5 minutes`;
}

module.exports = { initGemini, generateSuggestion, identifyFoodFromImage, generateDashboardSummary, generateRecipeSuggestion };
