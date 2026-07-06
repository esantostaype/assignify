/**
 * Search synonym groups for the Icon Library — lets a query like "globe"
 * also surface icons named "Earth" / "World", or "deal" surface
 * "Agreement01Icon", without needing per-icon tags (infeasible to hand-tag
 * ~4,567 vendored icons accurately).  Each inner array is a set of
 * interchangeable terms: searching for ANY term in a group expands the
 * search to EVERY term in that group.
 *
 * This is intentionally broad-but-shallow — general everyday concepts plus
 * the business/insurance vocabulary this app's icons actually get used for.
 * It won't catch everything on day one; add groups as real searches come up
 * empty.  Keep entries lowercase — matching is case-insensitive.
 */
export const SEARCH_SYNONYMS: string[][] = [
  // ── Nature / planet ──────────────────────────────────────────────
  ['globe', 'earth', 'world', 'planet', 'global'],
  ['sun', 'sunny', 'solar', 'daylight'],
  ['moon', 'lunar', 'night'],
  ['star', 'starred', 'favorite', 'favourite'],
  ['cloud', 'weather', 'sky'],
  ['rain', 'rainy', 'shower', 'storm'],
  ['snow', 'snowy', 'winter', 'ice', 'frost'],
  ['wind', 'windy', 'breeze'],
  ['fire', 'flame', 'burn', 'hot'],
  ['water', 'liquid', 'drop', 'droplet'],
  ['mountain', 'hill', 'peak'],
  ['tree', 'plant', 'forest', 'nature', 'leaf'],
  ['flower', 'bloom', 'blossom'],

  // ── Money / finance ──────────────────────────────────────────────
  ['money', 'cash', 'dollar', 'currency', 'coin', 'finance', 'financial'],
  ['bank', 'banking', 'account'],
  ['wallet', 'purse'],
  ['payment', 'pay', 'checkout', 'transaction'],
  ['invoice', 'bill', 'receipt'],
  ['budget', 'expense', 'spending'],
  ['profit', 'revenue', 'earnings', 'income'],
  ['tax', 'taxes'],
  ['loan', 'credit', 'debt', 'mortgage'],
  ['savings', 'save', 'piggy bank'],
  ['exchange', 'convert', 'conversion'],
  ['stock', 'stocks', 'shares', 'trading', 'market'],
  ['investment', 'invest', 'portfolio'],

  // ── Business / legal / insurance ─────────────────────────────────
  ['agreement', 'deal', 'contract', 'handshake', 'negotiation', 'partnership'],
  ['policy', 'coverage', 'insurance'],
  ['claim', 'claims'],
  ['quote', 'quotation', 'estimate', 'proposal'],
  ['document', 'file', 'paper', 'form'],
  ['signature', 'sign', 'signing'],
  ['certificate', 'certification', 'diploma', 'award'],
  ['license', 'licence', 'permit'],
  ['audit', 'inspection', 'review'],
  ['risk', 'hazard', 'danger'],
  ['client', 'customer', 'account holder'],
  ['broker', 'agent', 'representative'],
  ['company', 'business', 'organization', 'corporate', 'enterprise'],
  ['office', 'workplace'],
  ['meeting', 'conference', 'appointment'],
  ['presentation', 'slideshow', 'slides'],
  ['strategy', 'plan', 'planning'],
  ['goal', 'target', 'objective', 'aim'],
  ['growth', 'increase', 'trend up'],
  ['decline', 'decrease', 'trend down', 'drop'],
  ['report', 'summary', 'analysis'],
  ['task', 'todo', 'checklist', 'assignment'],
  ['project', 'workflow'],
  ['deadline', 'due date'],
  ['approval', 'approve', 'accept', 'confirm'],
  ['rejection', 'reject', 'decline', 'deny'],
  ['negotiate', 'bargain'],

  // ── People / identity ─────────────────────────────────────────────
  ['user', 'person', 'profile', 'account', 'member', 'contact'],
  ['team', 'group', 'people', 'staff', 'employee', 'employees'],
  ['manager', 'boss', 'supervisor', 'leader'],
  ['id', 'identity', 'identification', 'badge'],
  ['login', 'signin', 'sign in', 'authentication'],
  ['logout', 'signout', 'sign out'],
  ['register', 'signup', 'sign up', 'enrollment', 'enroll'],
  ['family', 'household'],
  ['baby', 'child', 'kid'],
  ['man', 'male'],
  ['woman', 'female'],
  ['couple', 'relationship'],
  ['friend', 'friends'],

  // ── Communication ──────────────────────────────────────────────
  ['phone', 'call', 'telephone', 'mobile', 'cell', 'dial'],
  ['email', 'mail', 'letter', 'envelope', 'message'],
  ['chat', 'conversation', 'talk', 'discussion'],
  ['notification', 'alert', 'reminder', 'bell'],
  ['share', 'send', 'forward'],
  ['broadcast', 'announcement', 'megaphone'],
  ['contact us', 'support', 'help desk', 'helpdesk'],
  ['feedback', 'comment', 'review'],
  ['question', 'query', 'faq', 'help'],
  ['inbox', 'mailbox'],

  // ── Time ──────────────────────────────────────────────────────────
  ['calendar', 'date', 'schedule', 'event', 'appointment'],
  ['clock', 'time', 'hour', 'timer', 'watch', 'stopwatch'],
  ['history', 'past', 'log', 'timeline'],
  ['future', 'upcoming', 'forecast'],
  ['reminder', 'alarm'],
  ['duration', 'countdown'],

  // ── Files / documents ──────────────────────────────────────────────
  ['folder', 'directory'],
  ['pdf'],
  ['spreadsheet', 'excel', 'xls'],
  ['word', 'doc', 'text document'],
  ['image', 'photo', 'picture', 'photograph'],
  ['attachment', 'clip', 'paperclip'],
  ['archive', 'zip', 'compress'],
  ['backup', 'restore'],
  ['cloud storage', 'drive'],
  ['print', 'printer', 'printing'],
  ['scan', 'scanner'],
  ['clipboard', 'paste'],

  // ── Actions / CRUD ──────────────────────────────────────────────
  ['delete', 'trash', 'remove', 'bin', 'discard'],
  ['edit', 'pencil', 'modify', 'change', 'update', 'write'],
  ['add', 'plus', 'create', 'new', 'insert'],
  ['search', 'find', 'magnify', 'lookup', 'look up', 'zoom'],
  ['filter', 'sort', 'refine'],
  ['settings', 'gear', 'config', 'configuration', 'preferences', 'options'],
  ['download', 'save'],
  ['upload', 'import'],
  ['copy', 'duplicate', 'clone'],
  ['cut'],
  ['undo', 'revert'],
  ['redo'],
  ['refresh', 'reload', 'sync', 'synchronize', 'update'],
  ['expand', 'maximize', 'fullscreen'],
  ['collapse', 'minimize', 'shrink'],
  ['drag', 'move', 'reorder'],
  ['select', 'choose', 'pick'],
  ['toggle', 'switch'],
  ['check', 'checkmark', 'tick', 'done', 'complete', 'success'],
  ['cancel', 'close', 'dismiss', 'exit'],
  ['play', 'start', 'run', 'begin'],
  ['pause', 'stop', 'halt'],
  ['loading', 'progress', 'spinner'],

  // ── Navigation / direction ──────────────────────────────────────
  ['home', 'house', 'main'],
  ['back', 'return', 'previous'],
  ['next', 'forward', 'continue'],
  ['up', 'top', 'ascend'],
  ['down', 'bottom', 'descend'],
  ['left'],
  ['right'],
  ['arrow', 'direction', 'pointer'],
  ['menu', 'hamburger', 'navigation'],
  ['sidebar', 'panel'],
  ['tab', 'tabs'],
  ['breadcrumb'],
  ['link', 'url', 'hyperlink'],
  ['external link', 'open in new'],

  // ── Media ──────────────────────────────────────────────────────────
  ['video', 'movie', 'film', 'clip'],
  ['music', 'audio', 'sound', 'song'],
  ['camera', 'photo', 'photography'],
  ['microphone', 'mic', 'record', 'recording'],
  ['speaker', 'volume', 'loudspeaker'],
  ['mute', 'silent'],
  ['gallery', 'album'],
  ['live', 'streaming', 'stream'],
  ['podcast', 'broadcast'],

  // ── Shopping / commerce ──────────────────────────────────────────
  ['cart', 'basket', 'bag', 'shopping'],
  ['store', 'shop', 'market', 'marketplace', 'storefront'],
  ['product', 'item', 'goods'],
  ['price', 'cost', 'pricing'],
  ['discount', 'coupon', 'sale', 'offer', 'promo'],
  ['delivery', 'shipping', 'package', 'parcel'],
  ['order', 'purchase', 'buy'],
  ['gift', 'present'],
  ['barcode', 'qr code', 'scan code'],

  // ── Tech / devices ──────────────────────────────────────────────
  ['computer', 'desktop', 'pc'],
  ['laptop', 'notebook'],
  ['mobile', 'smartphone', 'device'],
  ['tablet', 'ipad'],
  ['keyboard', 'type', 'typing'],
  ['mouse', 'cursor', 'click'],
  ['wifi', 'internet', 'network', 'connection'],
  ['cloud', 'server', 'hosting'],
  ['database', 'storage', 'data'],
  ['code', 'programming', 'developer', 'software'],
  ['bug', 'error', 'issue', 'problem'],
  ['api', 'integration'],
  ['bluetooth', 'wireless'],
  ['battery', 'power', 'charge', 'charging'],
  ['screen', 'display', 'monitor'],
  ['usb', 'cable', 'plug'],
  ['app', 'application'],
  ['robot', 'ai', 'artificial intelligence', 'automation'],

  // ── Security ──────────────────────────────────────────────────────
  ['lock', 'security', 'password', 'protect', 'secure'],
  ['unlock', 'open', 'access'],
  ['key', 'credentials'],
  ['shield', 'protection', 'safety', 'guard'],
  ['privacy', 'confidential', 'private'],
  ['fingerprint', 'biometric'],
  ['warning', 'caution', 'danger', 'alert'],
  ['error', 'fail', 'failure', 'wrong'],
  ['info', 'information'],
  ['ban', 'block', 'forbidden', 'restricted'],

  // ── Visibility ──────────────────────────────────────────────────
  ['eye', 'view', 'see', 'visibility', 'watch', 'preview'],
  ['hide', 'invisible', 'hidden'],
  ['spy', 'monitor', 'surveillance'],

  // ── Transport ──────────────────────────────────────────────────
  ['car', 'vehicle', 'automobile', 'auto'],
  ['truck', 'lorry'],
  ['plane', 'flight', 'airplane', 'aircraft'],
  ['ship', 'boat', 'vessel'],
  ['train', 'railway', 'railroad'],
  ['bus'],
  ['bike', 'bicycle', 'cycling'],
  ['motorcycle', 'motorbike'],
  ['taxi', 'cab', 'ride'],
  ['fuel', 'gas', 'petrol'],
  ['road', 'street', 'highway'],
  ['traffic'],
  ['parking'],

  // ── Location / maps ──────────────────────────────────────────────
  ['map', 'location', 'pin', 'place', 'gps', 'position'],
  ['navigation', 'route', 'directions', 'compass'],
  ['distance', 'nearby'],
  ['country', 'nation'],
  ['city', 'town'],
  ['flag', 'nationality'],

  // ── Health / medical ──────────────────────────────────────────────
  ['heart', 'health', 'cardiac', 'pulse'],
  ['medical', 'medicine', 'doctor', 'hospital', 'clinic'],
  ['pill', 'medication', 'drug', 'prescription'],
  ['first aid', 'emergency', 'ambulance'],
  ['nurse'],
  ['dna', 'genetics'],
  ['virus', 'bacteria', 'germ'],
  ['mask', 'protection'],
  ['fitness', 'exercise', 'workout', 'gym'],
  ['wheelchair', 'disability', 'accessibility'],
  ['tooth', 'dental', 'dentist'],
  ['brain', 'mind', 'mental'],

  // ── Food / drink ──────────────────────────────────────────────
  ['food', 'meal', 'eat', 'dining', 'restaurant'],
  ['drink', 'beverage'],
  ['coffee', 'cafe', 'espresso'],
  ['tea'],
  ['water bottle', 'hydration'],
  ['fruit', 'apple', 'banana'],
  ['vegetable', 'veggie'],
  ['pizza'],
  ['burger', 'hamburger', 'fast food'],
  ['cake', 'dessert', 'sweet'],
  ['wine', 'alcohol', 'beer'],
  ['kitchen', 'cooking', 'chef'],

  // ── Shapes / basics ──────────────────────────────────────────────
  ['circle', 'round', 'oval'],
  ['square', 'box', 'rectangle'],
  ['triangle'],
  ['grid', 'layout', 'table'],
  ['list', 'bullet', 'items'],
  ['dot', 'point', 'marker'],

  // ── Charts / analytics ──────────────────────────────────────────
  ['chart', 'graph', 'statistics', 'stats', 'analytics'],
  ['pie chart', 'proportion'],
  ['bar chart'],
  ['line chart', 'trend'],
  ['dashboard', 'overview'],
  ['percentage', 'percent', 'ratio'],
  ['funnel', 'pipeline'],

  // ── Social / engagement ──────────────────────────────────────────
  ['like', 'thumbs up', 'upvote'],
  ['dislike', 'thumbs down', 'downvote'],
  ['rating', 'review', 'stars'],
  ['smile', 'happy', 'emoji'],
  ['sad', 'unhappy', 'frown'],
  ['angry', 'mad'],
  ['love', 'heart'],
  ['follow', 'subscribe'],
  ['trophy', 'award', 'winner', 'achievement', 'medal'],

  // ── Weather already covered above; misc nature/animals ────────────
  ['animal', 'pet'],
  ['dog', 'puppy', 'canine'],
  ['cat', 'kitten', 'feline'],
  ['bird'],
  ['fish'],

  // ── Sports / activity ──────────────────────────────────────────
  ['sport', 'sports', 'game', 'athletic'],
  ['ball', 'soccer', 'football', 'basketball'],
  ['run', 'running', 'jog', 'jogging'],
  ['swim', 'swimming', 'pool'],
  ['yoga', 'meditation', 'relax'],

  // ── Buildings / places ──────────────────────────────────────────
  ['building', 'skyscraper', 'tower'],
  ['school', 'university', 'college', 'education'],
  ['bank building'],
  ['factory', 'industrial', 'warehouse'],
  ['church', 'temple', 'religion'],
  ['hotel', 'lodging'],
  ['restaurant building'],
  ['gym building'],
  ['airport'],
  ['store building'],

  // ── Household / objects ──────────────────────────────────────────
  ['bed', 'sleep', 'bedroom'],
  ['chair', 'furniture', 'seat'],
  ['lamp', 'light', 'lighting'],
  ['tool', 'tools', 'wrench', 'hammer', 'repair', 'fix'],
  ['trash can', 'garbage', 'waste'],
  ['umbrella'],
  ['bag', 'backpack', 'luggage', 'suitcase'],
  ['glasses', 'eyewear'],
  ['clothes', 'clothing', 'shirt', 'apparel'],
  ['shoe', 'shoes', 'footwear'],

  // ── Weather icons vs climate (extra) ──────────────────────────────
  ['temperature', 'thermometer'],
  ['recycle', 'recycling', 'eco', 'environment', 'sustainable', 'green'],
];

