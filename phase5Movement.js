// Late-load modular Divine Right fidelity layers after the legacy scripts have
// installed their final overrides. This avoids coupling the custom scenario to
// board-game-specific rules while keeping the original script order intact.
(function () {
  const files = [
    'navalRules.js',
    'diplomacyAdvanced.js',
    'siegeAdvanced.js',
    'siegeResolution.js',
    'rulesMinorFidelity.js',
    'rulesFidelityCompat.js',
    'rulesLeadershipFidelity.js',
    'specialUnitFidelity.js',
    'magicSpecialFidelity.js',
    'magicCombatCompat.js',
    'combatLeadershipResolution.js'
  ];
  function loadNext(i) {
    if (i >= files.length) return;
    const script = document.createElement('script');
    script.src = files[i];
    script.async = false;
    script.onload = () => loadNext(i + 1);
    script.onerror = () => { console.error(`[rules] Failed to load ${files[i]}`); loadNext(i + 1); };
    document.body.appendChild(script);
  }
  function begin() { loadNext(0); }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', begin, { once: true });
  else begin();
})();
