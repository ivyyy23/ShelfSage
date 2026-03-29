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

  // Add a random variation token so repeated calls produce different recipes
  const VARIATIONS = [
    'Think globally — consider Mediterranean, Asian, Latin American, or Indian flavor profiles.',
    'Lean into comfort food — hearty, warming, filling dishes.',
    'Keep it light and fresh — salads, wraps, grain bowls, or quick sautés.',
    'Think breakfast or brunch angle if ingredients allow.',
    'Suggest something creative and unexpected that uses these ingredients in a surprising way.'
  ];
  const variationHint = VARIATIONS[Math.floor(Math.random() * VARIATIONS.length)];

  if (model) {
    try {
      const requiredSection = requiredList
        ? `REQUIRED INGREDIENTS (you MUST use ALL of these in every recipe): ${requiredList}`
        : '';
      const optionalSection = optionalList
        ? `OPTIONAL PANTRY ITEMS (you may use any of these to complement the recipe): ${optionalList}`
        : '';

      const prompt = `You are ShelfSage, a creative home cooking assistant. Generate 2 DIFFERENT realistic recipes.

${requiredSection}
${optionalSection}

STRICT RULES:
- Every recipe MUST include ALL required ingredients.
- Do NOT suggest generic filler recipes (e.g., plain stir-fry template). Be specific to the actual ingredients.
- Each recipe must be distinctly different from the other (different cuisine or cooking method).
- ${variationHint}
- Ingredients listed must only come from the provided lists above — no adding unlisted items except basic pantry staples (salt, pepper, water, cooking oil).

For EACH recipe use EXACTLY this format:

🍳 **[Specific Dish Name]**
**Ingredients used:** [comma-separated — only from the lists above]
**Instructions:**
1. [specific step]
2. [specific step]
3. [specific step]
4. [specific step]
⏱️ ~[X] minutes

---

Separate the two recipes with exactly "---" on its own line.`;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Recipe generation error:', error.message);
    }
  }

  // Fallback mock when Gemini is unavailable
  const mainIngredient = required[0]?.name || optional[0]?.name || 'ingredients';
  return `🍳 **${mainIngredient} Skillet**
**Ingredients used:** ${requiredList || optionalList}
**Instructions:**
1. Heat a pan over medium heat and add a drizzle of oil
2. Add ${mainIngredient} and cook for 5 minutes until heated through
3. Season with salt, pepper, and any spices you have
4. Serve hot with bread or rice
⏱️ ~15 minutes

---

🥗 **Quick ${mainIngredient} Bowl**
**Ingredients used:** ${requiredList || optionalList}
**Instructions:**
1. Prepare any grain base (rice, pasta) according to package directions
2. Warm ${mainIngredient} in a pan with a splash of olive oil
3. Combine in a bowl and season to taste
4. Garnish with anything fresh you have available
⏱️ ~20 minutes`;
}

module.exports = { initGemini, generateSuggestion, identifyFoodFromImage, generateDashboardSummary, generateRecipeSuggestion };
