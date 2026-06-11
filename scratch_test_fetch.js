const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Define API functions locally since we are in node and types/imports might be complex
async function getCard(cardId) {
  const { data: records, error } = await supabase
    .from('electronic_cards')
    .select('*')
    .eq('card_id', cardId)
    .limit(1);

  if (error) throw error;
  return records && records.length ? records[0] : null;
}

async function getComponentInsertionsForCard(cardId) {
  const { data, error } = await supabase
    .from('component_insertions')
    .select('*')
    .eq('card_id', cardId)
    .order('timestamp', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getLoadingPlanForProduct(productId) {
  const { data, error } = await supabase
    .from('loading_plans')
    .select('*')
    .eq('product_id', productId)
    .order('insertion_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function test() {
  try {
    // Let's get all cards in the DB first
    const { data: allCards, error: cardsError } = await supabase
      .from('electronic_cards')
      .select('*');
    
    if (cardsError) throw cardsError;
    console.log('Total electronic_cards in DB:', allCards.length);
    
    if (allCards.length > 0) {
      const card = allCards[0];
      console.log('Testing card:', card.card_id, 'id:', card.id, 'product_id:', card.product_id);
      
      const insertions = await getComponentInsertionsForCard(card.id);
      console.log('Component insertions count:', insertions.length);
      
      const plan = card.product_id ? await getLoadingPlanForProduct(card.product_id) : [];
      console.log('Loading plan count:', plan.length);
      
      const totalInserted = insertions.reduce((a, c) => a + (c.inserted_quantity || 0), 0);
      const totalRequired = plan.reduce((a, p) => a + (p.required_quantity || 0), 0);
      console.log('Total inserted:', totalInserted, 'Total required:', totalRequired);
      
      const progress = totalRequired > 0 ? Math.round((totalInserted / totalRequired) * 100) : 0;
      console.log('Calculated progress:', progress + '%');
    }
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
