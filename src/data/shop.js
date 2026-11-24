// Dress-up shop: what is for sale and for how many gems 💎.
// The looks themselves are in char.js (options marked shop: true). Prices must match SHOP_PRICES in
// Apps Script Shop.gs — the server is the one that takes the gems.
// Item key = '<character key>:<option id>', e.g. 'hairColor:gold'. RPG outfits are one item for both
// genders: 'body:rpg_warrior' covers the bodies rpg_warrior_boy and rpg_warrior_girl.

export const SHOP_PRICES = {
  'body:rpg_warrior': 3000, 'body:rpg_archer': 3000, 'body:rpg_mage': 3500, 'body:rpg_rogue': 3500,
  'body:rpg_cleric': 4000, 'body:rpg_fighter': 4000, 'body:rpg_bard': 5000,
  'hairColor:mint': 300, 'hairColor:sky': 300, 'hairColor:snow': 400,
  'hairColor:gold': 600, 'hairColor:lava': 800, 'hairColor:galaxy': 1200,
  'shoes:orange': 200, 'shoes:purple': 200, 'shoes:pink': 250, 'shoes:neon': 400, 'shoes:gold': 900,
  'socks:yellow': 200, 'socks:red': 200, 'socks:purple': 200, 'socks:lime': 300,
};

// Shown greyed out as "coming soon" (no art yet): [emoji, name, price]
export const SHOP_SOON = {};

// Item a look belongs to: rpg_warrior_girl → 'body:rpg_warrior'.
export const itemKey = (key, id) => {
  const m = key === 'body' && /^(rpg_[a-z]+)_(boy|girl)$/.exec(id || '');
  return key + ':' + (m ? m[1] : id);
};
export const priceOf = (key, id) => SHOP_PRICES[itemKey(key, id)] || 0;
// Free looks are always yours; shop looks only once bought.
export const ownsLook = (owned, key, id) => !SHOP_PRICES[itemKey(key, id)] || !!owned?.includes(itemKey(key, id));
// The character keys that are wearing something not bought yet.
export const unownedKeys = (owned, cfg) =>
  ['body', 'hair', 'hairColor', 'skin', 'socks', 'shoes'].filter(k => cfg && !ownsLook(owned, k, cfg[k]));