const groupIndex: Map<string, Set<string>> = (() => {
  const index = new Map<string, Set<string>>();
  for (const group of SEARCH_SYNONYMS) {
    const asSet = new Set(group);
    for (const term of group) index.set(term, asSet);
  }
  return index;
})();

/**
 * Expands a raw search query into every term it should ALSO match — the
 * original query plus every synonym-group it belongs to.  Multi-word
 * queries are expanded word-by-word so "money transfer" still benefits
 * from the "money" group.
 */
export function expandSearchTerms(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const terms = new Set<string>([normalized]);
  for (const word of normalized.split(/\s+/)) {
    const group = groupIndex.get(word);
    if (group) for (const term of group) terms.add(term);
  }
  return [...terms];
}

/**
 * Splits a PascalCase icon name into lowercase words — "AirplaneTakeOff01Icon"
 * → ["airplane", "take", "off01", "icon"].  Matching word-by-word (rather
 * than one long substring) avoids false hits where two adjacent words
 * happen to spell a third: "airplane" + "Takeoff" contains the literal
 * substring "planet" at the join, which a whole-name `.includes()` would
 * wrongly surface for a "globe/planet" search.  Digits stay glued to the
 * word before them so a search for a bare word still prefix-matches
 * "Agreement01" via `.includes()`.
 */
function splitIconWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);
}

const wordsCache = new Map<string, string[]>();
function wordsFor(name: string): string[] {
  let words = wordsCache.get(name);
  if (!words) {
    words = splitIconWords(name);
    wordsCache.set(name, words);
  }
  return words;
}

/**
 * Does `term` match `words` starting exactly at `words[startIdx]`'s own
 * boundary?  Consumes whole words one at a time; the LAST word touched may
 * be a prefix match (so a still-being-typed query like "glob" matches the
 * word "globe").  Requiring the match to start at a boundary — rather than
 * anywhere inside a word — is what tells "discount"+"tag01" (two whole
 * words, legitimately concatenated) apart from "airplane"+"t" (one whole
 * word plus a stray leading fragment of the next): typing "discounttag01"
 * should find `DiscountTag01Icon`, but "planet" must NOT find
 * `AirplaneTakeOff01Icon` just because "airplane" + "Takeoff" happens to
 * spell it at the join.
 */
function matchesFromWordBoundary(words: string[], startIdx: number, term: string): boolean {
  let remaining = term;
  for (let i = startIdx; i < words.length; i++) {
    const word = words[i];
    if (word.length >= remaining.length) return word.startsWith(remaining);
    if (!remaining.startsWith(word)) return false;
    remaining = remaining.slice(word.length);
  }
  return remaining.length === 0;
}

/**
 * True if `name` matches the (already-expanded) search `terms`.  Multi-word
 * synonym phrases ("pie chart") are compacted to "piechart" first — the
 * word-boundary walk above then requires them to appear as consecutive
 * whole words, same as any other term.
 */
export function iconNameMatches(name: string, terms: string[]): boolean {
  const words = wordsFor(name);
  return terms.some((term) => {
    const compact = term.replace(/\s+/g, '');
    return words.some((_, i) => matchesFromWordBoundary(words, i, compact));
  });
}

/** Filters `names` against a raw query — synonym-expanded, word-aware. */
export function filterIconNames(names: readonly string[], query: string): string[] {
  const terms = expandSearchTerms(query);
  if (terms.length === 0) return [...names];
  return names.filter((n) => iconNameMatches(n, terms));
}
