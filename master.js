/* master.js */

// 1. INJECT THE HTML FRAMEWORK
document.body.insertAdjacentHTML('afterbegin', `
<div class="song-header-container" id="headerContainer"></div>

<div class="controls">
  <label class="toggle-pill"><input type="checkbox" id="showMember" checked onchange="updateView()"> Member</label>
  <label class="toggle-pill"><input type="checkbox" id="showChords" checked onchange="updateView()"> Chords</label>
  <label class="toggle-pill"><input type="checkbox" id="showHangul" checked onchange="updateView()"> Hangul</label>
  <label class="toggle-pill"><input type="checkbox" id="showRoman" checked onchange="updateView()"> Easy Romanized</label>
  <label class="toggle-pill"><input type="checkbox" id="showEnglish" checked onchange="updateView()"> English</label>
  
  <div class="utility-widget" id="transposeWidget">
    <span class="utility-label">KEY:</span>
    <button class="btn-utility" onclick="changeKey(-1)">−</button>
    <span class="utility-val" id="keyOffset">0</span>
    <button class="btn-utility" onclick="changeKey(1)">+</button>
  </div>

  <div class="utility-widget">
    <span class="utility-label">FONT:</span>
    <button class="btn-utility" onclick="changeFontSize(-0.1)">−</button>
    <span class="utility-val" id="fontSizeLabel">100%</span>
    <button class="btn-utility" onclick="changeFontSize(0.1)">+</button>
  </div>
</div>

<div class="lyrics-container" id="lyricsContainer"></div>
<div class="embed-footer-spacer"></div>

<div class="scroll-dock">
  <button class="btn-scroll-toggle" id="scrollBtn" onclick="toggleAutoScroll()">SCROLL</button>
  <div class="utility-widget">
    <span class="utility-label">SPEED:</span>
    <button class="btn-utility" onclick="changeScrollSpeed(-1)">−</button>
    <span class="utility-val" id="scrollSpeedLabel">1</span>
    <button class="btn-utility" onclick="changeScrollSpeed(1)">+</button>
  </div>
</div>

<div class="chord-modal-overlay" id="modalOverlay" onclick="closeChordModal()"></div>
<div class="chord-modal" id="chordModal">
  <div class="chord-modal-title" id="modalTitle">C Major</div>
  <div id="pianoContainer"></div>
</div>
`);

// 2. STATE & CONFIGURATION
let currentKeyOffset = 0;
let currentFontScale = 1.0;
let scrollInterval = null;
let isScrolling = false;
let scrollSpeed = 1;
let activeMemberFilter = null;

const scaleSharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const scaleFlats  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const chordFormulae = {
  '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 
  'maj7': [0, 4, 7, 11], 'sus4': [0, 5, 7], '7sus4': [0, 5, 7, 10], 
  'dim': [0, 3, 6], 'aug': [0, 4, 8], '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9]
};

// 3. FONT & SCROLL FUNCTIONS
function changeFontSize(amount) {
  currentFontScale = Math.max(0.6, Math.min(2.0, currentFontScale + amount));
  document.documentElement.style.setProperty('--base-font-scale', currentFontScale);
  document.getElementById('fontSizeLabel').textContent = Math.round(currentFontScale * 100) + '%';
  updateView(); 
}

function toggleAutoScroll() {
  const btn = document.getElementById('scrollBtn');
  if (isScrolling) {
    clearInterval(scrollInterval);
    btn.textContent = "SCROLL";
    btn.classList.remove('active');
    isScrolling = false;
  } else {
    btn.textContent = "STOP";
    btn.classList.add('active');
    isScrolling = true;
    startScrollEngine();
  }
}

function startScrollEngine() {
  if (scrollInterval) clearInterval(scrollInterval);
  const baseInterval = 60 / scrollSpeed; 
  scrollInterval = setInterval(() => {
    window.scrollBy(0, 1);
    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 2) {
      toggleAutoScroll();
    }
  }, baseInterval);
}

