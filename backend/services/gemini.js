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

COMPATIBILITY RULES — follow these strictly:
- Dairy (milk, yogurt, cream, cheese) → use in sauces, smoothies, desserts, baked goods, soups. Do NOT fry dairy with raw meat.
- Fruits (strawberries, apples, berries, banana) → desserts, smoothies, salads. Do NOT cook fruit with savory meat unless it's a known dish (e.g. chicken mango).
- Bread → sandwiches, toast, French toast, croutons.
- Eggs → omelettes, scrambles, baking, fried rice.
- Chicken / meat → savory dishes only (stir-fry, roast, soup, curry).
- Grains (rice, pasta, oats) → bowls, soups, baked goods.
- Vegetables → soups, stir-fry, salads, roasted sides.
- Condiments → supporting role only (seasoning, sauce base).

RECIPE RULES:
1. Each recipe must use 2–5 ingredients total.
2. Only combine COMPATIBLE ingredient categories. If required ingredients are incompatible with each other (e.g. strawberries + raw chicken), put them in SEPARATE recipes using valid subsets.
3. Every recipe name must be specific to the actual ingredients (not generic like "Quick Bowl" or "Pantry Skillet").
4. Do NOT add ingredients not in the provided lists (except water, salt, pepper, cooking oil).
5. Each recipe must be a different dish (different method or cuisine).
6. ${variationHint}
7. If no valid recipe can be made from ANY combination of the ingredients, output ONLY the fail-safe below.

FAIL-SAFE (use ONLY if truly no edible combination exists):
🍳 Thoughts and Prayers
Ingredients: Nothing!
Instructions:
1. Order in.
⏱️ 0 minutes

OUTPUT FORMAT — use EXACTLY this format for each recipe, no markdown bold, no extra lines:

🍳 <Specific Dish Name>
Ingredients: <comma-separated list — only from above>
Instructions:
1. <step>
2. <step>
3. <step>
⏱️ <X> minutes

---

Separate the two recipes with exactly "---" on its own line. Output nothing else.`;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Recipe generation error:', error.message);
    }
  }

  // Fallback mock when Gemini is unavailable
  const mainIngredient = required[0]?.name || optional[0]?.name || 'your ingredients';
  return `🍳 ${mainIngredient} Scramble
Ingredients: ${(required[0]?.name || optional[0]?.name) || 'pantry items'}
Instructions:
1. Heat a pan over medium heat with a little oil
2. Add ${mainIngredient} and cook through, stirring gently
3. Season with salt and pepper to taste
⏱️ 10 minutes

---

🥗 Simple ${mainIngredient} Plate
Ingredients: ${requiredList || optionalList}
Instructions:
1. Prepare ${mainIngredient} according to your preference
2. Combine with any complementary items you have
3. Serve and enjoy
⏱️ 15 minutes`;
}

module.exports = { initGemini, generateSuggestion, identifyFoodFromImage, generateDashboardSummary, generateRecipeSuggestion };
