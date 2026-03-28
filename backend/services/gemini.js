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
      const prompt = `Analyze this food image and respond with ONLY a JSON object (no markdown, no code fences) in this exact format:
{"name": "food name", "category": "one of: Dairy, Produce, Meat, Grains, Canned, Condiments, Frozen, Beverages, Snacks, Other", "estimatedShelfLifeDays": number}

Be specific about the food item name. Estimate a reasonable shelf life in days.`;

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text().trim();

      // Parse JSON from response, handling possible markdown code fences
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Could not parse Gemini response');
    } catch (error) {
      console.error('Gemini Vision error:', error.message);
      return { name: 'Unknown Food Item', category: 'Other', estimatedShelfLifeDays: 7 };
    }
  }

  return { name: 'Unknown Food Item', category: 'Other', estimatedShelfLifeDays: 7 };
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

// Suggest a recipe using expiring pantry items
async function generateRecipeSuggestion(items) {
  // Prefer expiring items, fall back to any items
  const expiring = items.filter(i => {
    const days = Math.ceil((new Date(i.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 5;
  });
  const pool = expiring.length > 0 ? expiring : items.slice(0, 6);
  const itemList = pool.map(i => i.name).join(', ');

  if (model && pool.length > 0) {
    try {
      const prompt = `You are ShelfSage, a smart pantry assistant. Suggest a simple recipe using some or all of these pantry items that need to be used soon: ${itemList}.

Provide:
1. A catchy recipe name with an emoji
2. Which of the listed ingredients to use
3. Simple 3-5 step instructions
4. Estimated prep + cook time

Keep it practical and beginner-friendly. Be concise but clear.`;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Recipe generation error:', error.message);
    }
  }

  if (pool.length === 0) {
    return '🍽️ Add some items to your pantry first, then come back for recipe ideas!';
  }

  return `🍳 **Quick Pantry Stir-Fry**\n\nUsing: ${itemList}\n\n1. Heat a pan over medium-high heat with a drizzle of oil\n2. Add your protein or main ingredient and cook through\n3. Toss in any vegetables and stir-fry for 3-4 minutes\n4. Season with soy sauce, garlic, or your favorite condiments\n5. Serve over rice or alongside bread\n\n⏱️ Ready in about 15 minutes`;
}

module.exports = { initGemini, generateSuggestion, identifyFoodFromImage, generateDashboardSummary, generateRecipeSuggestion };