function changeScrollSpeed(amount) {
  scrollSpeed = Math.max(1, Math.min(10, scrollSpeed + amount));
  document.getElementById('scrollSpeedLabel').textContent = scrollSpeed;
  if (isScrolling) startScrollEngine(); 
}

// 4. CHORD DIAGRAM MODAL
function showChordDiagram(chordName) {
  if (!chordName) return;
  const modal = document.getElementById('chordModal');
  const overlay = document.getElementById('modalOverlay');
  const title = document.getElementById('modalTitle');
  const container = document.getElementById('pianoContainer');
  
  title.textContent = chordName;
  
  const chordMatch = chordName.match(/^([A-G][b#]?)(.*)$/);
  if (!chordMatch) return;
  
  let rootNote = chordMatch[1];
  let extension = chordMatch[2];
  
  if (extension.includes('/')) extension = extension.split('/')[0];
  if (extension === 'M') extension = '';
  if (extension === 'min') extension = 'm';
  
  let rootIndex = scaleSharps.indexOf(rootNote);
  if (rootIndex === -1) rootIndex = scaleFlats.indexOf(rootNote);
  
  let activeIntervals = chordFormulae[extension] || chordFormulae['']; 
  let absoluteKeysToHighlight = activeIntervals.map(interval => (rootIndex + interval) % 12);

  const whiteKeyPitches = [0, 2, 4, 5, 7, 9, 11, 0, 2, 4, 5, 7, 9, 11];
  const blackKeysConfig = [
    { pitch: 1, leftOffset: 18 },  { pitch: 3, leftOffset: 48 },  
    { pitch: 6, leftOffset: 108 }, { pitch: 8, leftOffset: 138 }, 
    { pitch: 10, leftOffset: 168 }, { pitch: 1, leftOffset: 228 }, 
    { pitch: 3, leftOffset: 258 }  
  ];

  let svgHtml = `<svg class="keyboard-svg" viewBox="0 0 420 150" xmlns="http://www.w3.org/2000/svg">`;

  for (let i = 0; i < 14; i++) {
    let currentPitch = whiteKeyPitches[i];
    let isLit = absoluteKeysToHighlight.includes(currentPitch);
    let keyColor = isLit ? (currentPitch === rootIndex ? '#8e24aa' : '#ce93d8') : '#ffffff';
    svgHtml += `<rect x="${i * 30}" y="0" width="30" height="150" fill="${keyColor}" stroke="#202124" stroke-width="1.5" rx="2" />`;
  }

  blackKeysConfig.forEach(bk => {
    let isLit = absoluteKeysToHighlight.includes(bk.pitch);
    let keyColor = isLit ? (bk.pitch === rootIndex ? '#6a1b9a' : '#ba68c8') : '#202124';
    svgHtml += `<rect x="${bk.leftOffset}" y="0" width="18" height="95" fill="${keyColor}" stroke="#202124" stroke-width="1" rx="2" />`;
  });

  svgHtml += `</svg>`;
  container.innerHTML = svgHtml;

  modal.style.display = 'block';
  overlay.classList.add('active');
  setTimeout(() => modal.classList.add('active'), 10);
}

function closeChordModal() {
  const modal = document.getElementById('chordModal');
  const overlay = document.getElementById('modalOverlay');
  modal.classList.remove('active');
  overlay.classList.remove('active');
  setTimeout(() => modal.style.display = 'none', 200);
}

// 5. CHORD PROCESSING & TRANSPOSITION
function processInlineChords(text) {
  if (!text) return "";
  
  let processed = text.replace(/\[([A-G][b#]?[^\]]*)\](_+)/g, (match, chord, underscores) => {
    const spaces = '&nbsp;'.repeat(underscores.length);
    return `[${chord}]${spaces}`;
  });
  
  processed = processed.replace(/_/g, '');
  const parts = processed.split('[');
  let result = '';

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    if (i === 0 && part === '') continue;

    if (i === 0 || !part.includes(']')) {
      result += `<span class="chord-segment"><span class="inline-chord empty"></span><span class="lyric-text">${part}</span></span>`;
    } else {
      const splitPart = part.split(']');
      const chord = splitPart[0];
      const lyricText = splitPart.slice(1).join(']');

      let textHtml = '';
      if (lyricText.length > 0) {
        let firstChar = lyricText.charAt(0);
        if (firstChar !== ' ' && !firstChar.startsWith('&')) {
          textHtml = `<span class="highlighted-syllable-marker">${firstChar}</span>${lyricText.slice(1)}`;
        } else {
          textHtml = lyricText;
        }
      }

      result += `<span class="chord-segment"><span class="inline-chord" data-original-chord="${chord}" onclick="showChordDiagram(this.textContent)">${chord}</span><span class="lyric-text">${textHtml}</span></span>`;
    }
  }
  return result;
}

function stripChordTags(htmlStr) {
  const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
  const chords = doc.querySelectorAll('.inline-chord');
  chords.forEach(c => c.remove());
  return doc.body.textContent || "";
}

function changeKey(steps) {
  currentKeyOffset += steps;
  document.getElementById('keyOffset').textContent = (currentKeyOffset > 0 ? '+' : '') + currentKeyOffset;
  const chordElements = document.querySelectorAll('.inline-chord[data-original-chord]');
  chordElements.forEach(el => {
    const original = el.getAttribute('data-original-chord');
    el.textContent = transposeLine(original, currentKeyOffset);
  });
}

function transposeLine(text, steps) {
  if (steps === 0) return text;
  const chordRegex = /[A-G][b#]?/g;
  return text.replace(chordRegex, (match) => shiftNote(match, steps));
}

function shiftNote(note, steps) {
  let index = scaleSharps.indexOf(note);
  if (index === -1) index = scaleFlats.indexOf(note);
  if (index === -1) return note;
  let newIndex = (index + steps) % 12;
  if (newIndex < 0) newIndex += 12;
  return scaleSharps[newIndex];
}

// 6. MEMBER HIGHLIGHT FILTERING ENGINE
function toggleMemberFilter(emoji) {
  if (activeMemberFilter === emoji) {
    activeMemberFilter = null; 
  } else {
    activeMemberFilter = emoji;
  }

  document.querySelectorAll('.member-key-item').forEach(item => {
    if (activeMemberFilter && item.getAttribute('data-emoji') === activeMemberFilter) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  applyMemberFilter();
}

function applyMemberFilter() {
  const blocks = document.querySelectorAll('.line-block');
  blocks.forEach(block => {
    const memberAttr = block.getAttribute('data-member') || "";
    block.classList.remove('member-highlighted', 'member-dimmed');

    if (activeMemberFilter) {
      const isAll = memberAttr.toUpperCase().includes("ALL");
      const isMatch = memberAttr.includes(activeMemberFilter);

      if (isMatch || isAll) {
        block.classList.add('member-highlighted');
      } else {
        block.classList.add('member-dimmed');
      }
    }
  });
}

// 7. SONG DATA PARSER & DOM BUILDER
function buildLyrics() {
  const lyricsContainer = document.getElementById('lyricsContainer');
  const headerContainer = document.getElementById('headerContainer');
  
  if (typeof songData === 'undefined') return;

  let hasMember = false, hasChords = false, hasHangul = false, hasRoman = false, hasEnglish = false;
  let keyString = "";
  let currentMember = ""; // Stores active member across sequential lyric blocks

  const blocks = songData.trim().split(/\n\s*\n/);

  blocks.forEach(blockStr => {
    const lines = blockStr.trim().split('\n');
    let title = "", artist = "";
    let section = "", member = "";
    let hangul = "", roman = "", english = "";

    lines.forEach(l => {
      const line = l.trim();
      if (line.startsWith('Title:')) title = line.replace('Title:', '').trim();
      else if (line.startsWith('Artist:')) artist = line.replace('Artist:', '').trim();
      else if (line.startsWith('Key:') || line.startsWith('K:')) keyString = line.replace(/^(Key:|K:)/, '').trim();
      else if (line.startsWith('S:')) section = line.replace('S:', '').trim();
      else if (line.startsWith('M:')) { member = line.replace('M:', '').trim(); }
      else if (line.startsWith('H:')) { hangul = line.replace('H:', '').trim(); hasHangul = true; }
      else if (line.startsWith('R:')) { roman = line.replace('R:', '').trim(); hasRoman = true; }
      else if (line.startsWith('E:')) { english = line.replace('E:', '').trim(); hasEnglish = true; }
    });

    if (title || artist) {
      if (title) {
        const h1 = document.createElement('h1');
        h1.className = 'song-title';
        h1.textContent = title;
        headerContainer.appendChild(h1);
      }
      if (artist) {
        const h2 = document.createElement('h2');
        h2.className = 'song-artist';
        h2.textContent = artist;
        headerContainer.appendChild(h2);
      }
      return;
    }

    if (section) {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'section-header';
      sectionDiv.textContent = section;
      lyricsContainer.appendChild(sectionDiv);
    }

    // Update active member if M: was specified, otherwise inherit from previous block
    if (member) {
      currentMember = member;
    } else if (hangul || roman || english) {
      member = currentMember;
    }

    if (member) hasMember = true;

    if (member || hangul || roman || english) {
      const blockDiv = document.createElement('div');
      blockDiv.className = 'line-block';
      if (member) blockDiv.setAttribute('data-member', member);

      if (hangul.includes('[') || roman.includes('[') || english.includes('[')) hasChords = true;

      blockDiv.innerHTML = `
        <div class="member-col"></div>
        <div class="content-col">
          ${hangul ? `<div class="lyric-line hangul">${processInlineChords(hangul)}</div>` : ''}
          ${roman ? `<div class="lyric-line romanized">${processInlineChords(roman)}</div>` : ''}
          ${english ? `<div class="lyric-line english">${processInlineChords(english)}</div>` : ''}
        </div>
      `;

      lyricsContainer.appendChild(blockDiv);
    }
  });

  // Render Member Key Legend if provided
  if (keyString) {
    const keyContainer = document.createElement('div');
    keyContainer.className = 'member-key-container';
    keyContainer.id = 'memberKeyContainer';

    const items = keyString.split(/[\|,;]/);
    items.forEach(item => {
      const trimmed = item.trim();
      if (!trimmed) return;

      const parts = trimmed.split('=');
      let emoji = "", name = "";
      if (parts.length === 2) {
        emoji = parts[0].trim();
        name = parts[1].trim();
      } else {
        const firstSpaceIndex = trimmed.search(/\s/);
        if (firstSpaceIndex !== -1) {
          emoji = trimmed.substring(0, firstSpaceIndex).trim();
          name = trimmed.substring(firstSpaceIndex).trim();
        } else {
          emoji = trimmed;
        }
      }

      const keyItem = document.createElement('span');
      keyItem.className = 'member-key-item';
      keyItem.setAttribute('data-emoji', emoji);
      keyItem.onclick = function() { toggleMemberFilter(emoji); };
      keyItem.innerHTML = `<span class="member-key-emoji">${emoji}</span> ${name}`;
      keyContainer.appendChild(keyItem);
    });

    headerContainer.appendChild(keyContainer);
  }

  configurePillVisibility('showMember', hasMember);
  configurePillVisibility('showChords', hasChords);
  configurePillVisibility('showHangul', hasHangul);
  configurePillVisibility('showRoman', hasRoman);
  configurePillVisibility('showEnglish', hasEnglish);
}

function configurePillVisibility(elementId, isPresent) {
  const checkbox = document.getElementById(elementId);
  if (!checkbox) return;
  const pillWrapper = checkbox.closest('.toggle-pill');
  if (isPresent) { checkbox.checked = true; pillWrapper.classList.remove('hidden'); } 
  else { checkbox.checked = false; pillWrapper.classList.add('hidden'); }
}

// 8. VIEW CONTROLLER
function updateView() {
  const memberOn = document.getElementById('showMember').checked;
  const chordsOn = document.getElementById('showChords').checked;
  const hangulOn = document.getElementById('showHangul').checked;
  const romanOn = document.getElementById('showRoman').checked;
  const englishOn = document.getElementById('showEnglish').checked;

  const keyContainer = document.getElementById('memberKeyContainer');
  if (keyContainer) {
    if (memberOn) keyContainer.classList.remove('hidden');
    else {
      keyContainer.classList.add('hidden');
      if (activeMemberFilter) toggleMemberFilter(activeMemberFilter);
    }
  }

  const transWidget = document.getElementById('transposeWidget');
  if (chordsOn && !transWidget.parentNode.querySelector('#showChords').closest('.toggle-pill').classList.contains('hidden')) {
    transWidget.classList.remove('hidden');
  } else {
    transWidget.classList.add('hidden');
  }

  const blocks = document.querySelectorAll('.line-block');
  blocks.forEach(block => {
    const hangulEl = block.querySelector('.hangul');
    const romanEl = block.querySelector('.romanized');
    const englishEl = block.querySelector('.english');

    if (hangulEl) hangulEl.classList.remove('hidden');
    if (romanEl) romanEl.classList.remove('hidden');
    if (englishEl) englishEl.classList.remove('hidden');

    if (hangulEl && !hangulOn) hangulEl.classList.add('hidden');
    if (romanEl && !romanOn) romanEl.classList.add('hidden');
    if (englishEl && !englishOn) englishEl.classList.add('hidden');

    let dynamicSeenTexts = new Set();
    const checkVisibilityPriority = (el, toggleActive) => {
      if (!el || el.classList.contains('hidden')) return;
      if (toggleActive) {
        const rawCleanText = stripChordTags(el.innerHTML).trim();
        if (dynamicSeenTexts.has(rawCleanText) && rawCleanText !== "") {
          el.classList.add('hidden');
        } else {
          dynamicSeenTexts.add(rawCleanText);
        }
      }
    };
    checkVisibilityPriority(hangulEl, hangulOn);
    checkVisibilityPriority(romanEl, romanOn);
    checkVisibilityPriority(englishEl, englishOn);

    let chordRowAssigned = false;
    const targetLines = [hangulEl, romanEl, englishEl];

    targetLines.forEach(el => {
      if (!el || el.classList.contains('hidden')) return;

      const inlineChords = el.querySelectorAll('.inline-chord');
      const highlightedSyllables = el.querySelectorAll('.highlighted-syllable-marker');

      highlightedSyllables.forEach(s => {
        if (chordsOn) s.className = 'highlighted-syllable';
        else s.className = '';
      });

      if (chordsOn && !chordRowAssigned && inlineChords.length > 0) {
        inlineChords.forEach(c => c.classList.remove('hidden'));
        chordRowAssigned = true;
      } else {
        inlineChords.forEach(c => c.classList.add('hidden'));
      }
    });
  });

  updateMemberColumn(memberOn);
  applyMemberFilter();
}

function updateMemberColumn(showMember) {
  const blocks = document.querySelectorAll('.line-block');
  const memberCols = document.querySelectorAll('.member-col');
  let lastMember = "";

  memberCols.forEach(col => {
    if (showMember) col.classList.remove('hidden');
    else col.classList.add('hidden');
  });

  blocks.forEach(block => {
    const currentMember = block.getAttribute('data-member');
    const memberCol = block.querySelector('.member-col');
    memberCol.innerHTML = '';

    if (showMember && currentMember) {
      if (currentMember !== lastMember) {
        const badge = document.createElement('span');
        badge.className = 'member-prefix';
        badge.textContent = currentMember + ':';
        memberCol.appendChild(badge);
        alignBadgeToFirstLyric(block, badge);
      }
      lastMember = currentMember;
    }
  });
}

function alignBadgeToFirstLyric(block, badge) {
  const chordsOn = document.getElementById('showChords').checked;
  const firstVisibleLine = block.querySelector('.lyric-line:not(.hidden)');
  
  if (firstVisibleLine && chordsOn && firstVisibleLine.querySelector('.inline-chord:not(.hidden)')) {
    badge.style.marginTop = (20 * currentFontScale) + 'px'; 
  } else {
    badge.style.marginTop = '0px';
  }
}

// 9. INITIALIZE APPLICATION
buildLyrics();
updateView();
