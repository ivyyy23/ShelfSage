const mongoose = require('mongoose');
const Item = require('./models/Item');

// Helper to create dates relative to today
function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 0);
  return d;
}

const demoItems = [
  // RED — expired or expiring today
  {
    name: 'Milk',
    quantity: '1 gallon',
    category: 'Dairy',
    expirationDate: daysFromNow(0),
    aiSuggestion: '🥛 Make a creamy smoothie by blending milk with a banana and a drizzle of honey. Perfect for a quick breakfast!'
  },
  {
    name: 'Yogurt',
    quantity: '2 cups',
    category: 'Dairy',
    expirationDate: daysFromNow(-1),
    aiSuggestion: '🍦 Layer yogurt with granola and fresh berries for a delicious parfait. Great as a snack or light dessert.'
  },
  {
    name: 'Leftover Pasta',
    quantity: '1 container',
    category: 'Grains',
    expirationDate: daysFromNow(0),
    aiSuggestion: '🍝 Reheat and toss with olive oil, garlic, and parmesan for a quick lunch. Add any veggies you have on hand!'
  },

  // YELLOW — expiring in 1-3 days
  {
    name: 'Eggs',
    quantity: '6 eggs',
    category: 'Dairy',
    expirationDate: daysFromNow(2),
    aiSuggestion: '🍳 Whisk up a veggie scramble with whatever produce you have. Add cheese for extra flavor!'
  },
  {
    name: 'Bread',
    quantity: '1 loaf',
    category: 'Grains',
    expirationDate: daysFromNow(1),
    aiSuggestion: '🍞 Make French toast — dip slices in an egg-milk mixture with cinnamon, then pan-fry until golden.'
  },
  {
    name: 'Spinach',
    quantity: '1 bag',
    category: 'Produce',
    expirationDate: daysFromNow(2),
    aiSuggestion: '🥬 Sauté with garlic and a splash of lemon juice for a quick side dish. Also great tossed into pasta or omelets.'
  },
  {
    name: 'Chicken Breast',
    quantity: '2 pieces',
    category: 'Meat',
    expirationDate: daysFromNow(1),
    aiSuggestion: '🍗 Dice and stir-fry with your favorite vegetables and soy sauce for a 15-minute dinner.'
  },
  {
    name: 'Strawberries',
    quantity: '1 pint',
    category: 'Produce',
    expirationDate: daysFromNow(3),
    aiSuggestion: '🍓 Slice into a bowl with a dollop of whipped cream, or blend into a refreshing smoothie with yogurt.'
  },

  // GREEN — safe for 4+ days
  {
    name: 'Cheese',
    quantity: '1 block',
    category: 'Dairy',
    expirationDate: daysFromNow(10),
    aiSuggestion: '🧀 Grate over pasta, melt into a quesadilla, or enjoy sliced with crackers for a snack.'
  },
  {
    name: 'Rice',
    quantity: '2 lbs',
    category: 'Grains',
    expirationDate: daysFromNow(180),
    aiSuggestion: '🍚 Cook a batch and use for stir-fry bowls, burrito filling, or a simple side dish throughout the week.'
  },
  {
    name: 'Canned Beans',
    quantity: '3 cans',
    category: 'Canned',
    expirationDate: daysFromNow(365),
    aiSuggestion: '🫘 Rinse and add to a quick chili, taco filling, or toss into a salad for extra protein.'
  },
  {
    name: 'Pasta',
    quantity: '1 box',
    category: 'Grains',
    expirationDate: daysFromNow(200),
    aiSuggestion: '🍝 Cook al dente and toss with olive oil, cherry tomatoes, and fresh basil for a simple weeknight dinner.'
  },
  {
    name: 'Olive Oil',
    quantity: '1 bottle',
    category: 'Condiments',
    expirationDate: daysFromNow(300),
    aiSuggestion: '🫒 Use as a base for salad dressing — mix with lemon juice, salt, and herbs for a fresh vinaigrette.'
  },
  {
    name: 'Peanut Butter',
    quantity: '1 jar',
    category: 'Condiments',
    expirationDate: daysFromNow(90),
    aiSuggestion: '🥜 Spread on toast with banana slices, or stir into oatmeal for a protein-packed breakfast.'
  },
  {
    name: 'Frozen Peas',
    quantity: '1 bag',
    category: 'Frozen',
    expirationDate: daysFromNow(120),
    aiSuggestion: '❄️ Toss frozen peas into pasta in the last minute of cooking, or blend into a quick green soup.'
  },
  {
    name: 'Apples',
    quantity: '5 apples',
    category: 'Produce',
    expirationDate: daysFromNow(7),
    aiSuggestion: '🍎 Slice and enjoy with peanut butter, or dice into oatmeal with cinnamon for a warm breakfast.'
  }
];

async function seedDatabase(mongoUri) {
  try {
    if (mongoUri) {
      await mongoose.connect(mongoUri);
    }

    const count = await Item.countDocuments();
    if (count > 0) {
      console.log(`📦 Database already has ${count} items — skipping seed`);
      return false;
    }

    await Item.insertMany(demoItems);
    console.log(`🌱 Seeded ${demoItems.length} demo items into database`);
    return true;
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    return false;
  }
}

// Allow running directly: node seed.js
if (require.main === module) {
  require('dotenv').config();
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shelfsage';
  seedDatabase(uri).then(() => {
    mongoose.connection.close();
    process.exit(0);
  });
}

module.exports = { seedDatabase, demoItems };
